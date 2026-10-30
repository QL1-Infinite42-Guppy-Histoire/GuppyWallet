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
import { CHAINS } from "../config/chains";
import { fetchNativeBalances, type BalanceResult } from "../lib/balances";
import { fetchChainBalances, type TokenBalanceResult } from "../lib/onchain";
import { fetchInfinitePrices, type InfinitePrices } from "../lib/prices";
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
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<BalancesState | null>(null);

export function BalancesProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const address = wallet.info?.evmAddress ?? null;
  const [results, setResults] = useState<BalanceResult[] | null>(null);
  const [tokenResults, setTokenResults] = useState<TokenBalanceResult[] | null>(null);
  const [prices, setPrices] = useState<InfinitePrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addressRef = useRef<string | null>(null);
  addressRef.current = address;

  const refresh = useCallback(async () => {
    const target = addressRef.current;
    if (!target) {
      setResults(null);
      setTokenResults(null);
      setPrices(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [native, perChain, priceMap] = await Promise.all([
        fetchNativeBalances(target),
        Promise.all(CHAINS.map((c) => fetchChainBalances(c, target))),
        fetchInfinitePrices().catch(() => null),
      ]);
      // ignore stale responses if the wallet changed mid-flight
      if (addressRef.current !== target) return;
      setResults(native);
      setTokenResults(perChain.flat());
      setPrices(priceMap);
    } catch (e) {
      if (addressRef.current !== target) return;
      setError(e instanceof Error ? e.message : String(e));
      setResults(null);
      setTokenResults(null);
    } finally {
      if (addressRef.current === target) setLoading(false);
    }
  }, []);

  // Fetch automatically whenever the stored wallet (address) changes.
  useEffect(() => {
    if (address) {
      refresh();
    } else {
      setResults(null);
      setTokenResults(null);
      setPrices(null);
      setError(null);
    }
  }, [address, refresh]);

  const value = useMemo<BalancesState>(
    () => ({
      address,
      results,
      tokenResults,
      prices,
      loading,
      error,
      refresh,
    }),
    [address, results, tokenResults, prices, loading, error, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBalances(): BalancesState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBalances must be used inside BalancesProvider");
  return ctx;
}
