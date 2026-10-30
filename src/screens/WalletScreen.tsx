import { CameraView, useCameraPermissions } from "expo-camera";
import { isAddress, parseUnits } from "ethers";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BalanceResults } from "../components/BalanceResults";
import { useTxFlow, type TxJob } from "../components/ConfirmTx";
import { ReceiveModal } from "../components/ReceiveModal";
import {
  Body,
  ChipPicker,
  DisabledButton,
  Field,
  Heading,
  PercentChips,
  PrimaryButton,
} from "../components/controls";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";
import {
  CHAINS,
  INFINITE_TOKENS,
  QL1_TOKENS,
  type ChainConfig,
} from "../config/chains";
import {
  ERC20_WRITE_ABI,
  nativeGasReserve,
  percentOfBalance,
} from "../lib/onchain";
import {
  estimateOrFallback,
  gasCostNative,
  sendAndWait,
} from "../lib/tx";
import { Contract } from "ethers";

/** Extract an EVM address from a scanned QR payload (plain 0x… or ethereum: URI). */
function parseScannedAddress(raw: string): string | null {
  let s = raw.trim();
  if (s.toLowerCase().startsWith("ethereum:")) {
    s = s.slice("ethereum:".length);
    s = s.split("@")[0].split("?")[0].split("/")[0];
  }
  return isAddress(s) ? s : null;
}

