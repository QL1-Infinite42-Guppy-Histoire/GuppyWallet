import { formatUnits, parseUnits } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useTxFlow } from "./ConfirmTx";
import {
  Body,
  Field,
  Heading,
  InfoRow,
  PercentChips,
  PrimaryButton,
} from "./controls";
import { Card, colors } from "./ui";
import { useI18n } from "../context/LanguageContext";
import { tr } from "../i18n";
import { useWallet } from "../context/WalletContext";
import { percentOfBalance, prettyAmount } from "../lib/onchain";
import {
  fetchFlukeRecord,
  fetchFlukeState,
  fetchGuideItem,
  fetchSettleSignature,
  fetchStarlightState,
  flukeBoostJob,
  flukeCommitJob,
  flukeRevealJob,
  flukeSettleJob,
  starlightClaimJob,
  starlightRegisterJob,
  type FlukeRecord,
  type FlukeState,
  type GuideItemState,
  type StarlightState,
} from "../lib/zaphod";

/**
 * Fluke + Starlight, run natively in-app against The Guide contract
 * itself (research/ZAPHOD_FRONTEND.md). No external site, no
 * WalletConnect. settle is the one step that needs a signature issued
 * by the official API — until the API serves one, the UI honestly
 * stays in the「公式APIの署名待ち」state.
 */
