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
import PasswordPrompt from "../components/PasswordPrompt";
import { tr } from "../i18n";
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
  clearPasswordVerifier,
  deleteWallet,
  getUnlockMethod,
  getWalletPublicInfo,
  loadWalletSecret,
  saveWallet,
  setPasswordVerifier,
  setUnlockMethodStored,
  verifyPassword,
  type UnlockMethod,
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
 * AUTH MODEL (user instruction, 2026-10-30; unlock-method choice
 * added 2026-11-01): authentication is asked for at exactly two
 * moments —
 *   1. App open: on cold start, if a wallet exists and is locked, the
 *      unlock prompt appears automatically once (see the effect below).
 *      If the user cancels, nothing retries automatically; they can tap
 *      the unlock button in Settings (or the lock chip flow) instead.
 *   2. Signing: EVERY transaction send re-authenticates fresh inside
 *      ConfirmTx, immediately before the job executes — even when the
 *      session is already unlocked.
 * Both moments go through requestAuth(), which follows the unlock
 * method the user chose at setup (Settings can change it later): the
 * system biometric / device-PIN dialog, or — for the "password"
 * method — the in-app password prompt (only a salted hash of the
 * password is stored; see walletStore). Wallets created before the
 * choice existed default to biometrics, unchanged. Nothing else asks
 * for authentication: wallet deletion deliberately relies on its
 * two-step in-app confirmation UI only.
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
  /** gated unlock (chosen method); returns true when the key is in memory */
  unlock: () => Promise<boolean>;
  /** the app-wide unlock gate: biometrics or the app password,
   *  whichever method the user chose. Used at unlock and at signing. */
  requestAuth: (reason?: string) => Promise<boolean>;
  /** how this app unlocks: system biometrics / PIN, or an app password.
   *  App-wide (not per wallet); unset records read as "biometric". */
  unlockMethod: UnlockMethod;
  /** true right after a create/import in this session, until the
   *  unlock-method step of setup is completed or skipped */
  pendingUnlockSetup: boolean;
  /** save the chosen unlock method (sets the password verifier when
   *  the password method is picked) and finish the setup step */
  chooseUnlockMethod: (
    method: UnlockMethod,
    password?: string,
  ) => Promise<void>;
  /** skip the setup step without changing the method */
  completeUnlockSetup: () => void;
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

  // Unlock method (app-wide gate) + the in-app password prompt state.
  const [unlockMethod, setUnlockMethod] = useState<UnlockMethod>("biometric");
  const unlockMethodRef = useRef<UnlockMethod>("biometric");
  const [pendingUnlockSetup, setPendingUnlockSetup] = useState(false);
  const [pwPrompt, setPwPrompt] = useState<{ reason: string } | null>(null);
  const pwResolverRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    getWalletPublicInfo().then(setInfo).catch(() => setInfo(null));
    getUnlockMethod()
      .then((m) => {
        unlockMethodRef.current = m;
        setUnlockMethod(m);
      })
      .catch(() => {});
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, []);

  /**
   * The one gate for unlock + signing. Biometric method → the system
   * dialog (unchanged). Password method → the in-app prompt, resolved
   * by handlePwSubmit / handlePwCancel below. A second overlapping
   * request fails closed instead of stacking prompts.
   */
  const requestAuth = useCallback((reason?: string): Promise<boolean> => {
    if (unlockMethodRef.current !== "password") {
      return authenticate(reason);
    }
    return new Promise<boolean>((resolve) => {
      if (pwResolverRef.current) {
        resolve(false);
        return;
      }
      pwResolverRef.current = resolve;
      setPwPrompt({ reason: reason ?? tr("auth.unlockWallet") });
    });
  }, []);

  const handlePwSubmit = useCallback(async (pw: string): Promise<boolean> => {
    const ok = await verifyPassword(pw);
    if (!ok) return false; // prompt stays open, shows its error line
    const resolve = pwResolverRef.current;
    pwResolverRef.current = null;
    setPwPrompt(null);
    resolve?.(true);
    return true;
  }, []);

  const handlePwCancel = useCallback(() => {
    const resolve = pwResolverRef.current;
    pwResolverRef.current = null;
    setPwPrompt(null);
    resolve?.(false);
  }, []);

  const chooseUnlockMethod = useCallback(
    async (method: UnlockMethod, password?: string) => {
      if (method === "password") {
        if (!password) throw new Error(tr("err.passwordRequired"));
        await setPasswordVerifier(password);
        await setUnlockMethodStored("password");
      } else {
        await setUnlockMethodStored("biometric");
        // No stale verifier left behind when leaving the password method.
        await clearPasswordVerifier().catch(() => {});
      }
      unlockMethodRef.current = method;
      setUnlockMethod(method);
      setPendingUnlockSetup(false);
    },
    [],
  );

  const completeUnlockSetup = useCallback(
    () => setPendingUnlockSetup(false),
    [],
  );

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
      // Fresh wallet → the setup flow still owes the unlock-method
      // step (Settings / onboarding render it while this is set).
      setPendingUnlockSetup(true);
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
        throw new Error(tr("err.badPhrase"));
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
        throw new Error(tr("err.badPrivateKey"));
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
    const ok = await requestAuth(tr("auth.unlockWallet"));
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
  }, [privateKey, scheduleAutoLock, requestAuth]);

  // App-open unlock prompt (auth model #1): exactly once per cold
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
    // No auth gate here by design (see AUTH MODEL above): the Settings
    // screen's two-step confirmation UI is the only gate for deletion.
    // deleteWallet also clears the unlock-method record + verifier, so
    // the gate state resets together with the wallet (single-wallet
    // world; the multi-wallet storage keeps the gate app-wide).
    await deleteWallet();
    setInfo(null);
    setPrivateKey(null);
    setPendingPhrase(null);
    unlockMethodRef.current = "biometric";
    setUnlockMethod("biometric");
    setPendingUnlockSetup(false);
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
      requestAuth,
      unlockMethod,
      pendingUnlockSetup,
      chooseUnlockMethod,
      completeUnlockSetup,
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
      requestAuth,
      unlockMethod,
      pendingUnlockSetup,
      chooseUnlockMethod,
      completeUnlockSetup,
      lock,
      removeWallet,
      getSigner,
      getPrivateKey,
    ],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* The password gate (only ever visible when the chosen unlock
          method is "password" and requestAuth opened it). */}
      <PasswordPrompt
        visible={pwPrompt !== null}
        reason={pwPrompt?.reason ?? ""}
        onSubmit={handlePwSubmit}
        onCancel={handlePwCancel}
      />
    </Ctx.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
