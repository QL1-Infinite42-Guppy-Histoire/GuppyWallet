import { formatUnits, parseUnits } from "ethers";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import BridgeInboundSection from "./BridgeInboundSection";
import type { TxJob } from "./ConfirmTx";
import {
  Body,
  DisabledButton,
  Field,
  Heading,
  InfoRow,
  PercentChips,
  PrimaryButton,
} from "./controls";
import { Card, colors } from "./ui";
import { useI18n } from "../context/LanguageContext";
import type { I18nKey } from "../i18n";
import { useWallet } from "../context/WalletContext";
import { fetchEthBnbUsd } from "../lib/fx";
import { percentOfBalance, prettyAmount } from "../lib/onchain";
import {
  bscBnbToUsdtJob,
  fetchBnbUsdtQuote,
  fetchBscBalances,
  keepUsdFor,
  loadJourneyState,
  saveJourneyState,
  type BnbUsdtQuote,
} from "../lib/bscSwap";

const STEP_KEYS: I18nKey[] = [
  "journey.step1",
  "journey.step2",
  "journey.step3",
  "journey.step4",
];

/** Tracker step index per phase: steps before it are done. */
const PHASE_STEP: Record<string, number> = {
  loading: 0,
  swap: 1,
  bridge: 2,
  done: 4,
  tooSmall: 1,
  noBnb: 1,
  priceMissing: 1,
  loadError: 0,
  noWallet: 0,
};

const SLIPPAGE_PRESETS = ["0.1", "0.5", "1"] as const;

type Phase =
  | "loading"
  | "swap"
  | "bridge"
  | "done"
  | "tooSmall"
  | "noBnb"
  | "priceMissing"
  | "loadError"
  | "noWallet";

/**
 * The guided continuation of a cross-chain deposit (design doc §8):
 * BNB has arrived on BSC → keep a little back for gas and swap the
 * rest to USDT on PancakeSwap → bridge that USDT to 42 Chain with the
 * existing inbound bridge — one sequence, with a 4-stage tracker.
 * The swap and the bridge are separate ConfirmTx jobs with fresh
 * auth each (never unattended, never auto-retried). If the bridge
 * step is left unfinished, the place in the sequence is kept locally
 * and the next visit resumes at the bridge step.
 */
