import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

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
  reason = "ウォレットのロックを解除",
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    // Fall back to the device PIN/passcode when biometrics are unavailable.
    disableDeviceFallback: false,
  });
  return result.success;
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
}

/** True once the user has successfully sent at least one transaction. */
export async function getHasSentTx(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(HAS_SENT_KEY, STORE_OPTIONS);
  return v === "1";
}

export async function markHasSentTx(): Promise<void> {
  await SecureStore.setItemAsync(HAS_SENT_KEY, "1", STORE_OPTIONS);
}
