import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { explorerAddressUrl } from "../lib/balances";
import { useBalances } from "../context/BalancesContext";
import { priceOf } from "../lib/prices";
import { prettyAmount } from "../lib/onchain";
import { Card, TokenIcon, colors } from "./ui";

/**
 * Renders the last balance fetch: native balance cards per chain, plus a
 * token list per chain (with DEX-derived USD estimates on Infinite when
 * a reliable price route exists).
 */
export function BalanceResults() {
  const { results, tokenResults, prices, address } = useBalances();
  if (!results) return null;
  return (
    <>
      {results.map((r) => {
        const tokens = (tokenResults ?? []).filter(
          (t) =>
            t.ok &&
            t.balance.chainKey === r.chain.key &&
            t.balance.address !== null,
        );
        const tokenErrors = (tokenResults ?? []).filter(
          (t) => !t.ok && t.chainKey === r.chain.key,
        );
        return (
          <Card key={r.chain.key}>
            <Text style={styles.chainName}>
              {r.chain.displayName}（Chain ID {r.chain.evmChainId}）
            </Text>
            {r.ok ? (
              <>
                <View style={styles.nativeRow}>
                  <TokenIcon symbol={r.symbol} size={44} />
                  <View style={styles.nativeRight}>
                    <Text style={styles.balance}>
                      {prettyAmount(r.formatted)} {r.symbol}
                    </Text>
                    <Text style={styles.meta}>ネイティブ通貨</Text>
                  </View>
                </View>
                {r.chain.key === "infinite"
                  ? (() => {
                      const p = priceOf(prices, null);
                      return p.usd !== null && p.reliable ? (
                        <Text style={styles.meta}>
                          参考価格: 1 {r.symbol} ≈ ${p.usd.toFixed(2)}（
                          {p.route}）
                        </Text>
                      ) : null;
                    })()
                  : null}
                <Text style={styles.meta}>
                  RPC: {r.rpcUrl}
                  {"\n"}Block: {r.blockNumber}
                </Text>
                {address ? (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(explorerAddressUrl(r.chain, address))
                    }
                  >
                    <Text style={styles.link}>エクスプローラーで見る ↗</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.errorText}>取得に失敗しました</Text>
                <Text style={styles.meta}>
                  RPC: {r.rpcUrl}
                  {"\n"}
                  {r.error}
                </Text>
              </>
            )}
            {tokens.length > 0 ? (
              <View style={styles.tokenList}>
                <Text style={styles.tokenHeader}>トークン</Text>
                {tokens.map((t) =>
                  t.ok ? (
                    <View key={t.balance.address} style={styles.tokenRow}>
                      <View style={styles.tokenLeft}>
                        <TokenIcon symbol={t.balance.symbol} size={38} />
                        <Text style={styles.tokenSymbol}>
                          {t.balance.symbol}
                        </Text>
                      </View>
                      <View style={styles.tokenRight}>
                        <Text style={styles.tokenAmount}>
                          {t.balance.formatted}
                        </Text>
                        {r.chain.key === "infinite"
                          ? (() => {
                              const p = priceOf(prices, t.balance.address);
                              const value =
                                p.usd !== null && p.reliable
                                  ? Number(t.balance.formatted.replace(/,/g, "")) *
                                    p.usd
                                  : null;
                              return (
                                <Text style={styles.tokenUsd}>
                                  {value !== null && value > 0
                                    ? `≈ $${value.toFixed(2)}`
                                    : p.usd !== null && !p.reliable
                                      ? "価格不確実"
                                      : ""}
                                </Text>
                              );
                            })()
                          : null}
                      </View>
                    </View>
                  ) : null,
                )}
                {tokenErrors.length > 0 ? (
                  <Text style={styles.meta}>
                    一部トークンの取得に失敗しました（
                    {tokenErrors
                      .map((t) => (!t.ok ? t.symbol : ""))
                      .filter(Boolean)
                      .join(", ")}
                    ）
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  chainName: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  nativeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  nativeRight: { flex: 1, gap: 2 },
  balance: { color: colors.text, fontSize: 26, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  link: { color: colors.accent, fontSize: 13 },
  errorText: { color: colors.dangerText, fontSize: 15, fontWeight: "600" },
  tokenList: { marginTop: 10, gap: 2 },
  tokenHeader: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  tokenLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  tokenSymbol: { color: colors.text, fontSize: 15, fontWeight: "700" },
  tokenRight: { alignItems: "flex-end" },
  tokenAmount: { color: colors.text, fontSize: 15, fontWeight: "600" },
  tokenUsd: { color: colors.muted, fontSize: 11 },
});
