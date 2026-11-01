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
  normalizePhrase,
  walletFromPhrase,
  walletFromPhraseAtIndex,
  walletFromPrivateKey,
} from "../lib/walletCrypto";
import {
  authenticate,
  clearLegacyWalletKeys,
  clearPasswordVerifier,
  deleteWallet,
  getUnlockMethod,
  getWalletPublicInfo,
  hasUnlockMethodRecord,
  loadRegistry,
  loadWalletSecret,
  loadWalletsMeta,
  saveRegistry,
  saveWalletsMeta,
  setPasswordVerifier,
  setUnlockMethodStored,
  verifyPassword,
  type StoredWalletRecord,
  type UnlockMethod,
  type WalletAccountMeta,
  type WalletKind,
  type WalletMeta,
  type WalletPublicInfo,
  type WalletRegistry,
  type WalletsMeta,
} from "../lib/walletStore";

/**
 * Real wallet state (user opted in to signing on 2026-10-30).
 *
 * Secrets live only in expo-secure-store. After unlock, the ACTIVE
 * account's private key is derived into memory ONLY, and auto-relocks
 * after AUTO_LOCK_MS of inactivity. Nothing here ever transmits keys.
 *
 * STORAGE (v2, multi-wallet): every wallet's secret sits in one
 * SecureStore registry record; public metadata (kinds, derived
 * account addresses, active selections) in a companion record
 * (walletStore). A v1 single wallet (wallet.secret.v1 /
 * wallet.public.v1) is migrated into the registry on first load and
 * the legacy records are then removed — gate settings (unlock
 * method, password verifier, has-sent flag) are app-wide and are NOT
 * touched by the migration. `info` below is always the ACTIVE
 * account of the ACTIVE wallet, so every existing screen follows
 * wallet/account switching without changes. Switching wallet or
 * account relocks: the gate is asked again for the newly active
 * secret.
 *
 * FIRST RUN: setupState is "needsSetup" until at least one wallet
 * exists; App renders the onboarding flow (welcome → create/import →
 * unlock-method choice) in that state. Adding wallets or accounts
 * later happens in Settings and never re-asks the unlock method —
 * persist() only flags the setup step when no method was ever saved.
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
 * for authentication: wallet removal deliberately relies on its
 * two-step in-app confirmation UI only.
 */

const AUTO_LOCK_MS = 5 * 60 * 1000;

export type SetupState = "loading" | "needsSetup" | "ready";

interface WalletState {
  /** public info of the ACTIVE account — null when no wallet is stored */
  info: WalletPublicInfo | null;
  /** metadata of every stored wallet (no secrets) */
  wallets: WalletMeta[];
  activeWalletId: string | null;
  /** index of the active account inside the active wallet */
  activeAccountIndex: number;
  /** first-run gate: "needsSetup" until a wallet exists */
  setupState: SetupState;
  unlocked: boolean;
  /** phrase of a just-created wallet, shown once until confirmed saved */
  pendingPhrase: string | null;
  busy: boolean;
  createWallet: () => Promise<void>;
  confirmPhraseSaved: () => void;
  importPhrase: (phrase: string) => Promise<void>;
  importPrivateKey: (key: string) => Promise<void>;
  /** derive + select the next account of the active phrase wallet */
  addAccount: () => Promise<void>;
  /** make another stored wallet active (relocks) */
  switchWallet: (id: string) => Promise<void>;
  /** make another account of the active wallet active (relocks) */
  switchAccount: (index: number) => Promise<void>;
  /** gated unlock (chosen method); returns true when the key is in memory */
  unlock: () => Promise<boolean>;
  /** the app-wide unlock gate: biometrics or the app password,
   *  whichever method the user chose. Used at unlock and at signing. */
  requestAuth: (reason?: string) => Promise<boolean>;
  /** how this app unlocks: system biometrics / PIN, or an app password.
   *  App-wide (not per wallet); unset records read as "biometric". */
  unlockMethod: UnlockMethod;
  /** true right after a create/import in this session, until the
   *  unlock-method step of setup is completed or skipped. Only ever
   *  set when no unlock method was ever saved, so adding a wallet
   *  later does not re-ask. */
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
  /** remove the ACTIVE wallet (other wallets stay); removing the
   *  last one also clears the app-wide gate records */
  removeWallet: () => Promise<void>;
  /** ethers Wallet connected to the chain RPC, or null while locked.
   *  Accepts the wallet chains and the bridge's signer-only chains. */
  getSigner: (chain: ProviderChainLike) => Wallet | null;
  /** raw private key for local derivation needs, or null while locked */
  getPrivateKey: () => string | null;
}

