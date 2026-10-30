/**
 * Chain definitions for the Infinite / QL1 dedicated wallet.
 * Only values verified from public sources on 2026-10-30 are filled in.
 * Anything marked TODO_MT must be confirmed with developer MT — do not guess
 * chain IDs, denoms, or contract addresses for a wallet that moves real funds.
 */

export interface ChainConfig {
  key: "infinite" | "ql1";
  displayName: string;
  /** EVM chain id (decimal) */
  evmChainId: number;
  /** Cosmos SDK chain id, if known */
  cosmosChainId?: string;
  nativeSymbol: string;
  nativeDecimals: number;
  bech32Prefix: string;
  evmRpcUrls: string[];
  cosmosRestUrls?: string[];
  explorerUrl: string;
}

export const INFINITE: ChainConfig = {
  key: "infinite",
  displayName: "Infinite Drive",
  evmChainId: 421018,
  cosmosChainId: "infinite_421018-1",
  nativeSymbol: "42",
  nativeDecimals: 18, // base denom "drop" (exp 0), display denom exp 18 — official docs via infinitedrive42.xyz hub, 2026-10-30
  bech32Prefix: "infinite",
  evmRpcUrls: [
    "https://evm-rpc.infinitedrive.xyz", // official (Assets + Console listings agree)
    "https://evm-rpc-infinite.mschihuahua.org", // official listing
    "https://evm-rpc.infinitepanda.xyz", // official listing / community (Panda)
  ],
  explorerUrl: "https://scan.infinitedrive.xyz",
};

/** Infinite (42 Chain) tokens — contract addresses from the official link hub
 *  (infinitedrive42.xyz, 2026-10-30), as linked to the Blockscout explorer.
 *  Decimals are NOT listed here: confirm per-token before displaying balances. */
export const INFINITE_TOKENS = [
  { symbol: "FISH", address: "0x2c32120a12B754272d9E85C57F64b50cA2C43513" },
  { symbol: "PANIC", address: "0xfAA842c8871f7F99c183F77871f79ce07DD056Cd" },
  { symbol: "STARSHIP", address: "0x645D71e49B86CfBE3FB93081deC2c17a496Cd57d" },
  { symbol: "ZAP", address: "0x89195Ca5C954b6f99b78f4A2Aa5435A75Dc5B256" },
  { symbol: "MARVIN", address: "0xa307362f8a756722541dde6255AECf64F35Ba337" },
  { symbol: "FOXXEY", address: "0x68D5A28D3bf09a32d3b9C35714aB7A6166Ae2a00" },
  { symbol: "TOWEL", address: "0xD0f48123638BD243C3a0eE49D0D7BEb7404F9DE4" },
  { symbol: "CAT42", address: "0x7386719EBbBeB4d810fF89027Bfb8A1CDf696310" },
] as const;

export const QL1: ChainConfig = {
  key: "ql1",
  displayName: "QOM Layer One (QL1)",
  evmChainId: 766,
  cosmosChainId: undefined, // TODO_MT: confirm (do not guess)
  nativeSymbol: "QOM",
  nativeDecimals: 18, // TODO_MT: confirm base denom (e.g. aqom = 10^18)
  bech32Prefix: "qom",
  evmRpcUrls: [
    "https://evm-rpc-ql1.mschihuahua.org", // community (AYC)
  ],
  explorerUrl: "https://scan.qom.one",
};

/** QL1 tokens — from zaphod.one/zap linking to the QL1 explorer
 *  (scan.qom.network), checked 2026-10-30. Note: ZAP (QL1) is verified
 *  only as a Partial Match with a bytecode-mismatch warning on the
 *  explorer — treat with caution. Decimals not confirmed. */
export const QL1_TOKENS = [
  { symbol: "ZAP", address: "0x6041B64618434B9D0a9558B5975C5c1DEb45CEE6" },
] as const;

export const CHAINS: ChainConfig[] = [INFINITE, QL1];

/** dApps to open in the in-app browser (Phase 0-2) before native integration. */
export const DAPP_LINKS = {
  swap: "https://app.zaphod.one",
  flukeGuide: "https://fluke.zaphod.one",
  nft: "https://nft.zaphod.one",
  bridge: "https://bridge.zaphod.one",
  dontPanicDex: "https://app.dontpanic.finance",
  docs: "https://docs.infinitedrive.xyz/en/",
  console: "https://console.infinitedrive.xyz/",
  driveStats: "https://drivestats.online/",
  hub: "https://hub.infinitedrive.xyz/",
  staking: "https://staking.zaphod.one",
  fishDisk: "https://fishdisk.com",
} as const;
