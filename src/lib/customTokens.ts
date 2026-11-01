import AsyncStorage from "@react-native-async-storage/async-storage";
import { Contract, isAddress } from "ethers";
import type { ChainConfig } from "../config/chains";
import { tr } from "../i18n";
import { ERC20_READ_ABI, getProvider } from "./onchain";

/**
 * User-added custom tokens, persisted locally (AsyncStorage).
 * A token is accepted only after its name / symbol / decimals are read
 * live from the chain's RPC and a balanceOf probe answers — never
 * trust user-typed metadata.
 */

export interface CustomToken {
  chainKey: ChainConfig["key"];
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

const STORAGE_KEY = "zaphod.customTokens";

export async function loadCustomTokens(): Promise<CustomToken[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is CustomToken =>
        t &&
        (t.chainKey === "infinite" || t.chainKey === "ql1") &&
        typeof t.address === "string" &&
        isAddress(t.address) &&
        typeof t.symbol === "string" &&
        typeof t.decimals === "number",
    );
  } catch {
    return [];
  }
}

export async function saveCustomTokens(tokens: CustomToken[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    /* persistence is best-effort; in-memory state still works */
  }
}

/** Read a token's real metadata from the chain; throws when the
 *  address is not an ERC-20 contract that answers the standard calls. */
export async function fetchTokenMetadata(
  chain: ChainConfig,
  address: string,
): Promise<{ name: string; symbol: string; decimals: number }> {
  if (!isAddress(address)) {
    throw new Error(tr("err.invalidAddress"));
  }
  const contract = new Contract(
    address,
    ERC20_READ_ABI,
    getProvider(chain),
  ) as any;
  const [name, symbol, decimals] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
  ]);
  // Probe balanceOf so a non-token contract is rejected here, not later.
  await contract.balanceOf("0x0000000000000000000000000000000000000000");
  return {
    name: String(name),
    symbol: String(symbol),
    decimals: Number(decimals),
  };
}
