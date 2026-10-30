import { formatUnits } from "ethers";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { CHAINS } from "../config/chains";
import { BalanceResults } from "../components/BalanceResults";
import { Body, Heading, PrimaryButton } from "../components/controls";
import {
  Card,
  DontPanic,
  PrototypeWarning,
  Screen,
  Title,
  colors,
} from "../components/ui";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";
import { priceOf } from "../lib/prices";

export default function DashboardScreen() {
  const { tokenResults, prices, results, loading, refresh, address } =
    useBalances();
  const wallet = useWallet();
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

  return (
    <Screen>
      <DontPanic />
      <Title>Dashboard</Title>
      <PrototypeWarning />
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
              {loading
                ? "残高を取得しています…"
                : "残高はまだ取得されていません。下のボタンで取得できます。"}
            </Body>
          )}
          <Body>
            ウォレット: {wallet.info!.evmAddress.slice(0, 10)}…
            {wallet.info!.evmAddress.slice(-6)}（
            {wallet.unlocked ? "ロック解除中" : "ロック中"}）
          </Body>
          <PrimaryButton
            label={hasData ? "残高を更新" : "残高を取得"}
            onPress={refresh}
            loading={loading}
          />
        </Card>
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
  total: { color: colors.accent, fontSize: 30, fontWeight: "800" },
});
