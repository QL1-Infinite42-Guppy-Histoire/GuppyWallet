import { CHAINS, type ChainConfig } from "../config/chains";
import { formatTokenAmount } from "./onchain";

/**
 * Recent transactions via the chains' Blockscout v2 APIs
 * (GET {explorer}/api/v2/addresses/{address}/transactions).
 * Verified live from the VM on 2026-10-30 for both explorers:
 * items carry hash / from.hash / to.hash / value (wei string) /
 * timestamp (ISO) / status ("ok") / result ("success").
 * This is the address's main transaction list (native-value calls);
 * ERC-20 token transfers live on a separate explorer endpoint and are
 * not mixed in here.
 */

export interface TxHistoryItem {
  chainKey: ChainConfig["key"];
  chainName: string;
  nativeSymbol: string;
  hash: string;
  from: string;
  to: string | null;
  /** native value, formatted */
  valueFormatted: string;
  /** epoch milliseconds */
  timestamp: number;
  ok: boolean;
  direction: "in" | "out" | "self";
  explorerTxUrl: string;
}

async function fetchChainHistory(
  chain: ChainConfig,
  address: string,
): Promise<TxHistoryItem[]> {
  const res = await fetch(
    `${chain.explorerUrl}/api/v2/addresses/${address}/transactions`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: any = await res.json();
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  const me = address.toLowerCase();
  return items.map((it) => {
    const from: string = it?.from?.hash ?? "";
    const to: string | null = it?.to?.hash ?? null;
    const raw = BigInt(it?.value ?? "0");
    const direction =
      from.toLowerCase() === me && to?.toLowerCase() === me
        ? "self"
        : from.toLowerCase() === me
          ? "out"
          : "in";
    return {
      chainKey: chain.key,
      chainName: chain.displayName,
      nativeSymbol: chain.nativeSymbol,
      hash: String(it?.hash ?? ""),
      from,
      to,
      valueFormatted: formatTokenAmount(raw, chain.nativeDecimals),
      timestamp: Date.parse(it?.timestamp ?? "") || 0,
      ok: it?.status === "ok" && it?.result !== "error",
      direction,
      explorerTxUrl: `${chain.explorerUrl}/tx/${it?.hash}`,
    } as TxHistoryItem;
  });
}

export interface HistoryResult {
  items: TxHistoryItem[];
  /** chains whose explorer API could not be reached */
  failedChains: string[];
}

/** Merged, newest-first history across both chains (top `limit`). */
export async function fetchTxHistory(
  address: string,
  limit = 10,
): Promise<HistoryResult> {
  const settled = await Promise.allSettled(
    CHAINS.map((c) => fetchChainHistory(c, address)),
  );
  const items: TxHistoryItem[] = [];
  const failedChains: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else failedChains.push(CHAINS[i].displayName);
  });
  items.sort((a, b) => b.timestamp - a.timestamp);
  return { items: items.slice(0, limit), failedChains };
}
