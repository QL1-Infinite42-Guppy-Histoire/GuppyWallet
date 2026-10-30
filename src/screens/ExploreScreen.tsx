import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { Body, Heading, InfoRow, PrimaryButton } from "../components/controls";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { CHAINS, DAPP_LINKS } from "../config/chains";
import { useI18n } from "../context/LanguageContext";
import { getProvider } from "../lib/onchain";

interface ChainStatus {
  block: number | null;
  error: string | null;
}

interface Entry {
  label: string;
  description: string;
  url: string;
}

// URLs come from DAPP_LINKS / chain config only — no invented links.
const ENTRIES: Entry[] = [
  {
    label: "Infinite Drivechain — プロジェクトハブ",
    description: "プロジェクトのリンク集（公式）",
    url: DAPP_LINKS.projectHub,
  },
  {
    label: "Hub",
    description: "Infinite のポータル",
    url: DAPP_LINKS.hub,
  },
  {
    label: "DontPanic Finance",
    description: "Infinite 側 DEX（Swap / LP の参照実装）",
    url: DAPP_LINKS.dontPanicDex,
  },
  {
    label: "Fluke",
    description: "The Guide のゲーム（アプリ内でも実行できます）",
    url: DAPP_LINKS.flukeGuide,
  },
  {
    label: "NFT マーケットプレイス",
    description: "Guide などの NFT マーケット",
    url: DAPP_LINKS.nft,
  },
  {
    label: "Bridge",
    description: "Hyperlane ブリッジ（アプリ内でも実行できます）",
    url: DAPP_LINKS.bridge,
  },
  {
    label: "Docs",
    description: "Infinite 公式ドキュメント",
    url: DAPP_LINKS.docs,
  },
  {
    label: "Console",
    description: "Infinite コンソール",
    url: DAPP_LINKS.console,
  },
  {
    label: "DriveStats",
    description: "チェーン統計",
    url: DAPP_LINKS.driveStats,
  },
  {
    label: "FishDisk",
    description: "関連サービス（参照）",
    url: DAPP_LINKS.fishDisk,
  },
];

/**
 * Explore tab: ecosystem hub — live chain status (direct RPC probes,
 * no wallet needed), ecosystem/dApp links, and ended-service notes.
 * Absorbs the old More screen's link/info role.
 */
export default function ExploreScreen() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Record<string, ChainStatus> | null>(
    null,
  );

  const load = useCallback(async () => {
    const out: Record<string, ChainStatus> = {};
    await Promise.all(
      CHAINS.map(async (c) => {
        try {
          const block = await getProvider(c).getBlockNumber();
          out[c.key] = { block, error: null };
        } catch (e) {
          out[c.key] = {
            block: null,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );
    setStatus(out);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <Title>{t("tab.explore")}</Title>
      <PrototypeWarning />

      <Card>
        <Heading>{t("explore.chainStatus")}</Heading>
        {CHAINS.map((c) => {
          const s = status?.[c.key];
          return (
            <React.Fragment key={c.key}>
              <InfoRow
                label={c.displayName}
                value={
                  s === undefined
                    ? t("common.loading")
                    : s.block !== null
                      ? `${t("explore.block")} ${s.block}`
                      : t("common.fetchFailed")
                }
              />
              <Body>
                ネイティブ通貨 {c.nativeSymbol} / EVM Chain ID {c.evmChainId}
                {c.cosmosChainId ? ` / Cosmos ${c.cosmosChainId}` : ""}
                {"\n"}RPC: {c.evmRpcUrls[0]}
                {s?.error ? `\n${s.error}` : ""}
              </Body>
              <Pressable onPress={() => Linking.openURL(c.explorerUrl)}>
                <Text style={styles.link}>{t("explore.explorer")}</Text>
              </Pressable>
            </React.Fragment>
          );
        })}
        <PrimaryButton label={t("common.refresh")} onPress={load} />
      </Card>

      <Card>
        <Heading>QNS（.qom ドメイン）</Heading>
        <Body>{t("explore.qnsEnded")}</Body>
      </Card>

      <Card>
        <Heading>このガイドについて</Heading>
        <Body>
          DON'T PANIC — このウォレットは、Infinite Drivechain と QL1 のための
          銀河ヒッチハイカー向けガイドです。生命、宇宙、そして万物についての
          答えは 42。タオル（TOWEL）もちゃんとトークン一覧に入っています。
          慌てず、少額からどうぞ。
        </Body>
      </Card>

      <Text style={styles.note}>{t("explore.linkWarning")}</Text>
      <Card>
        <Heading>{t("explore.links")}</Heading>
        {ENTRIES.map((e) => (
          <React.Fragment key={e.label}>
            <Body>
              {e.label} — {e.description}
            </Body>
            <Pressable onPress={() => Linking.openURL(e.url)}>
              <Text style={styles.link}>{e.url} ↗</Text>
            </Pressable>
          </React.Fragment>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  link: { color: colors.accent, fontSize: 13 },
});
