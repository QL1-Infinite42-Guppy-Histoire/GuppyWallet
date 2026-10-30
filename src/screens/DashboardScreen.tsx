import { useNavigation } from "@react-navigation/native";
import { formatUnits } from "ethers";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  Title,
  colors,
} from "../components/ui";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";
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

export default function DashboardScreen() {
  const { tokenResults, prices, results, loading, refresh, address } =
    useBalances();
  const wallet = useWallet();
  const navigation = useNavigation<any>();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const hasWallet = wallet.info !== null;

  // Estimated USD total: Infinite-side holdings with a reliable
  // DEX-reserve price only. Unpriced / unreliable tokens are excluded
  // (never faked as $0) and counted so the UI can say so.
  let total = 0;
  let pricedCount = 0;
  let excludedCount = 0;
  if (tokenResults) {
    for (const t of tokenResults) {
      if (!t.ok || t.balance.chainKey !== "infinite") continue;
      const p = priceOf(prices, t.balance.address);
      const amount = Number(formatUnits(t.balance.raw, t.balance.decimals));
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
      <Title>ホーム</Title>
      <PrototypeWarning />
      <ReceiveModal
        visible={receiveOpen}
        onClose={() => setReceiveOpen(false)}
      />
      {!hasWallet ? (
        <Card>
          <DontPanic compact />
          <Body>
            まだウォレットがありません。「ウォレット」タブで新規作成するか、
            リカバリーフレーズ／秘密鍵をインポートすると、あなたの残高が
            ここに表示されます。
          </Body>
        </Card>
      ) : (
        <>
          {/* ------- hero: total balance ------- */}
          <View style={styles.hero}>
            <LinearGradient
              colors={GRADIENT_DEEP}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.heroLabel}>Total Balance（推定総額 USD）</Text>
            {hasData ? (
              <Text style={styles.heroTotal}>${total.toFixed(2)}</Text>
            ) : (
              <Text style={styles.heroTotalMuted}>
                {loading ? "取得中…" : "—"}
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
                label="送金"
                onPress={() => navigation.navigate("Wallet")}
              />
              <QuickAction
                glyph="↓"
                label="受取"
                onPress={() => setReceiveOpen(true)}
              />
              <QuickAction
                glyph="⇄"
                label="Swap"
                onPress={() => navigation.navigate("Swap")}
              />
            </View>
          </View>
          <PrimaryButton
            label={hasData ? "残高を更新" : "残高を取得"}
            onPress={refresh}
            loading={loading}
          />
        </>
      )}
      <BalanceResults />
      <Card>
        <Heading>運用状況（ステーキング）</Heading>
        <Body>
          Infinite側はステーキングプリコンパイル（0x0800）が稼働中です。
          バリデータ一覧・委任・st42の状態は「ステーキング」タブで
          確認できます。
        </Body>
      </Card>
      <Card>
        <Heading>対応チェーン</Heading>
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
  heroTotalMuted: { color: colors.muted, fontSize: 40, fontWeight: "800" },
  addressChip: {
    alignSelf: "flex-start",
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "rgba(7,11,22,0.45)",
  },
  addressChipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
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
});
