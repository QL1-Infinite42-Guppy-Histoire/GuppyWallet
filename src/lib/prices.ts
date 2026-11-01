import { Contract, ZeroAddress, formatUnits } from "ethers";
import {
  INFINITE,
  INFINITE_CONTRACTS,
  INFINITE_TOKENS,
  QL1,
  QL1_CONTRACTS,
  QL1_TOKENS,
  type ChainConfig,
} from "../config/chains";
import { tr } from "../i18n";
import { getProvider } from "./onchain";

/**
 * Infinite-side USD prices from DEX pair reserves (no public price API
 * exists — see research/NFT_AND_PRICES.md).
 *
 * Method: 42 price comes from the 42/USDT pair. Each token is priced via
 * its direct USDT pair and/or its pair against the native placeholder
 * (token → 42 → USDT). When both routes exist we prefer the deeper USD
 * route; when the two routes diverge by more than DIVERGENCE_LIMIT× the
 * price is marked unreliable and must be excluded from totals (thin
 * pools — these are estimates, never exact market prices).
 */

export const NATIVE_PLACEHOLDER =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const USDT_ADDRESS = "0xC2684966e5c95B2bc636FB4a1f3Da9Ad23d94753";
const PAIR_42_USDT = "0xfac6a97837fd3ef5876e18457eea52415296c613";
const DIVERGENCE_LIMIT = 3;

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address)",
] as const;
const PAIR_ABI = [
  "function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
] as const;

export interface TokenPrice {
  /** USD price per token, or null when no route exists */
  usd: number | null;
  /** human-readable route, e.g. "FISH→42→USDT" */
  route: string | null;
  /** false when routes diverge wildly — exclude from totals */
  reliable: boolean;
}

export type InfinitePrices = Map<string, TokenPrice>;
export type Ql1Prices = Map<string, TokenPrice>;

const NO_PRICE: TokenPrice = { usd: null, route: null, reliable: false };

interface PairQuote {
  /** price of `base` denominated in `quote` (whole-token units) */
  price: number;
  /** USD depth of the quote side of the pool */
  depthUsd: number;
}

async function pairQuote(
  chain: ChainConfig,
  pairAddress: string,
  base: string,
  quote: string,
  quoteUsd: number,
  baseDecimals = 18,
  quoteDecimals = 18,
): Promise<PairQuote | null> {
  try {
    const pair = new Contract(pairAddress, PAIR_ABI, getProvider(chain)) as any;
    const [token0, reserves] = await Promise.all([
      pair.token0() as Promise<string>,
      pair.getReserves(),
    ]);
    const baseIs0Pre = token0.toLowerCase() === base.toLowerCase();
    const r0 = Number(formatUnits(reserves[0], baseIs0Pre ? baseDecimals : quoteDecimals));
    const r1 = Number(formatUnits(reserves[1], baseIs0Pre ? quoteDecimals : baseDecimals));
    if (r0 <= 0 || r1 <= 0) return null;
    const baseIs0 = token0.toLowerCase() === base.toLowerCase();
    const baseReserve = baseIs0 ? r0 : r1;
    const quoteReserve = baseIs0 ? r1 : r0;
    return {
      price: quoteReserve / baseReserve,
      depthUsd: quoteReserve * quoteUsd,
    };
  } catch {
    return null;
  }
}

async function getPair(factory: any, a: string, b: string): Promise<string | null> {
  try {
    const pair: string = await factory.getPair(a, b);
    return pair && pair !== ZeroAddress ? pair : null;
  } catch {
    return null;
  }
}

