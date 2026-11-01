import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import {
  isBiometricAvailable,
  type UnlockMethod,
} from "../lib/walletStore";
import { Field, PrimaryButton } from "./controls";
import { colors } from "./ui";

/**
 * Unlock-method picker: used by the setup step right after a wallet
 * is created / imported (Settings and first-run onboarding), and
 * again by the "change" flow in Settings. Two plain options; the
 * password option reveals a set + confirm pair of fields. Saving goes
 * through wallet.chooseUnlockMethod (only a salted hash of the
 * password is ever stored). Devices without biometrics still get the
 * password option — and the biometric one keeps working through the
 * device PIN, which the note under it says when biometrics are absent.
 */
export default function UnlockMethodForm({
  initial,
  onDone,
}: {
  initial: UnlockMethod;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const wallet = useWallet();
  const [method, setMethod] = useState<UnlockMethod>(initial);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioOk, setBioOk] = useState<boolean | null>(null);

  useEffect(() => {
    isBiometricAvailable()
      .then(setBioOk)
      .catch(() => setBioOk(false));
  }, []);

  const save = async () => {
    setError(null);
    if (method === "password") {
      if (pw1.length < 6) {
        setError(t("auth.passwordTooShort"));
        return;
      }
      if (pw1 !== pw2) {
        setError(t("auth.passwordMismatch"));
        return;
      }
    }
    setBusy(true);
    try {
      await wallet.chooseUnlockMethod(
        method,
        method === "password" ? pw1 : undefined,
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        style={[
          styles.methodOption,
          method === "biometric" && styles.methodOptionOn,
        ]}
        onPress={() => setMethod("biometric")}
      >
        <Text style={styles.methodRadio}>
          {method === "biometric" ? "●" : "○"}
        </Text>
        <View style={styles.methodTexts}>
          <Text style={styles.methodLabel}>{t("auth.methodBiometric")}</Text>
          <Text style={styles.methodNote}>
            {t("auth.methodBiometricNote")}
          </Text>
          {bioOk === false ? (
            <Text style={styles.methodWarn}>
              {t("auth.methodBiometricUnavailable")}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        style={[
          styles.methodOption,
          method === "password" && styles.methodOptionOn,
        ]}
        onPress={() => setMethod("password")}
      >
        <Text style={styles.methodRadio}>
          {method === "password" ? "●" : "○"}
        </Text>
        <View style={styles.methodTexts}>
          <Text style={styles.methodLabel}>{t("auth.methodPassword")}</Text>
          <Text style={styles.methodNote}>{t("auth.methodPasswordNote")}</Text>
        </View>
      </Pressable>
      {method === "password" ? (
        <>
          <Field
            value={pw1}
            onChangeText={setPw1}
            placeholder={t("auth.newPassword")}
            secure
          />
          <Field
            value={pw2}
            onChangeText={setPw2}
            placeholder={t("auth.confirmPassword")}
            secure
          />
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={t("auth.methodSave")}
        onPress={save}
        loading={busy}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  error: { color: colors.dangerText, fontSize: 13 },
});
