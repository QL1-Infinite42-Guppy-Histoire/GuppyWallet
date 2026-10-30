import { Wallet } from "ethers";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getProvider, type ProviderChainLike } from "../lib/onchain";
import {
  cosmosAddressFromPrivateKey,
  generatePhrase,
  isValidPhrase,
  isValidPrivateKey,
  walletFromPhrase,
  walletFromPrivateKey,
} from "../lib/walletCrypto";
import {
  authenticate,
  deleteWallet,
  getWalletPublicInfo,
  loadWalletSecret,
  saveWallet,
  type WalletKind,
  type WalletPublicInfo,
} from "../lib/walletStore";

/**
 * Real wallet state (user opted in to signing on 2026-10-30).
 *
 * The secret lives only in expo-secure-store. After biometric unlock it
 * is derived into a private key held in memory ONLY, and auto-relocks
 * after AUTO_LOCK_MS of inactivity. Nothing here ever transmits keys.
 *
 * AUTH MODEL (user instruction, 2026-10-30): biometric authentication is
 * asked for at exactly two moments —
 *   1. App open: on cold start, if a wallet exists and is locked, the
 *      unlock prompt appears automatically once (see the effect below).
 *      If the user cancels, nothing retries automatically; they can tap
 *      the unlock button in Settings (or the lock chip flow) instead.
 *   2. Signing: EVERY transaction send re-authenticates fresh inside
 *      ConfirmTx, immediately before the job executes — even when the
 *      session is already unlocked.
 * Nothing else asks for biometrics: wallet deletion deliberately relies
 * on its two-step in-app confirmation UI only, and creation/import never
 * gated on biometrics.
 */

const AUTO_LOCK_MS = 5 * 60 * 1000;

interface WalletState {
  /** public info (kind + addresses) — null when no wallet is stored */
  info: WalletPublicInfo | null;
  unlocked: boolean;
  /** phrase of a just-created wallet, shown once until confirmed saved */
  pendingPhrase: string | null;
  busy: boolean;
  createWallet: () => Promise<void>;
  confirmPhraseSaved: () => void;
  importPhrase: (phrase: string) => Promise<void>;
  importPrivateKey: (key: string) => Promise<void>;
  /** biometric-gated unlock; returns true when the key is in memory */
  unlock: () => Promise<boolean>;
  lock: () => void;
  removeWallet: () => Promise<void>;
  /** ethers Wallet connected to the chain RPC, or null while locked.
   *  Accepts the wallet chains and the bridge's signer-only chains. */
  getSigner: (chain: ProviderChainLike) => Wallet | null;
  /** raw private key for local derivation needs, or null while locked */
  getPrivateKey: () => string | null;
}

const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<WalletPublicInfo | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [pendingPhrase, setPendingPhrase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getWalletPublicInfo().then(setInfo).catch(() => setInfo(null));
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, []);

  const scheduleAutoLock = useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => setPrivateKey(null), AUTO_LOCK_MS);
  }, []);

  const lock = useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
    setPrivateKey(null);
  }, []);

  const persist = useCallback(
    async (kind: WalletKind, secret: string, pk: string, address: string) => {
      const pub: WalletPublicInfo = {
        kind,
        evmAddress: address,
        infiniteAddress: cosmosAddressFromPrivateKey(pk, "infinite"),
        qomAddress: cosmosAddressFromPrivateKey(pk, "qom"),
      };
      await saveWallet(kind, secret, pub);
      setInfo(pub);
      setPrivateKey(pk);
      scheduleAutoLock();
    },
    [scheduleAutoLock],
  );

  const createWallet = useCallback(async () => {
    setBusy(true);
    try {
      const phrase = await generatePhrase();
      const wallet = walletFromPhrase(phrase);
      await persist("mnemonic", phrase, wallet.privateKey, wallet.address);
      setPendingPhrase(phrase);
    } finally {
      setBusy(false);
    }
  }, [persist]);

  const confirmPhraseSaved = useCallback(() => setPendingPhrase(null), []);

  const importPhrase = useCallback(
    async (phrase: string) => {
      if (!isValidPhrase(phrase)) {
        throw new Error(
          "リカバリーフレーズが正しくありません。単語の並びを確認してください。",
        );
      }
      setBusy(true);
      try {
        const wallet = walletFromPhrase(phrase);
        await persist(
          "mnemonic",
          phrase.trim().toLowerCase().replace(/\s+/g, " "),
          wallet.privateKey,
          wallet.address,
        );
      } finally {
        setBusy(false);
      }
    },
    [persist],
  );

  const importPrivateKey = useCallback(
    async (key: string) => {
      if (!isValidPrivateKey(key)) {
        throw new Error("秘密鍵の形式が正しくありません。");
      }
      setBusy(true);
      try {
        const wallet = walletFromPrivateKey(key);
        await persist("privateKey", key.trim(), wallet.privateKey, wallet.address);
      } finally {
        setBusy(false);
      }
    },
    [persist],
  );

  const unlock = useCallback(async (): Promise<boolean> => {
    if (privateKey) {
      scheduleAutoLock();
      return true;
    }
    const stored = await loadWalletSecret();
    if (!stored) return false;
    const ok = await authenticate("ウォレットのロックを解除");
    if (!ok) return false;
    try {
      const pk =
        stored.kind === "mnemonic"
          ? walletFromPhrase(stored.secret).privateKey
          : walletFromPrivateKey(stored.secret).privateKey;
      setPrivateKey(pk);
      scheduleAutoLock();
      return true;
    } catch {
      return false;
    }
  }, [privateKey, scheduleAutoLock]);

  // App-open biometric prompt (auth model #1): exactly once per cold
  // start, when a stored wallet exists and the key is not yet in memory.
  // Cancelling leaves the wallet locked with no automatic retry.
  const autoPromptedRef = useRef(false);
  useEffect(() => {
    if (info && !privateKey && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      unlock();
    }
  }, [info, privateKey, unlock]);

  const removeWallet = useCallback(async () => {
    // No biometric here by design (see AUTH MODEL above): the Settings
    // screen's two-step confirmation UI is the only gate for deletion.
    await deleteWallet();
    setInfo(null);
    setPrivateKey(null);
    setPendingPhrase(null);
  }, []);

  const getSigner = useCallback(
    (chain: ProviderChainLike): Wallet | null => {
      if (!privateKey) return null;
      scheduleAutoLock();
      return new Wallet(privateKey, getProvider(chain));
    },
    [privateKey, scheduleAutoLock],
  );

  const getPrivateKey = useCallback(() => privateKey, [privateKey]);

  const value = useMemo<WalletState>(
    () => ({
      info,
      unlocked: privateKey !== null,
      pendingPhrase,
      busy,
      createWallet,
      confirmPhraseSaved,
      importPhrase,
      importPrivateKey,
      unlock,
      lock,
      removeWallet,
      getSigner,
      getPrivateKey,
    }),
    [
      info,
      privateKey,
      pendingPhrase,
      busy,
      createWallet,
      confirmPhraseSaved,
      importPhrase,
      importPrivateKey,
      unlock,
      lock,
      removeWallet,
      getSigner,
      getPrivateKey,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
