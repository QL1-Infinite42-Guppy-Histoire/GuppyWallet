import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { useTxFlow, type TxJob } from "../components/ConfirmTx";
import {
  Body,
  DisabledButton,
  Field,
  Heading,
  InfoRow,
  PrimaryButton,
} from "../components/controls";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { DAPP_LINKS, QL1, QL1_CONTRACTS } from "../config/chains";
import { useWallet } from "../context/WalletContext";
import {
  checkQnsName,
  fetchNftCollections,
  getQnsController,
  type NftCollectionState,
  type QnsCheck,
} from "../lib/protocol";
import {
  estimateOrFallback,
  gasCostNative,
  sendAndWait,
} from "../lib/tx";

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
  const { startTx, modal } = useTxFlow();
  const address = wallet.info?.evmAddress ?? null;

  const [nfts, setNfts] = useState<NftCollectionState[] | null>(null);
  const [qnsInput, setQnsInput] = useState("");
  const [qns, setQns] = useState<QnsCheck | null>(null);
  const [qnsError, setQnsError] = useState<string | null>(null);
  const [qnsLoading, setQnsLoading] = useState(false);

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

  const handleCheckQns = async () => {
    setQnsError(null);
    setQnsLoading(true);
    try {
      setQns(await checkQnsName(qnsInput));
    } catch (e) {
      setQns(null);
      setQnsError(e instanceof Error ? e.message : String(e));
    } finally {
      setQnsLoading(false);
    }
  };

  const qnsRegisterJob = (): TxJob | null => {
    if (!qns || qns.available !== true || qns.priceRaw === null) return null;
    const name = qns.name;
    const price = qns.priceRaw;
    return {
      title: ".qom ドメイン永久取得",
      chain: QL1,
      lines: [
        { label: "アクション", value: "QNSドメインを永久取得（買い切り）" },
        { label: "ドメイン", value: `${name}.qom` },
        {
          label: "価格（一回払い）",
          value: `${qns.priceFormatted ?? "?"} QOM`,
        },
        { label: "有効期限", value: "なし（永久・更新不要）" },
        { label: "コントラクト", value: QL1_CONTRACTS.qnsRegistrarController },
      ],
      prepare: async (signer) => {
        const controller = getQnsController(signer);
        const owner = await signer.getAddress();
        const resolver: string = await controller.defaultResolver();
        const tx = {
          to: QL1_CONTRACTS.qnsRegistrarController,
          value: price,
          data: controller.interface.encodeFunctionData("register", [
            name,
            owner,
            resolver,
            false,
            true, // permanent: one-time purchase, never expires
          ]),
        };
        const gas = await estimateOrFallback(signer, tx, 500000n);
        return {
          gasEstimateText: await gasCostNative(signer, gas, "QOM"),
          send: async () => [await sendAndWait(signer, tx)],
        };
      },
    };
  };

  return (
    <Screen>
      <Title>その他</Title>
      <PrototypeWarning />
      {modal}

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
        <Heading>QNS（.qom ドメイン・永久取得）</Heading>
        <Body>
          .qom ドメインは一回払いの永久取得です（有効期限なし・更新不要）。
          取得したい名前を入力すると、空き状況と永久取得価格（ネイティブQOM）を
          コントラクトに直接問い合わせます。
        </Body>
        <Field
          value={qnsInput}
          onChangeText={setQnsInput}
          placeholder="例: alice（.qom は不要）"
        />
        <PrimaryButton
          label="空き状況を確認"
          onPress={handleCheckQns}
          loading={qnsLoading}
        />
        {qnsError ? <Text style={styles.errorText}>{qnsError}</Text> : null}
        {qns && qns.name ? (
          <>
            <InfoRow label="ドメイン" value={`${qns.name}.qom`} />
            <InfoRow
              label="形式チェック"
              value={
                qns.valid === null ? "—" : qns.valid ? "有効" : "無効な形式"
              }
            />
            <InfoRow
              label="空き状況"
              value={
                qns.available === null
                  ? "—"
                  : qns.available
                    ? "取得可能"
                    : "取得済み"
              }
            />
            <InfoRow
              label="永久取得価格（一回払い）"
              value={
                qns.priceFormatted ? `${qns.priceFormatted} QOM` : "—"
              }
            />
            <InfoRow label="有効期限" value="なし（永久・更新不要）" />
            {qns.available ? (
              <PrimaryButton
                label="この名前を永久取得する"
                onPress={() => {
                  const job = qnsRegisterJob();
                  if (job) startTx(job);
                }}
              />
            ) : (
              <DisabledButton label="登録できません（取得済み／無効）" />
            )}
          </>
        ) : null}
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
  errorText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  addr: { color: colors.muted, fontSize: 11, lineHeight: 15 },
});
