/**
 * Cross-chain deposit ("Deposit from another chain") configuration.
 *
 * The app never talks to ChangeNOW directly and never holds any
 * provider key: it calls our tiny stateless proxy (see proxy/ in this
 * repo), which injects the partner key server-side and only allows
 * the pairs below.
 *
 * PROXY_BASE_URL was empty while the proxy was undeployed (see
 * proxy/README.md); in that state the deposit flow shows an honest
 * 「準備中」 state and no order can be created. It has pointed at the
 * live workers.dev deployment since v0.2.2.
 */
export const PROXY_BASE_URL = "https://guppy-deposit-proxy.nepicobsv.workers.dev";

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
 * into BNB on BSC; the wallet-side swap to USDT comes later. XLM went
 * live first; SOL was enabled in v0.2.2 after its pair returned a sane
 * live quote through the deployed proxy (1 SOL → ≈0.1315 BNB,
 * min ≈0.00525 SOL, checked 2026-11-01).
 */
export const DEPOSIT_SOURCES: DepositSourceDef[] = [
  { key: "xlm", currency: "xlm", network: "xlm", symbol: "XLM", enabled: true },
  { key: "sol", currency: "sol", network: "sol", symbol: "SOL", enabled: true },
];

/** The single payout this flow uses: BNB on BSC. */
export const DEPOSIT_DEST = {
  currency: "bnb",
  network: "bsc",
  symbol: "BNB",
} as const;
