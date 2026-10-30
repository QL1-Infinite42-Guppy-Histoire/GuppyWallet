import {
  Contract,
  formatUnits,
  type TransactionRequest,
  type Wallet,
} from "ethers";
import { ERC20_WRITE_ABI } from "./onchain";

/**
 * Local transaction helpers. Everything is signed locally by the ethers
 * Wallet (key in memory only) and sent to the chain's public RPC.
 * Nothing here transmits keys anywhere.
 */

/** Estimate gas for a tx; if estimation reverts, use the fallback so the
 *  confirmation sheet can still show an approximate cost. */
export async function estimateOrFallback(
  signer: Wallet,
  tx: TransactionRequest,
  fallback: bigint,
): Promise<bigint> {
  try {
    return await signer.estimateGas(tx);
  } catch {
    return fallback;
  }
}

/** Human-readable native cost of `gasUnits` at current network price. */
export async function gasCostNative(
  signer: Wallet,
  gasUnits: bigint,
  nativeSymbol: string,
): Promise<string> {
  try {
    const feeData = await signer.provider!.getFeeData();
    const price = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
    return `${formatUnits(gasUnits * price, 18)} ${nativeSymbol}（目安）`;
  } catch {
    return "取得できませんでした";
  }
}

/** Send a prepared tx and wait for 1 confirmation; returns the hash. */
export async function sendAndWait(
  signer: Wallet,
  tx: TransactionRequest,
): Promise<string> {
  const response = await signer.sendTransaction(tx);
  await response.wait(1);
  return response.hash;
}

export interface AllowancePlan {
  needed: boolean;
  estimate: bigint;
  send: () => Promise<string>;
}

/** Exact-amount ERC-20 approval plan (no unlimited approvals by default). */
export async function planExactApproval(
  signer: Wallet,
  tokenAddress: string,
  spender: string,
  amount: bigint,
): Promise<AllowancePlan> {
  const token = new Contract(tokenAddress, ERC20_WRITE_ABI, signer) as any;
  const owner = await signer.getAddress();
  const current: bigint = await token.allowance(owner, spender);
  if (current >= amount) {
    return { needed: false, estimate: 0n, send: async () => "" };
  }
  const data: string = token.interface.encodeFunctionData("approve", [
    spender,
    amount,
  ]);
  const tx: TransactionRequest = { to: tokenAddress, data };
  const estimate = await estimateOrFallback(signer, tx, 60000n);
  return {
    needed: true,
    estimate,
    send: () => sendAndWait(signer, tx),
  };
}
