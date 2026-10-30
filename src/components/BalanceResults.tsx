import React from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { explorerAddressUrl } from "../lib/balances";
import { useWatchAddress } from "../context/WatchAddressContext";
import { Card, colors } from "./ui";

/** Renders the last balance fetch: one card per chain, errors included. */
export function BalanceResults() {
  const { results, address } = useWatchAddress();
  if (!results) return null;
  return (
    <>
      {results.map((r) => (
        <Card key={r.chain.key}>
          <Text style={styles.chainName}>
            {r.chain.displayName}（Chain ID {r.chain.evmChainId}）
          </Text>
          {r.ok ? (
            <>
              <Text style={styles.balance}>
                {r.formatted} {r.symbol}
              </Text>
              <Text style={styles.meta}>
                RPC: {r.rpcUrl}
                {"\n"}Block: {r.blockNumber}
              </Text>
              <Pressable
                onPress={() => Linking.openURL(explorerAddressUrl(r.chain, address))}
              >
                <Text style={styles.link}>エクスプローラーで見る ↗</Text>
              </Pressable>
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
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  chainName: { color: colors.muted, fontSize: 13 },
  balance: { color: colors.text, fontSize: 24, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  link: { color: colors.accent, fontSize: 13 },
  errorText: { color: colors.dangerText, fontSize: 15, fontWeight: "600" },
});