export default function JourneySection({
  startTx,
  onExit,
}: {
  startTx: (job: TxJob) => void;
  onExit: () => void;
}) {
  const { t } = useI18n();
  const wallet = useWallet();
  const address = wallet.info?.evmAddress ?? null;

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [bnbRaw, setBnbRaw] = useState<bigint | null>(null);
  const [keepUsd, setKeepUsd] = useState(0);
  const [keepRaw, setKeepRaw] = useState<bigint | null>(null);
  const [swapMaxRaw, setSwapMaxRaw] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<BnbUsdtQuote | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [slippage, setSlippage] = useState("1");
  const [sendError, setSendError] = useState<string | null>(null);

  const [bridgePrefill, setBridgePrefill] = useState<{
    amount: string;
    serial: number;
  } | null>(null);
  const [resumed, setResumed] = useState(false);

  /** BSC USDT balance captured when the swap step loaded — the
   *  actually-received amount after the swap is the delta to it. */
  const usdtBeforeRef = useRef<bigint>(0n);
  const addressRef = useRef<string | null>(null);
  addressRef.current = address;

  const slippageBps = useMemo(() => {
    const pct = Number(slippage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) return 100;
    return Math.round(pct * 100);
  }, [slippage]);

  const load = useCallback(async () => {
    setPhase("loading");
    setLoadError(null);
    setSendError(null);
    setQuote(null);
    try {
      const saved = await loadJourneyState();
      if (saved) {
        setBridgePrefill({ amount: saved.usdtAmount, serial: Date.now() });
        setResumed(true);
        setPhase("bridge");
        return;
      }
      const addr = addressRef.current;
      if (!addr) {
        setPhase("noWallet");
        return;
      }
      const [bal, prices] = await Promise.all([
        fetchBscBalances(addr),
        fetchEthBnbUsd().catch(() => ({ ethUsd: null, bnbUsd: null })),
      ]);
      setBnbRaw(bal.bnbRaw);
      usdtBeforeRef.current = bal.usdtRaw;
      if (bal.bnbRaw <= 0n) {
        setPhase("noBnb");
        return;
      }
      if (prices.bnbUsd === null) {
        setPhase("priceMissing");
        return;
      }
      const totalUsd = Number(formatUnits(bal.bnbRaw, 18)) * prices.bnbUsd;
      const rule = keepUsdFor(totalUsd);
      setKeepUsd(rule.keepUsd);
      if (rule.skip) {
        setKeepRaw(bal.bnbRaw);
        setPhase("tooSmall");
        return;
      }
      // Keep amount in raw units, proportional (cent precision) so
      // float error can never eat into the kept gas money.
      const totalCents = BigInt(Math.max(1, Math.round(totalUsd * 100)));
      const keepCents = BigInt(Math.round(rule.keepUsd * 100));
      const keep = (bal.bnbRaw * keepCents) / totalCents;
      setKeepRaw(keep);
      const swapMax = bal.bnbRaw - keep;
      setSwapMaxRaw(swapMax);
      setAmount(formatUnits(swapMax, 18));
      setPhase("swap");
    } catch (e) {
      setLoadError(
        `${t("journey.loadFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
      );
      setPhase("loadError");
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const amountRaw = useMemo(() => {
    try {
      const v = parseUnits(amount, 18);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amount]);

  const amountTooBig =
    amountRaw !== null && swapMaxRaw !== null && amountRaw > swapMaxRaw;

  // Live PancakeSwap quote for the amount being swapped (debounced,
  // same discipline as the deposit estimate). Never shown from a
  // stale order-time estimate — always the live pool.
  useEffect(() => {
    setQuote(null);
    setQuoteFailed(false);
    if (phase !== "swap" || amountRaw === null || amountTooBig) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchBnbUsdtQuote(amountRaw)
        .then((q) => {
          if (!cancelled) setQuote(q);
        })
        .catch(() => {
          if (!cancelled) setQuoteFailed(true);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, amountRaw, amountTooBig]);

  const advanceToBridge = useCallback(
    async (quoteAtSend: BnbUsdtQuote) => {
      let usdtAmount = quoteAtSend.amountOutFormatted;
      const addr = addressRef.current;
      if (addr) {
        try {
          const after = await fetchBscBalances(addr);
          const received = after.usdtRaw - usdtBeforeRef.current;
          if (received > 0n) usdtAmount = formatUnits(received, 18);
        } catch {
          /* fall back to the quote — the bridge form stays editable */
        }
      }
      await saveJourneyState({
        stage: "bridge",
        usdtAmount,
        updatedAt: Date.now(),
      });
      setBridgePrefill({ amount: usdtAmount, serial: Date.now() });
      setResumed(false);
      setPhase("bridge");
    },
    [],
  );

  const handleSwap = useCallback(() => {
    if (!quote || amountRaw === null || amountTooBig) return;
    setSendError(null);
    startTx(
      bscBnbToUsdtJob({
        amountInRaw: amountRaw,
        amountInFormatted: formatUnits(amountRaw, 18),
        amountOutRaw: quote.amountOut,
        amountOutFormatted: quote.amountOutFormatted,
        slippageBps,
        slippageText: slippage,
        onDone: () => void advanceToBridge(quote),
        onError: (msg) => setSendError(msg),
      }),
    );
  }, [quote, amountRaw, amountTooBig, slippageBps, slippage, startTx, advanceToBridge]);

  const handleBridgeDone = useCallback(() => {
    void saveJourneyState(null);
    setPhase("done");
  }, []);

  const handleReset = useCallback(() => {
    void saveJourneyState(null);
    setBridgePrefill(null);
    setResumed(false);
    setReloadKey((k) => k + 1);
  }, []);

  const stepIndex = PHASE_STEP[phase] ?? 0;

  const renderTracker = () => (
    <View style={styles.tracker}>
      {STEP_KEYS.map((key, idx) => {
        const done = idx < stepIndex;
        const current = idx === stepIndex;
        return (
          <React.Fragment key={key}>
            {idx > 0 ? <Text style={styles.trackArrow}>→</Text> : null}
            <View style={styles.trackStep}>
              <View
                style={[
                  styles.trackDot,
                  done && styles.trackDotDone,
                  current && styles.trackDotCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.trackDotText,
                    (done || current) && styles.trackDotTextActive,
                  ]}
                >
                  {done ? "✓" : String(idx + 1)}
                </Text>
              </View>
              <Text
                style={[
                  styles.trackLabel,
                  current && styles.trackLabelCurrent,
                  done && styles.trackLabelDone,
                ]}
              >
                {t(key)}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );

  return (
    <>
      <Card>
        <Heading>{t("journey.heading")}</Heading>
        <Body>{t("journey.intro")}</Body>
        {renderTracker()}
        {phase === "loading" ? <Body>{t("common.loading")}</Body> : null}
        {phase === "noWallet" ? <Body>{t("common.noWalletBody")}</Body> : null}
        {phase === "loadError" ? (
          <>
            <Text style={styles.error}>{loadError}</Text>
            <PrimaryButton
              label={t("common.refresh")}
              onPress={() => setReloadKey((k) => k + 1)}
            />
          </>
        ) : null}
        {phase === "noBnb" ? (
          <>
            <Body>{t("journey.noBnbBody")}</Body>
            <PrimaryButton
              label={t("common.refresh")}
              onPress={() => setReloadKey((k) => k + 1)}
            />
          </>
        ) : null}
        {phase === "priceMissing" ? (
          <>
            {bnbRaw !== null ? (
              <InfoRow
                label={t("journey.bnbBalance")}
                value={`${prettyAmount(formatUnits(bnbRaw, 18))} BNB`}
              />
            ) : null}
            <Body>{t("journey.priceMissingBody")}</Body>
            <PrimaryButton
              label={t("common.refresh")}
              onPress={() => setReloadKey((k) => k + 1)}
            />
          </>
        ) : null}
        {phase === "tooSmall" ? (
          <>
            {bnbRaw !== null ? (
              <InfoRow
                label={t("journey.bnbBalance")}
                value={`${prettyAmount(formatUnits(bnbRaw, 18))} BNB`}
              />
            ) : null}
            <Body>{t("journey.tooSmallBody")}</Body>
          </>
        ) : null}
        {phase === "swap" && bnbRaw !== null && keepRaw !== null && swapMaxRaw !== null ? (
          <>
            <InfoRow
              label={t("journey.bnbBalance")}
              value={`${prettyAmount(formatUnits(bnbRaw, 18))} BNB`}
            />
            <InfoRow
              label={t("journey.keepLabel")}
              value={`${prettyAmount(formatUnits(keepRaw, 18))} BNB`}
            />
            <Body>
              {t("journey.keepNotePrefix")}
              {keepUsd.toFixed(2)}
              {t("journey.keepNoteSuffix")}
            </Body>
            <InfoRow
              label={t("journey.swappableLabel")}
              value={`${prettyAmount(formatUnits(swapMaxRaw, 18))} BNB`}
            />
            <Body>{t("journey.swapAmountLabel")}</Body>
            <Field
              value={amount}
              onChangeText={setAmount}
              placeholder={t("journey.swapAmountLabel")}
              keyboardType="decimal-pad"
            />
            <PercentChips
              onSelect={(pct) => {
                setAmount(percentOfBalance(swapMaxRaw, pct, 18));
              }}
            />
            {amountTooBig ? (
              <Text style={styles.error}>{t("journey.amountTooBig")}</Text>
            ) : null}
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>{t("swap.slippageLabel")}</Text>
              <View style={styles.pctRow}>
                {SLIPPAGE_PRESETS.map((p) => {
                  const active = slippage === p;
                  return (
                    <Pressable
                      key={p}
                      style={[styles.pctChip, active && styles.pctChipActive]}
                      onPress={() => setSlippage(p)}
                    >
                      <Text
                        style={[
                          styles.pctChipText,
                          active && styles.pctChipTextActive,
                        ]}
                      >
                        {p}%
                      </Text>
                    </Pressable>
                  );
                })}
                <TextInput
                  style={styles.slippageInput}
                  value={slippage}
                  onChangeText={setSlippage}
                  keyboardType="decimal-pad"
                  autoCorrect={false}
                />
                <Text style={styles.settingsLabel}>%</Text>
              </View>
            </View>
            <Text style={styles.finePrint}>{t("swap.slippageNote")}</Text>
            {quote ? (
              <InfoRow
                label={t("label.receiveEst")}
                value={`${prettyAmount(quote.amountOutFormatted)} USDT`}
              />
            ) : quoteFailed ? (
              <Body>{t("deposit.estimateFailed")}</Body>
            ) : amountRaw !== null && !amountTooBig ? (
              <Body>{t("common.loading")}</Body>
            ) : null}
            {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
            {quote && amountRaw !== null && !amountTooBig ? (
              <PrimaryButton
                label={t("journey.swapButton")}
                onPress={handleSwap}
              />
            ) : (
              <DisabledButton label={t("journey.swapButton")} />
            )}
          </>
        ) : null}
        {phase === "bridge" ? (
          <Body>
            {resumed ? t("journey.resumeNote") : t("journey.bridgeIntro")}
          </Body>
        ) : null}
        {phase === "done" ? (
          <>
            <Heading>{t("journey.doneHeading")}</Heading>
            <Body>{t("journey.doneBody")}</Body>
            <PrimaryButton label={t("deposit.back")} onPress={onExit} />
          </>
        ) : null}
        {phase !== "done" ? (
          <PrimaryButton label={t("deposit.back")} onPress={onExit} />
        ) : null}
      </Card>
      {phase === "bridge" && bridgePrefill ? (
        <>
          <BridgeInboundSection
            startTx={startTx}
            prefill={{
              chainKey: "bsc",
              symbol: "USDT",
              amount: bridgePrefill.amount,
              serial: bridgePrefill.serial,
            }}
            onBridgeSubmitted={handleBridgeDone}
          />
          <Card>
            <PrimaryButton
              label={t("journey.resetButton")}
              onPress={handleReset}
            />
          </Card>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  tracker: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  trackStep: { alignItems: "center", flexShrink: 1, width: 74 },
  trackDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  trackDotDone: { backgroundColor: colors.accent },
  trackDotCurrent: { backgroundColor: colors.accent },
  trackDotText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  trackDotTextActive: { color: "#FFFFFF" },
  trackLabel: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 14,
  },
  trackLabelCurrent: { color: colors.text, fontWeight: "700" },
  trackLabelDone: { color: colors.text },
  trackArrow: { color: colors.muted, fontSize: 14, marginTop: 6 },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
  },
  settingsLabel: { color: colors.muted, fontSize: 12 },
  pctRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  pctChip: {
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pctChipActive: {
    backgroundColor: colors.gradStart,
    borderColor: colors.gradStart,
  },
  pctChipText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  pctChipTextActive: { color: "#FFFFFF" },
  slippageInput: {
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 12,
    minWidth: 46,
    textAlign: "center",
  },
  finePrint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 8 },
});
