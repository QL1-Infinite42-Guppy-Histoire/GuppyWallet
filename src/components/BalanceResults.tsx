import { formatUnits } from "ethers";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useBalances } from "../context/BalancesContext";
import { useI18n } from "../context/LanguageContext";
import { priceOf } from "../lib/prices";
import { prettyAmount } from "../lib/onchain";
import { TokenIcon, colors } from "./ui";

/** Format a JPY amount the way consumer wallets do: ¥12,345 / ¥13.76. */
export function formatJpy(v: number): string {
  return `¥${v.toLocaleString("ja-JP", {
    maximumFractionDigits: v < 100 ? 2 : 0,
  })}`;
}

interface RowData {
  key: string;
  symbol: string;
  chainName: string;
  amountText: string;
  jpyValue: number | null;
  usdValue: number | null;
}

/**
 * Plain Phantom-style token list for Home: icon, name, amount held,
 * and the JPY value on the right. Shows ONLY the chain selected on
 * Home (chainKey). Prices use the same DEX-reserve USD estimates as
 * the totals (unreliable ones are excluded, exactly as before) — they
 * just carry no labels here. QL1 rows price from the QL1 map (native
 * QOM anchored to the bridged-QOM price on 42 Chain). No technical
 * details (those live in Settings → 詳細情報）.
 */
export function BalanceResults({
  jpyRate,
  chainKey,
}: {
  jpyRate: number | null;
  chainKey: "infinite" | "ql1";
}) {
  const { results, tokenResults, prices, ql1Prices } = useBalances();
  const { t } = useI18n();
  if (!results) return null;

  const rows: RowData[] = [];
  const failedChains: string[] = [];
  let anyTokenError = false;

  for (const r of results) {
    if (r.chain.key !== chainKey) continue;
    if (!r.ok) {
      failedChains.push(r.chain.displayName);
      continue;
    }
    const priceMap = r.chain.key === "infinite" ? prices : ql1Prices;
    // native coin row
    const nativeAmount = Number(r.formatted);
    let nativeUsd: number | null = null;
    {
      const p = priceOf(priceMap, null);
      if (p.usd !== null && p.reliable) nativeUsd = nativeAmount * p.usd;
    }
    rows.push({
      key: `${r.chain.key}:native`,
      symbol: r.symbol,
      chainName: r.chain.displayName,
      amountText: `${prettyAmount(r.formatted)} ${r.symbol}`,
      usdValue: nativeUsd,
      jpyValue: nativeUsd !== null && jpyRate !== null ? nativeUsd * jpyRate : null,
    });
    // token rows for this chain
    for (const t of tokenResults ?? []) {
      if (!t.ok) {
        if (t.chainKey === r.chain.key) anyTokenError = true;
        continue;
      }
      if (t.balance.chainKey !== r.chain.key || t.balance.address === null) {
        continue;
      }
      let usd: number | null = null;
      {
        const p = priceOf(priceMap, t.balance.address);
        if (p.usd !== null && p.reliable) {
          usd =
            Number(formatUnits(t.balance.raw, t.balance.decimals)) * p.usd;
        }
      }
      rows.push({
        key: `${r.chain.key}:${t.balance.address}`,
        symbol: t.balance.symbol,
        chainName: r.chain.displayName,
        amountText: `${prettyAmount(t.balance.formatted)} ${t.balance.symbol}`,
        usdValue: usd,
        jpyValue: usd !== null && jpyRate !== null ? usd * jpyRate : null,
      });
    }
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <TokenIcon symbol={row.symbol} size={42} />
          <View style={styles.left}>
            <Text style={styles.symbol}>{row.symbol}</Text>
            <Text style={styles.chainName}>{row.chainName}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.amount}>{row.amountText}</Text>
            {row.jpyValue !== null ? (
              <Text style={styles.value}>{formatJpy(row.jpyValue)}</Text>
            ) : row.usdValue !== null ? (
              <Text style={styles.value}>${row.usdValue.toFixed(2)}</Text>
            ) : null}
          </View>
        </View>
      ))}
      {failedChains.map((name) => (
        <Text key={name} style={styles.note}>
          {t("balance.loadFailedPrefix")}{name}{t("balance.loadFailedSuffix")}
        </Text>
      ))}
      {anyTokenError ? (
        <Text style={styles.note}>{t("balance.someFailed")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  left: { flex: 1, gap: 1 },
  // Rows sit directly on the galaxy (no card) — on-space colors.
  symbol: { color: colors.onSpace, fontSize: 16, fontWeight: "700" },
  chainName: { color: colors.onSpaceMuted, fontSize: 11 },
  right: { alignItems: "flex-end", gap: 1 },
  amount: { color: colors.onSpace, fontSize: 15, fontWeight: "600" },
  value: { color: colors.onSpaceMuted, fontSize: 12 },
  note: { color: colors.onSpaceMuted, fontSize: 12, paddingVertical: 4 },
});
