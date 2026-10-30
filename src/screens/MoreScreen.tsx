import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import {
  Body,
  Heading,
  InfoRow,
  PrimaryButton,
} from "../components/controls";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { DAPP_LINKS } from "../config/chains";
import { useWallet } from "../context/WalletContext";
import {
  fetchNftCollections,
  type NftCollectionState,
} from "../lib/protocol";

interface Entry {
  label: string;
  description: string;
  url?: string;
  todoNote?: string;
}

// URLs come from DAPP_LINKS in src/config/chains.ts only — no invented links.
const ENTRIES: Entry[] = [
  {
    label: "Bridge",
    description: "QL1・Infinite 間などの資産移動（zaphod Bridge）",
    url: DAPP_LINKS.bridge,
    todoNote:
      "ブリッジの仕組み（対応ルート・手数料・所要時間）が未確認のため、アプリ内実行は未実装です（情報不足／TODO）。",
  },
  {
    label: "NFT",
    description: "Guide などの NFT マーケットプレイス",
    url: DAPP_LINKS.nft,
  },
  {
    label: "Fluke — The Guide",
    description: "Guide 系の体験／NFT 入口",
    todoNote:
      "Flukeのゲームコントラクトが公開情報から特定できないため、アプリ内実行は未実装です（情報不足／TODO）。",
  },
  {
    label: "DontPanic Finance",
    description: "Infinite 側 DEX（Swap / LP の参照実装）",
    url: DAPP_LINKS.dontPanicDex,
  },
  {
    label: "FishDisk",
    description: "関連サービス（参照）",
    url: DAPP_LINKS.fishDisk,
  },
];

export default function MoreScreen() {
  const wallet = useWallet();
  const address = wallet.info?.evmAddress ?? null;

  const [nfts, setNfts] = useState<NftCollectionState[] | null>(null);

  const loadNfts = useCallback(async () => {
    try {
      setNfts(await fetchNftCollections(address));
    } catch {
      setNfts(null);
    }
  }, [address]);

  useEffect(() => {
    loadNfts();
  }, [loadNfts]);

  return (
    <Screen>
      <Title>その他</Title>
      <PrototypeWarning />

      <Card>
        <Heading>NFTコレクション（Infinite）</Heading>
        {nfts ? (
          nfts.map((n) => (
            <React.Fragment key={n.address}>
              <InfoRow
                label={n.label}
                value={`${n.name ?? "—"}（${n.symbol ?? "—"}）`}
              />
              <InfoRow
                label="総供給"
                value={n.totalSupply ?? "取得不可（totalSupply未実装）"}
              />
              <InfoRow
                label="あなたの保有数"
                value={n.owned ?? "アドレス未設定"}
              />
              <Text style={styles.addr}>{n.address}</Text>
            </React.Fragment>
          ))
        ) : (
          <Body>読み込み中…</Body>
        )}
        <PrimaryButton label="更新" onPress={loadNfts} />
      </Card>

      <Card>
        <Heading>QNS（.qom ドメイン）</Heading>
        <Body>QNSの新規登録（ミント）は終了しています。</Body>
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

      <Text style={styles.note}>
        以下は外部サービスへのリンクです。外部サイト側で秘密鍵や
        ニーモニックの入力を求められたら絶対に入力しないでください。
      </Text>
      {ENTRIES.map((e) => (
        <Card key={e.label}>
          <Heading>{e.label}</Heading>
          <Body>{e.description}</Body>
          {e.todoNote ? <Text style={styles.todo}>{e.todoNote}</Text> : null}
          {e.url ? (
            <Pressable onPress={() => Linking.openURL(e.url!)}>
              <Text style={styles.link}>{e.url} ↗</Text>
            </Pressable>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  link: { color: colors.accent, fontSize: 13 },
  todo: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  addr: { color: colors.muted, fontSize: 11, lineHeight: 15 },
});
