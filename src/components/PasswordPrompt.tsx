import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../context/LanguageContext";
import { Field, PrimaryButton } from "./controls";
import { colors } from "./ui";

/**
 * In-app password gate, shown when the user's chosen unlock method
 * is "password" (instead of the system biometric dialog). Rendered by
 * WalletProvider at the root, so it can appear over any screen —
 * including above the ConfirmTx sheet at signing time. onSubmit
 * resolves true when the password matched (the provider then closes
 * the prompt); false keeps the prompt open with an error line.
 */
export default function PasswordPrompt({
  visible,
  reason,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  reason: string;
  onSubmit: (password: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setPw("");
      setWrong(false);
      setBusy(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    setWrong(false);
    const ok = await onSubmit(pw);
    setBusy(false);
    if (!ok) setWrong(true);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t("auth.passwordTitle")}</Text>
          <Text style={styles.reason}>{reason}</Text>
          <Field
            value={pw}
            onChangeText={(v) => {
              setPw(v);
              setWrong(false);
            }}
            placeholder={t("auth.passwordPlaceholder")}
            secure
          />
          {wrong ? (
            <Text style={styles.error}>{t("auth.passwordWrong")}</Text>
          ) : null}
          <PrimaryButton
            label={t("auth.unlockButton")}
            onPress={submit}
            loading={busy}
          />
          <Pressable onPress={onCancel}>
            <Text style={styles.cancel}>{t("tokens.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(3,6,18,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.glassSheet,
    borderRadius: 24,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  reason: { color: colors.muted, fontSize: 13 },
  error: { color: colors.dangerText, fontSize: 13 },
  cancel: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 4,
  },
});
