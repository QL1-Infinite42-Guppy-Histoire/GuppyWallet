import { formatUnits, parseUnits } from "ethers";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import type { TxJob } from "./ConfirmTx";
import {
  Body,
  ChipPicker,
  Field,
  InfoRow,
  PercentChips,
  PrimaryButton,
} from "./controls";
import { Card, colors } from "./ui";
import { BRIDGE_SOURCE_CHAINS } from "../config/chains";
import { useI18n } from "../context/LanguageContext";
import { tr } from "../i18n";
import { useWallet } from "../context/WalletContext";
import { percentOfBalance, prettyAmount } from "../lib/onchain";
import {
  BRIDGE_INBOUND,
  BRIDGE_INBOUND_DOMAIN,
  bridgeInboundSendJob,
  fetchBridgeQuote,
  fetchBridgeRouterState,
  fetchBridgeSourceBalances,
  isValidRecipient,
  truncateToDstDecimals,
  type BridgeInboundEntry,
  type BridgeQuote,
  type BridgeRouterState,
} from "../lib/zaphod";

/**
 * Bridge inbound: BSC / Ethereum → 42 Chain, via the Zaphod
 * BridgeRouters deployed on those chains. Every route in
 * BRIDGE_INBOUND was verified on-chain before being wired (see
 * lib/zaphod.ts); unverified entries render as 「準備中」 and cannot be
 * sent. The fee token on the source chain is its native coin (BNB on
 * BSC, ETH on Ethereum) — the token itself is only charged the router
 * fee shown in the quote. Sends go through ConfirmTx like everything
 * else (fresh biometric at signing time).
 */
