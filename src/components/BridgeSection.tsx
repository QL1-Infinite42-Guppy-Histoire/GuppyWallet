import { formatUnits, parseUnits } from "ethers";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import BridgeInboundSection from "./BridgeInboundSection";
import DepositSection from "./DepositSection";
import { useTxFlow } from "./ConfirmTx";
import {
  Body,
  ChipPicker,
  Field,
  Heading,
  InfoRow,
  PercentChips,
  PrimaryButton,
  SegmentedTabs,
} from "./controls";
import { Card, colors } from "./ui";
import { useBalances } from "../context/BalancesContext";
import { useI18n } from "../context/LanguageContext";
import { tr } from "../i18n";
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
 * Zaphod Bridge (Hyperlane), native in-app sends via the verified
 * BridgeRouters. Two directions: 「42 Chainから送る」 (outbound, below)
 * and 「42 Chainへ送る」 (BSC / Ethereum → 42 Chain, BridgeInboundSection).
 * QL1-origin sends stay READ-ONLY: the route table is shown, but
 * sending from QL1 is disabled until a live delivery test has been
 * done (research/ZAPHOD_FRONTEND.md caveat).
 */
export default function BridgeSection() {
  const wallet = useWallet();
  const { t } = useI18n();
  const balances = useBalances();
  const address = wallet.info?.evmAddress ?? null;
  const { startTx, modal } = useTxFlow();
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [showDeposit, setShowDeposit] = useState(false);

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
        `${tr("bridge.loadFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
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
            `${tr("bridge.quoteFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
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
      setSendError(t("bridge.pausedError"));
      return;
    }
    if (domain === null) {
      setSendError(t("bridge.selectDest"));
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
    if (state.maxRaw !== null && state.maxFormatted !== null && amountRaw > state.maxRaw) {
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
        <Heading>{t("bridge.heading")}</Heading>
        <SegmentedTabs
          options={[
            { key: "out", label: t("bridge.tabOut") },
            { key: "in", label: t("bridge.tabIn") },
          ]}
          value={direction}
          onChange={(k) => setDirection(k as "out" | "in")}
        />
      </Card>
      <Card>
        <Heading>{t("deposit.entryTitle")}</Heading>
        <Body>{t("deposit.entryBody")}</Body>
        <PrimaryButton
          label={t("deposit.openButton")}
          onPress={() => setShowDeposit(true)}
        />
      </Card>
      {showDeposit ? (
        <DepositSection onBack={() => setShowDeposit(false)} />
      ) : null}
      {!showDeposit && direction === "in" ? (
        <BridgeInboundSection startTx={startTx} />
      ) : null}
      {!showDeposit && direction === "out" ? (
      <>
      <Card>
        <Body>
          {t("bridge.intro")}
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
            <InfoRow label={t("label.token")} value={state.tokenSymbol} />
            <InfoRow
              label={t("label.status")}
              value={state.paused ? t("bridge.paused") : t("bridge.available")}
            />
            <InfoRow
              label={t("bridge.fee")}
              value={
                state.feeFlatRaw !== null && state.feeFlatRaw > 0n
                  ? `${t("bridge.feeFlatPrefix")}${prettyAmount(state.feeFlatFormatted ?? "")} ${state.tokenSymbol}`
                  : t("bridge.none")
              }
            />
            <InfoRow
              label={t("bridge.sendable")}
              value={`${state.minFormatted ?? "—"} 〜 ${state.maxFormatted ?? t("bridge.noLimit")}`}
            />
            <Body>{t("label.destinationChain")}</Body>
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
                label={t("bridge.extraFee")}
                value={`${prettyAmount(
                  state.destinations.find((d) => d.domain === domain)
                    ?.totalNativeFormatted ?? "—",
                )} 42`}
              />
            ) : null}
            <Body>{t("bridge.recipientLabel")}</Body>
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
                  label={t("bridge.arrival")}
                  value={`${prettyAmount(quote.forwardFormatted)} ${state.tokenSymbol}`}
                />
                <InfoRow
                  label={t("bridge.fee")}
                  value={`${prettyAmount(quote.feeFormatted)} ${state.tokenSymbol}`}
                />
                <InfoRow
                  label={t("bridge.extraFeeRow")}
                  value={`${prettyAmount(quote.totalNativeFormatted)} 42`}
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

      <Card>
        <Heading>{t("bridge.qomOutHeading")}</Heading>
        <Body>
          {t("bridge.qomOutBody")}
        </Body>
      </Card>
      </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  addr: { color: colors.muted, fontSize: 11, lineHeight: 15 },
});
