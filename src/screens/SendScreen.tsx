import { useRoute } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Contract, isAddress, parseUnits } from "ethers";
import React, { useEffect, useMemo, useState } from "react";
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
import { Card, Screen, colors } from "../components/ui";
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
  const route = useRoute<any>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [formError, setFormError] = useState<string | null>(null);

  // send form — the chain can be preselected from Home's chain toggle
  const [sendChainKey, setSendChainKey] = useState<string>(
    (route.params?.chain as string) ?? "infinite",
  );
  useEffect(() => {
    const c = route.params?.chain as string | undefined;
    if (c && (c === "infinite" || c === "ql1")) {
      setSendChainKey(c);
      setSendTokenKey("native");
    }
  }, [route.params?.chain]);
  const [sendTokenKey, setSendTokenKey] = useState<string>("native");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const openScanner = async () => {
    setScanNote(null);
    if (Platform.OS === "web") {
      setScanNote(t("send.qrWebNote"));
      return;
    }
    let granted = cameraPermission?.granted ?? false;
    if (!granted) {
      const res = await requestCameraPermission();
      granted = res.granted;
    }
    if (!granted) {
      setScanNote(t("send.qrNoPermission"));
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
      setScanNote(t("send.qrNotAddress"));
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
      setFormError(t("send.errBadAddress"));
      return;
    }
    let value: bigint;
    try {
      value = parseUnits(amount, sendToken.decimals);
      if (value <= 0n) throw new Error("zero");
    } catch {
      setFormError(t("err.checkAmount"));
      return;
    }
    const chain = sendChain;
    const token = sendToken;
    const to = recipient.trim();
    const job: TxJob = {
      title: t("send.title"),
      chain,
      lines: [
        { label: t("label.action"), value: `${t("send.jobActionPrefix")}${token.symbol}${t("send.jobActionSuffix")}` },
        { label: t("send.jobTo"), value: to },
        { label: t("label.amount"), value: `${amount} ${token.symbol}` },
        {
          label: t("label.contract"),
          value: token.address ?? t("send.jobNative"),
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
              {t("send.scanHint")}
            </Text>
            <Pressable
              style={styles.scannerClose}
              onPress={() => setScannerOpen(false)}
            >
              <Text style={styles.scannerCloseText}>{t("confirm.cancel")}</Text>
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
          <Heading>{t("send.title")}</Heading>
          <Body>{t("confirm.chain")}</Body>
          <ChipPicker
            options={CHAINS.map((c) => ({ key: c.key, label: c.displayName }))}
            value={sendChainKey}
            onChange={(k) => {
              setSendChainKey(k);
              setSendTokenKey("native");
            }}
          />
          <Body>{t("label.token")}</Body>
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
                placeholder={t("send.toPlaceholder")}
              />
            </View>
            <Pressable style={styles.scanButton} onPress={openScanner}>
              <Text style={styles.scanButtonText}>{t("send.qrButton")}</Text>
            </Pressable>
          </View>
          {scanNote ? <Text style={styles.scanNote}>{scanNote}</Text> : null}
          <Field
            value={amount}
            onChangeText={setAmount}
            placeholder={`${t("bridge.amountPrefix")}${sendToken.symbol}${t("bridge.amountSuffixParen")}`}
            keyboardType="decimal-pad"
          />
          <PercentChips
            onSelect={applySendPercent}
            disabled={!sendBalanceEntry?.ok}
          />
          <PrimaryButton label={t("send.toConfirm")} onPress={handleSend} />
          <Body>
            {t("send.confirmNote")}
          </Body>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        </Card>
      )}

      <Card>
        <Heading>{t("send.qomHeading")}</Heading>
        <Body>
          {t("send.qomBody")}
        </Body>
        <DisabledButton label={t("send.qomDisabled")} />
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
