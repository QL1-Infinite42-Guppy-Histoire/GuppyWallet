/**
 * USD/JPY reference rate from a public FX endpoint
 * (https://open.er-api.com/v6/latest/USD — no key required).
 * Cached in-memory for the session; returns null when the rate cannot
 * be fetched so the UI can show 未取得 instead of a fabricated number.
 */

const FX_URL = "https://open.er-api.com/v6/latest/USD";
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin&vs_currencies=usd";
const CACHE_MS = 10 * 60 * 1000;

let cache: { rate: number; at: number } | null = null;
let inflight: Promise<number | null> | null = null;

export async function fetchUsdJpy(): Promise<number | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rate;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(FX_URL);
      if (!res.ok) return cache?.rate ?? null;
      const data: any = await res.json();
      const rate = Number(data?.rates?.JPY);
      if (!Number.isFinite(rate) || rate <= 0) return cache?.rate ?? null;
      cache = { rate, at: Date.now() };
      return rate;
    } catch {
      return cache?.rate ?? null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export interface NativeUsdPrices {
  ethUsd: number | null;
  bnbUsd: number | null;
}

/**
 * ETH / BNB reference prices in USD from CoinGecko's public
 * simple/price endpoint (no key required). Used only for the bridge's
 * gas guide (see BRIDGE_GAS_MIN_USD in lib/zaphod.ts). Same caching
 * discipline as fetchUsdJpy: each price is null when it cannot be
 * fetched, so callers show the native balance only instead of a
 * fabricated dollar figure.
 */
let nativeCache: { prices: NativeUsdPrices; at: number } | null = null;
let nativeInflight: Promise<NativeUsdPrices> | null = null;

function saneUsd(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function fetchEthBnbUsd(): Promise<NativeUsdPrices> {
  if (nativeCache && Date.now() - nativeCache.at < CACHE_MS) {
    return nativeCache.prices;
  }
  if (nativeInflight) return nativeInflight;
  nativeInflight = (async () => {
    const stale: NativeUsdPrices = nativeCache?.prices ?? {
      ethUsd: null,
      bnbUsd: null,
    };
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) return stale;
      const data: any = await res.json();
      const prices: NativeUsdPrices = {
        ethUsd: saneUsd(data?.ethereum?.usd),
        bnbUsd: saneUsd(data?.binancecoin?.usd),
      };
      if (prices.ethUsd === null && prices.bnbUsd === null) return stale;
      nativeCache = { prices, at: Date.now() };
      return prices;
    } catch {
      return stale;
    } finally {
      nativeInflight = null;
    }
  })();
  return nativeInflight;
}
