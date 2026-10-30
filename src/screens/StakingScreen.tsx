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
  bondStatusLabel,
  fetchSt42State,
  fetchTicket,
  fetchValidators,
  getSt42Vault,
  type St42State,
  type TicketInfo,
  type ValidatorInfo,
} from "../lib/protocol";
import { estimateOrFallback, gasCostNative, sendAndWait } from "../lib/tx";

export default function StakingScreen() {
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
        `バリデータ一覧の取得に失敗しました：${e instanceof Error ? e.message : String(e)}`,
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
      setValError("委任数量を確認してください。");
      return null;
    }
    if (!selectedValidator) {
      setValError("バリデータを選んでください。");
      return null;
    }
    const labels = {
      delegate: "委任（デリゲート）",
      undelegate: "委任解除（アンデリゲート）",
      redelegate: "再委任（リデリゲート）",
    } as const;
    return {
      title: labels[action],
      chain: INFINITE,
      lines: [
        { label: "アクション", value: labels[action] },
        {
          label: "バリデータ",
          value: `${selectedValidator.moniker}`,
        },
        { label: "バリデータアドレス", value: selectedValidator.valoper },
        ...(action === "redelegate"
          ? [{ label: "再委任先", value: dstValoper }]
          : []),
        { label: "数量", value: `${stakeAmount} 42` },
        { label: "コントラクト", value: `${STAKING_PRECOMPILE}（ステーキングプリコンパイル）` },
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
    title: "ステーキング報酬を請求",
    chain: INFINITE,
    lines: [
      { label: "アクション", value: "報酬請求（claimRewards）" },
      { label: "コントラクト", value: `${DISTRIBUTION_PRECOMPILE}（配布プリコンパイル）` },
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
      setSt42Error("預け入れる数量を確認してください。");
      return null;
    }
    return {
      title: "st42に預け入れ",
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
      setSt42Error("出金申請するシェア数量を確認してください。");
      return null;
    }
    return {
      title: "st42 出金申請",
      chain: INFINITE,
      lines: [
        { label: "アクション", value: "出金申請（requestRedeem）→ チケット発行" },
        { label: "シェア", value: `${redeemShares} st42` },
        {
          label: "アンボンディング目安",
          value: st42?.unbondingDays
            ? `約${st42.unbondingDays.toFixed(0)}日 + エポック処理`
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
      setSt42Error("即時出金するシェア数量を確認してください。");
      return null;
    }
    const rate = st42?.rate ?? 1;
    const estOut = Number(exitShares) * rate;
    const minOut = parseUnits((estOut * 0.99).toFixed(18), 18);
    return {
      title: "st42 即時出金",
      chain: INFINITE,
      lines: [
        { label: "アクション", value: "即時出金（instantExit・手数料あり）" },
        { label: "シェア", value: `${exitShares} st42` },
        {
          label: "受取見込み（手数料前）",
          value: `≈ ${estOut.toFixed(6)} 42`,
        },
        {
          label: "最小受取",
          value: `${formatUnits(minOut, 18)} 42（1%スリッページ）`,
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
      setSt42Error("チケットIDを確認してください。");
      return null;
    }
    return {
      title: "st42 出金請求",
      chain: INFINITE,
      lines: [
        { label: "アクション", value: "出金請求（claim）" },
        { label: "チケットID", value: ticketIdText },
        {
          label: "チケット状態",
          value: ticket
            ? `epoch ${ticket.epoch} / ${ticket.claimed ? "請求済み" : ticket.epochFinalized ? "確定済み" : "未確定"}`
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
        `チケットを取得できませんでした：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <Screen>
      <Title>ステーキング</Title>
      <PrototypeWarning />
      {modal}

      <Card>
        <Heading>42 ステーキング（Infinite・プリコンパイル）</Heading>
        {valError ? <Text style={styles.errorText}>{valError}</Text> : null}
        {validators ? (
          <>
            <Body>
              バリデータ {validatorTotal ?? validators.length} 件（Bonded）。
              プリコンパイル 0x0800 は稼働中です。
            </Body>
            <View style={styles.list}>
              {validators.slice(0, 30).map((v) => (
                <Text key={v.valoper} style={styles.validatorLine}>
                  • {v.moniker}
                  {v.jailed ? "（jailed）" : ""} —{" "}
                  {bondStatusLabel(v.status)} / 委任総額{" "}
                  {prettyAmount(v.tokensFormatted)} 42
                </Text>
              ))}
            </View>
            <Body>委任先</Body>
            <ChipPicker
              options={validators.map((v) => ({
                key: v.valoper,
                label: v.moniker,
              }))}
              value={selectedValoper}
              onChange={setSelectedValoper}
            />
            <Body>再委任先</Body>
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
              割合チップはウォレットの42残高が基準です（MAX時はガス代を残します）。
              委任解除・再委任では委任中の数量が上限になります。
            </Body>
            <PrimaryButton
              label="委任する"
              onPress={() => {
                const job = stakingJob("delegate");
                if (job) startTx(job);
              }}
            />
            <PrimaryButton
              label="委任解除する"
              onPress={() => {
                const job = stakingJob("undelegate");
                if (job) startTx(job);
              }}
            />
            <PrimaryButton
              label="再委任する"
              onPress={() => {
                const job = stakingJob("redelegate");
                if (job) startTx(job);
              }}
            />
            <PrimaryButton
              label="報酬を請求する"
              onPress={() => startTx(claimRewardsJob())}
            />
            <Body>
              委任解除にはアンボンディング期間（約21日）があります。再委任は
              委任先を変更する操作です。
            </Body>
          </>
        ) : (
          <PrimaryButton
            label="バリデータ一覧を取得"
            onPress={loadValidators}
            loading={valLoading}
          />
        )}
        {!wallet.info ? (
          <Body>委任操作にはウォレットの作成／インポートが必要です。</Body>
        ) : null}
      </Card>

      <Card>
        <Heading>st42（リキッドステーキング）</Heading>
        {st42 ? (
          <>
            <InfoRow
              label="交換レート"
              value={
                st42.rate
                  ? `1 st42 ≈ ${st42.rate.toFixed(4)} 42${st42.rateFresh === false ? "（古い可能性）" : ""}`
                  : "取得不可"
              }
            />
            <InfoRow
              label="総預かり資産"
              value={
                st42.totalAssetsFormatted
                  ? `${prettyAmount(st42.totalAssetsFormatted)} 42`
                  : "—"
              }
            />
            <InfoRow
              label="アンボンディング"
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
                  : "アドレス未設定"
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
        <PrimaryButton label="状態を更新" onPress={loadSt42} />
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
          label="42を預けてst42を受け取る"
          onPress={() => {
            const job = st42DepositJob();
            if (job) startTx(job);
          }}
        />
        <Field
          value={redeemShares}
          onChangeText={setRedeemShares}
          placeholder="出金申請する数量（st42）"
          keyboardType="decimal-pad"
        />
        <PercentChips
          onSelect={(pct) =>
            applySharesPercent(setRedeemShares, st42?.yourShares ?? null, pct)
          }
          disabled={!st42?.yourShares}
        />
        <PrimaryButton
          label="出金を申請する（チケット発行）"
          onPress={() => {
            const job = st42RedeemJob();
            if (job) startTx(job);
          }}
        />
        <Body>
          出金申請で発行されるチケットIDは、トランザクションのイベント
          （RedeemRequested）に含まれます。エポック確定後に請求できます。
        </Body>
        <Field
          value={exitShares}
          onChangeText={setExitShares}
          placeholder="即時出金する数量（st42・手数料あり）"
          keyboardType="decimal-pad"
        />
        <PercentChips
          onSelect={(pct) =>
            applySharesPercent(setExitShares, st42?.yourShares ?? null, pct)
          }
          disabled={!st42?.yourShares}
        />
        <PrimaryButton
          label="即時出金する"
          onPress={() => {
            const job = st42InstantExitJob();
            if (job) startTx(job);
          }}
        />
        <Field
          value={ticketIdText}
          onChangeText={setTicketIdText}
          placeholder="チケットID"
          keyboardType="decimal-pad"
        />
        <PrimaryButton label="チケットを確認" onPress={handleCheckTicket} />
        {ticket ? (
          <Body>
            所有者 {ticket.owner.slice(0, 10)}… / シェア {ticket.sharesFormatted}
            {"\n"}epoch {ticket.epoch} /{" "}
            {ticket.claimed
              ? `請求済み（${ticket.claimedAmountFormatted} 42）`
              : ticket.epochFinalized
                ? "確定済み（請求可能）"
                : ticket.epochFinalized === false
                  ? "未確定（まだ請求できません）"
                  : "状態不明"}
          </Body>
        ) : null}
        <PrimaryButton
          label="出金を請求する（claim）"
          onPress={() => {
            const job = st42ClaimJob();
            if (job) startTx(job);
          }}
        />
      </Card>

      <Card>
        <Heading>QOM ステーキング（QL1）</Heading>
        <Body>
          QL1のバリデータ委任は公式手順では Cosmos トランザクション方式で、
          Cosmos署名経路はまだ接続していません（情報不足／TODO）。
          {wallet.info
            ? `あなたのQL1アドレス: ${wallet.info.qomAddress}`
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
