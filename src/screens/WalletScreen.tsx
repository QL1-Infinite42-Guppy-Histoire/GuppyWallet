import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { BalanceResults } from "../components/BalanceResults";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { useWatchAddress } from "../context/WatchAddressContext";
import {
  WALLET_CREATION_ENABLED,
  hasStoredWalletMarker,
  isBiometricAvailable,
} from "../lib/walletStore";

export default function WalletScreen() {
  const { address, setAddress, loading, error, refresh } = useWatchAddress();
  const [biometric, setBiometric] = useState<boolean | null>(null);
  const [hasMarker, setHasMarker] = useState<boolean | null>(null);

  useEffect(() => {
    isBiometricAvailable().then(setBiometric).catch(() => setBiometric(false));
    hasStoredWalletMarker().then(setHasMarker).catch(() => setHasMarker(false));
  }, []);

  return (
    <Screen>
      <Title>ウォレット</Title>
      <PrototypeWarning />

      <Card>
        <Text style={styles.heading}>アドレスをウォッチ（読み取り専用）</Text>
        <Text style={styles.body}>
          公開アドレスを貼ると、42（Infinite）と QOM（QL1）の残高を実際のRPCから取得します。
          秘密鍵やニーモニックはここに入力しないでください。
        </Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="0x…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={refresh} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0B0F19" />
          ) : (
            <Text style={styles.buttonText}>残高を取得</Text>
          )}
        </Pressable>
      </Card>

      <BalanceResults />

      <Card>
        <Text style={styles.heading}>ウォレットの作成／インポート</Text>
        <Text style={styles.body}>
          この試作版では無効化しています（WALLET_CREATION_ENABLED ={" "}
          {String(WALLET_CREATION_ENABLED)}）。鍵保管の置き場所（SecureStore＝Android
          Keystore）と生体認証ゲートの土台だけを用意してあります。監査を通すまでは
          本物のニーモニックを扱う機能は有効にしません。
        </Text>
        <Text style={styles.body}>
          生体認証が使える端末か: {biometric === null ? "確認中…" : biometric ? "はい" : "いいえ"}
          {"\n"}保存済みウォレットの目印: {hasMarker ? "あり" : "なし"}
        </Text>
        <Pressable style={[styles.button, styles.buttonDisabled]} disabled>
          <Text style={styles.buttonText}>作成／インポート（準備中）</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 16, fontWeight: "600" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  input: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#0B0F19", fontSize: 15, fontWeight: "700" },
  errorText: { color: colors.dangerText, fontSize: 13 },
});
