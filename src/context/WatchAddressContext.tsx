import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CHAINS } from "../config/chains";
import {
  fetchNativeBalances,
  isValidEvmAddress,
  type BalanceResult,
} from "../lib/balances";
import {
  fetchChainBalances,
  type TokenBalanceResult,
} from "../lib/onchain";
import { fetchInfinitePrices, type InfinitePrices } from "../lib/prices";
import { useWallet } from "./WalletContext";

/**
 * Shared address state for Dashboard / Wallet.
 * The effective address is the manually entered watch address when it is
 * a valid EVM address, otherwise the stored wallet's own address.
 * This context never holds a private key or mnemonic.
 */
interface WatchState {
  address: string;
  setAddress: (v: string) => void;
  /** address actually used for reads (watch input or wallet address) */
  effectiveAddress: string | null;
  results: BalanceResult[] | null;
  tokenResults: TokenBalanceResult[] | null;
  prices: InfinitePrices | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<WatchState | null>(null);

export function WatchAddressProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [address, setAddress] = useState("");
  const [results, setResults] = useState<BalanceResult[] | null>(null);
  const [tokenResults, setTokenResults] = useState<TokenBalanceResult[] | null>(null);
  const [prices, setPrices] = useState<InfinitePrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAddress = isValidEvmAddress(address)
    ? address.trim()
    : (wallet.info?.evmAddress ?? null);

  const refresh = useCallback(async () => {
    if (!effectiveAddress) {
      setError(
        "EVMアドレス（0x…）を入力するか、ウォレットを作成／インポートしてください。",
      );
      setResults(null);
      setTokenResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [native, perChain, priceMap] = await Promise.all([
        fetchNativeBalances(effectiveAddress),
        Promise.all(CHAINS.map((c) => fetchChainBalances(c, effectiveAddress))),
        fetchInfinitePrices().catch(() => null),
      ]);
      setResults(native);
      setTokenResults(perChain.flat());
      setPrices(priceMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResults(null);
      setTokenResults(null);
    } finally {
      setLoading(false);
    }
  }, [effectiveAddress]);

  const value = useMemo<WatchState>(
    () => ({
      address,
      setAddress,
      effectiveAddress,
      results,
      tokenResults,
      prices,
      loading,
      error,
      refresh,
    }),
    [
      address,
      effectiveAddress,
      results,
      tokenResults,
      prices,
      loading,
      error,
      refresh,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWatchAddress(): WatchState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWatchAddress must be used inside WatchAddressProvider");
  return ctx;
}
