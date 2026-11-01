import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { tr } from "../i18n";

/**
 * Wallet secret storage.
 *
 * The mnemonic / private key is stored ONLY here, inside expo-secure-store
 * (Android Keystore-backed, WHEN_UNLOCKED_THIS_DEVICE_ONLY). It is never
 * written to AsyncStorage, files, logs, or sent anywhere. A separate
 * "public info" record (kind + addresses only — no secret) lets the UI
 * show the wallet's addresses while the key itself stays locked.
 *
 * ⚠️ Still an UNAUDITED prototype: the user explicitly opted in to real
 * signing on 2026-10-30. Keep amounts small.
 */

export const WALLET_CREATION_ENABLED = true as const;

const SECRET_KEY = "wallet.secret.v1";
const PUBLIC_KEY = "wallet.public.v1";
const HAS_SENT_KEY = "wallet.hasSentTx.v1";
const UNLOCK_METHOD_KEY = "wallet.unlockMethod.v1";
const PW_VERIFIER_KEY = "wallet.pwVerifier.v1";
const REGISTRY_KEY = "wallet.registry.v2";
const META_KEY = "zaphod.walletsMeta.v2";
const STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;

export type WalletKind = "mnemonic" | "privateKey";

export interface WalletPublicInfo {
  kind: WalletKind;
  evmAddress: string;
  /** bech32 display addresses derived from the same key */
  infiniteAddress: string;
  qomAddress: string;
}

interface WalletSecret {
  kind: WalletKind;
  secret: string;
}

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

/** Gate a sensitive action behind device biometrics / device PIN. */
export async function authenticate(
  reason = tr("auth.unlockWallet"),
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    // Fall back to the device PIN/passcode when biometrics are unavailable.
    disableDeviceFallback: false,
  });
  return result.success;
}

/**
 * Unlock method (user choice at setup, changeable in Settings):
 * "biometric" gates behind authenticate() above; "password" gates
 * behind an app password. The method is an APP-WIDE gate — it is not
 * per wallet/account. Wallets stored before this feature existed
 * have no method record and are treated as "biometric", exactly as
 * they behaved before.
 */
export type UnlockMethod = "biometric" | "password";

export async function getUnlockMethod(): Promise<UnlockMethod> {
  try {
    const v = await SecureStore.getItemAsync(UNLOCK_METHOD_KEY, STORE_OPTIONS);
    return v === "password" ? "password" : "biometric";
  } catch {
    return "biometric";
  }
}

/** True when the user has ever explicitly saved an unlock method
 *  (vs. silently defaulting to biometrics). Setup asks only then —
 *  adding another wallet later never re-asks. */
export async function hasUnlockMethodRecord(): Promise<boolean> {
  try {
    return (
      (await SecureStore.getItemAsync(UNLOCK_METHOD_KEY, STORE_OPTIONS)) !==
      null
    );
  } catch {
    return false;
  }
}

export async function setUnlockMethodStored(
  method: UnlockMethod,
): Promise<void> {
  await SecureStore.setItemAsync(UNLOCK_METHOD_KEY, method, STORE_OPTIONS);
}

/**
 * App-password verifier. ONLY a salted hash is ever stored (SHA-256
 * over "<salt>:<password>", salt = 16 random bytes from the OS RNG,
 * kept in SecureStore next to the hash). The password itself is never
 * written anywhere. This verifier only gates the app UI — the wallet
 * secret itself stays in SecureStore exactly as before.
 */
