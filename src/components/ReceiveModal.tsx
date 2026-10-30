import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useWallet } from "../context/WalletContext";
import { colors } from "./ui";

/**
 * Receive view: a LARGE QR of the wallet's own address.
 *
 * The EVM address is shared by both chains; the bech32 (Cosmos) forms
 * are derived from the same key and shown for display/receiving via
 * Cosmos-side tooling. The QR always encodes the plain address text.
 */

type RecvKind = "evm-infinite" | "evm-ql1" | "cosmos-infinite" | "cosmos-ql1";

const OPTIONS: { key: RecvKind; label: string }[] = [
  { key: "evm-infinite", label: "42 Chain" },
  { key: "evm-ql1", label: "QL1" },
  { key: "cosmos-infinite", label: "42 Chain（別形式）" },
  { key: "cosmos-ql1", label: "QL1（別形式）" },
];

export function ReceiveModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const wallet = useWallet();
  const [kind, setKind] = useState<RecvKind>("evm-infinite");
  const [copied, setCopied] = useState(false);

  const info = wallet.info;
  const address = !info
    ? null
    : kind === "evm-infinite" || kind === "evm-ql1"
      ? info.evmAddress
      : kind === "cosmos-infinite"
        ? info.infiniteAddress
        : info.qomAddress;

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>受取</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll}>
            {!info || !address ? (
              <Text style={styles.note}>
                ウォレットを作成／インポートすると、受取用アドレスとQRコードが
                ここに表示されます。
              </Text>
            ) : (
              <>
                <View style={styles.chipRow}>
                  {OPTIONS.map((o) => {
                    const active = o.key === kind;
                    return (
                      <Pressable
                        key={o.key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setKind(o.key)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.note}>
                  {kind.startsWith("evm")
                    ? "このアドレスは 42 Chain / QL1 のどちらにも使えます。送るチェーンを間違えないでください。"
                    : "別形式のアドレスです。ふつうの送金には、上の「42 Chain / QL1」のアドレスを使ってください。"}
                </Text>
                <View style={styles.qrWrap}>
                  <QRCode
                    value={address}
                    size={232}
                    color="#0B0F19"
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <Text style={styles.addrLabel}>アドレス</Text>
                <Text style={styles.addr}>{address}</Text>
                <Pressable style={styles.copyButton} onPress={handleCopy}>
                  <Text style={styles.copyButtonText}>
                    {copied ? "コピーしました ✓" : "アドレスをコピー"}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    maxHeight: "88%",
  },
  scroll: { flexGrow: 0 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: colors.text, fontSize: 19, fontWeight: "800" },
  closeText: { color: colors.muted, fontSize: 18, paddingHorizontal: 4 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.panel,
  },
  chipActive: { backgroundColor: colors.gradStart, borderColor: colors.gradStart },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  qrWrap: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginVertical: 14,
  },
  addrLabel: { color: colors.muted, fontSize: 12, marginBottom: 2 },
  addr: { color: colors.text, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  copyButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: colors.primary,
  },
  copyButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
