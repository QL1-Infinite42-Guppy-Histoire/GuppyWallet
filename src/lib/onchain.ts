import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import {
  INFINITE_TOKENS,
  QL1_TOKENS,
  type ChainConfig,
} from "../config/chains";

/**
 * Read-only on-chain access: providers, native + ERC-20 balances.
 * Providers pin the network from our verified config (staticNetwork)
 * so a wrong/hostile RPC answering with another chain id is visible.
 */

const providerCache = new Map<string, JsonRpcProvider>();

export function getProvider(chain: ChainConfig): JsonRpcProvider {
  const cached = providerCache.get(chain.key);
  if (cached) return cached;
  const provider = new JsonRpcProvider(chain.evmRpcUrls[0], chain.evmChainId, {
    staticNetwork: true,
  });
  providerCache.set(chain.key, provider);
  return provider;
}

export const ERC20_READ_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
] as const;

export const ERC20_WRITE_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
] as const;

export interface TokenBalance {
  chainKey: ChainConfig["key"];
  symbol: string;
  /** null = native coin */
  address: string | null;
  raw: bigint;
  decimals: number;
  formatted: string;
}

export type TokenBalanceResult =
  | { ok: true; balance: TokenBalance }
  | { ok: false; chainKey: ChainConfig["key"]; symbol: string; error: string };

/** Trim a formatUnits string for display: max N fraction digits, no trailing zeros. */
export function prettyAmount(formatted: string, maxFraction = 6): string {
  if (!formatted.includes(".")) return formatted;
  const [int, fracRaw] = formatted.split(".");
  const frac = fracRaw.slice(0, maxFraction).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

export function formatTokenAmount(raw: bigint, decimals: number): string {
  return prettyAmount(formatUnits(raw, decimals));
}

/**
 * Amount string for a percentage of a raw balance (25/50/75/100 chips).
 * `reserve` (raw units) is subtracted only at 100% — used to keep a gas
 * buffer back when MAX-ing a native-coin amount.
 */
export function percentOfBalance(
  raw: bigint,
  pct: number,
  decimals: number,
  reserve: bigint = 0n,
): string {
  let amount = (raw * BigInt(pct)) / 100n;
  if (pct >= 100 && reserve > 0n) {
    amount = amount > reserve ? amount - reserve : 0n;
  }
  return formatUnits(amount, decimals);
}

/**
 * Estimated native-coin cost of a transaction, for MAX calculations:
 * current fee data × the caller's gas-limit assumption, +20% headroom.
 * Returns 0 when fee data is unavailable (MAX then uses full balance).
 */
export async function nativeGasReserve(
  chain: ChainConfig,
  gasLimit: bigint,
): Promise<bigint> {
  try {
    const fee = await getProvider(chain).getFeeData();
    const price = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
    return (price * gasLimit * 12n) / 10n;
  } catch {
    return 0n;
  }
}

async function fetchNative(
  chain: ChainConfig,
  address: string,
): Promise<TokenBalanceResult> {
  try {
    const raw = await getProvider(chain).getBalance(address);
    return {
      ok: true,
      balance: {
        chainKey: chain.key,
        symbol: chain.nativeSymbol,
        address: null,
        raw,
        decimals: chain.nativeDecimals,
        formatted: formatTokenAmount(raw, chain.nativeDecimals),
      },
    };
  } catch (e) {
    return {
      ok: false,
      chainKey: chain.key,
      symbol: chain.nativeSymbol,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function fetchToken(
  chain: ChainConfig,
  token: { symbol: string; address: string; decimals: number },
  address: string,
): Promise<TokenBalanceResult> {
  try {
    const contract = new Contract(
      token.address,
      ERC20_READ_ABI,
      getProvider(chain),
    ) as any;
    const raw: bigint = await contract.balanceOf(address);
    return {
      ok: true,
      balance: {
        chainKey: chain.key,
        symbol: token.symbol,
        address: token.address,
        raw,
        decimals: token.decimals,
        formatted: formatTokenAmount(raw, token.decimals),
      },
    };
  } catch (e) {
    return {
      ok: false,
      chainKey: chain.key,
      symbol: token.symbol,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Native + all listed ERC-20 balances of `address` on one chain. */
export async function fetchChainBalances(
  chain: ChainConfig,
  address: string,
): Promise<TokenBalanceResult[]> {
  const tokens = chain.key === "infinite" ? INFINITE_TOKENS : QL1_TOKENS;
  const results = await Promise.all([
    fetchNative(chain, address),
    ...tokens.map((t) => fetchToken(chain, t, address)),
  ]);
  return results;
}
