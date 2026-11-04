import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CHAINS, INFINITE_TOKENS } from "../config/chains";
import type { BalanceResult } from "../lib/balances";
import {
  loadCustomTokens,
  saveCustomTokens,
  type CustomToken,
} from "../lib/customTokens";
import { fetchChainBalances, type TokenBalanceResult } from "../lib/onchain";
import {
  fetchInfinitePrices,
  fetchQl1Prices,
  priceOf,
  type InfinitePrices,
  type Ql1Prices,
} from "../lib/prices";
import { useWallet } from "./WalletContext";

/**
 * Balances of the app's OWN wallet only (created / imported in this app).
 * There is intentionally no watch-address mode: if no wallet exists the
 * screens show a create/import empty state instead. This context never
 * holds a private key or mnemonic — public address + public chain data.
 */
interface BalancesState {
  /** the wallet's own EVM address, or null when no wallet is stored */
  address: string | null;
  results: BalanceResult[] | null;
  tokenResults: TokenBalanceResult[] | null;
  prices: InfinitePrices | null;
  /** QL1 prices, anchored to the bridged-QOM price on 42 Chain */
  ql1Prices: Ql1Prices | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** user-added custom tokens (persisted locally) */
  customTokens: CustomToken[];
  addCustomToken: (token: CustomToken) => Promise<void>;
  removeCustomToken: (chainKey: CustomToken["chainKey"], address: string) => Promise<void>;
}

const Ctx = createContext<BalancesState | null>(null);

export function BalancesProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const address = wallet.info?.evmAddress ?? null;
  const [results, setResults] = useState<BalanceResult[] | null>(null);
  const [tokenResults, setTokenResults] = useState<TokenBalanceResult[] | null>(null);
  const [prices, setPrices] = useState<InfinitePrices | null>(null);
  const [ql1Prices, setQl1Prices] = useState<Ql1Prices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const addressRef = useRef<string | null>(null);
  addressRef.current = address;
  const customTokensRef = useRef<CustomToken[]>([]);
  customTokensRef.current = customTokens;

  useEffect(() => {
    loadCustomTokens().then(setCustomTokens).catch(() => {});
  }, []);

  // In-flight dedup: overlapping refresh() calls (refresh button taps,
  // add/remove-token, the address-change effect) share ONE fetch pass
  // instead of each launching a full duplicate RPC sweep.
  const inFlightRef = useRef<Promise<void> | null>(null);

  const doRefresh = useCallback(async () => {
    const target = addressRef.current;
    if (!target) {
      setResults(null);
      setTokenResults(null);
      setPrices(null);
      setQl1Prices(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const extras = customTokensRef.current;
      const [perChain, priceMap] = await Promise.all([
        Promise.all(
          CHAINS.map((c) =>
            fetchChainBalances(
              c,
              target,
              extras.filter((t) => t.chainKey === c.key),
            ),
          ),
        ),
        fetchInfinitePrices().catch(() => null),
      ]);
      // The native-coin BalanceResults are DERIVED from the same pass:
      // fetchChainBalances already fetches each chain's native balance,
      // so the old separate native fetch only duplicated RPC traffic.
      const native: BalanceResult[] = CHAINS.map((c, i) => {
        const list = perChain[i] ?? [];
        const okNative = list.find(
          (r) => r.ok && r.balance.address === null,
        );
        if (okNative && okNative.ok) {
          return {
            ok: true,
            chain: c,
            rpcUrl: c.evmRpcUrls[0],
            formatted: okNative.balance.formatted,
            symbol: c.nativeSymbol,
          };
        }
        const failNative = list.find(
          (r) => !r.ok && r.symbol === c.nativeSymbol,
        );
        return {
          ok: false,
          chain: c,
          rpcUrl: c.evmRpcUrls[0],
          error:
            failNative && !failNative.ok ? failNative.error : "unknown",
        };
      });
      // QL1 pricing anchors to the bridged-QOM price on 42 Chain (same
      // asset): derive QOM's reliable USD price from the Infinite map.
      const qomToken = INFINITE_TOKENS.find((t) => t.symbol === "QOM");
      const qomPrice = qomToken ? priceOf(priceMap, qomToken.address) : null;
      const qomUsd = qomPrice?.reliable ? qomPrice.usd : null;
      const ql1Map = await fetchQl1Prices(
        qomUsd,
        extras
          .filter((t) => t.chainKey === "ql1")
          .map((t) => ({ address: t.address, symbol: t.symbol, decimals: t.decimals })),
      ).catch(() => null);
      // ignore stale responses if the wallet changed mid-flight
      if (addressRef.current !== target) return;
      setResults(native);
      setTokenResults(perChain.flat());
      setPrices(priceMap);
      setQl1Prices(ql1Map);
    } catch (e) {
      if (addressRef.current !== target) return;
      setError(e instanceof Error ? e.message : String(e));
      setResults(null);
      setTokenResults(null);
    } finally {
      if (addressRef.current === target) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    const run = doRefresh();
    inFlightRef.current = run;
    try {
      await run;
    } finally {
      if (inFlightRef.current === run) inFlightRef.current = null;
    }
  }, [doRefresh]);

  // Fetch automatically whenever the stored wallet (address) changes.
  useEffect(() => {
    if (address) {
      refresh();
    } else {
      setResults(null);
      setTokenResults(null);
      setPrices(null);
      setQl1Prices(null);
      setError(null);
    }
  }, [address, refresh]);

  const addCustomToken = useCallback(
    async (token: CustomToken) => {
      const next = [
        ...customTokensRef.current.filter(
          (t) =>
            !(
              t.chainKey === token.chainKey &&
              t.address.toLowerCase() === token.address.toLowerCase()
            ),
        ),
        token,
      ];
      setCustomTokens(next);
      await saveCustomTokens(next);
      await refresh();
    },
    [refresh],
  );

  const removeCustomToken = useCallback(
    async (chainKey: CustomToken["chainKey"], tokenAddress: string) => {
      const next = customTokensRef.current.filter(
        (t) =>
          !(
            t.chainKey === chainKey &&
            t.address.toLowerCase() === tokenAddress.toLowerCase()
          ),
      );
      setCustomTokens(next);
      await saveCustomTokens(next);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<BalancesState>(
    () => ({
      address,
      results,
      tokenResults,
      prices,
      ql1Prices,
      loading,
      error,
      refresh,
      customTokens,
      addCustomToken,
      removeCustomToken,
    }),
    [
      address,
      results,
      tokenResults,
      prices,
      ql1Prices,
      loading,
      error,
      refresh,
      customTokens,
      addCustomToken,
      removeCustomToken,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBalances(): BalancesState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBalances must be used inside BalancesProvider");
  return ctx;
}
