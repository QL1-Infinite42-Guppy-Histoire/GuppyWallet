import { useNavigation } from "@react-navigation/native";
import { formatUnits } from "ethers";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { CHAINS } from "../config/chains";
import { BalanceResults } from "../components/BalanceResults";
import { Body, Heading, PrimaryButton } from "../components/controls";
import { ReceiveModal } from "../components/ReceiveModal";
import {
  Card,
  DontPanic,
  GRADIENT,
  GRADIENT_DEEP,
  PrototypeWarning,
  Screen,
  colors,
} from "../components/ui";
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
        <LinearGradient
          colors={GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.quickGlyph}>{glyph}</Text>
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { t, lang } = useI18n();
  const { tokenResults, prices, results, loading, refresh, address } =
    useBalances();
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

  // Estimated USD total: Infinite-side holdings with a reliable
  // DEX-reserve price only. Unpriced / unreliable tokens are excluded
  // (never faked as $0) and counted so the UI can say so.
  let total = 0;
  let pricedCount = 0;
  let excludedCount = 0;
  if (tokenResults) {
    for (const tk of tokenResults) {
      if (!tk.ok || tk.balance.chainKey !== "infinite") continue;
      const p = priceOf(prices, tk.balance.address);
      const amount = Number(formatUnits(tk.balance.raw, tk.balance.decimals));
      if (p.usd !== null && p.reliable) {
        total += amount * p.usd;
        if (amount > 0) pricedCount += 1;
      } else if (amount > 0) {
        excludedCount += 1;
      }
    }
  }
  const hasData = results !== null;
  const evm = wallet.info?.evmAddress ?? null;

  return (
    <Screen>
      <DontPanic />
      <Text style={styles.catchphrase}>{t("home.catchphrase")}</Text>
      <PrototypeWarning />
      <ReceiveModal
        visible={receiveOpen}
        onClose={() => setReceiveOpen(false)}
      />
      {!hasWallet ? (
        <Card>
          <DontPanic compact />
          <Body>{t("common.noWalletBody")}</Body>
        </Card>
      ) : (
        <>
          {/* ------- hero: total balance (USD + JPY) ------- */}
          <View style={styles.hero}>
            <LinearGradient
              colors={GRADIENT_DEEP}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.heroLabel}>{t("home.totalBalance")}</Text>
            {hasData ? (
              <>
                <Text style={styles.heroTotal}>${total.toFixed(2)}</Text>
                <Text style={styles.heroJpy}>
                  {jpyRate !== null
                    ? `≈ ¥${Math.round(total * jpyRate).toLocaleString()}`
                    : `¥ ${t("common.notAvailable")}`}
                </Text>
              </>
            ) : (
              <Text style={styles.heroTotalMuted}>
                {loading ? t("common.loading") : "—"}
              </Text>
            )}
            {evm ? (
              <View style={styles.addressChip}>
                <Text style={styles.addressChipText}>
                  {evm.slice(0, 8)}…{evm.slice(-6)}（
                  {wallet.unlocked ? "ロック解除中" : "ロック中"}）
                </Text>
              </View>
            ) : null}
            {results ? (
              <Text style={styles.networkLine}>
                {results
                  .map(
                    (r) =>
                      `${r.chain.displayName}: ${r.ok ? `● Block ${r.blockNumber}` : "● 接続エラー"}`,
                  )
                  .join("  /  ")}
              </Text>
            ) : null}
            <Text style={styles.heroNote}>
              推定値（DEXプール由来）です。流動性の薄いプールの準備金比率から
              計算しているため、実際の市場価格とは異なる場合があります。
              {excludedCount > 0
                ? `価格を取得できない／信頼性が低いトークン ${excludedCount} 件は総額に含めていません。`
                : ""}
              {hasData && pricedCount === 0 && excludedCount === 0
                ? "価格付きの残高はまだありません。"
                : ""}
            </Text>
            <View style={styles.quickRow}>
              <QuickAction
                glyph="↑"
                label={t("home.send")}
                onPress={() => navigation.navigate("Send")}
              />
              <QuickAction
                glyph="↓"
                label={t("home.receive")}
                onPress={() => setReceiveOpen(true)}
              />
              <QuickAction
                glyph="⇄"
                label={t("home.swap")}
                onPress={() => navigation.navigate("DeFi", { section: "swap" })}
              />
            </View>
          </View>
          <PrimaryButton
            label={t("common.refresh")}
            onPress={refresh}
            loading={loading}
          />
          <PrimaryButton
            label={`${t("tokens.title")} — ${t("common.viewAll")}`}
            onPress={() => navigation.navigate("TokenList")}
          />
        </>
      )}
      <BalanceResults />
      {hasWallet ? (
        <Card>
          <Heading>{t("home.history")}</Heading>
          {history === null ? (
            <Body>{t("common.loading")}</Body>
          ) : history.length === 0 ? (
            <Body>{t("home.historyEmpty")}</Body>
          ) : (
            history.map((h) => (
              <Pressable
                key={`${h.chainKey}-${h.hash}`}
                style={styles.historyRow}
                onPress={() => Linking.openURL(h.explorerTxUrl)}
              >
                <Text style={styles.historyDir}>
                  {h.direction === "out" ? "↑" : h.direction === "in" ? "↓" : "⇄"}
                </Text>
                <View style={styles.historyMain}>
                  <Text style={styles.historyValue}>
                    {h.valueFormatted} {h.nativeSymbol}
                    {h.ok ? "" : "（失敗）"}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {h.chainName} ·{" "}
                    {new Date(h.timestamp).toLocaleString(
                      lang === "en" ? "en-US" : "ja-JP",
                    )}{" "}
                    · {h.hash.slice(0, 10)}…
                  </Text>
                </View>
                <Text style={styles.historyLink}>↗</Text>
              </Pressable>
            ))
          )}
          <Body>
            {t("home.historyNote")}
            {historyFailed.length > 0
              ? `（${historyFailed.join(", ")} は取得できませんでした）`
              : ""}
          </Body>
        </Card>
      ) : null}
      <Card>
        <Heading>{t("home.stakingStatus")}</Heading>
        <Body>{t("home.stakingStatusBody")}</Body>
      </Card>
      <Card>
        <Heading>{t("home.chains")}</Heading>
        {CHAINS.map((c) => (
          <Body key={c.key}>
            • {c.displayName} — ネイティブ通貨 {c.nativeSymbol} / EVM Chain ID{" "}
            {c.evmChainId}
            {c.cosmosChainId
              ? ` / Cosmos ${c.cosmosChainId}`
              : " / Cosmos Chain ID は未確認"}
          </Body>
        ))}
        {address ? null : (
          <Body>
            ※ 答えは 42。でも残高はウォレットを作らないと分かりません。
          </Body>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  catchphrase: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  hero: {
    borderRadius: 24,
    borderColor: colors.panelBorder,
    borderWidth: 1,
    padding: 20,
    gap: 8,
    overflow: "hidden",
  },
  heroLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  heroTotal: { color: "#FFFFFF", fontSize: 40, fontWeight: "800" },
  heroJpy: { color: colors.cyan, fontSize: 18, fontWeight: "700" },
  heroTotalMuted: { color: colors.muted, fontSize: 40, fontWeight: "800" },
  addressChip: {
    alignSelf: "flex-start",
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "rgba(5,11,27,0.45)",
  },
  addressChipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  networkLine: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  heroNote: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
  quickAction: { alignItems: "center", gap: 6 },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  quickGlyph: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  quickLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  historyDir: { color: colors.cyan, fontSize: 16, fontWeight: "800" },
  historyMain: { flex: 1, gap: 1 },
  historyValue: { color: colors.text, fontSize: 14, fontWeight: "700" },
  historyMeta: { color: colors.muted, fontSize: 11 },
  historyLink: { color: colors.accent, fontSize: 13 },
});
