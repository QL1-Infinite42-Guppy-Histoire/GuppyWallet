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

/**
 * Short-lived cache + in-flight dedup: Home re-asks for history
 * whenever balances refresh, and the explorer APIs are the slowest
 * calls in that path. A 20-second window removes duplicate fetches
 * from rapid refresh cycles while keeping the activity list
 * effectively live (a just-sent transaction appears within ~20 s;
 * balances themselves are never cached and always update first).
 */
const HISTORY_CACHE_MS = 20_000;
const historyCache = new Map<
  string,
  { at: number; result: HistoryResult }
>();
const historyInflight = new Map<string, Promise<HistoryResult>>();

/** Merged, newest-first history across both chains (top `limit`). */
export async function fetchTxHistory(
  address: string,
  limit = 10,
): Promise<HistoryResult> {
  const key = `${address.toLowerCase()}:${limit}`;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < HISTORY_CACHE_MS) return hit.result;
  const pending = historyInflight.get(key);
  if (pending) return pending;
  const run = (async (): Promise<HistoryResult> => {
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
    const result: HistoryResult = {
      items: items.slice(0, limit),
      failedChains,
    };
    // Only cache a fully successful read; a partial failure should
    // be retried on the next ask rather than pinned for the window.
    if (failedChains.length === 0) {
      historyCache.set(key, { at: Date.now(), result });
    }
    return result;
  })();
  historyInflight.set(key, run);
  try {
    return await run;
  } finally {
    if (historyInflight.get(key) === run) historyInflight.delete(key);
  }
}
