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
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { INFINITE } from "../config/chains";
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
        `預け先を読み込めませんでした：${e instanceof Error ? e.message : String(e)}`,
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
      setValError("数量を確認してください。");
      return null;
    }
    if (!selectedValidator) {
      setValError("預け先を選んでください。");
      return null;
    }
    const labels = {
      delegate: "42を預ける",
      undelegate: "預けた42を引き出す",
      redelegate: "預け先を変更する",
    } as const;
    return {
      title: labels[action],
      chain: INFINITE,
      lines: [
        { label: "アクション", value: labels[action] },
        {
          label: "預け先",
          value: `${selectedValidator.moniker}`,
        },
        { label: "バリデータアドレス", value: selectedValidator.valoper },
        ...(action === "redelegate"
          ? [{ label: "新しい預け先", value: dstValoper }]
          : []),
        { label: "数量", value: `${stakeAmount} 42` },
        { label: "コントラクト", value: STAKING_PRECOMPILE },
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
    title: "報酬を受け取る",
    chain: INFINITE,
    lines: [
      { label: "アクション", value: "報酬の受け取り" },
      { label: "コントラクト", value: DISTRIBUTION_PRECOMPILE },
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
      setSt42Error("預ける数量を確認してください。");
      return null;
    }
    return {
      title: "st42に預ける",
      chain: INFINITE,
      lines: [
        { label: "アクション", value: "42を預けてst42を受け取る" },
        { label: "数量", value: `${depositAmount} 42` },
        {
          label: "現在レート",
          value: st42?.rate ? `1 st42 ≈ ${st42.rate.toFixed(4)} 42` : "—",
        },
        { label: "コントラクト", value: ST42_ADDRESS },
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
      setSt42Error("引き出す数量を確認してください。");
      return null;
    }
    return {
      title: "st42 引き出しの申し込み",
      chain: INFINITE,
      lines: [
        { label: "アクション", value: "引き出しの申し込み" },
        { label: "数量", value: `${redeemShares} st42` },
        {
          label: "受け取れるまで",
          value: st42?.unbondingDays
            ? `約${st42.unbondingDays.toFixed(0)}日`
            : "—",
        },
        { label: "コントラクト", value: ST42_ADDRESS },
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
      setSt42Error("引き出す数量を確認してください。");
      return null;
    }
    const rate = st42?.rate ?? 1;
    const estOut = Number(exitShares) * rate;
    const minOut = parseUnits((estOut * 0.99).toFixed(18), 18);
    return {
      title: "st42 すぐ引き出す",
      chain: INFINITE,
      lines: [
        { label: "アクション", value: "すぐ引き出す（手数料あり）" },
        { label: "数量", value: `${exitShares} st42` },
        {
          label: "受取見込み（手数料前）",
          value: `≈ ${estOut.toFixed(6)} 42`,
        },
        {
          label: "最悪でも受け取れる量",
          value: `${formatUnits(minOut, 18)} 42`,
        },
        { label: "コントラクト", value: ST42_ADDRESS },
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
      setSt42Error("整理券の番号を確認してください。");
      return null;
    }
    return {
      title: "st42 受け取り",
      chain: INFINITE,
      lines: [
        { label: "アクション", value: "受け取り" },
        { label: "整理券の番号", value: ticketIdText },
        {
          label: "状態",
          value: ticket
            ? ticket.claimed
              ? "受け取り済み"
              : ticket.epochFinalized
                ? "受け取れます"
                : "まだ受け取れません"
            : "未確認",
        },
        { label: "コントラクト", value: ST42_ADDRESS },
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
        `整理券を確認できませんでした：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <Screen embedded={embedded}>
      {embedded ? null : <Title>ステーキング</Title>}
      <PrototypeWarning />
      {modal}

      <Card>
        <Heading>ステーキング（42）</Heading>
        <Body>42を預けて報酬をもらえます。</Body>
        {valError ? <Text style={styles.errorText}>{valError}</Text> : null}
        {validators ? (
          <>
            <Body>
              預け先は {validatorTotal ?? validators.length} 件から選べます。
            </Body>
            <View style={styles.list}>
              {validators.slice(0, 30).map((v) => (
                <Text key={v.valoper} style={styles.validatorLine}>
                  • {v.moniker}
                  {v.jailed ? "（お休み中）" : ""} — みんなの預け額{" "}
                  {prettyAmount(v.tokensFormatted)} 42
                </Text>
              ))}
            </View>
            <Body>預け先</Body>
            <ChipPicker
              options={validators.map((v) => ({
                key: v.valoper,
                label: v.moniker,
              }))}
              value={selectedValoper}
              onChange={setSelectedValoper}
            />
            <Body>新しい預け先</Body>
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
              placeholder="数量（42）"
              keyboardType="decimal-pad"
            />
            <PercentChips
              onSelect={(pct) => apply42Percent(setStakeAmount, 300000n, pct)}
              disabled={native42Raw === null}
            />
            <Body>
              残高に対する割合で選べます（MAXのときは手数料分を残します）。
              引き出すときは、預けている量が上限です。
            </Body>
            <PrimaryButton
              label="預ける"
              onPress={() => {
                const job = stakingJob("delegate");
                if (job) startTx(job);
              }}
            />
            <PrimaryButton
              label="引き出す"
              onPress={() => {
                const job = stakingJob("undelegate");
                if (job) startTx(job);
              }}
            />
            <PrimaryButton
              label="預け先を変更する"
              onPress={() => {
                const job = stakingJob("redelegate");
                if (job) startTx(job);
              }}
            />
            <PrimaryButton
              label="報酬を受け取る"
              onPress={() => startTx(claimRewardsJob())}
            />
            <Body>
              引き出すときは、約21日待つ必要があります。
            </Body>
          </>
        ) : (
          <PrimaryButton
            label="預け先を読み込む"
            onPress={loadValidators}
            loading={valLoading}
          />
        )}
        {!wallet.info ? (
          <Body>預けたり引き出したりには、ウォレットの作成／インポートが必要です。</Body>
        ) : null}
      </Card>

      <Card>
        <Heading>st42</Heading>
        <Body>42を預けるとst42がもらえます。預けた分は増えて戻ります。</Body>
        {st42 ? (
          <>
            <InfoRow
              label="今のレート"
              value={
                st42.rate
                  ? `1 st42 ≈ ${st42.rate.toFixed(4)} 42${st42.rateFresh === false ? "（少し前の値かもしれません）" : ""}`
                  : "取得不可"
              }
            />
            <InfoRow
              label="みんなの預け額"
              value={
                st42.totalAssetsFormatted
                  ? `${prettyAmount(st42.totalAssetsFormatted)} 42`
                  : "—"
              }
            />
            <InfoRow
              label="年利"
              value="未取得"
            />
            <InfoRow
              label="引き出しにかかる日数"
              value={
                st42.unbondingDays
                  ? `約${st42.unbondingDays.toFixed(0)}日`
                  : "—"
              }
            />
            <InfoRow
              label="あなたのst42"
              value={
                st42.yourSharesFormatted
                  ? `${prettyAmount(st42.yourSharesFormatted)} st42`
                  : "ウォレットがありません"
              }
            />
            {st42.depositsPaused ? (
              <Text style={styles.errorText}>
                現在、預け入れは一時停止中です。
              </Text>
            ) : null}
          </>
        ) : (
          <Body>読み込み中…</Body>
        )}
        {st42Error ? <Text style={styles.errorText}>{st42Error}</Text> : null}
        <PrimaryButton label="更新" onPress={loadSt42} />
        <Field
          value={depositAmount}
          onChangeText={setDepositAmount}
          placeholder="預ける数量（42）"
          keyboardType="decimal-pad"
        />
        <PercentChips
          onSelect={(pct) => apply42Percent(setDepositAmount, 400000n, pct)}
          disabled={native42Raw === null}
        />
        <PrimaryButton
          label="42を預ける"
          onPress={() => {
            const job = st42DepositJob();
            if (job) startTx(job);
          }}
        />
        <Field
          value={redeemShares}
          onChangeText={setRedeemShares}
          placeholder="引き出す数量（st42）"
          keyboardType="decimal-pad"
        />
        <PercentChips
          onSelect={(pct) =>
            applySharesPercent(setRedeemShares, st42?.yourShares ?? null, pct)
          }
          disabled={!st42?.yourShares}
        />
        <PrimaryButton
          label="引き出しを申し込む"
          onPress={() => {
            const job = st42RedeemJob();
            if (job) startTx(job);
          }}
        />
        <Body>
          申し込むと「整理券（チケット）」が出ます。番号を控えてください。
          約21日たったら、下のボタンで受け取れます。
        </Body>
        <Field
          value={exitShares}
          onChangeText={setExitShares}
          placeholder="すぐ引き出す数量（st42・手数料あり）"
          keyboardType="decimal-pad"
        />
        <PercentChips
          onSelect={(pct) =>
            applySharesPercent(setExitShares, st42?.yourShares ?? null, pct)
          }
          disabled={!st42?.yourShares}
        />
        <PrimaryButton
          label="すぐ引き出す"
          onPress={() => {
            const job = st42InstantExitJob();
            if (job) startTx(job);
          }}
        />
        <Field
          value={ticketIdText}
          onChangeText={setTicketIdText}
          placeholder="整理券の番号"
          keyboardType="decimal-pad"
        />
        <PrimaryButton label="整理券を確認" onPress={handleCheckTicket} />
        {ticket ? (
          <Body>
            数量 {ticket.sharesFormatted} st42
            {"\n"}
            {ticket.claimed
              ? `受け取り済み（${ticket.claimedAmountFormatted} 42）`
              : ticket.epochFinalized
                ? "受け取れます"
                : ticket.epochFinalized === false
                  ? "まだ受け取れません"
                  : "状態がわかりません"}
          </Body>
        ) : null}
        <PrimaryButton
          label="受け取る"
          onPress={() => {
            const job = st42ClaimJob();
            if (job) startTx(job);
          }}
        />
      </Card>

      <Card>
        <Heading>ステーキング（QOM）</Heading>
        <Body>
          QOMのステーキングは、このアプリではまだ使えません（準備中です）。
          {wallet.info
            ? `あなたのQL1用アドレス: ${wallet.info.qomAddress}`
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
