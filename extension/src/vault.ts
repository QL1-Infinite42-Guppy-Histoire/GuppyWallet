import { HDNodeWallet, Mnemonic, Wallet, hexlify } from "ethers";
import { getProvider } from "../../src/lib/onchain";
import type { ChainConfig } from "../../src/config/chains";

/**
 * Encrypted vault + in-memory session for the extension.
 *
 * Security model (same idea as MetaMask, deliberately simple):
 * - The recovery phrase is encrypted with a key derived from the
 *   user's password (PBKDF2-HMAC-SHA256, 600k iterations) using
 *   AES-256-GCM, and the ciphertext lives in chrome.storage.local.
 * - The phrase itself is NEVER stored in plaintext anywhere.
 * - Unlocking decrypts into memory only. The popup is short-lived
 *   by design: closing it destroys the key material (lock()).
 * - Derivation matches the Android app exactly
 *   (m/44'/60'/0'/0/0 via HDNodeWallet.fromMnemonic, mirroring
 *   src/lib/walletCrypto.ts), so the same recovery phrase opens the
 *   same wallet in the app and here.
 */

export const EVM_DERIVATION_PATH = "m/44'/60'/0'/0/0";
const STORAGE_KEY = "guppy.vault.v1";
const PBKDF2_ITERATIONS = 600_000;

interface VaultFile {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iter: number;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 ciphertext
}

// ---- storage (chrome.storage.local, localStorage fallback for dev)
async function storageGet(key: string): Promise<string | null> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const out = await chrome.storage.local.get(key);
      return (out[key] as string) ?? null;
    }
  } catch {
    // fall through to localStorage
  }
  return localStorage.getItem(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: value });
      return;
    }
  } catch {
    // fall through
  }
  localStorage.setItem(key, value);
}

async function storageRemove(key: string): Promise<void> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.remove(key);
      return;
    }
  } catch {
    // fall through
  }
  localStorage.removeItem(key);
}

// ---- base64 helpers
function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function b64decode(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---- vault operations
export async function hasVault(): Promise<boolean> {
  return (await storageGet(STORAGE_KEY)) !== null;
}

async function writeVault(mnemonic: string, password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(JSON.stringify({ mnemonic })),
  );
  const file: VaultFile = {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iter: PBKDF2_ITERATIONS,
    salt: b64encode(salt),
    iv: b64encode(iv),
    data: b64encode(new Uint8Array(cipher)),
  };
  await storageSet(STORAGE_KEY, JSON.stringify(file));
}

async function readVaultMnemonic(password: string): Promise<string> {
  const raw = await storageGet(STORAGE_KEY);
  if (!raw) throw new Error("no vault");
  const file = JSON.parse(raw) as VaultFile;
  const key = await deriveKey(password, b64decode(file.salt), file.iter);
  // AES-GCM throws on a wrong password (auth tag mismatch) — exactly
  // the behaviour the unlock screen relies on.
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(file.iv) as BufferSource },
    key,
    b64decode(file.data) as BufferSource,
  );
  const parsed = JSON.parse(new TextDecoder().decode(plain)) as {
    mnemonic: string;
  };
  return parsed.mnemonic;
}

export async function deleteVault(): Promise<void> {
  lock();
  await storageRemove(STORAGE_KEY);
}

// ---- derivation (identical to the Android app)
export function walletFromMnemonic(mnemonic: string): {
  address: string;
  privateKey: string;
} {
  const phrase = mnemonic.trim().replace(/\s+/g, " ");
  const node = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase(phrase),
    EVM_DERIVATION_PATH,
  );
  return { address: node.address, privateKey: node.privateKey };
}

export function createMnemonic(): string {
  const entropy = crypto.getRandomValues(new Uint8Array(16));
  return Mnemonic.fromEntropy(hexlify(entropy)).phrase;
}

export function isValidMnemonic(mnemonic: string): boolean {
  try {
    Mnemonic.fromPhrase(mnemonic.trim().replace(/\s+/g, " "));
    return true;
  } catch {
    return false;
  }
}

// ---- session (memory only; dies with the popup)
let session: { address: string; privateKey: string } | null = null;

export function currentAddress(): string | null {
  return session?.address ?? null;
}

export function isUnlocked(): boolean {
  return session !== null;
}

export function lock(): void {
  session = null;
}

export async function setupNewWallet(
  password: string,
): Promise<{ mnemonic: string; address: string }> {
  const mnemonic = createMnemonic();
  const { address, privateKey } = walletFromMnemonic(mnemonic);
  await writeVault(mnemonic, password);
  session = { address, privateKey };
  return { mnemonic, address };
}

export async function setupImportedWallet(
  mnemonic: string,
  password: string,
): Promise<{ address: string }> {
  const { address, privateKey } = walletFromMnemonic(mnemonic);
  await writeVault(mnemonic.trim().replace(/\s+/g, " "), password);
  session = { address, privateKey };
  return { address };
}

export async function unlock(password: string): Promise<{ address: string }> {
  const mnemonic = await readVaultMnemonic(password);
  const { address, privateKey } = walletFromMnemonic(mnemonic);
  session = { address, privateKey };
  return { address };
}

/** A signer bound to the given chain's provider, or null when locked. */
export function signerFor(chain: ChainConfig): Wallet | null {
  if (!session) return null;
  return new Wallet(session.privateKey, getProvider(chain));
}
