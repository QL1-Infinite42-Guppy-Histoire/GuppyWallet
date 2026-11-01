import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Body,
  Field,
  Heading,
  PrimaryButton,
} from "../components/controls";
import { GuppyMascot } from "../components/GuppyMascot";
import UnlockMethodForm from "../components/UnlockMethodForm";
import { Card, DontPanic, Screen, colors } from "../components/ui";
import { useI18n } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";

/**
 * First-run setup, shown by the App gate until a wallet exists (and
 * while the unlock-method step is still owed):
 *   welcome → create or import → choose how to unlock.
 * The step shown follows WalletContext state: a just-created wallet
 * first shows its recovery phrase once (pendingPhrase), then the
 * unlock-method step (pendingUnlockSetup); an import goes straight
 * to the method step. Adding more wallets/accounts later lives in
 * Settings and does not come back here.
 */
export default function OnboardingScreen() {
  const { t } = useI18n();
  const wallet = useWallet();

  const [phraseInput, setPhraseInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [phraseChecked, setPhraseChecked] = useState(false);

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

  // Step 2 of a create: the recovery phrase, shown exactly once.
  if (wallet.pendingPhrase) {
    return (
      <Screen>
        <DontPanic compact />
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
            <Text style={styles.bodyFlex}>{t("settings.recoveryCheck")}</Text>
          </Pressable>
          <PrimaryButton
            label={t("settings.recoveryClose")}
            onPress={() => {
              if (phraseChecked) wallet.confirmPhraseSaved();
            }}
          />
          {!phraseChecked ? <Body>{t("settings.recoveryHint")}</Body> : null}
        </Card>
      </Screen>
    );
  }

  // Step 3: choose how to unlock (fingerprint or app password).
  if (wallet.info && wallet.pendingUnlockSetup) {
    return (
      <Screen>
        <DontPanic compact />
        <Card>
          <Heading>{t("auth.methodTitle")}</Heading>
          <Body>{t("auth.methodNote")}</Body>
          <UnlockMethodForm
            initial={wallet.unlockMethod}
            onDone={wallet.completeUnlockSetup}
          />
          <Pressable onPress={wallet.completeUnlockSetup}>
            <Text style={styles.cancelText}>{t("auth.skipForNow")}</Text>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  // Step 1: welcome → create or import.
  return (
    <Screen>
      <DontPanic compact />
      <Card>
        <View style={styles.mascotCenter}>
          <GuppyMascot size={104} />
        </View>
        <Heading>{t("onboarding.welcomeTitle")}</Heading>
        <Body>{t("onboarding.welcomeBody")}</Body>
        <PrimaryButton
          label={t("settings.createWallet")}
          onPress={handleCreate}
          loading={wallet.busy}
        />
        <Text style={styles.subHeading}>
          {t("settings.importPhraseTitle")}
        </Text>
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
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mascotCenter: { alignItems: "center", paddingVertical: 6 },
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
  errorText: { color: colors.dangerText, fontSize: 13 },
  cancelText: { color: colors.muted, fontSize: 14, textAlign: "center" },
});