export default function FlukeSection() {
  const wallet = useWallet();
  const { t } = useI18n();
  const address = wallet.info?.evmAddress ?? null;
  const { startTx, modal } = useTxFlow();

  const [fluke, setFluke] = useState<FlukeState | null>(null);
  const [starlight, setStarlight] = useState<StarlightState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [itemIdText, setItemIdText] = useState("");
  const [item, setItem] = useState<GuideItemState | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [boostAmount, setBoostAmount] = useState("");

  const [recordIdText, setRecordIdText] = useState("");
  const [record, setRecord] = useState<FlukeRecord | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [sigState, setSigState] = useState<
    "idle" | "fetching" | "found" | "missing"
  >("idle");
  const [signature, setSignature] = useState<string | null>(null);

  const [bulkIdsText, setBulkIdsText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [f, s] = await Promise.all([
        fetchFlukeState(address),
        fetchStarlightState(),
      ]);
      setFluke(f);
      setStarlight(s);
    } catch (e) {
      setLoadError(
        `${tr("fluke.loadFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLookupItem = useCallback(async () => {
    setItemError(null);
    setItem(null);
    let id: bigint;
    try {
      id = BigInt(itemIdText.trim());
      if (id < 0n) throw new Error("negative");
    } catch {
      setItemError(tr("fluke.itemIdError"));
      return;
    }
    try {
      setItem(await fetchGuideItem(id, address));
    } catch (e) {
      setItemError(
        `Guide #${id.toString()}${tr("fluke.itemFetchFailedMid")}${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [itemIdText, address]);

  const handleLookupRecord = useCallback(async () => {
    setRecordError(null);
    setRecord(null);
    setSignature(null);
    setSigState("idle");
    let id: bigint;
    try {
      id = BigInt(recordIdText.trim());
      if (id < 0n) throw new Error("negative");
    } catch {
      setRecordError(tr("fluke.recordIdError"));
      return;
    }
    try {
      setRecord(await fetchFlukeRecord(id, address));
    } catch (e) {
      setRecordError(
        `${tr("fluke.recordCheckFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [recordIdText, address]);

  const handleFetchSignature = useCallback(async () => {
    if (!record) return;
    setSigState("fetching");
    const sig = await fetchSettleSignature(record.rn);
    if (sig) {
      setSignature(sig);
      setSigState("found");
    } else {
      setSigState("missing");
    }
  }, [record]);

  const parseBulkIds = (): bigint[] | null => {
    try {
      const ids = bulkIdsText
        .split(/[,\s]+/)
        .filter((s) => s.length > 0)
        .map((s) => BigInt(s));
      if (ids.length === 0) throw new Error("empty");
      return ids;
    } catch {
      setBulkError(t("fluke.bulkError"));
      return null;
    }
  };

  const boostJob = () => {
    if (!item) return;
    let amount: bigint;
    try {
      amount = parseUnits(boostAmount, 18);
      if (amount <= 0n) throw new Error("zero");
    } catch {
      setItemError(t("fluke.boostAmountError"));
      return;
    }
    startTx(flukeBoostJob(item.id, amount, formatUnits(amount, 18)));
  };

  return (
    <>
      {modal}
      <Card>
        <Heading>{t("fluke.heading")}</Heading>
        <Body>
          {t("fluke.body")}
        </Body>
        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        {fluke ? (
          <>
            <InfoRow
              label={t("fluke.gameState")}
              value={fluke.paused ? t("fluke.paused") : t("fluke.open")}
            />
            <InfoRow
              label={t("fluke.entryFee")}
              value={`${prettyAmount(fluke.priceFormatted)} ZAP`}
            />
            <InfoRow
              label={t("fluke.revealFee")}
              value={`${prettyAmount(fluke.revealPriceFormatted)}${t("fluke.revealFeeSuffix")}`}
            />
            <InfoRow
              label={t("fluke.poolA")}
              value={
                fluke.poolAFormatted
                  ? `${prettyAmount(fluke.poolAFormatted)} ZAP`
                  : "—"
              }
            />
            <InfoRow
              label={t("fluke.poolB")}
              value={
                fluke.poolBFormatted
                  ? `${prettyAmount(fluke.poolBFormatted)} ZAP`
                  : "—"
              }
            />
            <InfoRow
              label={t("fluke.leader")}
              value={
                fluke.leaderId
                  ? `Guide #${fluke.leaderId}${t("fluke.leaderScorePrefix")}${fluke.leaderScoreFormatted ? prettyAmount(fluke.leaderScoreFormatted) : "—"}${t("fluke.leaderScoreSuffix")}`
                  : "—"
              }
            />
            <InfoRow
              label={t("fluke.yourZap")}
              value={
                fluke.zapBalanceFormatted !== null
                  ? `${prettyAmount(fluke.zapBalanceFormatted)} ZAP`
                  : t("fluke.noWallet")
              }
            />
            <InfoRow
              label={t("fluke.yourGuides")}
              value={fluke.guideBalance ?? t("fluke.noWallet")}
            />
          </>
        ) : (
          <Body>{t("common.loading")}</Body>
        )}
        <PrimaryButton label={t("common.refresh")} onPress={load} />
        {fluke && !fluke.paused ? (
          <PrimaryButton
            label={`${t("fluke.joinPrefix")}${prettyAmount(fluke.priceFormatted)} ZAP${t("fluke.joinSuffix")}`}
            onPress={() => startTx(flukeCommitJob(fluke))}
          />
        ) : null}
        <Body>
          {t("fluke.joinNote")}
        </Body>
      </Card>

      <Card>
        <Heading>{t("fluke.lookupHeading")}</Heading>
        <Body>
          {t("fluke.lookupBody")}
        </Body>
        <Field
          value={itemIdText}
          onChangeText={setItemIdText}
          placeholder={t("fluke.itemIdPlaceholder")}
          keyboardType="decimal-pad"
        />
        <PrimaryButton label={t("qns.lookup")} onPress={handleLookupItem} />
        {itemError ? <Text style={styles.error}>{itemError}</Text> : null}
        {item ? (
          <>
            <InfoRow label={t("nftx.owner")} value={item.owner} />
            <InfoRow
              label={t("guide.score")}
              value={item.scoreFormatted ? prettyAmount(item.scoreFormatted) : "—"}
            />
            <InfoRow
              label={t("guide.burned")}
              value={item.burnedFormatted ? prettyAmount(item.burnedFormatted) : "—"}
            />
            <InfoRow label={t("guide.tier")} value={item.tier !== null ? String(item.tier) : "—"} />
            <InfoRow label={t("guide.forms")} value={item.formCount ?? "—"} />
            <InfoRow
              label={t("fluke.emblem")}
              value={item.currentEmblem ?? "—"}
            />
            {item.text ? (
              <InfoRow label={t("guide.text")} value={item.text} />
            ) : null}
            {item.starlight ? (
              <>
                <InfoRow
                  label={t("fluke.starlightRegistered")}
                  value={item.starlight.registered ? t("guide.registered") : t("guide.notRegistered")}
                />
                <InfoRow
                  label={t("guide.earned")}
                  value={`${prettyAmount(item.starlight.earnedFormatted)} [42]`}
                />
              </>
            ) : null}
            {item.mine && fluke ? (
              <>
                <PrimaryButton
                  label={`${t("fluke.flipPrefix")}${prettyAmount(fluke.revealPriceFormatted)}${t("fluke.flipSuffix")}`}
                  onPress={() => startTx(flukeRevealJob(item.id, fluke))}
                />
                <Field
                  value={boostAmount}
                  onChangeText={setBoostAmount}
                  placeholder={t("fluke.boostPlaceholder")}
                  keyboardType="decimal-pad"
                />
                <PercentChips
                  onSelect={(pct) => {
                    if (fluke.zapBalanceRaw !== null) {
                      setBoostAmount(
                        percentOfBalance(fluke.zapBalanceRaw, pct, 18),
                      );
                    }
                  }}
                  disabled={fluke.zapBalanceRaw === null}
                />
                <PrimaryButton label={t("fluke.boostButton")} onPress={boostJob} />
                {item.starlight && !item.starlight.registered ? (
                  <PrimaryButton
                    label={t("fluke.registerButton")}
                    onPress={() =>
                      startTx(starlightRegisterJob([BigInt(item.id)]))
                    }
                  />
                ) : null}
                {item.starlight &&
                item.starlight.registered &&
                item.starlight.earnedRaw > 0n ? (
                  <PrimaryButton
                    label={t("stake.claimTitle")}
                    onPress={() =>
                      startTx(starlightClaimJob([BigInt(item.id)]))
                    }
                  />
                ) : null}
              </>
            ) : item.mine ? null : (
              <Body>{t("fluke.notYours")}</Body>
            )}
          </>
        ) : null}
      </Card>

      <Card>
        <Heading>{t("job.flukeSettle")}</Heading>
        <Body>
          {t("fluke.settleBody")}
        </Body>
        <Field
          value={recordIdText}
          onChangeText={setRecordIdText}
          placeholder={t("fluke.recordPlaceholder")}
          keyboardType="decimal-pad"
        />
        <PrimaryButton label={t("fluke.checkRecord")} onPress={handleLookupRecord} />
        {recordError ? <Text style={styles.error}>{recordError}</Text> : null}
        {record ? (
          record.exists ? (
            <>
              <InfoRow label={t("nftx.owner")} value={record.owner} />
              <InfoRow label={t("label.targetGuide")} value={`#${record.item}`} />
              <InfoRow
                label={t("label.status")}
                value={record.settled ? t("fluke.settled") : t("fluke.unsettled")}
              />
              {!record.settled && record.mine ? (
                <>
                  <PrimaryButton
                    label={t("fluke.getPasscode")}
                    onPress={handleFetchSignature}
                  />
                  {sigState === "fetching" ? (
                    <Body>{t("fluke.checkingPasscode")}</Body>
                  ) : null}
                  {sigState === "missing" ? (
                    <Text style={styles.todo}>
                      {t("fluke.noPasscodeYet")}
                    </Text>
                  ) : null}
                  {sigState === "found" && signature ? (
                    <PrimaryButton
                      label={t("fluke.settleButton")}
                      onPress={() =>
                        startTx(flukeSettleJob(record.id, signature))
                      }
                    />
                  ) : null}
                </>
              ) : !record.settled ? (
                <Body>{t("fluke.recordNotYours")}</Body>
              ) : null}
            </>
          ) : (
            <Body>{t("fluke.recordNotFound")}</Body>
          )
        ) : null}
      </Card>

      <Card>
        <Heading>{t("star.heading")}</Heading>
        <Body>
          {t("star.body")}
        </Body>
        {starlight ? (
          <>
            <InfoRow
              label={t("star.period")}
              value={starlight.currentEpoch ?? "—"}
            />
            <InfoRow
              label={t("star.totalCollected")}
              value={
                starlight.totalInFormatted
                  ? `${prettyAmount(starlight.totalInFormatted)} 42`
                  : "—"
              }
            />
            <InfoRow
              label={t("star.registration")}
              value={starlight.registerPaused ? t("star.paused") : t("star.open")}
            />
          </>
        ) : (
          <Body>{t("common.loading")}</Body>
        )}
        <Field
          value={bulkIdsText}
          onChangeText={setBulkIdsText}
          placeholder={t("star.idsPlaceholder")}
        />
        {bulkError ? <Text style={styles.error}>{bulkError}</Text> : null}
        <PrimaryButton
          label={t("star.registerBulk")}
          onPress={() => {
            const ids = parseBulkIds();
            if (ids) startTx(starlightRegisterJob(ids));
          }}
        />
        <PrimaryButton
          label={t("star.claimBulk")}
          onPress={() => {
            const ids = parseBulkIds();
            if (ids) startTx(starlightClaimJob(ids));
          }}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  todo: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  addr: { color: colors.muted, fontSize: 11, lineHeight: 15 },
});
