import { Contract, formatUnits, parseUnits } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTxFlow, type TxJob } from "../components/ConfirmTx";
import {
  Body,
  ChipPicker,
  Field,
  Heading,
  InfoRow,
  PercentChips,
  PrimaryButton,
} from "../components/controls";
import { Card, Screen, Title, colors } from "../components/ui";
import { INFINITE } from "../config/chains";
import { useI18n } from "../context/LanguageContext";
import { tr } from "../i18n";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";
import {
  nativeGasReserve,
  percentOfBalance,
  prettyAmount,
} from "../lib/onchain";
import {
  DISTRIBUTION_ABI,
  DISTRIBUTION_PRECOMPILE,
  STAKING_ABI,
  STAKING_PRECOMPILE,
  ST42_ADDRESS,
  fetchSt42State,
  fetchTicket,
  fetchValidators,
  getSt42Vault,
  type St42State,
  type TicketInfo,
  type ValidatorInfo,
} from "../lib/protocol";
import { estimateOrFallback, gasCostNative, sendAndWait } from "../lib/tx";

export default function StakingScreen({
  embedded,
}: {
  /** Rendered inside the DeFi tab (no own Title / scroll container). */
  embedded?: boolean;
} = {}) {
  const wallet = useWallet();
  const { t } = useI18n();
  const balances = useBalances();
  const { startTx, modal } = useTxFlow();
  const address = wallet.info?.evmAddress ?? null;

  /** Own-wallet native 42 balance (raw), for percentage chips. */
  const native42 = balances.tokenResults?.find(
    (t) => t.ok && t.balance.chainKey === "infinite" && t.balance.address === null,
  );
  const native42Raw =
    native42 && native42.ok ? native42.balance.raw : null;

  const apply42Percent = async (
    setter: (v: string) => void,
    gasLimit: bigint,
    pct: number,
  ) => {
    if (native42Raw === null) return;
    const reserve =
      pct === 100 ? await nativeGasReserve(INFINITE, gasLimit) : 0n;
    setter(percentOfBalance(native42Raw, pct, 18, reserve));
  };

  const applySharesPercent = (
    setter: (v: string) => void,
    shares: bigint | null,
    pct: number,
  ) => {
    if (shares === null) return;
    setter(percentOfBalance(shares, pct, 18));
  };

  const [validators, setValidators] = useState<ValidatorInfo[] | null>(null);
  const [validatorTotal, setValidatorTotal] = useState<number | null>(null);
  const [valError, setValError] = useState<string | null>(null);
  const [valLoading, setValLoading] = useState(false);
  const [selectedValoper, setSelectedValoper] = useState<string>("");
  const [dstValoper, setDstValoper] = useState<string>("");
  const [stakeAmount, setStakeAmount] = useState("");

  const [st42, setSt42] = useState<St42State | null>(null);
  const [st42Error, setSt42Error] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [redeemShares, setRedeemShares] = useState("");
  const [exitShares, setExitShares] = useState("");
  const [ticketIdText, setTicketIdText] = useState("");
  const [ticket, setTicket] = useState<TicketInfo | null>(null);

  const loadValidators = useCallback(async () => {
    setValLoading(true);
    setValError(null);
    try {
      const res = await fetchValidators();
      setValidators(res.validators);
      setValidatorTotal(res.total);
      if (res.validators.length > 0) {
        setSelectedValoper((cur) => cur || res.validators[0].valoper);
        setDstValoper(
          (cur) => cur || res.validators[res.validators.length - 1].valoper,
        );
      }
    } catch (e) {
      setValError(
        `${tr("stake.loadValidatorsFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setValLoading(false);
    }
  }, []);

  const loadSt42 = useCallback(async () => {
    try {
      setSt42(await fetchSt42State(address));
    } catch (e) {
      setSt42Error(e instanceof Error ? e.message : String(e));
    }
  }, [address]);

  useEffect(() => {
    loadValidators();
    loadSt42();
  }, [loadValidators, loadSt42]);

  const selectedValidator = validators?.find(
    (v) => v.valoper === selectedValoper,
  );

  const stakingJob = (
    action: "delegate" | "undelegate" | "redelegate",
  ): TxJob | null => {
    let amount: bigint;
    try {
      amount = parseUnits(stakeAmount, 18);
      if (amount <= 0n) throw new Error("zero");
    } catch {
      setValError(t("err.checkAmount"));
      return null;
    }
    if (!selectedValidator) {
      setValError(t("stake.selectValidator"));
      return null;
    }
    const labels = {
      delegate: t("stake.delegate"),
      undelegate: t("stake.undelegate"),
      redelegate: t("stake.redelegate"),
    } as const;
    return {
      title: labels[action],
      chain: INFINITE,
      lines: [
        { label: t("label.action"), value: labels[action] },
        {
          label: t("label.validator"),
          value: `${selectedValidator.moniker}`,
        },
        { label: t("label.validatorAddress"), value: selectedValidator.valoper },
        ...(action === "redelegate"
          ? [{ label: t("label.newValidator"), value: dstValoper }]
          : []),
        { label: t("label.amount"), value: `${stakeAmount} 42` },
        { label: t("label.contract"), value: STAKING_PRECOMPILE },
      ],
      prepare: async (signer) => {
        const delegator = await signer.getAddress();
        const precompile = new Contract(
          STAKING_PRECOMPILE,
          STAKING_ABI,
          signer,
        ) as any;
        const data =
          action === "delegate"
            ? precompile.interface.encodeFunctionData("delegate", [
                delegator,
                selectedValidator.valoper,
                amount,
              ])
            : action === "undelegate"
              ? precompile.interface.encodeFunctionData("undelegate", [
                  delegator,
                  selectedValidator.valoper,
                  amount,
                ])
              : precompile.interface.encodeFunctionData("redelegate", [
                  delegator,
                  selectedValidator.valoper,
                  dstValoper,
                  amount,
                ]);
        const tx = { to: STAKING_PRECOMPILE, data };
        const gas = await estimateOrFallback(signer, tx, 300000n);
        return {
          gasEstimateText: await gasCostNative(signer, gas, "42"),
          send: async () => [await sendAndWait(signer, tx)],
        };
      },
    };
  };

  const claimRewardsJob = (): TxJob => ({
    title: t("stake.claimTitle"),
    chain: INFINITE,
    lines: [
      { label: t("label.action"), value: t("job.claimRewardsAction") },
      { label: t("label.contract"), value: DISTRIBUTION_PRECOMPILE },
    ],
    prepare: async (signer) => {
      const delegator = await signer.getAddress();
      const dist = new Contract(
        DISTRIBUTION_PRECOMPILE,
        DISTRIBUTION_ABI,
        signer,
      ) as any;
      const tx = {
        to: DISTRIBUTION_PRECOMPILE,
        data: dist.interface.encodeFunctionData("claimRewards", [delegator, 50]),
      };
      const gas = await estimateOrFallback(signer, tx, 300000n);
      return {
        gasEstimateText: await gasCostNative(signer, gas, "42"),
        send: async () => [await sendAndWait(signer, tx)],
      };
    },
  });

  const st42DepositJob = (): TxJob | null => {
    let value: bigint;
    try {
      value = parseUnits(depositAmount, 18);
      if (value <= 0n) throw new Error("zero");
    } catch {
      setSt42Error(t("stake.errCheckDepositAmount"));
      return null;
    }
    return {
      title: t("st42.jobDepositTitle"),
      chain: INFINITE,
      lines: [
        { label: t("label.action"), value: t("st42.jobDepositAction") },
        { label: t("label.amount"), value: `${depositAmount} 42` },
        {
          label: t("label.currentRate"),
          value: st42?.rate ? `1 st42 ≈ ${st42.rate.toFixed(4)} 42` : "—",
        },
        { label: t("label.contract"), value: ST42_ADDRESS },
      ],
      prepare: async (signer) => {
        const vault = getSt42Vault(signer);
        const tx = {
          to: ST42_ADDRESS,
          value,
          data: vault.interface.encodeFunctionData("deposit", []),
        };
        const gas = await estimateOrFallback(signer, tx, 400000n);
        return {
          gasEstimateText: await gasCostNative(signer, gas, "42"),
          send: async () => [await sendAndWait(signer, tx)],
        };
      },
    };
  };

  const st42RedeemJob = (): TxJob | null => {
    let shares: bigint;
    try {
      shares = parseUnits(redeemShares, 18);
      if (shares <= 0n) throw new Error("zero");
    } catch {
      setSt42Error(t("stake.errCheckWithdrawAmount"));
      return null;
    }
    return {
      title: t("st42.jobRedeemTitle"),
      chain: INFINITE,
      lines: [
        { label: t("label.action"), value: t("st42.redeemButton") },
        { label: t("label.amount"), value: `${redeemShares} st42` },
        {
          label: t("label.waitTime"),
          value: st42?.unbondingDays
            ? `${t("st42.daysPrefix")}${st42.unbondingDays.toFixed(0)}${t("st42.daysSuffix")}`
            : "—",
        },
        { label: t("label.contract"), value: ST42_ADDRESS },
      ],
      prepare: async (signer) => {
        const vault = getSt42Vault(signer);
        const tx = {
          to: ST42_ADDRESS,
          data: vault.interface.encodeFunctionData("requestRedeem", [shares]),
        };
        const gas = await estimateOrFallback(signer, tx, 400000n);
        return {
          gasEstimateText: await gasCostNative(signer, gas, "42"),
          send: async () => [await sendAndWait(signer, tx)],
        };
      },
    };
  };

  const st42InstantExitJob = (): TxJob | null => {
    let shares: bigint;
    try {
      shares = parseUnits(exitShares, 18);
      if (shares <= 0n) throw new Error("zero");
    } catch {
      setSt42Error(t("stake.errCheckWithdrawAmount"));
      return null;
    }
    const rate = st42?.rate ?? 1;
    const estOut = Number(exitShares) * rate;
    const minOut = parseUnits((estOut * 0.99).toFixed(18), 18);
    return {
      title: t("st42.jobExitTitle"),
      chain: INFINITE,
      lines: [
        { label: t("label.action"), value: t("st42.jobExitAction") },
        { label: t("label.amount"), value: `${exitShares} st42` },
        {
          label: t("label.receiveEstBeforeFee"),
          value: `≈ ${estOut.toFixed(6)} 42`,
        },
        {
          label: t("label.receiveMinAlt"),
          value: `${formatUnits(minOut, 18)} 42`,
        },
        { label: t("label.contract"), value: ST42_ADDRESS },
      ],
      prepare: async (signer) => {
        const vault = getSt42Vault(signer);
        const tx = {
          to: ST42_ADDRESS,
          data: vault.interface.encodeFunctionData("instantExit", [
            shares,
            minOut,
          ]),
        };
        const gas = await estimateOrFallback(signer, tx, 400000n);
        return {
          gasEstimateText: await gasCostNative(signer, gas, "42"),
          send: async () => [await sendAndWait(signer, tx)],
        };
      },
    };
  };

  const st42ClaimJob = (): TxJob | null => {
    let ticketId: bigint;
    try {
      ticketId = BigInt(ticketIdText);
    } catch {
      setSt42Error(t("stake.errCheckTicket"));
      return null;
    }
    return {
      title: t("st42.jobClaimTitle"),
      chain: INFINITE,
      lines: [
        { label: t("label.action"), value: t("st42.claimButton") },
        { label: t("label.ticketId"), value: ticketIdText },
        {
          label: t("label.status"),
          value: ticket
            ? ticket.claimed
              ? t("st42.statusClaimed")
              : ticket.epochFinalized
                ? t("st42.statusReady")
                : t("st42.statusNotYet")
            : t("st42.unchecked"),
        },
        { label: t("label.contract"), value: ST42_ADDRESS },
      ],
      prepare: async (signer) => {
        const vault = getSt42Vault(signer);
        const tx = {
          to: ST42_ADDRESS,
          data: vault.interface.encodeFunctionData("claim", [ticketId]),
        };
        const gas = await estimateOrFallback(signer, tx, 400000n);
        return {
          gasEstimateText: await gasCostNative(signer, gas, "42"),
          send: async () => [await sendAndWait(signer, tx)],
        };
      },
    };
  };

  const handleCheckTicket = async () => {
    setSt42Error(null);
    try {
      setTicket(await fetchTicket(BigInt(ticketIdText)));
    } catch (e) {
      setTicket(null);
      setSt42Error(
        `${t("st42.checkTicketFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <Screen embedded={embedded}>
      {embedded ? null : <Title>{t("defi.staking")}</Title>}
      {modal}

      <Card>
        <Heading>{t("stake.heading42")}</Heading>
        <Body>{t("stake.body42")}</Body>
        {valError ? <Text style={styles.errorText}>{valError}</Text> : null}
        {validators ? (
          <>
            <Body>
              {t("stake.validatorsPrefix")}{validatorTotal ?? validators.length}{t("stake.validatorsSuffix")}
            </Body>
            <View style={styles.list}>
              {validators.slice(0, 30).map((v) => (
                <Text key={v.valoper} style={styles.validatorLine}>
                  • {v.moniker}
                  {v.jailed ? t("stake.jailed") : ""} — {t("stake.totalStaked")}{" "}
                  {prettyAmount(v.tokensFormatted)} 42
                </Text>
              ))}
            </View>
            <Body>{t("label.validator")}</Body>
            <ChipPicker
              options={validators.map((v) => ({
                key: v.valoper,
                label: v.moniker,
              }))}
              value={selectedValoper}
              onChange={setSelectedValoper}
            />
            <Body>{t("label.newValidator")}</Body>
            <ChipPicker
              options={validators.map((v) => ({
                key: v.valoper,
                label: v.moniker,
              }))}
              value={dstValoper}
              onChange={setDstValoper}
            />
            <Field
              value={stakeAmount}
              onChangeText={setStakeAmount}
              placeholder={t("stake.amountPlaceholder42")}
              keyboardType="decimal-pad"
            />
            <PercentChips
              onSelect={(pct) => apply42Percent(setStakeAmount, 300000n, pct)}
              disabled={native42Raw === null}
            />
            <Body>
              {t("stake.percentNote")}
            </Body>
            <PrimaryButton
              label={t("stake.depositBtn")}
              onPress={() => {
                const job = stakingJob("delegate");
                if (job) startTx(job);
              }}
            />
            <PrimaryButton
              label={t("stake.undelegateBtn")}
              onPress={() => {
                const job = stakingJob("undelegate");
                if (job) startTx(job);
              }}
            />
            <PrimaryButton
              label={t("stake.redelegate")}
              onPress={() => {
                const job = stakingJob("redelegate");
                if (job) startTx(job);
              }}
            />
            <PrimaryButton
              label={t("stake.claimTitle")}
              onPress={() => startTx(claimRewardsJob())}
            />
            <Body>
              {t("stake.unbondingNote")}
            </Body>
          </>
        ) : (
          <PrimaryButton
            label={t("stake.loadValidators")}
            onPress={loadValidators}
            loading={valLoading}
          />
        )}
        {!wallet.info ? (
          <Body>{t("lp.needWallet")}</Body>
        ) : null}
      </Card>

      <Card>
        <Heading>st42</Heading>
        <Body>{t("st42.body")}</Body>
        {st42 ? (
          <>
            <InfoRow
              label={t("st42.rateLabel")}
              value={
                st42.rate
                  ? `1 st42 ≈ ${st42.rate.toFixed(4)} 42${st42.rateFresh === false ? t("st42.rateStaleSuffix") : ""}`
                  : t("common.unavailable")
              }
            />
            <InfoRow
              label={t("stake.totalStaked")}
              value={
                st42.totalAssetsFormatted
                  ? `${prettyAmount(st42.totalAssetsFormatted)} 42`
                  : "—"
              }
            />
            <InfoRow
              label={t("st42.apy")}
              value={t("common.notAvailable")}
            />
            <InfoRow
              label={t("st42.unbondingDays")}
              value={
                st42.unbondingDays
                  ? `${t("st42.daysPrefix")}${st42.unbondingDays.toFixed(0)}${t("st42.daysSuffix")}`
                  : "—"
              }
            />
            <InfoRow
              label={t("st42.yours")}
              value={
                st42.yourSharesFormatted
                  ? `${prettyAmount(st42.yourSharesFormatted)} st42`
                  : t("common.noWallet")
              }
            />
            {st42.depositsPaused ? (
              <Text style={styles.errorText}>
                {t("st42.pausedNote")}
              </Text>
            ) : null}
          </>
        ) : (
          <Body>{t("common.loading")}</Body>
        )}
        {st42Error ? <Text style={styles.errorText}>{st42Error}</Text> : null}
        <PrimaryButton label={t("common.refresh")} onPress={loadSt42} />
        <Field
          value={depositAmount}
          onChangeText={setDepositAmount}
          placeholder={t("st42.depositPlaceholder")}
          keyboardType="decimal-pad"
        />
        <PercentChips
          onSelect={(pct) => apply42Percent(setDepositAmount, 400000n, pct)}
          disabled={native42Raw === null}
        />
        <PrimaryButton
          label={t("stake.delegate")}
          onPress={() => {
            const job = st42DepositJob();
            if (job) startTx(job);
          }}
        />
        <Field
          value={redeemShares}
          onChangeText={setRedeemShares}
          placeholder={t("st42.redeemPlaceholder")}
          keyboardType="decimal-pad"
        />
        <PercentChips
          onSelect={(pct) =>
            applySharesPercent(setRedeemShares, st42?.yourShares ?? null, pct)
          }
          disabled={!st42?.yourShares}
        />
        <PrimaryButton
          label={t("st42.redeemButton")}
          onPress={() => {
            const job = st42RedeemJob();
            if (job) startTx(job);
          }}
        />
        <Body>
          {t("st42.ticketNote")}
        </Body>
        <Field
          value={exitShares}
          onChangeText={setExitShares}
          placeholder={t("st42.instantPlaceholder")}
          keyboardType="decimal-pad"
        />
        <PercentChips
          onSelect={(pct) =>
            applySharesPercent(setExitShares, st42?.yourShares ?? null, pct)
          }
          disabled={!st42?.yourShares}
        />
        <PrimaryButton
          label={t("st42.instantButton")}
          onPress={() => {
            const job = st42InstantExitJob();
            if (job) startTx(job);
          }}
        />
        <Field
          value={ticketIdText}
          onChangeText={setTicketIdText}
          placeholder={t("label.ticketId")}
          keyboardType="decimal-pad"
        />
        <PrimaryButton label={t("st42.checkTicket")} onPress={handleCheckTicket} />
        {ticket ? (
          <Body>
            {t("label.amount")} {ticket.sharesFormatted} st42
            {"\n"}
            {ticket.claimed
              ? `${t("st42.claimedPrefix")}${ticket.claimedAmountFormatted} 42${t("st42.claimedSuffix")}`
              : ticket.epochFinalized
                ? t("st42.statusReady")
                : ticket.epochFinalized === false
                  ? t("st42.statusNotYet")
                  : t("st42.statusUnknown")}
          </Body>
        ) : null}
        <PrimaryButton
          label={t("st42.claimButton")}
          onPress={() => {
            const job = st42ClaimJob();
            if (job) startTx(job);
          }}
        />
      </Card>

      <Card>
        <Heading>{t("qomStaking.heading")}</Heading>
        <Body>
          {t("qomStaking.body")}
          {wallet.info
            ? `${t("qomStaking.addressPrefix")}${wallet.info.qomAddress}`
            : ""}
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  list: { gap: 2 },
  validatorLine: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
