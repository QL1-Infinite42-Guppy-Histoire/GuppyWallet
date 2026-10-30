import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchNativeBalances,
  isValidEvmAddress,
  type BalanceResult,
} from "../lib/balances";

/**
 * Shared "watch address" state for Dashboard / Wallet.
 * Read-only by design: this context never holds a private key or mnemonic.
 */
interface WatchState {
  address: string;
  setAddress: (v: string) => void;
  results: BalanceResult[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<WatchState | null>(null);

export function WatchAddressProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState("");
  const [results, setResults] = useState<BalanceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isValidEvmAddress(address)) {
      setError("EVMアドレス（0x…）を正しく入力してください。");
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResults(await fetchNativeBalances(address));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const value = useMemo<WatchState>(
    () => ({ address, setAddress, results, loading, error, refresh }),
    [address, results, loading, error, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWatchAddress(): WatchState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWatchAddress must be used inside WatchAddressProvider");
  return ctx;
}
