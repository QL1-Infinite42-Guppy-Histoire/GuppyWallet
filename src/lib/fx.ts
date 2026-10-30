/**
 * USD/JPY reference rate from a public FX endpoint
 * (https://open.er-api.com/v6/latest/USD — no key required).
 * Cached in-memory for the session; returns null when the rate cannot
 * be fetched so the UI can show 未取得 instead of a fabricated number.
 */

const FX_URL = "https://open.er-api.com/v6/latest/USD";
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
