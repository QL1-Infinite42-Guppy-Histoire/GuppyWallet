import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CHAINS, type ChainConfig } from "../config/chains";

/**
 * The chain selected on the Home screen (42 Chain / QL1). Home shows only
 * the selected chain's total and tokens; the quick actions pass this
 * selection on as a navigation param (Send preselect, DeFi→Swap
 * preselect). Persisted locally so the choice survives restarts.
 */

const STORAGE_KEY = "zaphod.homeChain";

interface ChainSelectionState {
  chainKey: ChainConfig["key"];
  chain: ChainConfig;
  setChainKey: (key: ChainConfig["key"]) => void;
}

const Ctx = createContext<ChainSelectionState | null>(null);

export function ChainSelectionProvider({ children }: { children: ReactNode }) {
  const [chainKey, setChainKeyState] = useState<ChainConfig["key"]>("infinite");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "infinite" || saved === "ql1") setChainKeyState(saved);
      })
      .catch(() => {});
  }, []);

  const setChainKey = useCallback((key: ChainConfig["key"]) => {
    setChainKeyState(key);
    AsyncStorage.setItem(STORAGE_KEY, key).catch(() => {});
  }, []);

  const value = useMemo<ChainSelectionState>(() => {
    const chain = CHAINS.find((c) => c.key === chainKey) ?? CHAINS[0];
    return { chainKey, chain, setChainKey };
  }, [chainKey, setChainKey]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChainSelection(): ChainSelectionState {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useChainSelection must be used inside ChainSelectionProvider");
  return ctx;
}
