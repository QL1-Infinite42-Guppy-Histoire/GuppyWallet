import { isAddress } from "ethers";
import type { ChainConfig } from "../config/chains";

/**
 * Shared balance result types + address helpers.
 *
 * The actual fetching lives in lib/onchain.ts (fetchChainBalances),
 * which returns the native coin AND every ERC-20 in one pass.
 * BalancesContext derives the per-chain native `BalanceResult`s from
 * that single pass — until v0.3.0 a second, separate native fetch
 * (fresh providers + getBalance + getBlockNumber per chain) ran on
 * every refresh purely to fill this shape, doubling the native RPC
 * traffic for no new information.
 */

export interface ChainBalance {
  chain: ChainConfig;
  rpcUrl: string;
  /** Human-readable native balance, e.g. "1.2345" (string to avoid float loss) */
  formatted: string;
  symbol: string;
  /** Block height at fetch time, when the fetch path reports one. */
  blockNumber?: number;
}

export interface ChainBalanceError {
  chain: ChainConfig;
  rpcUrl: string;
  error: string;
}

export type BalanceResult =
  | ({ ok: true } & ChainBalance)
  | ({ ok: false } & ChainBalanceError);

export function isValidEvmAddress(value: string): boolean {
  return isAddress(value.trim());
}

/** Link to the address page on the chain's explorer (URL pattern per Blockscout). */
export function explorerAddressUrl(chain: ChainConfig, address: string): string {
  return `${chain.explorerUrl}/address/${address.trim()}`;
}
