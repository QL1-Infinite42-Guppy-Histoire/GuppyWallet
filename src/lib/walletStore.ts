import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

/**
 * ⚠️ PROTOTYPE STUB — UNAUDITED. DO NOT USE WITH REAL FUNDS. ⚠️
 *
 * This file defines the *shape* of wallet key storage only:
 *  - where a seed would live (expo-secure-store, backed by Android Keystore)
 *  - how unlock would be gated (device biometrics / PIN)
 *
 * Wallet creation / import is intentionally DISABLED below
 * (WALLET_CREATION_ENABLED = false). There is deliberately no code path in
 * this prototype that saves a real mnemonic, derives keys, signs, or sends.
 * Enabling any of that requires, at minimum:
 *  1. an audited BIP-39/44 implementation + crypto polyfill review for RN,
 *  2. MT's confirmed derivation paths for qom1… / infinite1… addresses,
 *  3. a separate security review.
 */

export const WALLET_CREATION_ENABLED = false as const;

const STORAGE_KEY_WALLET_MARKER = "prototype.wallet.marker.v1";

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

/** Gate a sensitive action behind device biometrics / device PIN. */
export async function authenticate(reason = "ウォレットのロックを解除"): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    // Fall back to the device PIN/passcode when biometrics are unavailable.
    disableDeviceFallback: false,
  });
  return result.success;
}

/** True only if a previous (future, audited) flow stored a wallet marker. */
export async function hasStoredWalletMarker(): Promise<boolean> {
  const marker = await SecureStore.getItemAsync(STORAGE_KEY_WALLET_MARKER, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return marker !== null;
}

function disabledError(): Error {
  return new Error(
    "ウォレットの作成／インポートはこの試作版では無効です。" +
      "未監査のコードに本物のニーモニックを入れないでください。",
  );
}

/** STUB — always throws while WALLET_CREATION_ENABLED is false. */
export async function createWalletStub(): Promise<never> {
  throw disabledError();
}

/** STUB — always throws while WALLET_CREATION_ENABLED is false. */
export async function importWalletStub(_mnemonic: string): Promise<never> {
  throw disabledError();
}
