import React from "react";
import { StyleSheet, Text } from "react-native";
import { Card, PrototypeWarning, Screen, Title, TodoMt, colors } from "../components/ui";

export default function StakingScreen() {
  return (
    <Screen>
      <Title>ステーキング</Title>
      <PrototypeWarning />
      <Card>
        <Text style={styles.heading}>42 / QOM の委任・委任解除</Text>
        <Text style={styles.body}>
          計画中のフロー: バリデーター一覧 → 委任量の入力 → 確認画面 → 署名。
          両チェーンとも Cosmos SDK + EVM のため、ステーキングが「Cosmos
          トランザクション」なのか「EVMプリコンパイル経由」なのかで実装が全く変わります。
          MT確認が取れるまで、ここは画面の設計のみで、トランザクションは作りません。
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>st42（リキッドステーキング）</Text>
        <Text style={styles.body}>
          42 を預けて st42 を受け取る想定の画面枠です。交換レート、アンボンディング期間、
          コントラクトアドレスはすべて MT 受領後に実値を入れます（推測値は入れません）。
        </Text>
      </Card>
      <TodoMt
        items={[
          "ステーキング方式：Cosmos tx か、EVMプリコンパイル（0x0800番台）か",
          "バリデーター一覧の取得元（REST / gRPC エンドポイント）",
          "st42 コントラクトのアドレスとABI、レート取得方法",
          "QL1 の Cosmos Chain ID と最小単位（aqom 等）・decimals",
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 16, fontWeight: "600" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
