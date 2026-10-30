import { JsonRpcProvider, formatUnits, isAddress } from "ethers";
import { CHAINS, type ChainConfig } from "../config/chains";

/**
 * Read-only balance fetching.
 *
 * This module ONLY reads from public RPCs. It never signs, never sends,
 * and never touches private keys — safe for the prototype phase.
 */

export interface ChainBalance {
  chain: ChainConfig;
  rpcUrl: string;
  /** Human-readable native balance, e.g. "1.2345" (string to avoid float loss) */
  formatted: string;
  symbol: string;
  blockNumber: number;
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

async function fetchOne(chain: ChainConfig, address: string): Promise<BalanceResult> {
  const rpcUrl = chain.evmRpcUrls[0];
  try {
    // Network is pinned from our verified config, not auto-detected, so a
    // hostile / wrong RPC answering with a different chain id is visible.
    const provider = new JsonRpcProvider(rpcUrl, chain.evmChainId, {
      staticNetwork: true,
    });
    const [raw, blockNumber] = await Promise.all([
      provider.getBalance(address),
      provider.getBlockNumber(),
    ]);
    return {
      ok: true,
      chain,
      rpcUrl,
      formatted: formatUnits(raw, chain.nativeDecimals),
      symbol: chain.nativeSymbol,
      blockNumber,
    };
  } catch (e) {
    return {
      ok: false,
      chain,
      rpcUrl,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Fetch the native balance (42 / QOM) of `address` on every configured chain. */
export async function fetchNativeBalances(address: string): Promise<BalanceResult[]> {
  const trimmed = address.trim();
  if (!isValidEvmAddress(trimmed)) {
    throw new Error("EVMアドレス（0x…）の形式ではありません。");
  }
  return Promise.all(CHAINS.map((chain) => fetchOne(chain, trimmed)));
}

/** Link to the address page on the chain's explorer (URL pattern per Blockscout). */
export function explorerAddressUrl(chain: ChainConfig, address: string): string {
  return `${chain.explorerUrl}/address/${address.trim()}`;
}
