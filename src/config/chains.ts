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
 *  Decimals confirmed = 18 for ALL of these via eth_call decimals()
 *  (research/CHAIN_DATA.md + research/NFT_AND_PRICES.md, 2026-10-30).
 *  NOTE: bridged USDT/USDC here are 18 decimals, NOT 6 like Ethereum.
 *  On-chain symbol quirks: PANIC's contract symbol() is "DONT" (name
 *  "Dont Panic"); st42's contract symbol() is "stC2" (name "Staked 42"). */
export const INFINITE_TOKENS = [
  { symbol: "FISH", address: "0x2c32120a12B754272d9E85C57F64b50cA2C43513", decimals: 18 },
  { symbol: "PANIC", address: "0xfAA842c8871f7F99c183F77871f79ce07DD056Cd", decimals: 18 },
  { symbol: "STARSHIP", address: "0x645D71e49B86CfBE3FB93081deC2c17a496Cd57d", decimals: 18 },
  { symbol: "ZAP", address: "0x89195Ca5C954b6f99b78f4A2Aa5435A75Dc5B256", decimals: 18 },
  { symbol: "MARVIN", address: "0xa307362f8a756722541dde6255AECf64F35Ba337", decimals: 18 },
  { symbol: "FOXXEY", address: "0x68D5A28D3bf09a32d3b9C35714aB7A6166Ae2a00", decimals: 18 },
  { symbol: "TOWEL", address: "0xD0f48123638BD243C3a0eE49D0D7BEb7404F9DE4", decimals: 18 },
  { symbol: "CAT42", address: "0x7386719EBbBeB4d810fF89027Bfb8A1CDf696310", decimals: 18 },
  { symbol: "st42", address: "0x78F40E828a92AF9e137FF7660E52Ac8B0f1D121E", decimals: 18 }, // on-chain symbol "stC2"
  { symbol: "QOM", address: "0x53465CbBBA5b14f5Dc00794330f0f4aFb30EAA1d", decimals: 18 }, // QOM token on Infinite
  { symbol: "USDT", address: "0xC2684966e5c95B2bc636FB4a1f3Da9Ad23d94753", decimals: 18 }, // Bridged USDT (18, not 6!)
  { symbol: "USDC", address: "0xea5b7fD59b7ec0F34663835A3a361F469C2D4c5C", decimals: 18 }, // Bridged USDC (18, not 6!)
] as const;

/** Infinite NFT collections confirmed on-chain (research/NFT_AND_PRICES.md).
 *  CAUTION: an ERC-20 "The Guide Token" 0x31648Ee446704394A12BEaFb8fdFB8C2a113f1Ca
 *  shares the GUIDE symbol — always identify by address, never symbol. */
export const INFINITE_NFTS = {
  theGuide: "0xF349E469C474048DEd6F9b914309E76880ED1bbD", // The Guide (GUIDE, ERC-721) — nft.zaphod.one collection address, holders match
  zg13: "0x8f0c0b0Da44F945f5c32F358292616da3a07fc9d", // Zaphod Girls The Thirteen (ZG13, ERC-721)
} as const;

/** Verified contracts found on the Infinite explorer (2026-10-30 scan sweep).
 *  Verified = source + ABI are public on the explorer. App ownership is NOT
 *  labelled on the explorer, so treat the st42 pair as the st42 system's
 *  contracts by name only until MT confirms. */
export const INFINITE_CONTRACTS = {
  st42Book: "0x458f6b41d093bED5aBBc1527DaBDf5499A85294F", // St42Book (verified)
  st42Vault: "0x0F93a9b0dBF2D1829928fe40cBc155e0b5B2D35e", // St42Vault (verified)
  x42Factory: "0x8965501ea6d898ef5251776C1E99Da3c5E6504eF", // X42Factory (verified; owner app unlabelled)
  // Don't Panic / Nutri-Matic DEX (Uniswap V2 style) — confirmed on-chain
  // 2026-10-30 via eth_call through two independent official RPCs:
  // router.factory() == dexFactory, factory.getPair(FISH, PANIC) == the
  // FISH/DONT Nutri-Matic V2 pair, router.WETH() == 0xEeee...EEeE (the
  // chain's native-42 placeholder convention). Router/factory contracts
  // themselves are unverified on the explorer, but the V2 interface is
  // standard. Supplied/corroborated by the user, then proven on-chain.
  dexRouter: "0xBF07dFE35746894bAe373f63f4Bf2379F9BaFEc0",
  dexFactory: "0x3157C6AcA800D507af95Ab1466adBA3A6F11eE1a",
} as const;

