import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Body,
  ChipPicker,
  Field,
  Heading,
  InfoRow,
  PrimaryButton,
} from "../components/controls";
import { GuppyMascot } from "../components/GuppyMascot";
import UnlockMethodForm from "../components/UnlockMethodForm";
import {
  Card,
  DontPanic,

  Screen,
  colors,
} from "../components/ui";
import {
  CHAINS,
  INFINITE_CONTRACTS,
  INFINITE_NFTS,
  QL1_CONTRACTS,
} from "../config/chains";
import { useI18n } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";
import { getProvider } from "../lib/onchain";
import { ST42_ADDRESS } from "../lib/protocol";

const APP_VERSION = "0.1.0"; // keep in sync with app.json "version"

export default function SettingsScreen() {
  const { t, lang, setLang } = useI18n();
  const wallet = useWallet();
  const balances = useBalances();

  const [phraseInput, setPhraseInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [addPhraseInput, setAddPhraseInput] = useState("");
  const [addKeyInput, setAddKeyInput] = useState("");
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [phraseChecked, setPhraseChecked] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showMethodForm, setShowMethodForm] = useState(false);
  const [methodSavedFlash, setMethodSavedFlash] = useState(false);

  // Technical details (moved off Home/Explore): live block numbers.
  const [blocks, setBlocks] = useState<Record<string, number | null>>({});
  const loadBlocks = useCallback(async () => {
    const out: Record<string, number | null> = {};
    await Promise.all(
      CHAINS.map(async (c) => {
        try {
          out[c.key] = await getProvider(c).getBlockNumber();
        } catch {
          out[c.key] = null;
        }
      }),
    );
    setBlocks(out);
  }, []);
  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const handleCreate = async () => {
    setFormError(null);
    try {
      await wallet.createWallet();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleImportPhrase = async () => {
    setFormError(null);
    try {
      await wallet.importPhrase(phraseInput);
      setPhraseInput("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleImportKey = async () => {
    setFormError(null);
    try {
      await wallet.importPrivateKey(keyInput);
      setKeyInput("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAddImportPhrase = async () => {
    setAddFormError(null);
    try {
      await wallet.importPhrase(addPhraseInput);
      setAddPhraseInput("");
    } catch (e) {
      setAddFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAddImportKey = async () => {
    setAddFormError(null);
    try {
      await wallet.importPrivateKey(addKeyInput);
      setAddKeyInput("");
    } catch (e) {
      setAddFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAddAccount = async () => {
    setAddFormError(null);
    try {
      await wallet.addAccount();
    } catch (e) {
      setAddFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const activeWalletMeta =
    wallet.wallets.find((w) => w.id === wallet.activeWalletId) ?? null;

  return (
    <Screen>
      {wallet.pendingPhrase ? (
        <Card>
          <Heading>{t("settings.recoveryTitle")}</Heading>
          <Text style={styles.phraseWarning}>
            {t("settings.recoveryWarning")}
          </Text>
          <Text style={styles.phrase}>{wallet.pendingPhrase}</Text>
          <Pressable
            style={styles.checkRow}
            onPress={() => setPhraseChecked((v) => !v)}
          >
            <Text style={styles.checkBox}>{phraseChecked ? "☑" : "☐"}</Text>
            <Text style={styles.bodyFlex}>
              {t("settings.recoveryCheck")}
            </Text>
          </Pressable>
          <PrimaryButton
            label={t("settings.recoveryClose")}
            onPress={() => {
              if (phraseChecked) wallet.confirmPhraseSaved();
            }}
          />
          {!phraseChecked ? (
            <Body>{t("settings.recoveryHint")}</Body>
          ) : null}
        </Card>
      ) : null}

      {wallet.info && wallet.pendingUnlockSetup ? (
        <Card>
          <Heading>{t("auth.methodTitle")}</Heading>
          <Body>{t("auth.methodNote")}</Body>
          <UnlockMethodForm
            initial={wallet.unlockMethod}
            onDone={() => setMethodSavedFlash(true)}
          />
          <Pressable onPress={wallet.completeUnlockSetup}>
            <Text style={styles.cancelText}>{t("auth.skipForNow")}</Text>
          </Pressable>
        </Card>
      ) : null}

      <Card>
        <Heading>{t("settings.wallet")}</Heading>
        {!wallet.info ? (
          <>
            <Body>
              {t("settings.walletIntro")}
            </Body>
            <PrimaryButton
              label={t("settings.createWallet")}
              onPress={handleCreate}
              loading={wallet.busy}
            />
            <Text style={styles.subHeading}>{t("settings.importPhraseTitle")}</Text>
            <Field
              value={phraseInput}
              onChangeText={setPhraseInput}
              placeholder={t("settings.importPhrasePlaceholder")}
            />
            <PrimaryButton
              label={t("settings.importPhrase")}
              onPress={handleImportPhrase}
              loading={wallet.busy}
            />
            <Text style={styles.subHeading}>{t("settings.importKeyTitle")}</Text>
            <Field
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder={t("settings.importKeyPlaceholder")}
            />
            <PrimaryButton
              label={t("settings.importKey")}
              onPress={handleImportKey}
              loading={wallet.busy}
            />
          </>
        ) : (
          <>
            <Body>
              {t("label.status")}: {wallet.unlocked ? t("settings.unlockedNote") : t("settings.locked")}
              {"\n"}{t("settings.kindLabel")}:{" "}
              {wallet.info.kind === "mnemonic"
                ? t("settings.kindPhrase")
                : t("settings.kindKey")}
            </Body>
            <Text style={styles.addrLabel}>{t("settings.addressCommon")}</Text>
            <Text style={styles.addr}>{wallet.info.evmAddress}</Text>
            <Text style={styles.addrLabel}>{t("settings.address42Alt")}</Text>
            <Text style={styles.addr}>{wallet.info.infiniteAddress}</Text>
            <Text style={styles.addrLabel}>{t("settings.addressQl1Alt")}</Text>
            <Text style={styles.addr}>{wallet.info.qomAddress}</Text>
            {wallet.wallets.length > 1 ? (
              <>
                <Text style={styles.subHeading}>
                  {t("wallet.switchWallet")}
                </Text>
                <ChipPicker
                  options={wallet.wallets.map((w, i) => ({
                    key: w.id,
                    label: `${t("wallet.walletLabel")} ${i + 1}`,
                  }))}
                  value={wallet.activeWalletId ?? ""}
                  onChange={(k) => wallet.switchWallet(k)}
                />
              </>
            ) : null}
            {activeWalletMeta && activeWalletMeta.accounts.length > 1 ? (
              <>
                <Text style={styles.subHeading}>
                  {t("wallet.switchAccount")}
                </Text>
                <ChipPicker
                  options={activeWalletMeta.accounts.map((a, i) => ({
                    key: String(i),
                    label: `${t("home.account")} ${i + 1}`,
                  }))}
                  value={String(wallet.activeAccountIndex)}
                  onChange={(k) => wallet.switchAccount(Number(k))}
                />
              </>
            ) : null}
            {wallet.info.kind === "mnemonic" ? (
              <>
                <PrimaryButton
                  label={t("wallet.addAccount")}
                  onPress={handleAddAccount}
                  loading={wallet.busy}
                />
                <Body>{t("wallet.addAccountNote")}</Body>
              </>
            ) : null}
            {wallet.unlocked ? (
              <PrimaryButton label={t("settings.lockButton")} onPress={wallet.lock} />
            ) : (
              <PrimaryButton
                label={
                  wallet.unlockMethod === "password"
                    ? t("settings.unlock")
                    : t("settings.unlockBio")
                }
                onPress={() => wallet.unlock()}
              />
            )}
            <Body>
              {t("auth.methodCurrent")}:{" "}
              {wallet.unlockMethod === "password"
                ? t("auth.methodPassword")
                : t("auth.methodBiometric")}
            </Body>
            {methodSavedFlash ? (
              <Text style={styles.doneText}>{t("auth.methodSaved")}</Text>
            ) : null}
            {showMethodForm ? (
              <UnlockMethodForm
                initial={wallet.unlockMethod}
                onDone={() => {
                  setShowMethodForm(false);
                  setMethodSavedFlash(true);
                }}
              />
            ) : (
              <Pressable
                onPress={async () => {
                  // Changing the gate first asks for the CURRENT one.
                  const ok = await wallet.requestAuth();
                  if (ok) {
                    setMethodSavedFlash(false);
                    setShowMethodForm(true);
                  }
                }}
              >
                <Text style={styles.linkText}>{t("auth.methodChange")}</Text>
              </Pressable>
            )}
            {confirmRemove ? (
              <>
                <Text style={styles.phraseWarning}>
                  {t("settings.deleteWarning")}
                </Text>
                <PrimaryButton
                  label={t("settings.deleteConfirm")}
                  onPress={async () => {
                    await wallet.removeWallet();
                    setConfirmRemove(false);
                  }}
                />
                <Pressable onPress={() => setConfirmRemove(false)}>
                  <Text style={styles.cancelText}>{t("settings.cancelWord")}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => setConfirmRemove(true)}>
                <Text style={styles.removeText}>{t("wallet.removeThis")}</Text>
              </Pressable>
            )}
          </>
        )}
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
      </Card>

      {wallet.info ? (
        <Card>
          <Heading>{t("wallet.addWallet")}</Heading>
          <Body>{t("wallet.addWalletNote")}</Body>
          <PrimaryButton
            label={t("settings.createWallet")}
            onPress={handleCreate}
            loading={wallet.busy}
          />
          <Text style={styles.subHeading}>{t("settings.importPhraseTitle")}</Text>
          <Field
            value={addPhraseInput}
            onChangeText={setAddPhraseInput}
            placeholder={t("settings.importPhrasePlaceholder")}
          />
          <PrimaryButton
            label={t("settings.importPhrase")}
            onPress={handleAddImportPhrase}
            loading={wallet.busy}
          />
          <Text style={styles.subHeading}>{t("settings.importKeyTitle")}</Text>
          <Field
            value={addKeyInput}
            onChangeText={setAddKeyInput}
            placeholder={t("settings.importKeyPlaceholder")}
          />
          <PrimaryButton
            label={t("settings.importKey")}
            onPress={handleAddImportKey}
            loading={wallet.busy}
          />
          {addFormError ? (
            <Text style={styles.errorText}>{addFormError}</Text>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Heading>{t("settings.language")}</Heading>
        <ChipPicker
          options={[
            { key: "ja", label: "日本語" },
            { key: "en", label: "English" },
          ]}
          value={lang}
          onChange={(k) => setLang(k === "en" ? "en" : "ja")}
        />
      </Card>

      <Card>
        <Heading>{t("settings.customTokens")}</Heading>
        {balances.customTokens.length === 0 ? (
          <Body>{t("settings.noCustomTokens")}</Body>
        ) : (
          balances.customTokens.map((ct) => (
            <React.Fragment key={`${ct.chainKey}-${ct.address}`}>
              <Body>
                {ct.symbol}（{ct.name}）—{" "}
                {CHAINS.find((c) => c.key === ct.chainKey)?.displayName}
                {"\n"}
                {ct.address}
              </Body>
              <Pressable
                onPress={() =>
                  balances.removeCustomToken(ct.chainKey, ct.address)
                }
              >
                <Text style={styles.removeText}>{t("tokens.remove")}</Text>
              </Pressable>
            </React.Fragment>
          ))
        )}
        <Body>{t("settings.customTokensNote")}</Body>
      </Card>

      <Card>
        <Heading>{t("settings.details")}</Heading>
        <Body>{t("settings.detailsNote")}</Body>
        {CHAINS.map((c) => (
          <View key={c.key} style={styles.detailBlock}>
            <Text style={styles.subHeading}>{c.formalName}</Text>
            <InfoRow label="EVM Chain ID" value={String(c.evmChainId)} />
            <InfoRow
              label="Cosmos Chain ID"
              value={c.cosmosChainId ?? "—"}
            />
            <InfoRow
              label={t("explore.block")}
              value={
                blocks[c.key] === undefined
                  ? t("common.loading")
                  : blocks[c.key] === null
                    ? t("common.fetchFailed")
                    : String(blocks[c.key])
              }
            />
            <Text style={styles.addrLabel}>RPC</Text>
            <Text style={styles.addr}>{c.evmRpcUrls[0]}</Text>
            <Text style={styles.addrLabel}>{t("settings.explorerLabel")}</Text>
            <Text style={styles.addr}>{c.explorerUrl}</Text>
          </View>
        ))}
        <PrimaryButton label={t("common.refresh")} onPress={loadBlocks} />
        <Text style={styles.subHeading}>{t("settings.mainContracts")}</Text>
        {[
          [t("settings.dexRouterInfinite"), INFINITE_CONTRACTS.dexRouter],
          [t("settings.dexFactoryInfinite"), INFINITE_CONTRACTS.dexFactory],
          [t("settings.dexRouterQl1"), QL1_CONTRACTS.dexRouter],
          [t("settings.dexFactoryQl1"), QL1_CONTRACTS.dexFactory],
          ["st42", ST42_ADDRESS],
          ["The Guide / Fluke", INFINITE_NFTS.theGuide],
          ["ZG13", INFINITE_NFTS.zg13],
          ["Starlight", INFINITE_CONTRACTS.starlightLedger],
          [`${t("settings.bridgeRouterPrefix")}QOM${t("settings.bridgeRouterSuffix")}`, INFINITE_CONTRACTS.bridgeRouterQom],
          [`${t("settings.bridgeRouterPrefix")}USDT${t("settings.bridgeRouterSuffix")}`, INFINITE_CONTRACTS.bridgeRouterUsdt],
          [`${t("settings.bridgeRouterPrefix")}USDC${t("settings.bridgeRouterSuffix")}`, INFINITE_CONTRACTS.bridgeRouterUsdc],
          [`${t("settings.bridgeRouterPrefix")}WBTC${t("settings.bridgeRouterSuffix")}`, INFINITE_CONTRACTS.bridgeRouterWbtc],
          ["QNS（.qom）", QL1_CONTRACTS.qnsDomains],
        ].map(([label, addr]) => (
          <React.Fragment key={label}>
            <Text style={styles.addrLabel}>{label}</Text>
            <Text style={styles.addr}>{addr}</Text>
          </React.Fragment>
        ))}
      </Card>

      <Card>
        <Heading>{t("settings.security")}</Heading>
        <Body>{t("settings.securityBody")}</Body>
      </Card>

      <Card>
        <Heading>{t("settings.about")}</Heading>
        <DontPanic compact tone="card" />
        <View style={styles.aboutRow}>
          <GuppyMascot size={58} />
          <View style={styles.aboutNameCol}>
            <Text style={styles.aboutName}>
              GuppyWallet — {t("settings.catchphrase")}
            </Text>
            <Text style={styles.aboutVersion}>
              {t("settings.version")}: {APP_VERSION}
            </Text>
          </View>
        </View>
        <Body>
          {t("home.catchphrase")}
          {"\n"}
          {t("settings.aboutGuide")}
        </Body>
        <Body>{t("settings.priceNote")}</Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  aboutRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  aboutNameCol: { flex: 1, gap: 2 },
  aboutName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  aboutVersion: { color: colors.muted, fontSize: 12 },
  detailBlock: { gap: 2, marginTop: 4 },
  subHeading: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  bodyFlex: { color: colors.muted, fontSize: 13, lineHeight: 19, flex: 1 },
  phrase: {
    color: colors.accent,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "600",
    backgroundColor: colors.panel,
    borderRadius: 10,
    padding: 12,
  },
  phraseWarning: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  checkRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  checkBox: { color: colors.accent, fontSize: 18 },
  addrLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  addr: { color: colors.text, fontSize: 12, lineHeight: 17 },
  errorText: { color: colors.dangerText, fontSize: 13 },
  removeText: { color: colors.dangerText, fontSize: 14, textAlign: "center" },
  cancelText: { color: colors.muted, fontSize: 14, textAlign: "center" },
  methodOption: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.panel,
  },
  methodOptionOn: { borderColor: colors.accent, borderWidth: 2 },
  methodRadio: { color: colors.accent, fontSize: 16, lineHeight: 20 },
  methodTexts: { flex: 1, gap: 2 },
  methodLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  methodNote: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  methodWarn: { color: colors.dangerText, fontSize: 12, lineHeight: 17 },
  doneText: { color: colors.positive, fontSize: 13 },
  linkText: {
    color: colors.accent,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 2,
  },
});
