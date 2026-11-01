import { useNavigation, useRoute } from "@react-navigation/native";
import { formatUnits } from "ethers";
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Body,
  ChipPicker,
  Field,
  Heading,
  PrimaryButton,
} from "../components/controls";
import {
  Card,

  Screen,
  TokenIcon,
  colors,
} from "../components/ui";
import {
  CHAINS,
  INFINITE_TOKENS,
  QL1_TOKENS,
  type ChainConfig,
} from "../config/chains";
import { useChainSelection } from "../context/ChainSelectionContext";
import { useI18n } from "../context/LanguageContext";
import { useBalances } from "../context/BalancesContext";
import { explorerAddressUrl } from "../lib/balances";
import {
  fetchTokenMetadata,
  type CustomToken,
} from "../lib/customTokens";
import { priceOf } from "../lib/prices";

interface Row {
  key: string;
  chain: ChainConfig;
  symbol: string;
  name: string;
  address: string | null;
  formatted: string | null;
  usdValue: number | null;
  custom: boolean;
}

/**
 * Full token list: search + chain filter + per-token detail + custom
 * token add (metadata read live from RPC). Balances come from
 * BalancesContext (real RPC data). Prices are the DEX-reserve USD
 * estimates where reliable; otherwise 価格未取得 — never fabricated.
 * The 24h change has no data source and always shows 未取得.
 */
