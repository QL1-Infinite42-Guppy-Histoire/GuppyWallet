import { CameraView, useCameraPermissions } from "expo-camera";
import { Contract, isAddress, parseUnits } from "ethers";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTxFlow, type TxJob } from "../components/ConfirmTx";
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
import {
  CHAINS,
  INFINITE_TOKENS,
  QL1_TOKENS,
  type ChainConfig,
} from "../config/chains";
import { useI18n } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";
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

/** Extract an EVM address from a scanned QR payload (plain 0x… or ethereum: URI). */
function parseScannedAddress(raw: string): string | null {
  let s = raw.trim();
  if (s.toLowerCase().startsWith("ethereum:")) {
    s = s.slice("ethereum:".length);
    s = s.split("@")[0].split("?")[0].split("/")[0];
  }
  return isAddress(s) ? s : null;
}

/**
 * Send flow (EVM). Reached from Home's Send quick action. Wallet
 * management lives in Settings; balances live on Home — this screen is
 * only the transfer form + QR scanner + confirmation flow.
 */
export default function SendScreen() {
  const { t } = useI18n();
  const wallet = useWallet();
  const balances = useBalances();
  const { startTx, modal } = useTxFlow();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [formError, setFormError] = useState<string | null>(null);

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
        "読み取ったQRは、送金用アドレスではありませんでした。",
      );
    }
  };

  const sendChain: ChainConfig =
    CHAINS.find((c) => c.key === sendChainKey) ?? CHAINS[0];
  const sendTokens = useMemo(() => {
    const listed =
      sendChain.key === "infinite" ? INFINITE_TOKENS : QL1_TOKENS;
    const customs = balances.customTokens
      .filter((c) => c.chainKey === sendChain.key)
      .map((c) => ({
        symbol: c.symbol,
        address: c.address as string,
        decimals: c.decimals,
      }));
    const list = [...listed, ...customs];
    return [
      {
        key: "native",
        label: sendChain.nativeSymbol,
        symbol: sendChain.nativeSymbol,
        address: null as string | null,
        decimals: sendChain.nativeDecimals,
      },
      ...list.map((tk) => ({
        key: tk.address,
        label: tk.symbol,
        symbol: tk.symbol,
        address: tk.address as string | null,
        decimals: tk.decimals,
      })),
    ];
  }, [sendChain, balances.customTokens]);
  const sendToken =
    sendTokens.find((tk) => tk.key === sendTokenKey) ?? sendTokens[0];

  /** Percentage chips for the send amount, from the token's balance. */
  const sendBalanceEntry = balances.tokenResults?.find((tk) => {
    if (!tk.ok || tk.balance.chainKey !== sendChain.key) return false;
    if (sendToken.address === null) return tk.balance.address === null;
    return (
      tk.balance.address?.toLowerCase() === sendToken.address.toLowerCase()
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

  const handleSend = () => {
    setFormError(null);
    if (!isAddress(recipient.trim())) {
      setFormError("送り先のアドレスが正しくありません。");
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
      <Title>{t("send.title")}</Title>
      <PrototypeWarning />
      {modal}

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

      {!wallet.info ? (
        <Card>
          <Heading>{t("common.noWallet")}</Heading>
          <Body>{t("common.noWalletBody")}</Body>
        </Card>
      ) : (
        <Card>
          <Heading>送金</Heading>
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
            options={sendTokens.map((tk) => ({ key: tk.key, label: tk.label }))}
            value={sendToken.key}
            onChange={setSendTokenKey}
          />
          <View style={styles.recipientRow}>
            <View style={styles.recipientField}>
              <Field
                value={recipient}
                onChangeText={setRecipient}
                placeholder="送り先のアドレス 0x…"
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
          <PrimaryButton label="確認画面へ" onPress={handleSend} />
          <Body>
            送る前に、次の画面で送り先・金額・手数料を必ず確認してください。
          </Body>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        </Card>
      )}

      <Card>
        <Heading>QL1のもう一つの送り方（準備中）</Heading>
        <Body>
          QL1には別の送金方法もありますが、このアプリではまだ使えません。
          qom1… / infinite1… で始まるアドレスへの送金は、この画面ではできません。
        </Body>
        <DisabledButton label="この送り方は準備中" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorText: { color: colors.dangerText, fontSize: 13 },
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
