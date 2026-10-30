# QL1 DEX (QomSwap) — Router & Factory Identification

Researched 2026-10-30, read-only, via scan.qom.network (Blockscout API) and
eth_call against https://evm-rpc-ql1.mschihuahua.org. Every address below is
backed by an on-chain proof, mirroring the method that worked on Infinite
(pair.factory() / router.factory() / factory.getPair()).

## Verdict

QL1 has **two live Uniswap V2-style deployments**. The dominant one — LP
tokens literally named "QOMSWAP V2", home of the QSWAP token, 645 pairs,
~240k router transactions — is **QomSwap**. A second, much smaller deployment
(10 pairs, LP tokens named "QOMX LP", stock verified Uniswap V2 code) also
exists; its brand is not labelled on the explorer (possibly an earlier or
sister deployment — do not assume it is QomSwap).

## Deployment 1 — QomSwap (main)

| Role | Address |
|---|---|
| Factory | `0x475f361993D6FAcBF32fB82B66be0fB40f3d974C` |
| Router | `0xc1f90231035A52091eBCb7dddaCa3051a5F44f30` |
| Wrapped native (WQOM) | `0xa26dfBF98Dd1A32FAe56A3D2B2D60A8a41b0bDF0` |
| DEX token (QSWAP) | `0x4AF41F453Ead00d1cc6Aa0b5B454bdeB102AFc8d` |
| Deployer (factory + router) | `0xcddeBBaD367956F2Bf3E6C668085B4884669e717` |

Neither contract is explorer-verified (no name/ABI on scan), but the eth_call
proofs below are definitive for the standard V2 interface:

- Pair `0x2c9e7BC2f7Cb66BDd7989F1f485D7640E5967173` (contract name
  "UniswapV2Pair", token name "QOMSWAP V2"): `factory()` →
  `0x475f361993d6facbf32fb82b66be0fb40f3d974c`; `token0()` = QSWAP,
  `token1()` = WQOM; reserves non-zero; pair balances ≈ 16.45M QSWAP and
  ≈ 805.8B WQOM (explorer token-balances).
- `factory.getPair(QSWAP, WQOM)` → `0x2c9e7bc2f7cb66bdd7989f1f485d7640e5967173` ✓ (the same pair)
- `factory.allPairsLength()` → `0x285` = **645 pairs**
- Swap/liquidity transactions riding on that pair (methods
  swapExactTokensForTokens, swapExactTokensForETH, swapExactETHForTokens,
  addLiquidityETH, from many different users) all have **to =
  0xc1f90231035A52091eBCb7dddaCa3051a5F44f30** (verified on 3 sample txs:
  0x5e20e025…, 0xa48fa248…, 0x93886068…)
- `router.factory()` → `0x475f361993d6facbf32fb82b66be0fb40f3d974c` ✓
- `router.WETH()` → `0xa26dfbf98dd1a32fae56a3d2b2d60a8a41b0bdf0` = WQOM ✓
- Router activity (explorer counters): **239,655 transactions**,
  238,779 token transfers. A second sampled pair
  (0x67f3698C97c62b7f6f9190eda399B2B92fC153BC) also returns the same
  factory() — one factory, many pairs.
- External corroboration: CoinGecko describes QomSwap as the main DEX on
  QL1 with WQOM/QUSDT its most active pair; `factory.getPair(WQOM, qUSDT
  0xC276b91c0e8D10260af7b67009d2683bB7776308)` →
  `0xA21d14Fe48f48556f760Fa173aE9Bc3f6a996C5B`, an LP token named
  "QOMSWAP V2" in this factory.

### ZAP on this DEX — negative result
`factory.getPair(ZAP 0x6041B64618434B9D0a9558B5975C5c1DEb45CEE6, WQOM)` = 0x0
and `getPair(ZAP, QSWAP)` = 0x0. **There is no direct ZAP pair in QomSwap's
factory.** Any QL1 ZAP swap route is either multi-hop via another token or
goes through a different venue/aggregator — unresolved, needs MT or a
traced live ZAP swap transaction.

## Deployment 2 — smaller, brand unlabelled ("QOMX LP" pairs)

| Role | Address |
|---|---|
| Factory | `0xb3E66a40f65109B44a1De55611C0BE5566561797` (verified, contract name "UniswapV2Factory", Solidity v0.5.16) |
| Router | `0x49AfA8819625b409963B9891F36d1b368AdaAb6c` (verified) |
| Deployer | `0xc6f31a37CA9f5Fc6F29Da42d67d4CE532c36331D` |

Proofs:
- LP token "QOMX LP" `0x7f5C6f640388614CFFdDb178dB1a39163B7D080d`:
  `factory()` → `0xb3e66a40f65109b44a1de55611c0be5566561797`;
  `token0()` = WQOM, `token1()` = Q (Q Stablecoin
  `0xC3D374365d184bd0A24645778b29a9dfc20ead01`)
- `factory.allPairsLength()` → **10 pairs**;
  `factory.getPair(WQOM, Q)` → the same QOMX LP pair ✓
- Swap tx 0x800f8ee1… (swapExactTokensForETH on that pair) has to =
  `0x49AfA8819625b409963B9891F36d1b368AdaAb6c`;
  `router.factory()` → factory2 ✓; `router.WETH()` → WQOM ✓
- Router activity: 5,442 transactions — two orders of magnitude below
  QomSwap's router.

## Zaphod linkage check
- zaphod.one/zap (fetched 2026-10-30) names **no QL1 swap venue**: for
  Infinite it says "ZAP / 42 … on Infinite Don't Panic DEX"; nothing about
  QomSwap or QL1 swaps. No QomSwap mention found on the Zaphod pages
  checked. Whether Zaphod Swap's QL1 side routes through QomSwap's router
  above remains unproven (and there is no direct ZAP pair in that factory).

## Confidence
- Factory + router of the main deployment: **proven on-chain** (eth_call
  triangle: pair.factory, router.factory, router.WETH, factory.getPair).
- Attribution of the main deployment to the "QomSwap" brand: **high**
  (LP token naming "QOMSWAP V2", QSWAP token's home pair, CoinGecko's
  description of QomSwap as QL1's main DEX with matching flagship pair).
- Deployment 2's brand/purpose: **unknown** — evidence recorded, not named.
- Anything beyond this (Zaphod's own QL1 routing, QomSwap frontend URL
  wiring) was not established here and is not guessed.
