import { Contract, ZeroAddress, formatUnits, parseUnits } from "ethers";
import {
  INFINITE_CONTRACTS,
  INFINITE_TOKENS,
  QL1_CONTRACTS,
  QL1_TOKENS,
  type ChainConfig,
} from "../config/chains";
import { getProvider } from "./onchain";
import { NATIVE_PLACEHOLDER } from "./prices";

/**
 * Uniswap V2-style DEX access for the two confirmed deployments:
 *  - Infinite: Don't Panic / Nutri-Matic router + factory (chains.ts)
 *  - QL1: QomSwap router + factory (chains.ts)
 * Native-coin convention differs per chain: Infinite pairs key on the
 * 0xEeee…EEeE placeholder (router.WETH() returns it); QL1 uses the real
 * WQOM ERC-20 as its wrapped native.
 */

export const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function factory() view returns (address)",
  "function WETH() view returns (address)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
  "function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)",
  "function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB)",
  "function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) returns (uint256 amountToken, uint256 amountETH)",
] as const;

export const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address)",
] as const;

export const PAIR_ABI = [
  "function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function balanceOf(address account) view returns (uint256)",
] as const;

export interface DexToken {
  symbol: string;
  /** pair-key address: placeholder (Infinite native) / WQOM (QL1 native) / token contract */
  address: string;
  decimals: number;
  isNative: boolean;
}

export function dexConfig(chain: ChainConfig): {
  router: string;
  factory: string;
  nativeAnchor: string;
} {
  if (chain.key === "infinite") {
    return {
      router: INFINITE_CONTRACTS.dexRouter,
      factory: INFINITE_CONTRACTS.dexFactory,
      nativeAnchor: NATIVE_PLACEHOLDER,
    };
  }
  return {
    router: QL1_CONTRACTS.dexRouter,
    factory: QL1_CONTRACTS.dexFactory,
    nativeAnchor: QL1_TOKENS[1].address, // WQOM
  };
}

export function dexTokens(chain: ChainConfig): DexToken[] {
  const { nativeAnchor } = dexConfig(chain);
  const native: DexToken = {
    symbol: chain.nativeSymbol,
    address: nativeAnchor,
    decimals: chain.nativeDecimals,
    isNative: true,
  };
  const tokens = chain.key === "infinite" ? INFINITE_TOKENS : QL1_TOKENS;
  const rest = tokens
    .filter((t) => t.address.toLowerCase() !== nativeAnchor.toLowerCase())
    .map<DexToken>((t) => ({
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals,
      isNative: false,
    }));
  // On QL1 the wrapped token itself is also swappable as an ERC-20.
  if (chain.key === "ql1") {
    rest.push({
      symbol: "WQOM",
      address: nativeAnchor,
      decimals: 18,
      isNative: false,
    });
  }
  return [native, ...rest];
}

export function getRouter(chain: ChainConfig, signerOrProvider?: any): any {
  const { router } = dexConfig(chain);
  return new Contract(router, ROUTER_ABI, signerOrProvider ?? getProvider(chain));
}

export function getFactory(chain: ChainConfig): any {
  const { factory } = dexConfig(chain);
  return new Contract(factory, FACTORY_ABI, getProvider(chain));
}

async function pairExists(factory: any, a: string, b: string): Promise<boolean> {
  try {
    const pair: string = await factory.getPair(a, b);
    return !!pair && pair !== ZeroAddress;
  } catch {
    return false;
  }
}

export async function getPairAddress(
  chain: ChainConfig,
  a: string,
  b: string,
): Promise<string | null> {
  try {
    const pair: string = await getFactory(chain).getPair(a, b);
    return pair && pair !== ZeroAddress ? pair : null;
  } catch {
    return null;
  }
}

/**
 * Best simple path: direct pair, else via the chain's native anchor.
 * Returns null when neither exists.
 */
