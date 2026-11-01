import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Body,
  ChipPicker,
  DisabledButton,
  Field,
  Heading,
  InfoRow,
  PrimaryButton,
} from "./controls";
import { Card, colors } from "./ui";
import { DEPOSIT_ENABLED, DEPOSIT_SOURCES } from "../config/deposit";
import { useI18n } from "../context/LanguageContext";
import type { I18nKey } from "../i18n";
import { useWallet } from "../context/WalletContext";
import { fetchXlmSolUsd } from "../lib/fx";
import { prettyAmount } from "../lib/onchain";
import {
  createDepositOrder,
  DEPOSIT_STEP_PHASES,
  depositPhase,
  fetchDepositEstimate,
  fetchDepositMin,
  fetchDepositStatus,
  isDepositFinal,
  loadDepositOrders,
  saveDepositOrders,
  type DepositOrder,
  type DepositPhase,
} from "../lib/deposit";

const PHASE_LABEL: Record<DepositPhase, I18nKey> = {
  waiting: "deposit.stepWaiting",
  confirming: "deposit.stepConfirming",
  exchanging: "deposit.stepExchanging",
  sending: "deposit.stepSending",
  finished: "deposit.stepDone",
  failed: "deposit.statusFailed",
  refunded: "deposit.statusRefunded",
  verifying: "deposit.statusVerifying",
};

/** Short labels for the order list rows (the PHASE_LABEL texts for
 *  problem states are full sentences — too long for a row). */
const ROW_LABEL: Record<DepositPhase, I18nKey> = {
  waiting: "deposit.stepWaiting",
  confirming: "deposit.stepConfirming",
  exchanging: "deposit.stepExchanging",
  sending: "deposit.stepSending",
  finished: "deposit.stepDone",
  failed: "deposit.rowFailed",
  refunded: "deposit.rowRefunded",
  verifying: "deposit.rowVerifying",
};

const POLL_MS = 20_000;

/**
 * Cross-chain deposit: the user sends XLM from their own Stellar
 * wallet; a ChangeNOW exchange (created through our proxy — the app
 * holds no provider key) pays BNB out to their own BSC address.
 * BNB-first per design doc §8. When an order finishes, the flow
 * hands over to the guided journey (JourneySection: swap to USDT,
 * then bridge) via onContinue. While PROXY_BASE_URL is empty
 * (DEPOSIT_ENABLED false) the whole flow is an honest 準備中 and no
 * order can be created.
 */
