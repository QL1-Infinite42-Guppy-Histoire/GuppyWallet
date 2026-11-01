/**
 * Cross-chain deposit ("Deposit from another chain") configuration.
 *
 * The app never talks to ChangeNOW directly and never holds any
 * provider key: it calls our tiny stateless proxy (see proxy/ in this
 * repo), which injects the partner key server-side and only allows
 * the pairs below.
 *
 * PROXY_BASE_URL stays empty until the proxy has been deployed (see
 * proxy/README.md). While it is empty the deposit flow shows an
 * honest 「準備中」 state and no order can be created; setting the
 * deployed workers.dev URL here is the only change needed to go live.
 */
export const PROXY_BASE_URL = "";

export const DEPOSIT_ENABLED = PROXY_BASE_URL.trim().length > 0;

export interface DepositSourceDef {
  key: "xlm" | "sol";
  /** ChangeNOW currency ticker */
  currency: string;
  /** ChangeNOW network id */
  network: string;
  symbol: string;
  /** false = shown as 対応予定 and cannot start a deposit yet */
  enabled: boolean;
}

/**
 * Sources for the BNB-first flow (design doc §8): ONE provider order
 * into BNB on BSC; the wallet-side swap to USDT comes later. XLM is
 * live first — SOL stays 対応予定 until its pair has been through the
 * same live test XLM went through (design doc §7 / Phase 0).
 */
export const DEPOSIT_SOURCES: DepositSourceDef[] = [
  { key: "xlm", currency: "xlm", network: "xlm", symbol: "XLM", enabled: true },
  { key: "sol", currency: "sol", network: "sol", symbol: "SOL", enabled: false },
];

/** The single payout this flow uses: BNB on BSC. */
export const DEPOSIT_DEST = {
  currency: "bnb",
  network: "bsc",
  symbol: "BNB",
} as const;