export default function TokenListScreen() {
  const { t } = useI18n();
  const balances = useBalances();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { chainKey: homeChainKey } = useChainSelection();
  const [query, setQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

  // add-custom form. The chain starts from the chain selected on Home
  // (the switch there drives this form too); the user can still change
  // it here. Adding is two steps: check (read the token's real info
  // from the chain and show it) → confirm.
  const [addChainKey, setAddChainKey] = useState<string>(homeChainKey);
  const [addAddress, setAddAddress] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addDone, setAddDone] = useState<string | null>(null);
  const [preview, setPreview] = useState<CustomToken | null>(null);
  // Arriving from Home's "add token" entry surfaces the form first.
  const [focusAdd, setFocusAdd] = useState(false);

  useEffect(() => {
    const params = route.params ?? {};
    if (params.addToken) {
      setFocusAdd(true);
      if (params.chain === "infinite" || params.chain === "ql1") {
        setAddChainKey(params.chain);
      }
      navigation.setParams({ addToken: undefined, chain: undefined });
    }
  }, [route.params, navigation]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const customByAddr = new Map(
      balances.customTokens.map((c) => [
        `${c.chainKey}:${c.address.toLowerCase()}`,
        c,
      ]),
    );
    for (const chain of CHAINS) {
      const native = balances.results?.find((r) => r.chain.key === chain.key);
      out.push({
        key: `${chain.key}:native`,
        chain,
        symbol: chain.nativeSymbol,
        name: chain.nativeSymbol,
        address: null,
        formatted: native?.ok ? native.formatted : null,
        usdValue: null,
        custom: false,
      });
      for (const tr of balances.tokenResults ?? []) {
        if (!tr.ok || tr.balance.chainKey !== chain.key) continue;
        if (tr.balance.address === null) continue; // native already added
        const custom = customByAddr.get(
          `${chain.key}:${tr.balance.address.toLowerCase()}`,
        );
        let usdValue: number | null = null;
        if (chain.key === "infinite") {
          const p = priceOf(balances.prices, tr.balance.address);
          if (p.usd !== null && p.reliable) {
            usdValue =
              Number(formatUnits(tr.balance.raw, tr.balance.decimals)) * p.usd;
          }
        }
        out.push({
          key: `${chain.key}:${tr.balance.address}`,
          chain,
          symbol: tr.balance.symbol,
          name: custom?.name ?? tr.balance.symbol,
          address: tr.balance.address,
          formatted: tr.balance.formatted,
          usdValue,
          custom: !!custom,
        });
      }
    }
    return out;
  }, [balances.results, balances.tokenResults, balances.prices, balances.customTokens]);

  const filtered = rows.filter((r) => {
    if (chainFilter !== "all" && r.chain.key !== chainFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.symbol.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      (r.address ?? "").toLowerCase().includes(q)
    );
  });

  // Step 1: read the token's real info from the chain and show it as a
  // preview. Nothing is saved yet — the user confirms in step 2.
  const handleCheck = async () => {
    setAddError(null);
    setAddDone(null);
    setPreview(null);
    const chain = CHAINS.find((c) => c.key === addChainKey) ?? CHAINS[0];
    const addr = addAddress.trim();
    const listed =
      chain.key === "infinite" ? INFINITE_TOKENS : QL1_TOKENS;
    if (
      listed.some((tk) => tk.address.toLowerCase() === addr.toLowerCase()) ||
      balances.customTokens.some(
        (c) =>
          c.chainKey === chain.key &&
          c.address.toLowerCase() === addr.toLowerCase(),
      )
    ) {
      setAddError(t("tokens.alreadyAdded"));
      return;
    }
    setAddBusy(true);
    try {
      const meta = await fetchTokenMetadata(chain, addr);
      setPreview({
        chainKey: chain.key,
        address: addr,
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
      });
    } catch (e) {
      setAddError(
        `${t("tokens.addFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setAddBusy(false);
    }
  };

  // Step 2: the user checked the preview and taps add — only now is
  // the token saved (and its balance starts showing on Home).
  const handleConfirmAdd = async () => {
    if (!preview) return;
    setAddBusy(true);
    try {
      await balances.addCustomToken(preview);
      setAddDone(
        `${t("tokens.addedPrefix")}${preview.symbol}${t("tokens.addedMid")}${preview.name}${t("tokens.addedSuffix")}`,
      );
      setPreview(null);
      setAddAddress("");
    } catch (e) {
      setAddError(
        `${t("tokens.addFailedPrefix")}${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setAddBusy(false);
    }
  };

  const addChain = CHAINS.find((c) => c.key === addChainKey) ?? CHAINS[0];

  const listCard = (
      <Card>
        {filtered.length === 0 ? (
          <Body>{t("tokens.empty")}</Body>
        ) : (
          filtered.map((r) => {
            const open = openKey === r.key;
            return (
              <React.Fragment key={r.key}>
                <Pressable
                  style={styles.row}
                  onPress={() => setOpenKey(open ? null : r.key)}
                >
                  <View style={styles.rowLeft}>
                    <TokenIcon symbol={r.symbol} size={38} />
                    <View>
                      <Text style={styles.symbol}>
                        {r.symbol}
                        {r.custom ? (
                          <Text style={styles.customTag}>
                            {" "}
                            （{t("tokens.custom")}）
                          </Text>
                        ) : null}
                      </Text>
                      <Text style={styles.chainName}>{r.chain.displayName}</Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.amount}>
                      {r.formatted ?? t("common.unavailable")}
                    </Text>
                    <Text style={styles.usd}>
                      {r.usdValue !== null ? `≈ $${r.usdValue.toFixed(2)}` : ""}
                    </Text>
                  </View>
                </Pressable>
                {open ? (
                  <View style={styles.detail}>
                    <Body>
                      {t("common.address")}:{" "}
                      {r.address ?? t("tokens.nativeParens")}
                    </Body>
                    {r.address ? (
                      <Pressable
                        onPress={() =>
                          Linking.openURL(
                            `${r.chain.explorerUrl}/token/${r.address}`,
                          )
                        }
                      >
                        <Text style={styles.link}>
                          {t("explore.explorer")}
                        </Text>
                      </Pressable>
                    ) : balances.address ? (
                      <Pressable
                        onPress={() =>
                          Linking.openURL(
                            explorerAddressUrl(r.chain, balances.address!),
                          )
                        }
                      >
                        <Text style={styles.link}>
                          {t("explore.explorer")}
                        </Text>
                      </Pressable>
                    ) : null}
                    {r.custom && r.address ? (
                      <Pressable
                        onPress={() =>
                          balances.removeCustomToken(r.chain.key, r.address!)
                        }
                      >
                        <Text style={styles.remove}>{t("tokens.remove")}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </React.Fragment>
            );
          })
        )}
        <PrimaryButton
          label={t("common.refresh")}
          onPress={balances.refresh}
          loading={balances.loading}
        />
      </Card>
  );

  const addCard = (
      <Card>
        <Heading>{t("tokens.addCustom")}</Heading>
        <Body>{t("tokens.addCustomNote")}</Body>
        <ChipPicker
          options={CHAINS.map((c) => ({ key: c.key, label: c.displayName }))}
          value={addChainKey}
          onChange={(k) => {
            setAddChainKey(k);
            setPreview(null);
          }}
        />
        <Field
          value={addAddress}
          onChangeText={(v) => {
            setAddAddress(v);
            setPreview(null);
            setAddDone(null);
          }}
          placeholder={t("tokens.contractPlaceholder")}
        />
        {preview ? (
          <View style={styles.preview}>
            <Body>
              {t("tokens.tokenName")}: {preview.name}
            </Body>
            <Body>
              {t("tokens.symbol")}: {preview.symbol}
            </Body>
            <Body>
              {t("tokens.decimals")}: {preview.decimals}
            </Body>
            <Body>
              {t("common.address")}: {preview.address}
            </Body>
            <PrimaryButton
              label={t("tokens.add")}
              onPress={handleConfirmAdd}
              loading={addBusy}
            />
            <Pressable onPress={() => setPreview(null)}>
              <Text style={styles.cancel}>{t("tokens.cancel")}</Text>
            </Pressable>
          </View>
        ) : (
          <PrimaryButton
            label={`${t("tokens.check")}（${addChain.displayName}）`}
            onPress={handleCheck}
            loading={addBusy}
          />
        )}
        {addError ? <Text style={styles.error}>{addError}</Text> : null}
        {addDone ? <Text style={styles.done}>{addDone}</Text> : null}
      </Card>
  );

  return (
    <Screen>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder={t("tokens.searchPlaceholder")}
      />
      <ChipPicker
        options={[
          { key: "all", label: t("tokens.all") },
          ...CHAINS.map((c) => ({ key: c.key, label: c.displayName })),
        ]}
        value={chainFilter}
        onChange={setChainFilter}
      />
      {focusAdd ? (
        <>
          {addCard}
          {listCard}
        </>
      ) : (
        <>
          {listCard}
          {addCard}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    gap: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  symbol: { color: colors.text, fontSize: 15, fontWeight: "700" },
  customTag: { color: colors.cyan, fontSize: 11, fontWeight: "600" },
  chainName: { color: colors.muted, fontSize: 11 },
  rowRight: { alignItems: "flex-end" },
  amount: { color: colors.text, fontSize: 15, fontWeight: "600" },
  usd: { color: colors.muted, fontSize: 11 },
  detail: {
    gap: 4,
    paddingBottom: 8,
    paddingLeft: 48,
  },
  preview: { gap: 6, paddingTop: 2 },
  cancel: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 6,
  },
  link: { color: colors.accent, fontSize: 13 },
  remove: { color: colors.dangerText, fontSize: 13 },
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  done: { color: colors.positive, fontSize: 13 },
});