export async function findPath(
  chain: ChainConfig,
  from: DexToken,
  to: DexToken,
): Promise<DexToken[] | null> {
  if (from.address.toLowerCase() === to.address.toLowerCase()) return null;
  const factory = getFactory(chain);
  if (await pairExists(factory, from.address, to.address)) return [from, to];
  const { nativeAnchor } = dexConfig(chain);
  const anchor: DexToken =
    from.address.toLowerCase() === nativeAnchor.toLowerCase()
      ? from
      : to.address.toLowerCase() === nativeAnchor.toLowerCase()
        ? to
        : {
            symbol: chain.nativeSymbol,
            address: nativeAnchor,
            decimals: chain.nativeDecimals,
            isNative: true,
          };
  if (
    from.address.toLowerCase() !== nativeAnchor.toLowerCase() &&
    to.address.toLowerCase() !== nativeAnchor.toLowerCase()
  ) {
    const [a, b] = await Promise.all([
      pairExists(factory, from.address, nativeAnchor),
      pairExists(factory, nativeAnchor, to.address),
    ]);
    if (a && b) return [from, anchor, to];
  }
  return null;
}

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  amountOutFormatted: string;
  /** 1 unit of `from` in units of `to`, as a display number */
  rate: number;
  /** spot rate from raw pair reserves (no fee / no impact), if computable */
  spotRate: number | null;
  /** % worse than spot (fee + price impact combined), if computable */
  priceImpactPct: number | null;
  path: DexToken[];
  routeLabel: string;
}

/**
 * Walk the path's pair reserves to get the zero-fee spot output for
 * `amountIn`. Returns null when any hop's reserves cannot be read.
 */
async function spotAmountOut(
  chain: ChainConfig,
  path: DexToken[],
  amountIn: bigint,
): Promise<bigint | null> {
  try {
    const factory = getFactory(chain);
    let current = amountIn;
    for (let i = 0; i < path.length - 1; i++) {
      const pairAddr: string = await factory.getPair(
        path[i].address,
        path[i + 1].address,
      );
      if (!pairAddr || pairAddr === ZeroAddress) return null;
      const pair = new Contract(
        pairAddr,
        PAIR_ABI,
        getProvider(chain),
      ) as any;
      const [reserves, token0] = await Promise.all([
        pair.getReserves(),
        pair.token0(),
      ]);
      const r0: bigint = reserves[0];
      const r1: bigint = reserves[1];
      const inIsToken0 =
        String(token0).toLowerCase() === path[i].address.toLowerCase();
      const rIn = inIsToken0 ? r0 : r1;
      const rOut = inIsToken0 ? r1 : r0;
      if (rIn === 0n || rOut === 0n) return null;
      current = (current * rOut) / rIn;
    }
    return current;
  } catch {
    return null;
  }
}

export async function fetchSwapQuote(
  chain: ChainConfig,
  from: DexToken,
  to: DexToken,
  amountText: string,
): Promise<SwapQuote> {
  const amountIn = parseUnits(amountText, from.decimals);
  if (amountIn <= 0n) throw new Error("数量は0より大きくしてください。");
  const path = await findPath(chain, from, to);
  if (!path) {
    throw new Error(
      "このペアのルートが見つかりません（直接ペアもネイティブ経由ペアも存在しません）。",
    );
  }
  const router = getRouter(chain);
  let amounts: bigint[];
  try {
    amounts = await router.getAmountsOut(
      amountIn,
      path.map((t) => t.address),
    );
  } catch {
    throw new Error(
      "見積もりを取得できませんでした（流動性不足の可能性があります）。",
    );
  }
  const amountOut = amounts[amounts.length - 1];
  const inNum = Number(formatUnits(amountIn, from.decimals));
  const outNum = Number(formatUnits(amountOut, to.decimals));
  const spotOut = await spotAmountOut(chain, path, amountIn);
  let spotRate: number | null = null;
  let priceImpactPct: number | null = null;
  if (spotOut !== null && spotOut > 0n) {
    const spotNum = Number(formatUnits(spotOut, to.decimals));
    spotRate = inNum > 0 ? spotNum / inNum : null;
    priceImpactPct = spotNum > 0 ? (1 - outNum / spotNum) * 100 : null;
  }
  return {
    amountIn,
    amountOut,
    amountOutFormatted: formatUnits(amountOut, to.decimals),
    rate: inNum > 0 ? outNum / inNum : 0,
    spotRate,
    priceImpactPct,
    path,
    routeLabel: path.map((t) => t.symbol).join(" → "),
  };
}

/** Apply slippage (in basis points) to a quoted output. */
export function applySlippage(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10000 - slippageBps)) / 10000n;
}

/** Default deadline: 20 minutes from now, unix seconds. */
export function deadline20Min(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}
