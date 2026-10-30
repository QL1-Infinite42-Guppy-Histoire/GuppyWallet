import type { Wallet } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ChainConfig } from "../config/chains";
import { useWallet } from "../context/WalletContext";
import { getHasSentTx, markHasSentTx } from "../lib/walletStore";
import { colors } from "./ui";

/**
 * Mandatory confirmation sheet for every transaction.
 *
 * Flow: (unlock if needed) → prepare (fee estimate) → review sheet in
 * plain words (where to / how much / fee estimate) → user taps
 * confirm → local signing + send → explorer link + pending/success/
 * failure state. Technical lines (contract addresses etc.) stay
 * available behind a 詳細 toggle — same safety data, plainer front.
 * The first-ever send carries an extra "まずは少額で" warning.
 */

/** Line labels that are technical detail, shown behind the toggle. */
const DETAIL_LABELS = new Set([
  "コントラクト",
  "ルーター",
  "ペアコントラクト",
  "バリデータアドレス",
  "署名",
]);

export interface TxLine {
  label: string;
  value: string;
}

export interface PreparedTx {
  gasEstimateText: string;
  send: () => Promise<string[]>;
}

export interface TxJob {
  title: string;
  chain: ChainConfig;
  lines: TxLine[];
  prepare: (signer: Wallet) => Promise<PreparedTx>;
}

type Phase =
  | "locked"
  | "preparing"
  | "review"
  | "sending"
  | "done"
  | "error";

export function ConfirmTxModal({
  job,
  onClose,
}: {
  job: TxJob | null;
  onClose: () => void;
}) {
  const wallet = useWallet();
  const [phase, setPhase] = useState<Phase>("locked");
  const [prepared, setPrepared] = useState<PreparedTx | null>(null);
  const [hashes, setHashes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [firstSend, setFirstSend] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!job) return;
    setPrepared(null);
    setHashes([]);
    setError(null);
    setShowDetails(false);
    setPhase(wallet.unlocked ? "preparing" : "locked");
    getHasSentTx()
      .then((has) => setFirstSend(!has))
      .catch(() => setFirstSend(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  useEffect(() => {
    if (!job || phase !== "preparing") return;
    let cancelled = false;
    (async () => {
      const signer = wallet.getSigner(job.chain);
      if (!signer) {
        if (!cancelled) setPhase("locked");
        return;
      }
      try {
        const p = await job.prepare(signer);
        if (!cancelled) {
          setPrepared(p);
          setPhase("review");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, phase]);

  const handleUnlock = useCallback(async () => {
    const ok = await wallet.unlock();
    if (ok) setPhase("preparing");
  }, [wallet]);

  const handleConfirm = useCallback(async () => {
    if (!prepared) return;
    setPhase("sending");
    try {
      const result = await prepared.send();
      setHashes(result.filter((h) => h));
      await markHasSentTx().catch(() => undefined);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [prepared]);

  if (!job) return null;
  const { chain } = job;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{job.title}</Text>
          <ScrollView style={styles.scroll}>
            <View style={styles.lineRow}>
              <Text style={styles.lineLabel}>チェーン</Text>
              <Text style={styles.lineValue}>{chain.displayName}</Text>
            </View>
            {job.lines
              .filter((l) => !DETAIL_LABELS.has(l.label))
              .map((l) => (
                <View key={l.label} style={styles.lineRow}>
                  <Text style={styles.lineLabel}>{l.label}</Text>
                  <Text style={styles.lineValue}>{l.value}</Text>
                </View>
              ))}
            {phase === "review" || phase === "sending" || phase === "done" ? (
              <View style={styles.lineRow}>
                <Text style={styles.lineLabel}>手数料の目安</Text>
                <Text style={styles.lineValue}>
                  {prepared?.gasEstimateText ?? "—"}
                </Text>
              </View>
            ) : null}
            {job.lines.some((l) => DETAIL_LABELS.has(l.label)) ? (
              <>
                <Pressable onPress={() => setShowDetails((v) => !v)}>
                  <Text style={styles.detailToggle}>
                    {showDetails ? "詳細を閉じる" : "詳細を見る"}
                  </Text>
                </Pressable>
                {showDetails
                  ? job.lines
                      .filter((l) => DETAIL_LABELS.has(l.label))
                      .map((l) => (
                        <View key={l.label} style={styles.lineRow}>
                          <Text style={styles.lineLabel}>{l.label}</Text>
                          <Text style={styles.lineValue}>{l.value}</Text>
                        </View>
                      ))
                  : null}
              </>
            ) : null}
            {firstSend && phase !== "done" ? (
              <View style={styles.firstSend}>
                <Text style={styles.firstSendText}>
                  ⚠️ 初めての送信です。間違いを防ぐため、まずは少額でテストしてください。
                </Text>
              </View>
            ) : null}

            {phase === "locked" ? (
              <Text style={styles.note}>
                送るには、指紋などでロックを解除してください。
              </Text>
            ) : null}
            {phase === "preparing" ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.note}>手数料を計算しています…</Text>
              </View>
            ) : null}
            {phase === "sending" ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.note}>
                  送信しました。結果が反映されるまで少しお待ちください…
                </Text>
              </View>
            ) : null}
            {phase === "done" ? (
              <>
                <Text style={styles.success}>✅ 送信が完了しました</Text>
                {hashes.map((h) => (
                  <Pressable
                    key={h}
                    onPress={() =>
                      Linking.openURL(`${chain.explorerUrl}/tx/${h}`)
                    }
                  >
                    <Text style={styles.hash}>
                      取引の詳細を見る ↗
                    </Text>
                  </Pressable>
                ))}
              </>
            ) : null}
            {phase === "error" ? (
              <Text style={styles.errorText}>送信できませんでした：{error}</Text>
            ) : null}
          </ScrollView>

          {phase === "locked" ? (
            <Pressable style={styles.button} onPress={handleUnlock}>
              <Text style={styles.buttonText}>ロックを解除する</Text>
            </Pressable>
          ) : null}
          {phase === "review" ? (
            <Pressable style={styles.button} onPress={handleConfirm}>
              <Text style={styles.buttonText}>この内容で送る</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.cancel}
            onPress={onClose}
            disabled={phase === "sending"}
          >
            <Text style={styles.cancelText}>
              {phase === "done" ? "閉じる" : "キャンセル"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Hook: holds the current job and renders the confirmation modal. */
export function useTxFlow() {
  const [job, setJob] = useState<TxJob | null>(null);
  const startTx = useCallback((j: TxJob) => setJob(j), []);
  const modal = (
    <ConfirmTxModal job={job} onClose={() => setJob(null)} />
  );
  return { startTx, modal };
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
    padding: 18,
    gap: 10,
    maxHeight: "85%",
  },
  scroll: { flexGrow: 0 },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 3,
  },
  lineLabel: { color: colors.muted, fontSize: 13 },
  lineValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  detailToggle: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 6,
  },
  center: { alignItems: "center", gap: 8, paddingVertical: 8 },
  firstSend: {
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  firstSendText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  success: { color: colors.positive, fontSize: 15, fontWeight: "700" },
  hash: { color: colors.accent, fontSize: 13, paddingVertical: 2 },
  errorText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  button: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: colors.primary,
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  cancel: { alignItems: "center", paddingVertical: 8 },
  cancelText: { color: colors.muted, fontSize: 14 },
});