export default function BridgeInboundSection({
  startTx,
}: {
  startTx: (job: TxJob) => void;
}) {
  const wallet = useWallet();
  const { t } = useI18n();
  const address = wallet.info?.evmAddress ?? null;

  const [chainKey, setChainKey] = useState<string>("bsc");
  const [symbol, setSymbol] = useState<string>("USDT");
  const [state, setState] = useState<BridgeRouterState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceBalances, setSourceBalances] = useState<{
    nativeRaw: bigint;
    tokenRaw: bigint;
  } | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const chain =
    BRIDGE_SOURCE_CHAINS.find((c) => c.key === chainKey) ??
    BRIDGE_SOURCE_CHAINS[0];
  const chainEntries = BRIDGE_INBOUND.filter((e) => e.chain.key === chain.key);
  const entry: BridgeInboundEntry | undefined = chainEntries.find(
    (e) => e.symbol === symbol && e.verified,
  );

  // Keep the token selection valid when the source chain changes.
  useEffect(() => {
    if (!chainEntries.some((e) => e.symbol === symbol && e.verified)) {
      const first = chainEntries.find((e) => e.verified);
      if (first) setSymbol(first.symbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainKey]);

  const load = useCallback(async () => {
    if (!entry) return;
    setLoadError(null);
    setState(null);
    setQuote(null);
    setSourceBalances(null);
    try {
      const s = await fetchBridgeRouterState(entry.router, entry.chain, [
        { domain: BRIDGE_INBOUND_DOMAIN, label: "42 Chain" },
      ]);
      setState(s);
      if (address) {
        const b = await fetchBridgeSourceBalances(
          entry,
          s.token,
          address,
        ).catch(() => null);
        setSourceBalances(b);
      }
    } catch (e) {
      setLoadError(
        `${tr("bridge.loadFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.router, address]);

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
      if (v <= 0n) return null;
      const truncated = truncateToDstDecimals(v, state.tokenDecimals);
      return truncated > 0n ? truncated : null;
    } catch {
      return null;
    }
  }, [amount, state]);

  // Live quote whenever router / amount settle.
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!state || !entry || amountRaw === null) return;
    let cancelled = false;
    (async () => {
      try {
        const q = await fetchBridgeQuote(
          state.router,
          BRIDGE_INBOUND_DOMAIN,
          amountRaw,
          state.tokenDecimals,
          entry.chain,
          { nativeOptional: true },
        );
        if (!cancelled) setQuote(q);
      } catch (e) {
        if (!cancelled) {
          setQuoteError(
            `${tr("bridge.quoteFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, entry, amountRaw]);

  const handleSend = () => {
    setSendError(null);
    if (!state || !entry) return;
    if (state.paused) {
      setSendError(t("bridge.pausedError"));
      return;
    }
    if (!isValidRecipient(recipient)) {
      setSendError(t("bridge.badRecipient"));
      return;
    }
    if (amountRaw === null) {
      setSendError(t("err.checkAmount"));
      return;
    }
    if (state.minRaw !== null && amountRaw < state.minRaw) {
      setSendError(
        `${t("bridge.minPrefix")}${state.minFormatted} ${state.tokenSymbol}${t("bridge.amountSuffix")}`,
      );
      return;
    }
    if (
      state.maxRaw !== null &&
      state.maxFormatted !== null &&
      amountRaw > state.maxRaw
    ) {
      setSendError(
        `${t("bridge.maxPrefix")}${state.maxFormatted} ${state.tokenSymbol}${t("bridge.amountSuffix")}`,
      );
      return;
    }
    if (!quote) {
      setSendError(t("bridge.waitQuote"));
      return;
    }
    if (quote.forwardRaw <= 0n) {
      setSendError(t("bridge.zeroArrival"));
      return;
    }
    if (
      sourceBalances !== null &&
      quote.totalNativeRaw > sourceBalances.nativeRaw
    ) {
      setSendError(
        `${t("bridgeIn.feeShortPrefix")}${chain.nativeSymbol}${t("bridgeIn.feeShortSuffix")}`,
      );
      return;
    }
    startTx(
      bridgeInboundSendJob({
        entry,
        tokenAddress: state.token,
        tokenDecimals: state.tokenDecimals,
        recipient: recipient.trim(),
        amountRaw,
        amountFormatted: formatUnits(amountRaw, state.tokenDecimals),
      }),
    );
  };

  return (
    <Card>
      <Body>
        {t("bridgeIn.intro")}
      </Body>
      <Body>{t("bridgeIn.sourceChain")}</Body>
      <ChipPicker
        options={BRIDGE_SOURCE_CHAINS.map((c) => ({
          key: c.key,
          label: c.key === "bsc" ? "BSC" : "Ethereum",
        }))}
        value={chainKey}
        onChange={setChainKey}
      />
      <Body>
        {t("bridgeIn.feeNotePrefix")}{chain.nativeSymbol}{t("bridgeIn.feeNoteSuffix")}
      </Body>
      <Body>{t("label.token")}</Body>
      <ChipPicker
        options={chainEntries
          .filter((e) => e.verified)
          .map((e) => ({ key: e.symbol, label: e.symbol }))}
        value={symbol}
        onChange={setSymbol}
      />
      {chainEntries
        .filter((e) => !e.verified)
        .map((e) => (
          <InfoRow key={e.symbol} label={e.symbol} value={t("bridgeIn.preparing")} />
        ))}
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      {state ? (
        <>
          <InfoRow label={t("label.token")} value={state.tokenSymbol} />
          <InfoRow
            label={t("label.status")}
            value={state.paused ? t("bridge.paused") : t("bridge.available")}
          />
          <InfoRow
            label={t("bridge.sendable")}
            value={`${state.minFormatted ?? "—"} 〜 ${state.maxFormatted ?? t("bridge.noLimit")}`}
          />
          {sourceBalances ? (
            <>
              <InfoRow
                label={t("bridgeIn.yourBalance")}
                value={`${prettyAmount(formatUnits(sourceBalances.tokenRaw, state.tokenDecimals))} ${state.tokenSymbol}`}
              />
              <InfoRow
                label={`${t("bridgeIn.feeBalancePrefix")}${chain.nativeSymbol}${t("bridgeIn.feeBalanceSuffix")}`}
                value={`${prettyAmount(formatUnits(sourceBalances.nativeRaw, chain.nativeDecimals))} ${chain.nativeSymbol}`}
              />
            </>
          ) : (
            <Body>{t("bridgeIn.balanceLoadFailed")}</Body>
          )}
          <Body>{t("bridgeIn.recipientLabel")}</Body>
          <Field
            value={recipient}
            onChangeText={setRecipient}
            placeholder="0x…"
          />
          <Body>{t("bridge.amountPrefix")}{state.tokenSymbol}{t("bridge.amountSuffixParen")}</Body>
          <Field
            value={amount}
            onChangeText={setAmount}
            placeholder={`${t("bridge.amountPrefix")}${state.tokenSymbol}${t("bridge.amountSuffixParen")}`}
            keyboardType="decimal-pad"
          />
          <PercentChips
            onSelect={(pct) => {
              if (sourceBalances !== null) {
                setAmount(
                  percentOfBalance(
                    sourceBalances.tokenRaw,
                    pct,
                    state.tokenDecimals,
                  ),
                );
              }
            }}
            disabled={sourceBalances === null}
          />
          {quoteError ? <Text style={styles.error}>{quoteError}</Text> : null}
          {quote ? (
            <>
              <InfoRow
                label={t("bridge.arrival")}
                value={`${prettyAmount(quote.forwardFormatted)} ${state.tokenSymbol}`}
              />
              <InfoRow
                label={t("bridge.fee")}
                value={`${prettyAmount(quote.feeFormatted)} ${state.tokenSymbol}`}
              />
              <InfoRow
                label={t("bridge.extraFeeRow")}
                value={
                  quote.nativeQuoteOk && quote.totalNativeRaw > 0n
                    ? `${prettyAmount(quote.totalNativeFormatted)} ${chain.nativeSymbol}`
                    : t("bridge.none")
                }
              />
            </>
          ) : amountRaw !== null ? (
            <Body>{t("bridge.quoting")}</Body>
          ) : null}
          {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
          <PrimaryButton label={t("bridge.sendButton")} onPress={handleSend} />
          <PrimaryButton label={t("common.refresh")} onPress={load} />
        </>
      ) : (
        <Body>{t("common.loading")}</Body>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
});
