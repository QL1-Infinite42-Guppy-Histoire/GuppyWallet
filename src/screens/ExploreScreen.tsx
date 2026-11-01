import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Heading } from "../components/controls";
import { Card, Screen, colors } from "../components/ui";
import { DAPP_LINKS } from "../config/chains";
import { useI18n } from "../context/LanguageContext";
import type { I18nKey } from "../i18n";

interface Entry {
  label?: string;
  labelKey?: I18nKey;
  descKey: I18nKey;
  url: string;
}

// URLs come from DAPP_LINKS / chain config only — no invented links.
// Descriptions are one plain line each; technical chain status lives
// in Settings → Details, not here.
const ENTRIES: Entry[] = [
  {
    label: "42 Chain",
    descKey: "explore.linkHub",
    url: DAPP_LINKS.projectHub,
  },
  {
    label: "Hub",
    descKey: "explore.linkPortal",
    url: DAPP_LINKS.hub,
  },
  {
    label: "DontPanic Finance",
    descKey: "explore.linkDontPanic",
    url: DAPP_LINKS.dontPanicDex,
  },
  {
    label: "Fluke",
    descKey: "explore.linkFluke",
    url: DAPP_LINKS.flukeGuide,
  },
  {
    labelKey: "explore.linkNftMarket",
    descKey: "explore.linkNftMarketDesc",
    url: DAPP_LINKS.nft,
  },
  {
    label: "Bridge",
    descKey: "explore.linkBridge",
    url: DAPP_LINKS.bridge,
  },
  {
    label: "Docs",
    descKey: "explore.linkDocs",
    url: DAPP_LINKS.docs,
  },
  {
    label: "Console",
    descKey: "explore.linkAdmin",
    url: DAPP_LINKS.console,
  },
  {
    label: "DriveStats",
    descKey: "explore.linkStats",
    url: DAPP_LINKS.driveStats,
  },
  {
    label: "FishDisk",
    descKey: "explore.linkRelated",
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
      <Card>
        <Heading>{t("explore.links")}</Heading>
        {ENTRIES.map((e) => (
          <Pressable
            key={e.label ?? e.labelKey}
            style={styles.row}
            onPress={() => Linking.openURL(e.url)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>
                {e.labelKey ? t(e.labelKey) : e.label}
              </Text>
              <Text style={styles.rowDesc}>{t(e.descKey)}</Text>
            </View>
            <Text style={styles.rowArrow}>↗</Text>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Heading>{t("explore.qnsHeading")}</Heading>
        <Body>{t("explore.qnsEnded")}</Body>
      </Card>

      <Card>
        <Heading>{t("explore.aboutHeading")}</Heading>
        <Body>
          {t("explore.aboutGuide")}
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
