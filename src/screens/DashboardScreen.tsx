import React from "react";
import { StyleSheet, Text } from "react-native";
import { CHAINS } from "../config/chains";
import { BalanceResults } from "../components/BalanceResults";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";

export default function DashboardScreen() {
  return (
    <Screen>
      <Title>Dashboard</Title>
      <PrototypeWarning />
      <Card>
        <Text style={styles.heading}>資産総額</Text>
        <Text style={styles.body}>
          価格データ（MT側API／DEXプール価格）が未受領のため、総額の円／ドル換算はまだ表示しません。
          下の各チェーン残高が現在の実データです。アドレスの入力と取得は「ウォレット」タブで行います。
        </Text>
      </Card>
      <BalanceResults />
      <Card>
        <Text style={styles.heading}>運用状況（ステーキング）</Text>
        <Text style={styles.body}>
          ステーキング方式（Cosmos tx か EVMプリコンパイルか）が MT 確認待ちのため未接続です。
          確認でき次第、委任先・委任量・報酬をここに表示します。
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>対応チェーン</Text>
        {CHAINS.map((c) => (
          <Text key={c.key} style={styles.body}>
            • {c.displayName} — ネイティブ通貨 {c.nativeSymbol} / EVM Chain ID {c.evmChainId}
            {c.cosmosChainId ? ` / Cosmos ${c.cosmosChainId}` : " / Cosmos Chain ID は TODO_MT"}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 16, fontWeight: "600" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
