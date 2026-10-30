import { formatUnits, parseUnits } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useTxFlow } from "./ConfirmTx";
import {
  Body,
  Field,
  Heading,
  InfoRow,
  PercentChips,
  PrimaryButton,
} from "./controls";
import { Card, colors } from "./ui";
import { useWallet } from "../context/WalletContext";
import { percentOfBalance, prettyAmount } from "../lib/onchain";
import {
  fetchFlukeRecord,
  fetchFlukeState,
  fetchGuideItem,
  fetchSettleSignature,
  fetchStarlightState,
  flukeBoostJob,
  flukeCommitJob,
  flukeRevealJob,
  flukeSettleJob,
  starlightClaimJob,
  starlightRegisterJob,
  type FlukeRecord,
  type FlukeState,
  type GuideItemState,
  type StarlightState,
} from "../lib/zaphod";

/**
 * Fluke + Starlight, run natively in-app against The Guide contract
 * itself (research/ZAPHOD_FRONTEND.md). No external site, no
 * WalletConnect. settle is the one step that needs a signature issued
 * by the official API — until the API serves one, the UI honestly
 * stays in the「公式APIの署名待ち」state.
 */
export default function FlukeSection() {
  const wallet = useWallet();
  const address = wallet.info?.evmAddress ?? null;
  const { startTx, modal } = useTxFlow();

  const [fluke, setFluke] = useState<FlukeState | null>(null);
  const [starlight, setStarlight] = useState<StarlightState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [itemIdText, setItemIdText] = useState("");
  const [item, setItem] = useState<GuideItemState | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [boostAmount, setBoostAmount] = useState("");

  const [recordIdText, setRecordIdText] = useState("");
  const [record, setRecord] = useState<FlukeRecord | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [sigState, setSigState] = useState<
    "idle" | "fetching" | "found" | "missing"
  >("idle");
  const [signature, setSignature] = useState<string | null>(null);

  const [bulkIdsText, setBulkIdsText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [f, s] = await Promise.all([
        fetchFlukeState(address),
        fetchStarlightState(),
      ]);
      setFluke(f);
      setStarlight(s);
    } catch (e) {
      setLoadError(
        `Flukeの情報を読み込めませんでした：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLookupItem = useCallback(async () => {
    setItemError(null);
    setItem(null);
    let id: bigint;
    try {
      id = BigInt(itemIdText.trim());
      if (id < 0n) throw new Error("negative");
    } catch {
      setItemError("GuideのトークンID（数値）を入力してください。");
      return;
    }
    try {
      setItem(await fetchGuideItem(id, address));
    } catch (e) {
      setItemError(
        `Guide #${id.toString()} を取得できませんでした（存在しないIDの可能性があります）：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [itemIdText, address]);

  const handleLookupRecord = useCallback(async () => {
    setRecordError(null);
    setRecord(null);
    setSignature(null);
    setSigState("idle");
    let id: bigint;
    try {
      id = BigInt(recordIdText.trim());
      if (id < 0n) throw new Error("negative");
    } catch {
      setRecordError("参加番号（数字）を入力してください。");
      return;
    }
    try {
      setRecord(await fetchFlukeRecord(id, address));
    } catch (e) {
      setRecordError(
        `参加番号を確認できませんでした：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [recordIdText, address]);

  const handleFetchSignature = useCallback(async () => {
    if (!record) return;
    setSigState("fetching");
    const sig = await fetchSettleSignature(record.rn);
    if (sig) {
      setSignature(sig);
      setSigState("found");
    } else {
      setSigState("missing");
    }
  }, [record]);

  const parseBulkIds = (): bigint[] | null => {
    try {
      const ids = bulkIdsText
        .split(/[,\s]+/)
        .filter((s) => s.length > 0)
        .map((s) => BigInt(s));
      if (ids.length === 0) throw new Error("empty");
      return ids;
    } catch {
      setBulkError("Guide IDをカンマ区切りで入力してください（例: 123, 456）。");
      return null;
    }
  };

  const boostJob = () => {
    if (!item) return;
    let amount: bigint;
    try {
      amount = parseUnits(boostAmount, 18);
      if (amount <= 0n) throw new Error("zero");
    } catch {
      setItemError("ブーストの数量（ZAP）を確認してください。");
      return;
    }
    startTx(flukeBoostJob(item.id, amount, formatUnits(amount, 18)));
  };

  return (
    <>
      {modal}
      <Card>
        <Heading>Fluke（くじ引き）</Heading>
        <Body>
          Guide NFTで遊べる抽選ゲームです。外部サイトを開かず、
          このアプリの中でそのまま遊べます。
        </Body>
        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        {fluke ? (
          <>
            <InfoRow
              label="ゲーム状態"
              value={fluke.paused ? "お休み中" : "開催中"}
            />
            <InfoRow
              label="参加料"
              value={`${prettyAmount(fluke.priceFormatted)} ZAP`}
            />
            <InfoRow
              label="めくる料金"
              value={`${prettyAmount(fluke.revealPriceFormatted)}（42で支払い）`}
            />
            <InfoRow
              label="賞金プールA"
              value={
                fluke.poolAFormatted
                  ? `${prettyAmount(fluke.poolAFormatted)} ZAP`
                  : "—"
              }
            />
            <InfoRow
              label="賞金プールB"
              value={
                fluke.poolBFormatted
                  ? `${prettyAmount(fluke.poolBFormatted)} ZAP`
                  : "—"
              }
            />
            <InfoRow
              label="現在のリーダー"
              value={
                fluke.leaderId
                  ? `Guide #${fluke.leaderId}（スコア ${fluke.leaderScoreFormatted ? prettyAmount(fluke.leaderScoreFormatted) : "—"}）`
                  : "—"
              }
            />
            <InfoRow
              label="あなたのZAP残高"
              value={
                fluke.zapBalanceFormatted !== null
                  ? `${prettyAmount(fluke.zapBalanceFormatted)} ZAP`
                  : "ウォレット未作成"
              }
            />
            <InfoRow
              label="あなたのGuide保有数"
              value={fluke.guideBalance ?? "ウォレット未作成"}
            />
          </>
        ) : (
          <Body>読み込み中…</Body>
        )}
        <PrimaryButton label="更新" onPress={load} />
        {fluke && !fluke.paused ? (
          <PrimaryButton
            label={`参加する（${prettyAmount(fluke.priceFormatted)} ZAP）`}
            onPress={() => startTx(flukeCommitJob(fluke))}
          />
        ) : null}
        <Body>
          参加すると参加番号（レコードID）が出ます。精算のときに
          使うので控えてください。初めての方は、必ず少額でどうぞ。
        </Body>
      </Card>

      <Card>
        <Heading>Guideを調べる・めくる・ブースト</Heading>
        <Body>
          番号を入力すると、持ち主・スコア・報酬の登録状態を
          表示します。自分のGuideなら、めくったりブーストしたりできます。
        </Body>
        <Field
          value={itemIdText}
          onChangeText={setItemIdText}
          placeholder="Guide トークンID（例: 3326）"
          keyboardType="decimal-pad"
        />
        <PrimaryButton label="調べる" onPress={handleLookupItem} />
        {itemError ? <Text style={styles.error}>{itemError}</Text> : null}
        {item ? (
          <>
            <InfoRow label="所有者" value={item.owner} />
            <InfoRow
              label="スコア"
              value={item.scoreFormatted ? prettyAmount(item.scoreFormatted) : "—"}
            />
            <InfoRow
              label="消した分"
              value={item.burnedFormatted ? prettyAmount(item.burnedFormatted) : "—"}
            />
            <InfoRow label="ティア" value={item.tier !== null ? String(item.tier) : "—"} />
            <InfoRow label="フォーム数" value={item.formCount ?? "—"} />
            <InfoRow
              label="現在のエンブレム"
              value={item.currentEmblem ?? "—"}
            />
            {item.text ? (
              <InfoRow label="刻まれたテキスト" value={item.text} />
            ) : null}
            {item.starlight ? (
              <>
                <InfoRow
                  label="Starlight登録"
                  value={item.starlight.registered ? "登録済み" : "未登録"}
                />
                <InfoRow
                  label="ためた報酬"
                  value={`${prettyAmount(item.starlight.earnedFormatted)} [42]`}
                />
              </>
            ) : null}
            {item.mine && fluke ? (
              <>
                <PrimaryButton
                  label={`めくる（${prettyAmount(fluke.revealPriceFormatted)} まで）`}
                  onPress={() => startTx(flukeRevealJob(item.id, fluke))}
                />
                <Field
                  value={boostAmount}
                  onChangeText={setBoostAmount}
                  placeholder="ブースト数量（ZAP）"
                  keyboardType="decimal-pad"
                />
                <PercentChips
                  onSelect={(pct) => {
                    if (fluke.zapBalanceRaw !== null) {
                      setBoostAmount(
                        percentOfBalance(fluke.zapBalanceRaw, pct, 18),
                      );
                    }
                  }}
                  disabled={fluke.zapBalanceRaw === null}
                />
                <PrimaryButton label="ブーストする" onPress={boostJob} />
                {item.starlight && !item.starlight.registered ? (
                  <PrimaryButton
                    label="Starlightに登録する"
                    onPress={() =>
                      startTx(starlightRegisterJob([BigInt(item.id)]))
                    }
                  />
                ) : null}
                {item.starlight &&
                item.starlight.registered &&
                item.starlight.earnedRaw > 0n ? (
                  <PrimaryButton
                    label="報酬を受け取る"
                    onPress={() =>
                      startTx(starlightClaimJob([BigInt(item.id)]))
                    }
                  />
                ) : null}
              </>
            ) : item.mine ? null : (
              <Body>このGuideはあなたのウォレットのものではありません。</Body>
            )}
          </>
        ) : null}
      </Card>

      <Card>
        <Heading>Fluke — 精算</Heading>
        <Body>
          参加番号（レコードID）を入力すると、精算できるか確認できます。
          精算には、公式サイトが出す「合言葉」が必要です。
        </Body>
        <Field
          value={recordIdText}
          onChangeText={setRecordIdText}
          placeholder="参加番号（レコードID）"
          keyboardType="decimal-pad"
        />
        <PrimaryButton label="レコードを確認" onPress={handleLookupRecord} />
        {recordError ? <Text style={styles.error}>{recordError}</Text> : null}
        {record ? (
          record.exists ? (
            <>
              <InfoRow label="所有者" value={record.owner} />
              <InfoRow label="対象Guide" value={`#${record.item}`} />
              <InfoRow
                label="状態"
                value={record.settled ? "精算済み" : "未精算"}
              />
              {!record.settled && record.mine ? (
                <>
                  <PrimaryButton
                    label="合言葉を受け取る"
                    onPress={handleFetchSignature}
                  />
                  {sigState === "fetching" ? (
                    <Body>合言葉を確認しています…</Body>
                  ) : null}
                  {sigState === "missing" ? (
                    <Text style={styles.todo}>
                      まだ合言葉が届いていません。時間をおいてもう一度
                      試すか、公式サイト（fluke.zaphod.one）で精算してください。
                    </Text>
                  ) : null}
                  {sigState === "found" && signature ? (
                    <PrimaryButton
                      label="精算する"
                      onPress={() =>
                        startTx(flukeSettleJob(record.id, signature))
                      }
                    />
                  ) : null}
                </>
              ) : !record.settled ? (
                <Body>このレコードはあなたのウォレットのものではありません。</Body>
              ) : null}
            </>
          ) : (
            <Body>そのIDのレコードは見つかりませんでした。</Body>
          )
        ) : null}
      </Card>

      <Card>
        <Heading>Starlight（Guideの報酬）</Heading>
        <Body>
          Guide NFTを登録すると、42の報酬が少しずつたまります。
          複数のGuideをまとめて登録・受け取りできます。
        </Body>
        {starlight ? (
          <>
            <InfoRow
              label="現在の期間"
              value={starlight.currentEpoch ?? "—"}
            />
            <InfoRow
              label="集まった合計"
              value={
                starlight.totalInFormatted
                  ? `${prettyAmount(starlight.totalInFormatted)} 42`
                  : "—"
              }
            />
            <InfoRow
              label="登録受付"
              value={starlight.registerPaused ? "停止中" : "受付中"}
            />
          </>
        ) : (
          <Body>読み込み中…</Body>
        )}
        <Field
          value={bulkIdsText}
          onChangeText={setBulkIdsText}
          placeholder="Guide ID（カンマ区切り、例: 123, 456）"
        />
        {bulkError ? <Text style={styles.error}>{bulkError}</Text> : null}
        <PrimaryButton
          label="まとめて登録する"
          onPress={() => {
            const ids = parseBulkIds();
            if (ids) startTx(starlightRegisterJob(ids));
          }}
        />
        <PrimaryButton
          label="まとめて報酬を受け取る"
          onPress={() => {
            const ids = parseBulkIds();
            if (ids) startTx(starlightClaimJob(ids));
          }}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  todo: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  addr: { color: colors.muted, fontSize: 11, lineHeight: 15 },
});