export async function fetchInfinitePrices(): Promise<InfinitePrices> {
  const prices: InfinitePrices = new Map();
  const provider = getProvider(INFINITE);
  const factory = new Contract(
    INFINITE_CONTRACTS.dexFactory,
    FACTORY_ABI,
    provider,
  ) as any;

  // Anchor: 42 in USD from the 42/USDT pair (USDT treated as $1).
  const anchor = await pairQuote(INFINITE, PAIR_42_USDT, NATIVE_PLACEHOLDER, USDT_ADDRESS, 1);
  const price42 = anchor?.price ?? null;
  prices.set("native", {
    usd: price42,
    route: price42 ? tr("price.route42Pool") : null,
    reliable: price42 !== null,
  });
  prices.set(USDT_ADDRESS.toLowerCase(), {
    usd: 1,
    route: tr("price.routeBase"),
    reliable: true,
  });
  if (price42 === null) {
    for (const t of INFINITE_TOKENS) prices.set(t.address.toLowerCase(), NO_PRICE);
    return prices;
  }

  await Promise.all(
    INFINITE_TOKENS.map(async (token) => {
      const key = token.address.toLowerCase();
      if (key === USDT_ADDRESS.toLowerCase()) return;
      const [directPair, viaPair] = await Promise.all([
        getPair(factory, token.address, USDT_ADDRESS),
        getPair(factory, token.address, NATIVE_PLACEHOLDER),
      ]);
      const direct = directPair
        ? await pairQuote(INFINITE, directPair, token.address, USDT_ADDRESS, 1)
        : null;
      const via = viaPair
        ? await pairQuote(INFINITE, viaPair, token.address, NATIVE_PLACEHOLDER, price42)
        : null;
      const viaUsd = via ? via.price * price42 : null;

      if (direct && viaUsd !== null) {
        const ratio =
          Math.max(direct.price, viaUsd) / Math.min(direct.price, viaUsd);
        if (ratio > DIVERGENCE_LIMIT) {
          prices.set(key, {
            usd: null,
            route: tr("price.routeDiverged"),
            reliable: false,
          });
          return;
        }
        const useDirect = direct.depthUsd >= (via?.depthUsd ?? 0);
        prices.set(key, {
          usd: useDirect ? direct.price : viaUsd,
          route: useDirect ? `${token.symbol}→USDT` : `${token.symbol}→42→USDT`,
          reliable: true,
        });
        return;
      }
      if (direct) {
        prices.set(key, {
          usd: direct.price,
          route: `${token.symbol}→USDT`,
          reliable: true,
        });
        return;
      }
      if (viaUsd !== null) {
        prices.set(key, {
          usd: viaUsd,
          route: `${token.symbol}→42→USDT`,
          reliable: true,
        });
        return;
      }
      prices.set(key, NO_PRICE);
    }),
  );
  return prices;
}

/** Price lookup helper: key is the token contract address or "native". */
export function priceOf(
  prices: Map<string, TokenPrice> | null,
  address: string | null,
): TokenPrice {
  if (!prices) return NO_PRICE;
  if (address === null) return prices.get("native") ?? NO_PRICE;
  return prices.get(address.toLowerCase()) ?? NO_PRICE;
}

/**
 * QL1-side USD prices. There is no QOM/USD market on QL1 itself, so the
 * anchor is the bridged QOM price on 42 Chain (same asset, priced there
 * via the DEX routes above — the caller passes its reliable USD price,
 * or null when 42 Chain pricing failed). Every other QL1 token is priced
 * from its QomSwap pair against WQOM: usd = (QOM per token) × qomUsd.
 * Single-route only, mirroring the Infinite rule (a lone direct route is
 * accepted; nothing is invented when no pair exists — e.g. ZAP has no
 * QomSwap pair and stays unpriced).
 */
export async function fetchQl1Prices(
  qomUsd: number | null,
  extraTokens: { address: string; symbol: string; decimals: number }[] = [],
): Promise<Ql1Prices> {
  const prices: Ql1Prices = new Map();
  const wqom = QL1_TOKENS.find((t) => t.symbol === "WQOM")!;
  const anchorPrice: TokenPrice =
    qomUsd !== null
      ? { usd: qomUsd, route: tr("price.routeQom42"), reliable: true }
      : NO_PRICE;
  prices.set("native", anchorPrice);
  prices.set(wqom.address.toLowerCase(), {
    usd: qomUsd,
    route: qomUsd !== null ? tr("price.routeWrappedQom") : null,
    reliable: qomUsd !== null,
  });

  const listed = new Set(QL1_TOKENS.map((t) => t.address.toLowerCase()));
  const targets = [
    ...QL1_TOKENS.filter((t) => t.symbol !== "WQOM").map((t) => ({
      address: t.address as string,
      symbol: t.symbol as string,
      decimals: t.decimals as number,
    })),
    ...extraTokens.filter((t) => !listed.has(t.address.toLowerCase())),
  ];
  if (qomUsd === null) {
    for (const t of targets) prices.set(t.address.toLowerCase(), NO_PRICE);
    return prices;
  }
  const factory = new Contract(
    QL1_CONTRACTS.dexFactory,
    FACTORY_ABI,
    getProvider(QL1),
  ) as any;
  await Promise.all(
    targets.map(async (token) => {
      const key = token.address.toLowerCase();
      const pair = await getPair(factory, token.address, wqom.address);
      const quote = pair
        ? await pairQuote(QL1, pair, token.address, wqom.address, qomUsd, token.decimals, 18)
        : null;
      if (quote) {
        prices.set(key, {
          usd: quote.price * qomUsd,
          route: `${token.symbol}${tr("price.routeToQomSuffix")}`,
          reliable: true,
        });
      } else {
        prices.set(key, NO_PRICE);
      }
    }),
  );
  return prices;
}
