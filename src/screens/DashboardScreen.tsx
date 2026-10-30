import { formatUnits } from "ethers";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { CHAINS } from "../config/chains";
import { BalanceResults } from "../components/BalanceResults";
import { Body, Heading } from "../components/controls";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { useWallet } from "../context/WalletContext";
import { useWatchAddress } from "../context/WatchAddressContext";
import { priceOf } from "../lib/prices";

export default function DashboardScreen() {
  const { tokenResults, prices, results, effectiveAddress } = useWatchAddress();
  const wallet = useWallet();

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

  return (
    <Screen>
      <Title>Dashboard</Title>
      <PrototypeWarning />
      <Card>
        <Heading>推定総額（USD）</Heading>
        {hasData ? (
          <>
            <Text style={styles.total}>${total.toFixed(2)}</Text>
            <Body>
              推定値（DEXプール由来）です。流動性の薄いプールの準備金比率から
              計算しているため、実際の市場価格とは異なる場合があります。
              {excludedCount > 0
                ? `価格を取得できない／信頼性が低いトークン ${excludedCount} 件は総額に含めていません。`
                : ""}
              {pricedCount === 0 && excludedCount === 0
                ? "価格付きの残高はまだありません。"
                : ""}
            </Body>
          </>
        ) : (
          <Body>
            {effectiveAddress
              ? "「ウォレット」タブで残高を取得すると、ここに推定総額が表示されます。"
              : "アドレスを入力するかウォレットを作成すると、残高と推定総額が表示されます。アドレスの入力と取得は「ウォレット」タブで行います。"}
          </Body>
        )}
        {wallet.info ? (
          <Body>
            ウォレット: {wallet.info.evmAddress.slice(0, 10)}…
            {wallet.info.evmAddress.slice(-6)}（
            {wallet.unlocked ? "ロック解除中" : "ロック中"}）
          </Body>
        ) : null}
      </Card>
      <BalanceResults />
      <Card>
        <Heading>運用状況（ステーキング）</Heading>
        <Body>
          Infinite側はステーキングプリコンパイル（0x0800）が稼働中です。
          バリデータ一覧・委任・st42・ZAPステーキングの状態は
          「ステーキング」タブで確認できます。
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
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { color: colors.accent, fontSize: 30, fontWeight: "800" },
});
