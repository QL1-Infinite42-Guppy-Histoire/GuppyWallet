import { formatUnits, parseUnits } from "ethers";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useTxFlow } from "./ConfirmTx";
import {
  Body,
  ChipPicker,
  Field,
  Heading,
  InfoRow,
  PercentChips,
  PrimaryButton,
} from "./controls";
import { Card, colors } from "./ui";
import { useBalances } from "../context/BalancesContext";
import { useWallet } from "../context/WalletContext";
import { percentOfBalance, prettyAmount } from "../lib/onchain";
import {
  BRIDGE_DESTINATIONS,
  BRIDGE_ROUTERS_INFINITE,
  bridgeSendJob,
  fetchBridgeQuote,
  fetchBridgeRouterState,
  isValidRecipient,
  type BridgeQuote,
  type BridgeRouterState,
} from "../lib/zaphod";

/**
 * Zaphod Bridge (Hyperlane), native in-app sends from Infinite via the
 * verified BridgeRouters. QL1-origin sends stay READ-ONLY: the route
 * table is shown, but sending from QL1 is disabled until a live
 * delivery test has been done (research/ZAPHOD_FRONTEND.md caveat).
 */
export default function BridgeSection() {
  const wallet = useWallet();
  const balances = useBalances();
  const address = wallet.info?.evmAddress ?? null;
  const { startTx, modal } = useTxFlow();

  const [symbol, setSymbol] = useState<string>(
    BRIDGE_ROUTERS_INFINITE[0].symbol,
  );
  const [state, setState] = useState<BridgeRouterState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [domain, setDomain] = useState<number | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const entry = BRIDGE_ROUTERS_INFINITE.find((r) => r.symbol === symbol);

  const load = useCallback(async () => {
    if (!entry) return;
    setLoadError(null);
    setState(null);
    setQuote(null);
    try {
      const s = await fetchBridgeRouterState(entry.router);
      setState(s);
      setDomain((cur) =>
        cur !== null && s.destinations.some((d) => d.domain === cur)
          ? cur
          : (s.destinations[0]?.domain ?? null),
      );
    } catch (e) {
      setLoadError(
        `情報を読み込めませんでした：${e instanceof Error ? e.message : String(e)}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (address && recipient === "") setRecipient(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const amountRaw = useMemo(() => {
    if (!state) return null;
    try {
      const v = parseUnits(amount, state.tokenDecimals);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amount, state]);

  // Live quote whenever router / destination / amount settle.
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!state || domain === null || amountRaw === null) return;
    let cancelled = false;
    (async () => {
      try {
        const q = await fetchBridgeQuote(
          state.router,
          domain,
          amountRaw,
          state.tokenDecimals,
        );
        if (!cancelled) setQuote(q);
      } catch (e) {
        if (!cancelled) {
          setQuoteError(
            `見積もりに失敗しました：${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, domain, amountRaw]);

  const tokenBalanceRaw = useMemo(() => {
    if (!state) return null;
    const r = balances.tokenResults?.find(
      (t) =>
        t.ok &&
        t.balance.chainKey === "infinite" &&
        t.balance.address?.toLowerCase() === state.token.toLowerCase(),
    );
    return r && r.ok ? r.balance.raw : null;
  }, [balances.tokenResults, state]);

  const destinationLabel =
    BRIDGE_DESTINATIONS.find((d) => d.domain === domain)?.label ?? "";

  const handleSend = () => {
    setSendError(null);
    if (!state || !entry) return;
    if (state.paused) {
      setSendError("今はお休み中です。");
      return;
    }
    if (domain === null) {
      setSendError("送信先チェーンを選んでください。");
      return;
    }
    if (!isValidRecipient(recipient)) {
      setSendError("送り先アドレスの形式が正しくありません。");
      return;
    }
    if (amountRaw === null) {
      setSendError("数量を確認してください。");
      return;
    }
    if (state.minRaw !== null && amountRaw < state.minRaw) {
      setSendError(
        `最小数量は ${state.minFormatted} ${state.tokenSymbol} です。`,
      );
      return;
    }
    if (state.maxRaw !== null && state.maxFormatted !== null && amountRaw > state.maxRaw) {
      setSendError(
        `最大数量は ${state.maxFormatted} ${state.tokenSymbol} です。`,
      );
      return;
    }
    if (!quote) {
      setSendError("見積もりの取得を待ってください。");
      return;
    }
    if (quote.forwardRaw <= 0n) {
      setSendError(
        "手数料を差し引くと到着数量が0になります。数量を増やしてください。",
      );
      return;
    }
    startTx(
      bridgeSendJob({
        routerAddress: state.router,
        tokenAddress: state.token,
        tokenSymbol: state.tokenSymbol,
        tokenDecimals: state.tokenDecimals,
        domain,
        destinationLabel,
        recipient: recipient.trim(),
        amountRaw,
        amountFormatted: formatUnits(amountRaw, state.tokenDecimals),
      }),
    );
  };

  return (
    <>
      {modal}
      <Card>
        <Heading>ブリッジ</Heading>
        <Body>
          別のチェーンへ通貨を送ります。届くまで少し時間が
          かかることがあります。これは片道の送信です。送ったあとの
          状況は、完了画面のリンクから確認できます。初めての方は、
          必ず少額でテストしてください。
        </Body>
        <ChipPicker
          options={BRIDGE_ROUTERS_INFINITE.map((r) => ({
            key: r.symbol,
            label: r.symbol,
          }))}
          value={symbol}
          onChange={setSymbol}
        />
        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        {state ? (
          <>
            <InfoRow label="トークン" value={state.tokenSymbol} />
            <InfoRow
              label="状態"
              value={state.paused ? "お休み中" : "使えます"}
            />
            <InfoRow
              label="手数料"
              value={
                state.feeFlatRaw !== null && state.feeFlatRaw > 0n
                  ? `固定 ${prettyAmount(state.feeFlatFormatted ?? "")} ${state.tokenSymbol}`
                  : "なし"
              }
            />
            <InfoRow
              label="送れる量"
              value={`${state.minFormatted ?? "—"} 〜 ${state.maxFormatted ?? "上限なし"}`}
            />
            <Body>送信先チェーン</Body>
            <ChipPicker
              options={state.destinations.map((d) => ({
                key: String(d.domain),
                label:
                  BRIDGE_DESTINATIONS.find((x) => x.domain === d.domain)
                    ?.label ?? String(d.domain),
              }))}
              value={domain !== null ? String(domain) : ""}
              onChange={(k) => setDomain(Number(k))}
            />
            {domain !== null ? (
              <InfoRow
                label="別途かかる手数料（目安）"
                value={`${prettyAmount(
                  state.destinations.find((d) => d.domain === domain)
                    ?.totalNativeFormatted ?? "—",
                )} 42`}
              />
            ) : null}
            <Body>送り先のアドレス</Body>
            <Field
              value={recipient}
              onChangeText={setRecipient}
              placeholder="0x…"
            />
            <Body>数量（{state.tokenSymbol}）</Body>
            <Field
              value={amount}
              onChangeText={setAmount}
              placeholder={`数量（${state.tokenSymbol}）`}
              keyboardType="decimal-pad"
            />
            <PercentChips
              onSelect={(pct) => {
                if (tokenBalanceRaw !== null) {
                  setAmount(
                    percentOfBalance(tokenBalanceRaw, pct, state.tokenDecimals),
                  );
                }
              }}
              disabled={tokenBalanceRaw === null}
            />
            {quoteError ? (
              <Text style={styles.error}>{quoteError}</Text>
            ) : null}
            {quote ? (
              <>
                <InfoRow
                  label="届く量"
                  value={`${prettyAmount(quote.forwardFormatted)} ${state.tokenSymbol}`}
                />
                <InfoRow
                  label="手数料"
                  value={`${prettyAmount(quote.feeFormatted)} ${state.tokenSymbol}`}
                />
                <InfoRow
                  label="別途の手数料"
                  value={`${prettyAmount(quote.totalNativeFormatted)} 42`}
                />
              </>
            ) : amountRaw !== null ? (
              <Body>見積もりを取得しています…</Body>
            ) : null}
            {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
            <PrimaryButton label="送る" onPress={handleSend} />
            <PrimaryButton label="更新" onPress={load} />
          </>
        ) : (
          <Body>読み込み中…</Body>
        )}
      </Card>

      <Card>
        <Heading>QL1から送る（準備中）</Heading>
        <Body>
          QL1から送る方法は、ちゃんと届くか少額で試してから
          使えるようにします。今はまだ送れません。
        </Body>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  addr: { color: colors.muted, fontSize: 11, lineHeight: 15 },
});
