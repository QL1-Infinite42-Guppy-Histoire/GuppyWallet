import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import {
  Body,
  ChipPicker,
  Field,
  Heading,
  PrimaryButton,
} from "../components/controls";
import {
  Card,
  DontPanic,
  PrototypeWarning,
  Screen,
  Title,
  colors,
} from "../components/ui";
import { CHAINS } from "../config/chains";
import { useI18n } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";

const APP_VERSION = "0.1.0"; // keep in sync with app.json "version"

/**
 * Settings: the ONLY home of wallet management (create / import /
 * lock / delete), the JA/EN language switch, custom-token management,
 * security notes and About. Balances live on Home; sending lives in
 * the Send screen — nothing is duplicated here.
 */
export default function SettingsScreen() {
  const { t, lang, setLang } = useI18n();
  const wallet = useWallet();
  const balances = useBalances();

  const [phraseInput, setPhraseInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [phraseChecked, setPhraseChecked] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

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

  return (
    <Screen>
      <Title>{t("tab.settings")}</Title>
      <PrototypeWarning />

      {wallet.pendingPhrase ? (
        <Card>
          <Heading>リカバリーフレーズ（1回だけ表示）</Heading>
          <Text style={styles.phraseWarning}>
            ⚠️ このフレーズはウォレットの全資産への鍵です。紙に書いて安全な場所に保管し、
            スクリーンショット・クラウド・他人への共有は絶対にしないでください。
            この画面を閉じると二度と表示されません。
          </Text>
          <Text style={styles.phrase}>{wallet.pendingPhrase}</Text>
          <Pressable
            style={styles.checkRow}
            onPress={() => setPhraseChecked((v) => !v)}
          >
            <Text style={styles.checkBox}>{phraseChecked ? "☑" : "☐"}</Text>
            <Text style={styles.bodyFlex}>
              紙に書き写して保管しました。フレーズを失うと資産を復元できません。
            </Text>
          </Pressable>
          <PrimaryButton
            label="確認して閉じる"
            onPress={() => {
              if (phraseChecked) wallet.confirmPhraseSaved();
            }}
          />
          {!phraseChecked ? (
            <Body>チェックを入れると閉じられます。</Body>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Heading>{t("settings.wallet")}</Heading>
        {!wallet.info ? (
          <>
            <Body>
              ウォレットを作成するか、既存のリカバリーフレーズ／秘密鍵をインポートできます。
              鍵は端末の安全領域（SecureStore＝Android Keystore）にだけ保存され、
              外部に送信されることはありません。
            </Body>
            <PrimaryButton
              label="新しいウォレットを作成"
              onPress={handleCreate}
              loading={wallet.busy}
            />
            <Text style={styles.subHeading}>リカバリーフレーズでインポート</Text>
            <Field
              value={phraseInput}
              onChangeText={setPhraseInput}
              placeholder="単語をスペース区切りで入力（12/24語）"
            />
            <PrimaryButton
              label="フレーズをインポート"
              onPress={handleImportPhrase}
              loading={wallet.busy}
            />
            <Text style={styles.subHeading}>秘密鍵でインポート</Text>
            <Field
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="0x…（64桁の16進数）"
            />
            <PrimaryButton
              label="秘密鍵をインポート"
              onPress={handleImportKey}
              loading={wallet.busy}
            />
          </>
        ) : (
          <>
            <Body>
              状態: {wallet.unlocked ? "ロック解除中（5分で自動ロック）" : "ロック中"}
              {"\n"}種類:{" "}
              {wallet.info.kind === "mnemonic"
                ? "リカバリーフレーズ（BIP-39, m/44'/60'/0'/0/0）"
                : "秘密鍵"}
            </Body>
            <Text style={styles.addrLabel}>EVMアドレス（両チェーン共通）</Text>
            <Text style={styles.addr}>{wallet.info.evmAddress}</Text>
            <Text style={styles.addrLabel}>Cosmosアドレス（Infinite・表示のみ）</Text>
            <Text style={styles.addr}>{wallet.info.infiniteAddress}</Text>
            <Text style={styles.addrLabel}>Cosmosアドレス（QL1・表示のみ）</Text>
            <Text style={styles.addr}>{wallet.info.qomAddress}</Text>
            {wallet.unlocked ? (
              <PrimaryButton label="ロックする" onPress={wallet.lock} />
            ) : (
              <PrimaryButton
                label="生体認証でロック解除"
                onPress={() => wallet.unlock()}
              />
            )}
            {confirmRemove ? (
              <>
                <Text style={styles.phraseWarning}>
                  ⚠️ ウォレットをこの端末から削除します。リカバリーフレーズを
                  保管していない場合、資産に二度とアクセスできなくなります。
                </Text>
                <PrimaryButton
                  label="本当に削除する（生体認証）"
                  onPress={async () => {
                    await wallet.removeWallet();
                    setConfirmRemove(false);
                  }}
                />
                <Pressable onPress={() => setConfirmRemove(false)}>
                  <Text style={styles.cancelText}>やめる</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => setConfirmRemove(true)}>
                <Text style={styles.removeText}>ウォレットを削除する</Text>
              </Pressable>
            )}
          </>
        )}
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
      </Card>

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
        <Body>追加は「ホーム → トークン一覧」から行えます。</Body>
      </Card>

      <Card>
        <Heading>{t("settings.security")}</Heading>
        <Body>{t("settings.securityBody")}</Body>
      </Card>

      <Card>
        <Heading>{t("settings.about")}</Heading>
        <DontPanic compact />
        <Body>
          Zaphod Wallet — {t("settings.catchphrase")}
          {"\n"}
          ひとつのウォレットに、無限の可能性を。
          {"\n"}
          {t("settings.version")}: {APP_VERSION}
          {"\n"}
          このウォレットは Infinite Drivechain と QL1 のための
          銀河ヒッチハイカー向けガイドです。生命、宇宙、そして万物についての
          答えは 42。タオル（TOWEL）もちゃんとトークン一覧に入っています。
          慌てず、少額からどうぞ。
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.bgDeep,
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
});
