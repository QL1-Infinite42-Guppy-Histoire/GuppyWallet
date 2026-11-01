import { useNavigation } from "@react-navigation/native";
import { formatUnits } from "ethers";
import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BalanceResults, formatJpy } from "../components/BalanceResults";
import { GuppyMascot } from "../components/GuppyMascot";
import {
  Body,
  Heading,
  PrimaryButton,
  SegmentedTabs,
} from "../components/controls";
import { ReceiveModal } from "../components/ReceiveModal";
import { Card, DontPanic, Screen, colors } from "../components/ui";
import { CHAINS } from "../config/chains";
import { useChainSelection } from "../context/ChainSelectionContext";
import { useI18n } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";
import { fetchUsdJpy } from "../lib/fx";
import { fetchTxHistory, type TxHistoryItem } from "../lib/history";
import { priceOf } from "../lib/prices";

function QuickAction({
  glyph,
  label,
  onPress,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickIconWrap}>
        <Text style={styles.quickGlyph}>{glyph}</Text>
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * Home, Phantom-style and plain: account + address chip on top, one
 * big JPY total (USD as a small sub-line), quick actions, a simple
 * token list and a plain activity list. No technical details here —
 * chain/RPC/contract info lives in Settings → 詳細情報.
 */
export default function HomeScreen() {
  const { t, lang } = useI18n();
  const { tokenResults, prices, ql1Prices, results, loading, refresh, address } =
    useBalances();
  const { chainKey, setChainKey } = useChainSelection();
  const wallet = useWallet();
  const navigation = useNavigation<any>();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [jpyRate, setJpyRate] = useState<number | null>(null);
  const [history, setHistory] = useState<TxHistoryItem[] | null>(null);
  const [historyFailed, setHistoryFailed] = useState<string[]>([]);
  const hasWallet = wallet.info !== null;

  useEffect(() => {
    fetchUsdJpy().then(setJpyRate).catch(() => setJpyRate(null));
  }, []);

  useEffect(() => {
    if (!address) {
      setHistory(null);
      return;
    }
    let cancelled = false;
    fetchTxHistory(address, 10)
      .then((r) => {
        if (cancelled) return;
        setHistory(r.items);
        setHistoryFailed(r.failedChains);
      })
      .catch(() => {
        if (!cancelled) setHistory(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, tokenResults]);

  // Total: holdings on the SELECTED chain with a reliable DEX-reserve
  // price only. Unpriced / unreliable tokens are excluded (never faked
  // as $0). QL1 prices anchor to the bridged-QOM price on 42 Chain.
  const priceMap = chainKey === "infinite" ? prices : ql1Prices;
  let total = 0;
  if (tokenResults) {
    for (const tk of tokenResults) {
      if (!tk.ok || tk.balance.chainKey !== chainKey) continue;
      const p = priceOf(priceMap, tk.balance.address);
      const amount = Number(formatUnits(tk.balance.raw, tk.balance.decimals));
      if (p.usd !== null && p.reliable) total += amount * p.usd;
    }
  }
  const hasData = results !== null;
  const evm = wallet.info?.evmAddress ?? null;
  const totalJpy = jpyRate !== null ? total * jpyRate : null;

  return (
    <Screen>
      <DontPanic compact />
      {/* account header: name + small address chip */}
      <View style={styles.accountRow}>
        <Text style={styles.accountName}>
          {t("home.account")} 1
        </Text>
        {evm ? (
          <View style={styles.addressChip}>
            <Text style={styles.addressChipText}>
              {evm.slice(0, 6)}…{evm.slice(-4)}
            </Text>
          </View>
        ) : null}
        {hasWallet ? (
          <Text style={styles.lockState}>
            {wallet.unlocked
              ? lang === "en"
                ? "Unlocked"
                : "ロック解除中"
              : lang === "en"
                ? "Locked"
                : "ロック中"}
          </Text>
        ) : null}
      </View>
      <Text style={styles.catchphrase}>{t("home.catchphrase")}</Text>
      <ReceiveModal
        visible={receiveOpen}
        onClose={() => setReceiveOpen(false)}
      />
      {!hasWallet ? (
        <Card>
          <DontPanic compact tone="card" />
          <View style={styles.mascotCenter}>
            <GuppyMascot size={104} />
          </View>
          <Body>{t("common.noWalletBody")}</Body>
        </Card>
      ) : (
        <>
          {/* ------- hero: chain toggle + one big total, JPY first ------- */}
          <View style={styles.hero}>
            {/* mascot drifting in the top-right of the hero glass,
                beside the total — decorative, touches pass through */}
            <View style={styles.heroMascot} pointerEvents="none">
              <GuppyMascot size={92} />
            </View>
            <SegmentedTabs
              options={CHAINS.map((c) => ({
                key: c.key,
                label: c.displayName,
              }))}
              value={chainKey}
              onChange={(k) => setChainKey(k as typeof chainKey)}
            />
            <Text style={styles.heroLabel}>{t("home.totalBalance")}</Text>
            {hasData ? (
              <>
                <Text style={styles.heroTotal}>
                  {totalJpy !== null
                    ? formatJpy(totalJpy)
                    : `$${total.toFixed(2)}`}
                </Text>
                {totalJpy !== null ? (
                  <Text style={styles.heroSub}>${total.toFixed(2)}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.heroTotalMuted}>
                {loading ? t("common.loading") : "—"}
              </Text>
            )}
            <View style={styles.quickRow}>
              <QuickAction
                glyph="↑"
                label={t("home.send")}
                onPress={() => navigation.navigate("Send", { chain: chainKey })}
              />
              <QuickAction
                glyph="↓"
                label={t("home.receive")}
                onPress={() => setReceiveOpen(true)}
              />
              <QuickAction
                glyph="⇄"
                label={t("home.swap")}
                onPress={() =>
                  navigation.navigate("DeFi", {
                    section: "swap",
                    chain: chainKey,
                  })
                }
              />
            </View>
          </View>
          <PrimaryButton
            label={t("common.refresh")}
            onPress={refresh}
            loading={loading}
          />

          {/* ------- tokens ------- */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t("home.tokens")}</Text>
            <Pressable onPress={() => navigation.navigate("TokenList")}>
              <Text style={styles.viewAll}>
                {t("common.viewAll")} ›
              </Text>
            </Pressable>
          </View>
          <BalanceResults jpyRate={jpyRate} chainKey={chainKey} />

          {/* ------- activity ------- */}
          <Card>
            <Heading>{t("home.history")}</Heading>
            {history === null ? (
              <Body>{t("common.loading")}</Body>
            ) : history.length === 0 ? (
              <>
                <View style={styles.mascotCenter}>
                  <GuppyMascot size={76} />
                </View>
                <Body>{t("home.historyEmpty")}</Body>
              </>
            ) : (
              history.map((h) => (
                <Pressable
                  key={`${h.chainKey}-${h.hash}`}
                  style={styles.historyRow}
                  onPress={() => Linking.openURL(h.explorerTxUrl)}
                >
                  <View style={styles.historyIcon}>
                    <Text style={styles.historyDir}>
                      {h.direction === "out"
                        ? "↑"
                        : h.direction === "in"
                          ? "↓"
                          : "⇄"}
                    </Text>
                  </View>
                  <View style={styles.historyMain}>
                    <Text style={styles.historyTitle}>
                      {h.direction === "out"
                        ? lang === "en"
                          ? "Sent"
                          : "送金"
                        : h.direction === "in"
                          ? lang === "en"
                            ? "Received"
                            : "受取"
                          : lang === "en"
                            ? "To myself"
                            : "自分への送金"}
                      {h.ok
                        ? ""
                        : lang === "en"
                          ? " (failed)"
                          : "（失敗）"}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {new Date(h.timestamp).toLocaleString(
                        lang === "en" ? "en-US" : "ja-JP",
                        {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                      {" · "}
                      {h.chainName}
                    </Text>
                  </View>
                  <Text style={styles.historyValue}>
                    {h.valueFormatted} {h.nativeSymbol}
                  </Text>
                </Pressable>
              ))
            )}
            <Body>
              {t("home.historyNote")}
              {historyFailed.length > 0
                ? lang === "en"
                  ? " (Some entries could not be loaded.)"
                  : "（一部は取得できませんでした）"
                : ""}
            </Body>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 2,
  },
  accountName: { color: colors.onSpace, fontSize: 17, fontWeight: "800" },
  addressChip: {
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  addressChipText: { color: colors.onSpace, fontSize: 12, fontWeight: "600" },
  lockState: { color: colors.onSpaceMuted, fontSize: 11 },
  catchphrase: {
    color: colors.cyanBright,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    paddingHorizontal: 2,
  },
  hero: {
    borderRadius: 24,
    backgroundColor: colors.glassStrong,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    padding: 20,
    gap: 6,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  heroMascot: { position: "absolute", right: 12, top: 72, zIndex: 1 },
  mascotCenter: { alignItems: "center", paddingVertical: 4 },
  heroLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  heroTotal: { color: colors.text, fontSize: 44, fontWeight: "800" },
  heroSub: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  heroTotalMuted: { color: colors.muted, fontSize: 44, fontWeight: "800" },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  quickAction: { alignItems: "center", gap: 6 },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.primary,
  },
  quickGlyph: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  quickLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionTitle: { color: colors.onSpace, fontSize: 17, fontWeight: "800" },
  viewAll: { color: colors.cyanBright, fontSize: 13, fontWeight: "700" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  historyDir: { color: colors.cyan, fontSize: 15, fontWeight: "800" },
  historyMain: { flex: 1, gap: 1 },
  historyTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  historyMeta: { color: colors.muted, fontSize: 11 },
  historyValue: { color: colors.text, fontSize: 14, fontWeight: "700" },
});