interface PwVerifier {
  salt: string;
  hash: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(salt: string, password: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`,
  );
}

export async function setPasswordVerifier(password: string): Promise<void> {
  const salt = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const hash = await hashPassword(salt, password);
  const record: PwVerifier = { salt, hash };
  await SecureStore.setItemAsync(
    PW_VERIFIER_KEY,
    JSON.stringify(record),
    STORE_OPTIONS,
  );
}

export async function hasPasswordVerifier(): Promise<boolean> {
  try {
    return (
      (await SecureStore.getItemAsync(PW_VERIFIER_KEY, STORE_OPTIONS)) !==
      null
    );
  } catch {
    return false;
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(PW_VERIFIER_KEY, STORE_OPTIONS);
    if (!raw) return false;
    const record = JSON.parse(raw) as PwVerifier;
    const candidate = await hashPassword(record.salt, password);
    // Constant-time-ish comparison so the length of a matching prefix
    // isn't observable through timing.
    if (candidate.length !== record.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
      diff |= candidate.charCodeAt(i) ^ record.hash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export async function clearPasswordVerifier(): Promise<void> {
  await SecureStore.deleteItemAsync(PW_VERIFIER_KEY, STORE_OPTIONS);
}

export async function getWalletPublicInfo(): Promise<WalletPublicInfo | null> {
  const raw = await SecureStore.getItemAsync(PUBLIC_KEY, STORE_OPTIONS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WalletPublicInfo;
  } catch {
    return null;
  }
}

export async function hasStoredWalletMarker(): Promise<boolean> {
  return (await getWalletPublicInfo()) !== null;
}

export async function saveWallet(
  kind: WalletKind,
  secret: string,
  info: WalletPublicInfo,
): Promise<void> {
  const secretRecord: WalletSecret = { kind, secret };
  await SecureStore.setItemAsync(
    SECRET_KEY,
    JSON.stringify(secretRecord),
    STORE_OPTIONS,
  );
  await SecureStore.setItemAsync(
    PUBLIC_KEY,
    JSON.stringify(info),
    STORE_OPTIONS,
  );
}

export async function loadWalletSecret(): Promise<WalletSecret | null> {
  const raw = await SecureStore.getItemAsync(SECRET_KEY, STORE_OPTIONS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WalletSecret;
  } catch {
    return null;
  }
}

export async function deleteWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(SECRET_KEY, STORE_OPTIONS);
  await SecureStore.deleteItemAsync(PUBLIC_KEY, STORE_OPTIONS);
  await SecureStore.deleteItemAsync(HAS_SENT_KEY, STORE_OPTIONS);
  await SecureStore.deleteItemAsync(UNLOCK_METHOD_KEY, STORE_OPTIONS);
  await SecureStore.deleteItemAsync(PW_VERIFIER_KEY, STORE_OPTIONS);
}

/** True once the user has successfully sent at least one transaction. */
export async function getHasSentTx(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(HAS_SENT_KEY, STORE_OPTIONS);
  return v === "1";
}

export async function markHasSentTx(): Promise<void> {
  await SecureStore.setItemAsync(HAS_SENT_KEY, "1", STORE_OPTIONS);
}

/**
 * ── Multi-wallet storage (v2) ─────────────────────────────────────
 * Secrets live per-wallet in ONE SecureStore record (the registry):
 * every wallet the user created / imported, keyed by id (the
 * account-0 EVM address — unique per wallet, and re-importing the
 * same wallet dedupes onto the same id). Public metadata (kinds,
 * derived account addresses, which wallet/account is active) sits in
 * a companion SecureStore record so the two can't drift apart.
 *
 * Migration: wallets stored by the v1 single-wallet layout
 * (wallet.secret.v1 / wallet.public.v1) are folded into this layout
 * by WalletContext on first load; clearLegacyWalletKeys() then
 * removes ONLY the v1 secret/public records (the unlock-method
 * record, password verifier and has-sent flag are app-wide and stay).
 */

export interface StoredWalletRecord {
  id: string;
  kind: WalletKind;
  secret: string;
}

export interface WalletRegistry {
  wallets: StoredWalletRecord[];
  activeWalletId: string | null;
}

export async function loadRegistry(): Promise<WalletRegistry | null> {
  try {
    const raw = await SecureStore.getItemAsync(REGISTRY_KEY, STORE_OPTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletRegistry;
    if (!parsed || !Array.isArray(parsed.wallets)) return null;
    return {
      wallets: parsed.wallets.filter(
        (w) =>
          w &&
          typeof w.id === "string" &&
          (w.kind === "mnemonic" || w.kind === "privateKey") &&
          typeof w.secret === "string",
      ),
      activeWalletId:
        typeof parsed.activeWalletId === "string"
          ? parsed.activeWalletId
          : null,
    };
  } catch {
    return null;
  }
}

export async function saveRegistry(registry: WalletRegistry): Promise<void> {
  await SecureStore.setItemAsync(
    REGISTRY_KEY,
    JSON.stringify(registry),
    STORE_OPTIONS,
  );
}

export interface WalletAccountMeta {
  evmAddress: string;
  infiniteAddress: string;
  qomAddress: string;
}

export interface WalletMeta {
  id: string;
  kind: WalletKind;
  accounts: WalletAccountMeta[];
  activeAccountIndex: number;
}

export interface WalletsMeta {
  wallets: WalletMeta[];
  activeWalletId: string | null;
}

export async function loadWalletsMeta(): Promise<WalletsMeta | null> {
  try {
    const raw = await SecureStore.getItemAsync(META_KEY, STORE_OPTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletsMeta;
    if (!parsed || !Array.isArray(parsed.wallets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveWalletsMeta(meta: WalletsMeta): Promise<void> {
  // Kept in SecureStore alongside the registry (not best-effort
  // AsyncStorage) so the two records can't silently drift apart.
  await SecureStore.setItemAsync(
    META_KEY,
    JSON.stringify(meta),
    STORE_OPTIONS,
  );
}

/** Remove ONLY the v1 single-wallet records after a successful
 *  migration into the v2 registry. Gate settings are app-wide and
 *  deliberately NOT touched here. */
export async function clearLegacyWalletKeys(): Promise<void> {
  await SecureStore.deleteItemAsync(SECRET_KEY, STORE_OPTIONS);
  await SecureStore.deleteItemAsync(PUBLIC_KEY, STORE_OPTIONS);
}
