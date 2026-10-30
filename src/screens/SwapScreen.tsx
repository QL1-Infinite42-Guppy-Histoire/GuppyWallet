import React from "react";
import { StyleSheet, Text } from "react-native";
import { Card, PrototypeWarning, Screen, Title, TodoMt, colors } from "../components/ui";

export default function SwapScreen() {
  return (
    <Screen>
      <Title>Swap</Title>
      <PrototypeWarning />
      <Card>
        <Text style={styles.heading}>計画中のフロー（試作画面）</Text>
        <Text style={styles.body}>
          1. チェーンを選ぶ（Infinite / QL1）{"\n"}
          2. 交換元・交換先トークンと数量を入れる{"\n"}
          3. MT側ルーターから quote（レート・手数料・スリッページ）を取得して表示{"\n"}
          4. 内容確認画面で、送り先コントラクトと手数料を人間が読める形で提示{"\n"}
          5. 署名して送信 —— この試作版では署名・送信は実装していません
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>流動性提供（LP）もここに統合予定</Text>
        <Text style={styles.body}>
          LP追加・解除・報酬確認は、DEXのコントラクト（DontPanic Finance / Zaphod側）が
          分かり次第、Swapと同じ画面系統に実装します。現時点ではダミーの数値や
          架空のプールは表示しません。
        </Text>
      </Card>
      <TodoMt
        items={[
          "SwapルーターのコントラクトアドレスとABI（チェーン別）",
          "対象トークンのアドレス一覧（42 / QOM 以外）",
          "quote取得の方法（オンチェーン呼出か、MT側APIか）と手数料仕様",
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 16, fontWeight: "600" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
