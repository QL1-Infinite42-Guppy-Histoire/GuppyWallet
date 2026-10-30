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
  // Fluke (fluke.zaphod.one) — recovered from the site's public JS config
  // and VERIFIED on-chain 2026-10-30 (research/ZAPHOD_FRONTEND.md,
  // research/abi-fluke.json). The game core IS The Guide contract itself
  // (INFINITE_NFTS.theGuide): commit/reveal/seed/settle/boost/write/append
  // live on the NFT contract. Config only — no app flow built yet.
  flukeRenderer: "0xA6d108386633D3c102d4e0b952A3a96322057Ac4", // on-chain art renderer; core.renderer() returns this
  flukeArt: "0xB4321eae9dDF0C3aC11C7B7aE555dF626798FFA4", // art module named in the Fluke config
  starlightLedger: "0xebC32E52a1AA52d8A0cD71402C4ffDf316f0Db07", // "Starlight" yield ledger (explorer name): register Guide NFTs -> streamed [42] rewards; Fluke config "yield.ledger", verified live (currentEpoch/totalIn answered)
  // Zaphod Bridge (Hyperlane-based) — Infinite side. Recovered from
  // bridge.zaphod.one JS + its public /api/state, VERIFIED on-chain
  // 2026-10-30 (research/ZAPHOD_FRONTEND.md, research/abi-bridge.json):
  // each BridgeRouter (VERSION 1.3.0) wraps one Hyperlane warp router;
  // token()/underlying() cross-checked against the site config.
  // Config only — no bridge flow built yet.
  hyperlaneMailbox: "0xac70cdD7F2B712AEF7A20661e0c2E96E1Da1d63E", // Hyperlane mailbox (Infinite); nonce() answered
  bridgeRouterQom: "0x049a78Fe311cf1C23f09cdd4F12420FfC917C8db", // -> QL1 only; feeBps 0, feeFlat 0, min 1 QOM
  bridgeRouterUsdt: "0x8667682B62CacedA9e87B3CAA21D5B09D9Ae13c3", // -> ETH/BSC; feeFlat 2 USDT, min 1
  bridgeRouterUsdc: "0xCDbf8dA81F0a24f25Bcd23c6232704BBfA410bd4", // -> ETH/BSC; feeFlat 2 USDC, min 1
  bridgeRouterWbtc: "0xb436C84a634ccEECc13d29Dc3F933625522c5e6f", // -> ETH only; no fee, min 3000 (8-dec units)
} as const;

/** Zaphod Bridge QL1 <-> Infinite token pairs (config only, verified
 *  2026-10-30 — research/ZAPHOD_FRONTEND.md). On Infinite the user calls
 *  the BridgeRouter (INFINITE_CONTRACTS.bridgeRouter* for QOM/USDT/USDC/
 *  WBTC; the remaining Infinite routers are listed in ZAPHOD_FRONTEND.md).
 *  On QL1 there is NO BridgeRouter wrapper: the frontend calls
 *  transferRemote directly on the token's Hyperlane warp router, and the
 *  token itself is an xERC20 held via its lockbox. All pairs feeBps 0 /
 *  no flat fee. Hyperlane domain = EVM chain id on both chains.
 *  NOTE: routers/lockboxes cross-checked between the site registry and
 *  /api/state; the ql1Xerc20 values are config-sourced (only QOM's was
 *  identity-verified on-chain) — re-check before wiring a send flow. */