const Ctx = createContext<WalletState | null>(null);

/** Public metadata of account `index` of a stored wallet record.
 *  Derivation is deterministic, so metadata can always be rebuilt
 *  from the secret — which is what the load-time reconcile does. */
function deriveAccountMeta(
  record: StoredWalletRecord,
  index: number,
): WalletAccountMeta {
  const w =
    record.kind === "mnemonic"
      ? walletFromPhraseAtIndex(record.secret, index)
      : walletFromPrivateKey(record.secret);
  return {
    evmAddress: w.address,
    infiniteAddress: cosmosAddressFromPrivateKey(w.privateKey, "infinite"),
    qomAddress: cosmosAddressFromPrivateKey(w.privateKey, "qom"),
  };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<WalletsMeta | null>(null);
  const metaRef = useRef<WalletsMeta | null>(null);
  const registryRef = useRef<WalletRegistry>({
    wallets: [],
    activeWalletId: null,
  });
  const [loaded, setLoaded] = useState(false);
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

  // Load the registry + metadata, migrating a v1 single wallet first
  // when one exists, then reconciling metadata against the secrets.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let registry = await loadRegistry();
        let walletsMeta = await loadWalletsMeta();
        if (!registry || registry.wallets.length === 0) {
          const [secret, pub] = await Promise.all([
            loadWalletSecret(),
            getWalletPublicInfo(),
          ]);
          if (secret && pub) {
            const record: StoredWalletRecord = {
              id: pub.evmAddress,
              kind: secret.kind,
              secret: secret.secret,
            };
            registry = { wallets: [record], activeWalletId: record.id };
            walletsMeta = {
              wallets: [
                {
                  id: record.id,
                  kind: secret.kind,
                  accounts: [
                    {
                      evmAddress: pub.evmAddress,
                      infiniteAddress: pub.infiniteAddress,
                      qomAddress: pub.qomAddress,
                    },
                  ],
                  activeAccountIndex: 0,
                },
              ],
              activeWalletId: record.id,
            };
            await saveRegistry(registry);
            await saveWalletsMeta(walletsMeta);
            await clearLegacyWalletKeys();
          }
        }
        if (registry && registry.wallets.length > 0) {
          // Rebuild metadata from the secrets, preserving each
          // wallet's account count and active selections.
          const prevById = new Map(
            (walletsMeta?.wallets ?? []).map((w) => [w.id, w]),
          );
          const rebuilt: WalletMeta[] = registry.wallets.map((record) => {
            const prev = prevById.get(record.id);
            const count =
              record.kind === "mnemonic"
                ? Math.max(1, prev?.accounts.length ?? 1)
                : 1;
            const accounts: WalletAccountMeta[] = [];
            for (let i = 0; i < count; i++) {
              accounts.push(deriveAccountMeta(record, i));
            }
            const idx = Math.min(
              Math.max(0, prev?.activeAccountIndex ?? 0),
              accounts.length - 1,
            );
            return {
              id: record.id,
              kind: record.kind,
              accounts,
              activeAccountIndex: idx,
            };
          });
          const activeId =
            rebuilt.some((w) => w.id === walletsMeta?.activeWalletId)
              ? (walletsMeta!.activeWalletId as string)
              : rebuilt.some((w) => w.id === registry!.activeWalletId)
                ? (registry!.activeWalletId as string)
                : rebuilt[0].id;
          walletsMeta = { wallets: rebuilt, activeWalletId: activeId };
          await saveWalletsMeta(walletsMeta);
          if (registry.activeWalletId !== activeId) {
            registry = { ...registry, activeWalletId: activeId };
            await saveRegistry(registry);
          }
        } else {
          walletsMeta = null;
        }
        if (cancelled) return;
        registryRef.current = registry ?? {
          wallets: [],
          activeWalletId: null,
        };
        metaRef.current = walletsMeta;
        setMeta(walletsMeta);
      } catch {
        if (!cancelled) {
          registryRef.current = { wallets: [], activeWalletId: null };
          metaRef.current = null;
          setMeta(null);
        }
      }
      try {
        const m = await getUnlockMethod();
        if (!cancelled) {
          unlockMethodRef.current = m;
          setUnlockMethod(m);
        }
      } catch {
        // default "biometric" stays
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
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
      const record: StoredWalletRecord = { id: address, kind, secret };
      const reg = registryRef.current;
      const regWallets = reg.wallets.some((w) => w.id === address)
        ? reg.wallets.map((w) => (w.id === address ? record : w))
        : [...reg.wallets, record];
      const newReg: WalletRegistry = {
        wallets: regWallets,
        activeWalletId: address,
      };
      await saveRegistry(newReg);
      registryRef.current = newReg;

      const prevMeta = metaRef.current;
      const prevWallet = prevMeta?.wallets.find((w) => w.id === address);
      // Re-importing the same wallet keeps its added accounts (the
      // import itself lands on account 0); a fresh wallet starts
      // with just account 0.
      const walletMeta: WalletMeta = prevWallet
        ? { ...prevWallet, activeAccountIndex: 0 }
        : {
            id: address,
            kind,
            accounts: [deriveAccountMeta(record, 0)],
            activeAccountIndex: 0,
          };
      const metaWallets = prevWallet
        ? prevMeta!.wallets.map((w) => (w.id === address ? walletMeta : w))
        : [...(prevMeta?.wallets ?? []), walletMeta];
      const newMeta: WalletsMeta = {
        wallets: metaWallets,
        activeWalletId: address,
      };
      await saveWalletsMeta(newMeta);
      metaRef.current = newMeta;
      setMeta(newMeta);

      setPrivateKey(pk);
      scheduleAutoLock();
      // The unlock-method step is owed only when the user has never
      // explicitly saved one — adding a wallet later never re-asks.
      setPendingUnlockSetup(!(await hasUnlockMethodRecord()));
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
          normalizePhrase(phrase),
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

  const addAccount = useCallback(async () => {
    const m = metaRef.current;
    const reg = registryRef.current;
    if (!m || !m.activeWalletId) return;
    const wm = m.wallets.find((w) => w.id === m.activeWalletId);
    const record = reg.wallets.find((w) => w.id === m.activeWalletId);
    if (!wm || !record) return;
    if (record.kind !== "mnemonic") {
      // Private-key wallets hold exactly one account by construction;
      // the UI hides the button for them — this is just the guard.
      throw new Error(tr("err.addAccountKeyOnly"));
    }
    const nextIndex = wm.accounts.length;
    const updated: WalletMeta = {
      ...wm,
      accounts: [...wm.accounts, deriveAccountMeta(record, nextIndex)],
      activeAccountIndex: nextIndex,
    };
    const newMeta: WalletsMeta = {
      ...m,
      wallets: m.wallets.map((w) => (w.id === updated.id ? updated : w)),
    };
    await saveWalletsMeta(newMeta);
    metaRef.current = newMeta;
    setMeta(newMeta);
    // Landing on the new account relocks: its key is derived only
    // after the gate, like any other account switch.
    setPrivateKey(null);
  }, []);

  const switchWallet = useCallback(async (id: string) => {
    const m = metaRef.current;
    if (!m || m.activeWalletId === id || !m.wallets.some((w) => w.id === id)) {
      return;
    }
    const newMeta: WalletsMeta = { ...m, activeWalletId: id };
    await saveWalletsMeta(newMeta);
    metaRef.current = newMeta;
    setMeta(newMeta);
    const newReg: WalletRegistry = {
      ...registryRef.current,
      activeWalletId: id,
    };
    await saveRegistry(newReg);
    registryRef.current = newReg;
    setPrivateKey(null);
  }, []);

  const switchAccount = useCallback(async (index: number) => {
    const m = metaRef.current;
    if (!m || !m.activeWalletId) return;
    const wm = m.wallets.find((w) => w.id === m.activeWalletId);
    if (
      !wm ||
      index < 0 ||
      index >= wm.accounts.length ||
      wm.activeAccountIndex === index
    ) {
      return;
    }
    const updated: WalletMeta = { ...wm, activeAccountIndex: index };
    const newMeta: WalletsMeta = {
      ...m,
      wallets: m.wallets.map((w) => (w.id === updated.id ? updated : w)),
    };
    await saveWalletsMeta(newMeta);
    metaRef.current = newMeta;
    setMeta(newMeta);
    setPrivateKey(null);
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (privateKey) {
      scheduleAutoLock();
      return true;
    }
    const reg = registryRef.current;
    const m = metaRef.current;
    if (!m) return false;
    const activeId = m.activeWalletId ?? reg.activeWalletId;
    const record = reg.wallets.find((w) => w.id === activeId);
    if (!record) return false;
    const wm = m.wallets.find((w) => w.id === record.id);
    const index =
      record.kind === "mnemonic" ? (wm?.activeAccountIndex ?? 0) : 0;
    const ok = await requestAuth(tr("auth.unlockWallet"));
    if (!ok) return false;
    try {
      const pk =
        record.kind === "mnemonic"
          ? walletFromPhraseAtIndex(record.secret, index).privateKey
          : walletFromPrivateKey(record.secret).privateKey;
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
    if (meta && !privateKey && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      unlock();
    }
  }, [meta, privateKey, unlock]);

  const removeWallet = useCallback(async () => {
    // No auth gate here by design (see AUTH MODEL above): the Settings
    // screen's two-step confirmation UI is the only gate for removal.
    const m = metaRef.current;
    const reg = registryRef.current;
    if (!m || !m.activeWalletId) return;
    const remainingMeta = m.wallets.filter((w) => w.id !== m.activeWalletId);
    const remainingReg = reg.wallets.filter(
      (w) => w.id !== m.activeWalletId,
    );
    const nextActive = remainingMeta[0]?.id ?? null;
    const newReg: WalletRegistry = {
      wallets: remainingReg,
      activeWalletId: nextActive,
    };
    const newMeta: WalletsMeta = {
      wallets: remainingMeta,
      activeWalletId: nextActive,
    };
    await saveRegistry(newReg);
    await saveWalletsMeta(newMeta);
    registryRef.current = newReg;
    metaRef.current = remainingMeta.length > 0 ? newMeta : null;
    setMeta(remainingMeta.length > 0 ? newMeta : null);
    setPrivateKey(null);
    setPendingPhrase(null);
    if (remainingMeta.length === 0) {
      // Last wallet gone: the app-wide gate records go with it (the
      // pre-multi-wallet behavior), so a future setup starts clean.
      // deleteWallet clears the legacy keys + has-sent + gate records;
      // the (now empty) registry/meta records stay consistent.
      await deleteWallet().catch(() => {});
      unlockMethodRef.current = "biometric";
      setUnlockMethod("biometric");
      setPendingUnlockSetup(false);
    }
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

  // The active account, synthesized into the WalletPublicInfo shape
  // every screen already consumes.
  const activeWalletMeta =
    meta?.wallets.find((w) => w.id === meta.activeWalletId) ??
    meta?.wallets[0] ??
    null;
  const activeAccountMeta = activeWalletMeta
    ? (activeWalletMeta.accounts[activeWalletMeta.activeAccountIndex] ??
      activeWalletMeta.accounts[0] ??
      null)
    : null;
  const info: WalletPublicInfo | null =
    activeWalletMeta && activeAccountMeta
      ? {
          kind: activeWalletMeta.kind,
          evmAddress: activeAccountMeta.evmAddress,
          infiniteAddress: activeAccountMeta.infiniteAddress,
          qomAddress: activeAccountMeta.qomAddress,
        }
      : null;
  const setupState: SetupState = !loaded
    ? "loading"
    : !activeWalletMeta
      ? "needsSetup"
      : "ready";

  const value = useMemo<WalletState>(
    () => ({
      info,
      wallets: meta?.wallets ?? [],
      activeWalletId: meta?.activeWalletId ?? null,
      activeAccountIndex: activeWalletMeta?.activeAccountIndex ?? 0,
      setupState,
      unlocked: privateKey !== null,
      pendingPhrase,
      busy,
      createWallet,
      confirmPhraseSaved,
      importPhrase,
      importPrivateKey,
      addAccount,
      switchWallet,
      switchAccount,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      info?.kind,
      info?.evmAddress,
      meta,
      setupState,
      privateKey,
      pendingPhrase,
      busy,
      createWallet,
      confirmPhraseSaved,
      importPhrase,
      importPrivateKey,
      addAccount,
      switchWallet,
      switchAccount,
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
