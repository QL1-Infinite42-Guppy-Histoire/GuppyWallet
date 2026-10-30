import React from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { DAPP_LINKS } from "../config/chains";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";

interface Entry {
  label: string;
  description: string;
  url?: string;
  todoNote?: string;
}

// URLs come from DAPP_LINKS in src/config/chains.ts only — no invented links.
// QNS (.qom domains) has no confirmed URL in chains.ts yet, so it stays a
// non-link entry until MT confirms the official URL.
const ENTRIES: Entry[] = [
  {
    label: "Bridge",
    description: "QL1・Infinite 間などの資産移動（zaphod Bridge）",
    url: DAPP_LINKS.bridge,
  },
  {
    label: "NFT",
    description: "Guide などの NFT マーケットプレイス",
    url: DAPP_LINKS.nft,
  },
  {
    label: "Fluke — The Guide",
    description: "Guide 系の体験／NFT 入口",
    url: DAPP_LINKS.flukeGuide,
  },
  {
    label: "DontPanic Finance",
    description: "Infinite 側 DEX（Swap / LP の参照実装）",
    url: DAPP_LINKS.dontPanicDex,
  },
  {
    label: "QNS（.qom ドメイン）",
    description: ".qom ドメインの取得・管理",
    todoNote: "公式URLとコントラクト情報が未確認のためリンクなし（TODO_MT）",
  },
  {
    label: "FishDisk",
    description: "関連サービス（参照）",
    url: DAPP_LINKS.fishDisk,
  },
];

export default function MoreScreen() {
  return (
    <Screen>
      <Title>その他</Title>
      <PrototypeWarning />
      <Text style={styles.note}>
        現段階では各サービスをブラウザで開きます。将来はウォレットのプロバイダーを
        注入するアプリ内ブラウザに置き換え、署名連携できるようにします。
        外部サイト側で秘密鍵やニーモニックの入力を求められたら絶対に入力しないでください。
      </Text>
      {ENTRIES.map((e) => (
        <Card key={e.label}>
          <Text style={styles.heading}>{e.label}</Text>
          <Text style={styles.body}>{e.description}</Text>
          {e.url ? (
            <Pressable onPress={() => Linking.openURL(e.url!)}>
              <Text style={styles.link}>{e.url} ↗</Text>
            </Pressable>
          ) : (
            <Text style={styles.todo}>{e.todoNote}</Text>
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  heading: { color: colors.text, fontSize: 16, fontWeight: "600" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  link: { color: colors.accent, fontSize: 13 },
  todo: { color: colors.dangerText, fontSize: 13 },
});
