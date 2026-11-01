import { bech32 } from "@scure/base";
import * as Crypto from "expo-crypto";
import {
  HDNodeWallet,
  Mnemonic,
  SigningKey,
  Wallet,
  getBytes,
  hexlify,
  isHexString,
  ripemd160,
  sha256,
} from "ethers";

/**
 * Wallet key derivation. All randomness comes from expo-crypto
 * (OS secure RNG) — never Math.random. Keys are derived locally only.
 */

export const EVM_DERIVATION_PATH = "m/44'/60'/0'/0/0";

/** BIP-44 path of account `index` of a phrase (index 0 is the path
 *  above — accounts are the last path component, MetaMask-style). */
export function derivationPathForIndex(index: number): string {
  return `m/44'/60'/0'/0/${index}`;
}

/** Generate a fresh 24-word BIP-39 phrase from 32 bytes of OS entropy. */
export async function generatePhrase(): Promise<string> {
  const entropy = await Crypto.getRandomBytesAsync(32);
  return Mnemonic.fromEntropy(hexlify(entropy)).phrase;
}

export function isValidPhrase(phrase: string): boolean {
  try {
    Mnemonic.fromPhrase(normalizePhrase(phrase));
    return true;
  } catch {
    return false;
  }
}

export function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Derive the EVM wallet (m/44'/60'/0'/0/0) from a BIP-39 phrase. */
export function walletFromPhrase(phrase: string): HDNodeWallet {
  return walletFromPhraseAtIndex(phrase, 0);
}

/** Derive account `index` of a BIP-39 phrase (same phrase, next
 *  address). Index 0 is exactly walletFromPhrase's result. */
export function walletFromPhraseAtIndex(
  phrase: string,
  index: number,
): HDNodeWallet {
  const mnemonic = Mnemonic.fromPhrase(normalizePhrase(phrase));
  return HDNodeWallet.fromMnemonic(mnemonic, derivationPathForIndex(index));
}

export function isValidPrivateKey(key: string): boolean {
  const k = key.trim();
  return isHexString(k, 32) && k !== "0x" + "0".repeat(64);
}

export function walletFromPrivateKey(privateKey: string): Wallet {
  return new Wallet(privateKey.trim());
}

/**
 * Cosmos bech32 account address for the same secp256k1 key:
 * address bytes = ripemd160(sha256(compressed pubkey)), bech32-encoded
 * with the chain prefix (infinite / qom). Display/derivation only —
 * Cosmos-side signing is not wired yet.
 */
export function cosmosAddressFromPrivateKey(
  privateKey: string,
  prefix: string,
): string {
  const pubKey = SigningKey.computePublicKey(privateKey, true);
  const hash = ripemd160(sha256(pubKey));
  return bech32.encode(prefix, bech32.toWords(getBytes(hash)));
}

/** bech32 validator-operator address (e.g. infinitevaloper1…) from the
 *  20-byte operator address hex returned by the staking precompile. */
export function valoperFromHex(operatorHex: string, prefix: string): string {
  if (!isHexString(operatorHex, 20)) return operatorHex; // already bech32 etc.
  return bech32.encode(prefix, bech32.toWords(getBytes(operatorHex)));
}