export const BRIDGE_PAIRS_QL1 = [
  { symbol: "QOM", infiniteBridgeRouter: "0x049a78Fe311cf1C23f09cdd4F12420FfC917C8db", infiniteRouter: "0xf4440822c681Ce4CB80b5a3A508876eE23b40F1b", ql1Router: "0x30da1e7c8de5FA75B593002E0b2D2910FFcAdCB6", ql1Lockbox: "0x32b78419711a58E8Cd9945430F696f7db996fD50", ql1Xerc20: "0x91fe5fe31493de5e2eab71aa1006099627626fa8" },
  { symbol: "BABY", infiniteBridgeRouter: "0x4aba9dBE8a990C19501C1c4C3E677f775006D2e2", infiniteRouter: "0x49b525D647068E17892a66e08d197e7Faa036D3E", ql1Router: "0x8ff9452f309159828903d2D6cCa58CCcb2b5Cd16", ql1Lockbox: "0x8a9C80244E00baF719289f9CB10fd335B6BA77e5", ql1Xerc20: "0x40b60b0343a240c311561533667afd079e9c208d" },
  { symbol: "CAW", infiniteBridgeRouter: "0x82bA5D61a70677f7f53A9894C63DfB61FD8bCb65", infiniteRouter: "0xA8493DbB1be229Fbbc9127d6D2e387dbEA2AE214", ql1Router: "0xD14cF03D3753d80a1f6fb818Aa1c728D5c36B3bf", ql1Lockbox: "0xD3E886c616E17202cCB8a5f2932865F281c4Af86", ql1Xerc20: "0xea5b7fd59b7ec0f34663835a3a361F469C2D4c5C" },
  { symbol: "FATHER", infiniteBridgeRouter: "0x056c116c09ACb788d038E7dDc167249C26493D6e", infiniteRouter: "0xAe3fB59A4c950447386e7d2cA54ab05c857B817E", ql1Router: "0x54718De5e064DcD1181b7847591c5864434ED92e", ql1Lockbox: "0x631376D745A56CA4EFD9e565BF4cE0d56A8828FC", ql1Xerc20: "0x7ab903bc6aad05ace51dbfb35a43e6aea17310d1" },
  { symbol: "HAWK", infiniteBridgeRouter: "0x0d198200dC673e96217ddeA9560d26Ae0d092074", infiniteRouter: "0xBd0c6E7dA96F71cfD2E6651d697b048bAf5c91Cd", ql1Router: "0x916fb1a761d0Db8888C3F79d6c614C9FFf73b657", ql1Lockbox: "0x51BB05C603bc7D554D37be76cdE13360C1a84286", ql1Xerc20: "0xc2684966e5c95b2bc636FB4a1f3Da9Ad23d94753" },
  { symbol: "KET", infiniteBridgeRouter: "0x3BC94E9F417561Ca37559E07dfC65496fcE94557", infiniteRouter: "0xb1b313B3767c73398935E5bCDD7914340E73f3dD", ql1Router: "0x59d6e50f5b0559A088e3eaAc21E520be18453704", ql1Lockbox: "0x2060fA8977B89E55021B592E11134c26b78eAd21", ql1Xerc20: "0x866abba86c6176c9cd48804a47829559a382270e" },
  { symbol: "O", infiniteBridgeRouter: "0xcB893a7e5f2932531f6e04c0Fc3b17AC4884475f", infiniteRouter: "0xE62ba8A1df1ED3628f2C22A245f7A47a76573CB5", ql1Router: "0x488B1f39AA01196ec8a14891bAfFEe6630155A61", ql1Lockbox: "0xF2ecB173b63699C49ace3faae80af5ce677af015", ql1Xerc20: "0x4ad2d363bce045a7df7c9069cb517cc803409bea" },
  { symbol: "OSAK", infiniteBridgeRouter: "0xA2093426c03ba6F0f6049532b6f13F1e36566358", infiniteRouter: "0xB477ab5A53d8361b735BD812095325a35Fc29b1B", ql1Router: "0xe3a35d9f4EF7eacD5bb47164Ee8d7bff75C2cF6B", ql1Lockbox: "0x49bA579c2cC70260a008809A8182FbCfABc8b45E", ql1Xerc20: "0x16630f46109774257a65b645ad26b14b48e78aab" },
] as const;

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
 *  QNS = QOM Domains system. New .qom registrations (mint) have ENDED
 *  (user-confirmed 2026-10-30); the QNS addresses below are kept as
 *  reference config only — the app has no registration flow. */
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
  // Zaphod Bridge (Hyperlane) — QL1 side (verified 2026-10-30,
  // research/ZAPHOD_FRONTEND.md). QL1 has no BridgeRouter wrapper; see
  // BRIDGE_PAIRS_QL1 above for per-token routers/lockboxes. Config only.
  hyperlaneMailbox: "0x2f136BaA37Eb5711483D295944EeDa01c4142dA0", // Hyperlane mailbox (QL1); nonce() answered
} as const;

export const CHAINS: ChainConfig[] = [INFINITE, QL1];

/** External service links (information only — swaps run natively in-app
 *  against the confirmed DEX routers). */
export const DAPP_LINKS = {
  flukeGuide: "https://fluke.zaphod.one",
  nft: "https://nft.zaphod.one",
  bridge: "https://bridge.zaphod.one",
  dontPanicDex: "https://app.dontpanic.finance",
  docs: "https://docs.infinitedrive.xyz/en/",
  console: "https://console.infinitedrive.xyz/",
  driveStats: "https://drivestats.online/",
  hub: "https://hub.infinitedrive.xyz/",
  fishDisk: "https://fishdisk.com",
} as const;