export const QL1: ChainConfig = {
  key: "ql1",
  displayName: "QOM Layer One (QL1)",
  evmChainId: 766,
  // Confirmed 2026-10-30 (research/CHAIN_DATA.md): chain ID from the QL1
  // genesis at rpc.foxxone.one + official validator guide; base denom
  // "aqom" (bond_denom), 1 QOM = 10^18 aqom per the guide. Was TODO_MT.
  cosmosChainId: "qom_766-1",
  nativeSymbol: "QOM",
  nativeDecimals: 18,
  bech32Prefix: "qom",
  evmRpcUrls: [
    "https://evm-rpc-ql1.mschihuahua.org", // community (AYC)
  ],
  explorerUrl: "https://scan.qom.network",
};

/** Infinite staking: the Cosmos EVM staking precompile at 0x0000...0800 is
 *  LIVE — probed on-chain 2026-10-30, returned 23 bonded validators via
 *  the standard cosmos/evm StakingI interface. QL1 has NO staking
 *  precompile at that address (probe returned empty); QL1 delegation is
 *  Cosmos tx per the official guide (qomd tx staking delegate). */

/** QL1 tokens — from zaphod.one/zap linking to the QL1 explorer
 *  (scan.qom.network), checked 2026-10-30. Note: ZAP (QL1) is verified
 *  only as a Partial Match with a bytecode-mismatch warning on the
 *  explorer — treat with caution. Decimals confirmed 18 via eth_call
 *  (ZAP/WQOM: research/CHAIN_DATA.md; QSWAP: direct call 2026-10-30).
 *  QSWAP is the QomSwap token; its QSWAP/WQOM pair (LP "QOMSWAP V2")
 *  is 0x2c9e7BC2f7Cb66BDd7989F1f485D7640E5967173. */
export const QL1_TOKENS = [
  { symbol: "ZAP", address: "0x6041B64618434B9D0a9558B5975C5c1DEb45CEE6", decimals: 18 },
  { symbol: "WQOM", address: "0xa26dfBF98Dd1A32FAe56A3D2B2D60A8a41b0bDF0", decimals: 18 }, // Wrapped QOM
  { symbol: "QSWAP", address: "0x4AF41F453Ead00d1cc6Aa0b5B454bdeB102AFc8d", decimals: 18 }, // QomSwap token
] as const;

/** Verified contracts found on the QL1 explorer (scan.qom.network, 2026-10-30).
 *  QNS = QOM Domains system. Names are sold as PERMANENT purchases
 *  (one-time `permanentRentPrice`, never expires) per the user, 2026-10-30. */
export const QL1_CONTRACTS = {
  qnsDomains: "0xDCbF4614152a22D1883Ba3929c668B978A3be548", // QOM Domains (QNS) / QNSBaseRegistrar (verified)
  qnsRegistrarController: "0x4d9FE3F0EE6Fe1645DD537EC59a0a328f7148372", // QNSRegistrarController (verified; casing fixed to valid EIP-55 checksum 2026-10-30 — same address bytes)
  // QomSwap (QL1's main DEX, Uniswap V2 style) — proven on-chain
  // 2026-10-30 (research/QL1_DEX.md): pair.factory() == dexFactory,
  // factory.getPair(QSWAP, WQOM) == pair, router.factory() == dexFactory,
  // router.WETH() == WQOM. Factory holds 645 pairs; router ~240k txs.
  // Unverified on explorer; standard V2 interface answers.
  // NOTE: no direct ZAP pair exists in this factory (getPair = zero) —
  // Zaphod's QL1 ZAP routing remains unresolved.
  dexRouter: "0xc1f90231035A52091eBCb7dddaCa3051a5F44f30",
  dexFactory: "0x475f361993D6FAcBF32fB82B66be0fB40f3d974C",
} as const;

export const CHAINS: ChainConfig[] = [INFINITE, QL1];

/** External service links (information only — swaps run natively in-app
 *  against the confirmed DEX routers; no aggregator is used). */
export const DAPP_LINKS = {
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
