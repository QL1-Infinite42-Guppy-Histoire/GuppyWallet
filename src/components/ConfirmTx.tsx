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
 * Flow: (unlock if needed) → prepare (gas estimate) → review sheet
 * showing chain / action / contract / amounts / estimated gas →
 * user taps confirm → local signing + send → hash + explorer link +
 * pending/success/failure state. The first-ever send carries an extra
 * "少額でテストしてください" warning.
 */

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

  useEffect(() => {
    if (!job) return;
    setPrepared(null);
    setHashes([]);
    setError(null);
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
              <Text style={styles.lineValue}>
                {chain.displayName}（EVM {chain.evmChainId}）
              </Text>
            </View>
            {job.lines.map((l) => (
              <View key={l.label} style={styles.lineRow}>
                <Text style={styles.lineLabel}>{l.label}</Text>
                <Text style={styles.lineValue}>{l.value}</Text>
              </View>
            ))}
            {phase === "review" || phase === "sending" || phase === "done" ? (
              <View style={styles.lineRow}>
                <Text style={styles.lineLabel}>ガス代（目安）</Text>
                <Text style={styles.lineValue}>
                  {prepared?.gasEstimateText ?? "—"}
                </Text>
              </View>
            ) : null}
            {firstSend && phase !== "done" ? (
              <View style={styles.firstSend}>
                <Text style={styles.firstSendText}>
                  ⚠️ 初めての送信です。必ず少額でテストしてください。未監査の試作版のため、
                  大きな金額は送らないでください。
                </Text>
              </View>
            ) : null}

            {phase === "locked" ? (
              <Text style={styles.note}>
                送信にはウォレットのロック解除（生体認証）が必要です。
              </Text>
            ) : null}
            {phase === "preparing" ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.note}>ガスを見積もっています…</Text>
              </View>
            ) : null}
            {phase === "sending" ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.note}>
                  署名して送信しました。チェーンの承認を待っています…
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
                      tx: {h.slice(0, 18)}…{h.slice(-8)} ↗
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
              <Text style={styles.buttonText}>生体認証でロック解除</Text>
            </Pressable>
          ) : null}
          {phase === "review" ? (
            <Pressable style={styles.button} onPress={handleConfirm}>
              <Text style={styles.buttonText}>内容を確認して署名・送信</Text>
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  center: { alignItems: "center", gap: 8, paddingVertical: 8 },
  firstSend: {
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  firstSendText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  success: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  hash: { color: colors.accent, fontSize: 13, paddingVertical: 2 },
  errorText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: "#0B0F19", fontSize: 15, fontWeight: "700" },
  cancel: { alignItems: "center", paddingVertical: 8 },
  cancelText: { color: colors.muted, fontSize: 14 },
});