export default function WalletScreen() {
  const wallet = useWallet();
  const balances = useBalances();
  const { startTx, modal } = useTxFlow();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [phraseInput, setPhraseInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [phraseChecked, setPhraseChecked] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  // send form
  const [sendChainKey, setSendChainKey] = useState<string>("infinite");
  const [sendTokenKey, setSendTokenKey] = useState<string>("native");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const openScanner = async () => {
    setScanNote(null);
    if (Platform.OS === "web") {
      setScanNote(
        "WebプレビューではQRスキャンは使えません。アドレスを貼り付けてください。",
      );
      return;
    }
    let granted = cameraPermission?.granted ?? false;
    if (!granted) {
      const res = await requestCameraPermission();
      granted = res.granted;
    }
    if (!granted) {
      setScanNote(
        "カメラの許可がないためQRスキャンは使えません。端末の設定で許可するか、アドレスを貼り付けてください。",
      );
      return;
    }
    setScannerOpen(true);
  };

  const handleBarcodeScanned = (data: string) => {
    const addr = parseScannedAddress(data);
    setScannerOpen(false);
    if (addr) {
      setRecipient(addr);
      setScanNote(null);
    } else {
      setScanNote(
        "読み取ったQRはEVMアドレスではありませんでした。内容を確認してください。",
      );
    }
  };

  const sendChain: ChainConfig =
    CHAINS.find((c) => c.key === sendChainKey) ?? CHAINS[0];
  const sendTokens = useMemo(() => {
    const list = sendChain.key === "infinite" ? INFINITE_TOKENS : QL1_TOKENS;
    return [
      {
        key: "native",
        label: sendChain.nativeSymbol,
        symbol: sendChain.nativeSymbol,
        address: null as string | null,
        decimals: sendChain.nativeDecimals,
      },
      ...list.map((t) => ({
        key: t.address,
        label: t.symbol,
        symbol: t.symbol,
        address: t.address as string | null,
        decimals: t.decimals,
      })),
    ];
  }, [sendChain]);
  const sendToken =
    sendTokens.find((t) => t.key === sendTokenKey) ?? sendTokens[0];

  /** Percentage chips for the send amount, from the token's balance. */
  const sendBalanceEntry = balances.tokenResults?.find((t) => {
    if (!t.ok || t.balance.chainKey !== sendChain.key) return false;
    if (sendToken.address === null) return t.balance.address === null;
    return (
      t.balance.address?.toLowerCase() === sendToken.address.toLowerCase()
    );
  });
  const applySendPercent = async (pct: number) => {
    if (!sendBalanceEntry || !sendBalanceEntry.ok) return;
    // MAX on the native coin keeps a plain-transfer gas reserve back.
    const reserve =
      pct === 100 && sendToken.address === null
        ? await nativeGasReserve(sendChain, 21000n)
        : 0n;
    setAmount(
      percentOfBalance(
        sendBalanceEntry.balance.raw,
        pct,
        sendToken.decimals,
        reserve,
      ),
    );
  };

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

  const handleSend = () => {
    setFormError(null);
    if (!isAddress(recipient.trim())) {
      setFormError("送信先アドレス（0x…）が正しくありません。");
      return;
    }
    let value: bigint;
    try {
      value = parseUnits(amount, sendToken.decimals);
      if (value <= 0n) throw new Error("zero");
    } catch {
      setFormError("数量を確認してください。");
      return;
    }
    const chain = sendChain;
    const token = sendToken;
    const to = recipient.trim();
    const job: TxJob = {
      title: "送金",
      chain,
      lines: [
        { label: "アクション", value: `${token.symbol} を送金` },
        { label: "送信先", value: to },
        { label: "数量", value: `${amount} ${token.symbol}` },
        {
          label: "コントラクト",
          value: token.address ?? "（ネイティブ送金）",
        },
      ],
      prepare: async (signer) => {
        let tx;
        if (token.address === null) {
          tx = { to, value };
        } else {
          const contract = new Contract(token.address, ERC20_WRITE_ABI, signer) as any;
          tx = {
            to: token.address,
            data: contract.interface.encodeFunctionData("transfer", [to, value]),
          };
        }
        const gas = await estimateOrFallback(
          signer,
          tx,
          token.address === null ? 21000n : 65000n,
        );
        return {
          gasEstimateText: await gasCostNative(signer, gas, chain.nativeSymbol),
          send: async () => [await sendAndWait(signer, tx)],
        };
      },
    };
    startTx(job);
  };

  return (
    <Screen>
      <Title>ウォレット</Title>
      <PrototypeWarning />
      {modal}
      <ReceiveModal
        visible={receiveOpen}
        onClose={() => setReceiveOpen(false)}
      />

      {/* QR scanner (native only — never rendered on web) */}
      <Modal
        visible={scannerOpen}
        animationType="slide"
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={styles.scannerWrap}>
          {Platform.OS !== "web" ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => handleBarcodeScanned(data)}
            />
          ) : null}
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerHint}>
              送金先アドレスのQRコードを枠内に合わせてください
            </Text>
            <Pressable
              style={styles.scannerClose}
              onPress={() => setScannerOpen(false)}
            >
              <Text style={styles.scannerCloseText}>キャンセル</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
        <Heading>マイウォレット</Heading>
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
            <PrimaryButton
              label="受取（QRコードを表示）"
              onPress={() => setReceiveOpen(true)}
            />
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

      {wallet.info ? (
        <Card>
          <Heading>送金（EVM）</Heading>
          <Body>チェーン</Body>
          <ChipPicker
            options={CHAINS.map((c) => ({ key: c.key, label: c.displayName }))}
            value={sendChainKey}
            onChange={(k) => {
              setSendChainKey(k);
              setSendTokenKey("native");
            }}
          />
          <Body>トークン</Body>
          <ChipPicker
            options={sendTokens.map((t) => ({ key: t.key, label: t.label }))}
            value={sendToken.key}
            onChange={setSendTokenKey}
          />
          <View style={styles.recipientRow}>
            <View style={styles.recipientField}>
              <Field
                value={recipient}
                onChangeText={setRecipient}
                placeholder="送信先アドレス 0x…"
              />
            </View>
            <Pressable style={styles.scanButton} onPress={openScanner}>
              <Text style={styles.scanButtonText}>QR読取</Text>
            </Pressable>
          </View>
          {scanNote ? <Text style={styles.scanNote}>{scanNote}</Text> : null}
          <Field
            value={amount}
            onChangeText={setAmount}
            placeholder={`数量（${sendToken.symbol}）`}
            keyboardType="decimal-pad"
          />
          <PercentChips
            onSelect={applySendPercent}
            disabled={!sendBalanceEntry?.ok}
          />
          <PrimaryButton label="確認画面へ（送金）" onPress={handleSend} />
          <Body>
            送信前に、チェーン・送信先・数量・ガス代を確認画面で必ず確認してください。
          </Body>
        </Card>
      ) : null}

      {wallet.info ? (
        <Card>
          <Heading>残高（マイウォレット）</Heading>
          <Body>
            あなたのウォレットの残高を実際のRPCから取得します。
          </Body>
          {balances.error ? (
            <Text style={styles.errorText}>{balances.error}</Text>
          ) : null}
          <PrimaryButton
            label="残高を取得／更新"
            onPress={balances.refresh}
            loading={balances.loading}
          />
        </Card>
      ) : null}

      <BalanceResults />

      <Card>
        <Heading>QL1 / Cosmos側の送金・ステーキング</Heading>
        <Body>
          Cosmosトランザクションの署名経路はまだ接続していません（情報不足／TODO）。
          上記の bech32 アドレス（qom1… / infinite1…）は表示のみです。
          QL1の委任は公式手順では Cosmos tx 方式のため、対応は今後の課題です。
        </Body>
        <DisabledButton label="Cosmos送金（準備中）" />
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
    backgroundColor: "#0B0F19",
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
  recipientRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  recipientField: { flex: 1 },
  scanButton: {
    borderColor: colors.gradStart,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
  },
  scanButtonText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  scanNote: { color: colors.accentWarm, fontSize: 12, lineHeight: 17 },
  scannerWrap: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    gap: 16,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  scannerHint: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  scannerClose: {
    borderColor: "#FFFFFF",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  scannerCloseText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