export default function DepositSection({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  /** Journey (v0.2.1): when a deposit finishes, hand over to the
   *  guided BNB → USDT → 42 Chain sequence instead of just going
   *  back to the bridge screen. */
  onContinue?: () => void;
}) {
  const { t } = useI18n();
  const wallet = useWallet();
  const address = wallet.info?.evmAddress ?? null;

  const [orders, setOrders] = useState<DepositOrder[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  // New-order form state.
  const [sourceKey, setSourceKey] = useState<"xlm" | "sol">("xlm");
  const [amount, setAmount] = useState("");
  const [minAmount, setMinAmount] = useState<number | null>(null);
  const [minFailed, setMinFailed] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimateFailed, setEstimateFailed] = useState(false);
  const [xlmUsd, setXlmUsd] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const ordersRef = useRef<DepositOrder[]>([]);
  ordersRef.current = orders;

  const persist = useCallback((next: DepositOrder[]) => {
    setOrders(next);
    void saveDepositOrders(next);
  }, []);

  /** Refresh every unfinished order; per-order failures stay silent
   *  and keep the last known status (same discipline as the bridge
   *  deposit detection). */
  const refreshOrders = useCallback(async () => {
    if (!DEPOSIT_ENABLED) return;
    const current = ordersRef.current;
    const open = current.filter((o) => !isDepositFinal(depositPhase(o.status)));
    if (open.length === 0) return;
    const patches = await Promise.allSettled(
      open.map((o) => fetchDepositStatus(o)),
    );
    let changed = false;
    const next = current.map((o) => {
      const idx = open.findIndex((x) => x.id === o.id);
      if (idx < 0) return o;
      const r = patches[idx];
      if (r.status !== "fulfilled") return o;
      changed = true;
      return { ...o, ...r.value };
    });
    if (changed) persist(next);
  }, [persist]);

  // Load saved orders once; poll while this screen is open and
  // refresh when the app comes back to the foreground.
  useEffect(() => {
    let cancelled = false;
    loadDepositOrders().then((saved) => {
      if (cancelled) return;
      setOrders(saved);
      ordersRef.current = saved;
      void refreshOrders();
    });
    const timer = setInterval(() => void refreshOrders(), POLL_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refreshOrders();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live minimum for the selected source.
  useEffect(() => {
    if (!DEPOSIT_ENABLED) return;
    setMinAmount(null);
    setMinFailed(false);
    let cancelled = false;
    fetchDepositMin(sourceKey)
      .then((m) => {
        if (cancelled) return;
        if (m === null) setMinFailed(true);
        else setMinAmount(m);
      })
      .catch(() => {
        if (!cancelled) setMinFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceKey]);

  // XLM dollar price for the amount estimate (display only).
  useEffect(() => {
    fetchXlmSolUsd()
      .then((p) => setXlmUsd(p.xlmUsd))
      .catch(() => setXlmUsd(null));
  }, []);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const belowMin =
    amountValid && minAmount !== null && amountNum < minAmount;

  // Debounced estimate once the amount clears the minimum.
  useEffect(() => {
    setEstimate(null);
    setEstimateFailed(false);
    if (!DEPOSIT_ENABLED || !amountValid || belowMin) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchDepositEstimate(sourceKey, amount)
        .then((v) => {
          if (cancelled) return;
          if (v === null) setEstimateFailed(true);
          else setEstimate(v);
        })
        .catch(() => {
          if (!cancelled) setEstimateFailed(true);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amount, amountValid, belowMin, sourceKey]);

  const copy = useCallback(async (key: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2000);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!address || !amountValid || belowMin || minAmount === null) return;
    setCreating(true);
    setCreateError(null);
    try {
      const order = await createDepositOrder(sourceKey, amount, address);
      persist([order, ...ordersRef.current]);
      setOpenId(order.id);
    } catch (e) {
      setCreateError(
        `${t("deposit.createFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setCreating(false);
    }
  }, [address, amount, amountValid, belowMin, minAmount, sourceKey, persist, t]);

  const openOrder = orders.find((o) => o.id === openId) ?? null;

  const copyButton = (key: string, value: string) => (
    <Pressable style={styles.copyButton} onPress={() => void copy(key, value)}>
      <Text style={styles.copyButtonText}>
        {copiedKey === key ? t("deposit.copied") : t("deposit.copy")}
      </Text>
    </Pressable>
  );

  const renderSteps = (order: DepositOrder) => {
    const phase = depositPhase(order.status);
    if (phase === "failed") {
      return <Text style={styles.error}>{t("deposit.statusFailed")}</Text>;
    }
    if (phase === "refunded") {
      return <Text style={styles.error}>{t("deposit.statusRefunded")}</Text>;
    }
    if (phase === "verifying") {
      return <Text style={styles.error}>{t("deposit.statusVerifying")}</Text>;
    }
    const currentIdx = DEPOSIT_STEP_PHASES.indexOf(phase);
    return (
      <View>
        {DEPOSIT_STEP_PHASES.map((step, idx) => {
          const done = idx < currentIdx || phase === "finished";
          const current = idx === currentIdx && phase !== "finished";
          return (
            <View key={step} style={styles.stepRow}>
              <Text
                style={[
                  styles.stepMark,
                  done && styles.stepMarkDone,
                  current && styles.stepMarkCurrent,
                ]}
              >
                {done ? "✓" : "・"}
              </Text>
              <Text
                style={[
                  styles.stepLabel,
                  current && styles.stepLabelCurrent,
                  done && styles.stepLabelDone,
                ]}
              >
                {t(PHASE_LABEL[step])}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderOrderDetail = (order: DepositOrder) => {
    const phase = depositPhase(order.status);
    const sym = order.source === "xlm" ? "XLM" : "SOL";
    return (
      <>
        <Card>
          <Heading>{t("deposit.sendHeading")}</Heading>
          <Body>
            {t("deposit.sendIntroPrefix")}
            {prettyAmount(order.fromAmount)}
            {t("deposit.sendIntroSuffix")}
          </Body>
          <InfoRow
            label={t("deposit.amountToSend")}
            value={`${prettyAmount(order.fromAmount)} ${sym}`}
          />
          <View style={styles.valueBlock}>
            <Text style={styles.valueLabel}>{t("deposit.addressLabel")}</Text>
            <Text style={styles.valueText}>{order.payinAddress}</Text>
            {copyButton("addr", order.payinAddress)}
          </View>
          {order.payinExtraId ? (
            <View style={styles.valueBlock}>
              <Text style={styles.valueLabel}>{t("deposit.memoLabel")}</Text>
              <Text style={styles.memoText}>{order.payinExtraId}</Text>
              {copyButton("memo", order.payinExtraId)}
            </View>
          ) : null}
          {order.source === "xlm" ? (
            <View style={styles.warning}>
              <Text style={styles.warningText}>{t("deposit.memoWarning")}</Text>
            </View>
          ) : null}
        </Card>
        <Card>
          <Heading>{t("deposit.statusHeading")}</Heading>
          {renderSteps(order)}
          {phase === "finished" ? (
            <>
              <Body>{t("deposit.doneBody")}</Body>
              {order.actualTo ? (
                <InfoRow
                  label={t("deposit.expectedLabel")}
                  value={`${prettyAmount(order.actualTo)} BNB`}
                />
              ) : null}
              {onContinue ? (
                <PrimaryButton
                  label={t("journey.entryButton")}
                  onPress={onContinue}
                />
              ) : (
                <PrimaryButton label={t("deposit.goBridge")} onPress={onBack} />
              )}
            </>
          ) : null}
          <InfoRow label={t("deposit.exchangeId")} value={order.id} />
          <PrimaryButton
            label={t("common.refresh")}
            onPress={() => void refreshOrders()}
          />
        </Card>
        <Card>
          <Body>{t("deposit.memoForgotten")}</Body>
          <InfoRow label={t("deposit.exchangeId")} value={order.id} />
        </Card>
        <PrimaryButton
          label={t("deposit.back")}
          onPress={() => setOpenId(null)}
        />
      </>
    );
  };

  if (openOrder) return renderOrderDetail(openOrder);

  return (
    <>
      <Card>
        <Heading>{t("deposit.heading")}</Heading>
        <Body>{t("deposit.intro")}</Body>
        {!DEPOSIT_ENABLED ? (
          <Body>{t("deposit.preparingBody")}</Body>
        ) : !address ? (
          <Body>{t("common.noWalletBody")}</Body>
        ) : (
          <>
            <Body>{t("deposit.sourceLabel")}</Body>
            <ChipPicker
              options={DEPOSIT_SOURCES.map((s) => ({
                key: s.key,
                label:
                  s.key === "xlm"
                    ? t("deposit.sourceXlm")
                    : t("deposit.sourceSolSoon"),
              }))}
              value={sourceKey}
              onChange={(k) => {
                const def = DEPOSIT_SOURCES.find((s) => s.key === k);
                if (def?.enabled) setSourceKey(def.key);
              }}
            />
            <Body>{t("deposit.amountXlm")}</Body>
            <Field
              value={amount}
              onChangeText={setAmount}
              placeholder={t("deposit.amountXlm")}
              keyboardType="decimal-pad"
            />
            {amountValid && xlmUsd !== null ? (
              <Body>
                {t("deposit.usdApproxPrefix")}
                {(amountNum * xlmUsd).toFixed(2)}
                {t("deposit.usdApproxSuffix")}
              </Body>
            ) : null}
            {minAmount !== null ? (
              <Body>
                {t("deposit.minPrefix")}
                {prettyAmount(String(minAmount))}
                {t("deposit.minSuffix")}
              </Body>
            ) : minFailed ? (
              <Text style={styles.error}>{t("deposit.minLoadFailed")}</Text>
            ) : (
              <Body>{t("deposit.minLoading")}</Body>
            )}
            {belowMin && minAmount !== null ? (
              <Text style={styles.error}>
                {t("deposit.tooSmallPrefix")}
                {prettyAmount(String(minAmount))}
                {t("deposit.tooSmallSuffix")}
              </Text>
            ) : null}
            {estimate !== null ? (
              <InfoRow
                label={t("deposit.expectedLabel")}
                value={`${prettyAmount(String(estimate))}${t("deposit.expectedSuffix")}`}
              />
            ) : estimateFailed && amountValid && !belowMin ? (
              <Body>{t("deposit.estimateFailed")}</Body>
            ) : null}
            <Body>{t("deposit.keepGasNote")}</Body>
            <Body>{t("deposit.rateNote")}</Body>
            <Body>{t("deposit.payoutNote")}</Body>
            {createError ? (
              <Text style={styles.error}>{createError}</Text>
            ) : null}
            {amountValid && !belowMin && minAmount !== null ? (
              <PrimaryButton
                label={creating ? t("deposit.creating") : t("deposit.createButton")}
                onPress={() => void handleCreate()}
                loading={creating}
              />
            ) : (
              <DisabledButton label={t("deposit.createButton")} />
            )}
          </>
        )}
        <PrimaryButton label={t("deposit.back")} onPress={onBack} />
      </Card>

      {orders.length > 0 ? (
        <Card>
          <Heading>{t("deposit.ordersHeading")}</Heading>
          {orders.map((o) => {
            const phase = depositPhase(o.status);
            const sym = o.source === "xlm" ? "XLM" : "SOL";
            return (
              <Pressable
                key={o.id}
                style={styles.orderRow}
                onPress={() => setOpenId(o.id)}
              >
                <Text style={styles.orderMain}>
                  {`${prettyAmount(o.fromAmount)} ${sym} → BNB`}
                </Text>
                <Text style={styles.orderStatus}>
                  {t(ROW_LABEL[phase])}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  valueBlock: { gap: 4, marginVertical: 4 },
  valueLabel: { color: colors.muted, fontSize: 13 },
  valueText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  memoText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
  },
  copyButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  copyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  warning: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerText,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 6,
  },
  warningText: {
    color: colors.dangerText,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  stepMark: { color: colors.muted, fontSize: 15, width: 18, textAlign: "center" },
  stepMarkDone: { color: colors.accent, fontWeight: "800" },
  stepMarkCurrent: { color: colors.accent, fontWeight: "800" },
  stepLabel: { color: colors.muted, fontSize: 14 },
  stepLabelCurrent: { color: colors.text, fontWeight: "700" },
  stepLabelDone: { color: colors.text },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    gap: 12,
  },
  orderMain: { color: colors.text, fontSize: 14, fontWeight: "600" },
  orderStatus: { color: colors.muted, fontSize: 13, flexShrink: 1 },
});
