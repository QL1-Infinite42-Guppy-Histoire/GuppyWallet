import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Heading } from "../components/controls";
import { Card, Screen, Title, colors } from "../components/ui";
import { DAPP_LINKS } from "../config/chains";
import { useI18n } from "../context/LanguageContext";

interface Entry {
  label: string;
  description: string;
  url: string;
}

// URLs come from DAPP_LINKS / chain config only — no invented links.
// Descriptions are one plain line each; technical chain status lives
// in Settings → 詳細情報, not here.
const ENTRIES: Entry[] = [
  {
    label: "42 Chain",
    description: "プロジェクトの公式リンク集",
    url: DAPP_LINKS.projectHub,
  },
  {
    label: "Hub",
    description: "42 Chain のポータルサイト",
    url: DAPP_LINKS.hub,
  },
  {
    label: "DontPanic Finance",
    description: "通貨を交換したり預けたりできるサイト",
    url: DAPP_LINKS.dontPanicDex,
  },
  {
    label: "Fluke",
    description: "Guide NFTで遊べるくじ引きゲーム（このアプリでも遊べます）",
    url: DAPP_LINKS.flukeGuide,
  },
  {
    label: "NFT マーケット",
    description: "NFTを買ったり売ったりできる場所",
    url: DAPP_LINKS.nft,
  },
  {
    label: "Bridge",
    description: "別のチェーンへ通貨を送るサイト（このアプリでもできます）",
    url: DAPP_LINKS.bridge,
  },
  {
    label: "Docs",
    description: "公式の説明ページ",
    url: DAPP_LINKS.docs,
  },
  {
    label: "Console",
    description: "開発者向けの管理画面",
    url: DAPP_LINKS.console,
  },
  {
    label: "DriveStats",
    description: "チェーンの利用状況がわかるページ",
    url: DAPP_LINKS.driveStats,
  },
  {
    label: "FishDisk",
    description: "関連サービス",
    url: DAPP_LINKS.fishDisk,
  },
];

/**
 * Explore tab: a friendly ecosystem hub — one-line descriptions and
 * big tappable rows. No technical data here.
 */
export default function ExploreScreen() {
  const { t } = useI18n();

  return (
    <Screen>
      <Title>{t("tab.explore")}</Title>

      <Card>
        <Heading>{t("explore.links")}</Heading>
        {ENTRIES.map((e) => (
          <Pressable
            key={e.label}
            style={styles.row}
            onPress={() => Linking.openURL(e.url)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>{e.label}</Text>
              <Text style={styles.rowDesc}>{e.description}</Text>
            </View>
            <Text style={styles.rowArrow}>↗</Text>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Heading>QNS（.qom ドメイン）</Heading>
        <Body>{t("explore.qnsEnded")}</Body>
      </Card>

      <Card>
        <Heading>このガイドについて</Heading>
        <Body>
          DON'T PANIC — このウォレットは、42 Chain と QL1 のための
          銀河ヒッチハイカー向けガイドです。生命、宇宙、そして万物についての
          答えは 42。タオル（TOWEL）もちゃんとトークン一覧に入っています。
          慌てず、少額からどうぞ。
        </Body>
      </Card>

      <Text style={styles.note}>{t("explore.linkWarning")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Rendered directly on the galaxy, below the cards.
  note: { color: colors.onSpaceMuted, fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  rowMain: { flex: 1, gap: 2 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  rowDesc: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  rowArrow: { color: colors.cyan, fontSize: 15, fontWeight: "700" },
});
