import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useTxFlow } from "../components/ConfirmTx";
import {
  Body,
  Field,
  Heading,
  InfoRow,
  PrimaryButton,
  SegmentedTabs,
} from "../components/controls";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { INFINITE_NFTS } from "../config/chains";
import { useI18n } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import {
  fetchNftCollections,
  fetchOwnedNftTokens,
  type NftCollectionState,
  type OwnedNftToken,
} from "../lib/protocol";
import {
  fetchOwnedQnsDomains,
  lookupQnsName,
  type OwnedQnsDomain,
  type QnsLookup,
} from "../lib/qns";
import {
  fetchGuideItem,
  fetchStarlightState,
  starlightClaimJob,
  starlightRegisterJob,
  type GuideItemState,
  type StarlightState,
} from "../lib/zaphod";

type NftTab = "nft" | "guide" | "qns";

/**
 * NFT tab with three sub-tabs:
 *  - NFT: known collections + owned token ids (explorer index)
 *  - Guide: owned Guide detail (score/tier/emblem/text) + Starlight
 *    registration / earned, with register & claim running natively
 *  - QNS: owned .qom domains (read-only) + name lookup. Registration
 *    has ENDED — there is no mint flow here, by design.
 */
export default function NftScreen() {
  const { t } = useI18n();
  const wallet = useWallet();
  const address = wallet.info?.evmAddress ?? null;
  const { startTx, modal } = useTxFlow();
  const [tab, setTab] = useState<NftTab>("nft");

  // ---- NFT sub-tab state
  const [collections, setCollections] = useState<NftCollectionState[] | null>(null);
  const [ownedTokens, setOwnedTokens] = useState<OwnedNftToken[] | null>(null);
  const [ownedLoaded, setOwnedLoaded] = useState(false);

  const loadNfts = useCallback(async () => {
    try {
      setCollections(await fetchNftCollections(address));
    } catch {
      setCollections(null);
    }
    if (address) {
      setOwnedTokens(await fetchOwnedNftTokens(address));
    } else {
      setOwnedTokens(null);
    }
    setOwnedLoaded(true);
  }, [address]);

  useEffect(() => {
    loadNfts();
  }, [loadNfts]);

  // ---- Guide sub-tab state
  const [starlight, setStarlight] = useState<StarlightState | null>(null);
  const [guideIdInput, setGuideIdInput] = useState("");
  const [guideItem, setGuideItem] = useState<GuideItemState | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [guideBusy, setGuideBusy] = useState(false);

  const loadStarlight = useCallback(async () => {
    try {
      setStarlight(await fetchStarlightState());
    } catch {
      setStarlight(null);
    }
  }, []);

  useEffect(() => {
    if (tab === "guide") loadStarlight();
  }, [tab, loadStarlight]);

  const loadGuide = async (idText: string) => {
    setGuideError(null);
    let id: bigint;
    try {
      id = BigInt(idText.trim());
    } catch {
      setGuideError("トークンID（数値）を入力してください。");
      return;
    }
    setGuideBusy(true);
    try {
      setGuideItem(await fetchGuideItem(id, address));
    } catch (e) {
      setGuideItem(null);
      setGuideError(
        `取得できませんでした：${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setGuideBusy(false);
    }
  };

  const myGuides = (ownedTokens ?? []).filter(
    (o) => o.collectionAddress.toLowerCase() === INFINITE_NFTS.theGuide.toLowerCase(),
  );

  // ---- QNS sub-tab state
  const [domains, setDomains] = useState<OwnedQnsDomain[] | null | undefined>(undefined);
  const [qnsInput, setQnsInput] = useState("");
  const [qnsResult, setQnsResult] = useState<QnsLookup | null>(null);
  const [qnsError, setQnsError] = useState<string | null>(null);
  const [qnsBusy, setQnsBusy] = useState(false);

  useEffect(() => {
    if (tab !== "qns" || !address) return;
    let cancelled = false;
    fetchOwnedQnsDomains(address).then((d) => {
      if (!cancelled) setDomains(d);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, address]);

  const handleQnsLookup = async () => {
    setQnsError(null);
    setQnsResult(null);
    if (!qnsInput.trim()) return;
    setQnsBusy(true);
    try {
      setQnsResult(await lookupQnsName(qnsInput));
    } catch (e) {
      setQnsError(e instanceof Error ? e.message : String(e));
    } finally {
      setQnsBusy(false);
    }
  };

  return (
    <Screen>
      <Title>{t("tab.nft")}</Title>
      <PrototypeWarning />
      {modal}
      <SegmentedTabs
        options={[
          { key: "nft", label: t("nft.tabNft") },
          { key: "guide", label: t("nft.tabGuide") },
          { key: "qns", label: t("nft.tabQns") },
        ]}
        value={tab}
        onChange={(k) => setTab(k as NftTab)}
      />

      {tab === "nft" ? (
        <>
          <Card>
            <Heading>{t("nft.collections")}</Heading>
            {collections ? (
              collections.map((n) => (
                <React.Fragment key={n.address}>
                  <InfoRow
                    label={n.label}
                    value={`${n.name ?? "—"}（${n.symbol ?? "—"}）`}
                  />
                  <InfoRow
                    label={t("nft.totalSupply")}
                    value={n.totalSupply ?? "取得不可（totalSupply未実装）"}
                  />
                  <InfoRow
                    label={t("nft.ownedCount")}
                    value={n.owned ?? "アドレス未設定"}
                  />
                  <Text style={styles.addr}>{n.address}</Text>
                </React.Fragment>
              ))
            ) : (
              <Body>{t("common.loading")}</Body>
            )}
            <PrimaryButton label={t("common.refresh")} onPress={loadNfts} />
          </Card>
          <Card>
            <Heading>{t("nft.yourTokens")}</Heading>
            {!address ? (
              <Body>{t("common.noWalletBody")}</Body>
            ) : !ownedLoaded ? (
              <Body>{t("common.loading")}</Body>
            ) : ownedTokens === null ? (
              <Body>{t("nft.apiNote")}</Body>
            ) : ownedTokens.length === 0 ? (
              <Body>{t("nft.none")}</Body>
            ) : (
              ownedTokens.map((o) => (
                <Body key={`${o.collectionAddress}-${o.tokenId}`}>
                  #{o.tokenId}
                  {o.name ? ` — ${o.name}` : ""}（
                  {o.collectionAddress.toLowerCase() ===
                  INFINITE_NFTS.theGuide.toLowerCase()
                    ? "The Guide"
                    : "ZG13"}
                  ）
                </Body>
              ))
            )}
          </Card>
        </>
      ) : null}

      {tab === "guide" ? (
        <>
          <Card>
            <Heading>{t("guide.starlight")}</Heading>
            {starlight ? (
              <>
                <InfoRow
                  label="現在のエポック"
                  value={starlight.currentEpoch ?? "—"}
                />
                <InfoRow
                  label="総ストリーム（ネイティブ）"
                  value={
                    starlight.totalInFormatted
                      ? `${starlight.totalInFormatted} 42`
                      : "—"
                  }
                />
                <InfoRow
                  label="登録受付"
                  value={
                    starlight.registerPaused === null
                      ? "—"
                      : starlight.registerPaused
                        ? "停止中"
                        : "受付中"
                  }
                />
              </>
            ) : (
              <Body>{t("common.loading")}</Body>
            )}
            <PrimaryButton label={t("common.refresh")} onPress={loadStarlight} />
          </Card>

          {address && myGuides.length > 0 ? (
            <Card>
              <Heading>あなたの Guide</Heading>
              {myGuides.map((g) => (
                <PrimaryButton
                  key={g.tokenId}
                  label={`#${g.tokenId} の詳細を見る`}
                  onPress={() => {
                    setGuideIdInput(g.tokenId);
                    loadGuide(g.tokenId);
                  }}
                />
              ))}
            </Card>
          ) : null}

          <Card>
            <Heading>Guideを調べる</Heading>
            <Field
              value={guideIdInput}
              onChangeText={setGuideIdInput}
              placeholder="トークンID（数値）"
              keyboardType="decimal-pad"
            />
            <PrimaryButton
              label="調べる"
              onPress={() => loadGuide(guideIdInput)}
              loading={guideBusy}
            />
            {guideError ? (
              <Text style={styles.error}>{guideError}</Text>
            ) : null}
            {guideItem ? (
              <>
                <InfoRow label="所有者" value={guideItem.owner} />
                <InfoRow
                  label={t("guide.score")}
                  value={guideItem.scoreFormatted ?? "—"}
                />
                <InfoRow
                  label={t("guide.tier")}
                  value={guideItem.tier !== null ? String(guideItem.tier) : "—"}
                />
                <InfoRow
                  label={t("guide.emblem")}
                  value={guideItem.currentEmblem ?? "—"}
                />
                <InfoRow
                  label={t("guide.forms")}
                  value={guideItem.formCount ?? "—"}
                />
                <InfoRow
                  label={t("guide.burned")}
                  value={guideItem.burnedFormatted ?? "—"}
                />
                {guideItem.text ? (
                  <Body>
                    {t("guide.text")}: {guideItem.text}
                  </Body>
                ) : null}
                {guideItem.starlight ? (
                  <>
                    <InfoRow
                      label={t("guide.starlight")}
                      value={
                        guideItem.starlight.registered
                          ? t("guide.registered")
                          : t("guide.notRegistered")
                      }
                    />
                    <InfoRow
                      label={t("guide.earned")}
                      value={`${guideItem.starlight.earnedFormatted} 42`}
                    />
                    {guideItem.mine && !guideItem.starlight.registered ? (
                      <PrimaryButton
                        label="Starlightに登録する"
                        onPress={() =>
                          startTx(starlightRegisterJob([BigInt(guideItem.id)]))
                        }
                      />
                    ) : null}
                    {guideItem.mine && guideItem.starlight.registered ? (
                      <PrimaryButton
                        label="報酬を請求する（claim）"
                        onPress={() =>
                          startTx(starlightClaimJob([BigInt(guideItem.id)]))
                        }
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {tab === "qns" ? (
        <>
          <Card>
            <Heading>{t("qns.ownedTitle")}</Heading>
            {!address ? (
              <Body>{t("common.noWalletBody")}</Body>
            ) : domains === undefined ? (
              <Body>{t("common.loading")}</Body>
            ) : domains === null ? (
              <Body>{t("common.fetchFailed")}</Body>
            ) : domains.length === 0 ? (
              <Body>{t("qns.ownedNone")}</Body>
            ) : (
              domains.map((d) => (
                <Body key={d.tokenId}>
                  {d.name ?? `（名前未取得）`} — ID {d.tokenId.slice(0, 12)}…
                </Body>
              ))
            )}
            <Body>{t("qns.enumerateNote")}</Body>
          </Card>
          <Card>
            <Heading>{t("qns.lookupTitle")}</Heading>
            <Body>{t("qns.lookupNote")}</Body>
            <Field
              value={qnsInput}
              onChangeText={setQnsInput}
              placeholder={t("qns.lookupPlaceholder")}
            />
            <PrimaryButton
              label={t("qns.lookup")}
              onPress={handleQnsLookup}
              loading={qnsBusy}
            />
            {qnsError ? <Text style={styles.error}>{qnsError}</Text> : null}
            {qnsResult ? (
              <>
                <InfoRow label="ドメイン" value={qnsResult.name} />
                <InfoRow
                  label={t("qns.owner")}
                  value={qnsResult.owner ?? t("qns.available")}
                />
                {qnsResult.owner ? (
                  <InfoRow
                    label={t("qns.expires")}
                    value={
                      qnsResult.permanent
                        ? t("qns.permanent")
                        : (qnsResult.expiresIso ?? "—")
                    }
                  />
                ) : null}
                {qnsResult.owner &&
                address &&
                qnsResult.owner.toLowerCase() === address.toLowerCase() ? (
                  <Body>{t("qns.yours")}</Body>
                ) : null}
              </>
            ) : null}
          </Card>
          <Card>
            <Body>{t("explore.qnsEnded")}</Body>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addr: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
});
