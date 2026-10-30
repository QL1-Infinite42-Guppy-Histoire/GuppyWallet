# ABI 調査メモ（2026-10-30）

## Zaphod Swap（app.zaphod.one）
- 結論: ルーター／アグリゲーター本体のコントラクトアドレスと公開ABIは、Swap UI、zaphod.one のリンク先、エクスプローラーのいずれでも確認できなかった。Docs／GitHub へのリンクもサイト内に無し。
- 画面文言はアグリゲーター型: 「BEST PRICE ACROSS EVERY VENUE ON 42CHAIN」
- Swap UIのネットワーク選択: 42chain（既定）、Base、BNB、Ethereum、Arbitrum、Monad、Robinhood。チェーンID表示は無し（42chain = Infinite 421018 とは画面証拠だけでは断定しない）。
- 42chain側トークンリスト表示: ZAP と USDT のみ。
- → ルーターのアドレス＋ABIは MT から直接もらう必要がある（依頼済みチェックリスト項目）。

## 公開ABIが確認できたもの（ルーターではない）
- ZAP（Infinite）: 0x89195Ca5C954b6f99b78f4A2Aa5435A75Dc5B256
  Blockscoutで検証済み（Exact Match、Zap.sol、v0.8.23）。ABIタブあり。
- ZAP（QL1/QOM）: 0x6041B64618434B9D0a9558B5975C5c1DEb45CEE6
  エクスプローラーは scan.qom.network。検証は Partial Match で、バイトコード不一致の警告あり — 利用時は要注意。
- ZAP/42 プール（Infinite、Don't Panic DEX）: 0xB647ce2aa7d436CCE95dc961D066Ef610CA451B7
  未検証（Verify & publish 表示）。公開ABIなし。バイトコード内に Nutri-Matic V2 / UniswapV2 系の文字列があるが、ルーター特定の根拠にはならない。

## Scan sweep findings (2026-10-30, both Blockscout explorers)
What scans CAN confirm: token CAs (token lists) and verified contracts (name + ABI public).
What they CANNOT: which unlabelled address is a given app's router/factory.

Infinite (scan.infinitedrive.xyz; 506 contracts total, 83 verified at check time):
- st42 token 0x78F40E828a92AF9e137FF7660E52Ac8B0f1D121E
- St42Book 0x458f6b41d093bED5aBBc1527DaBDf5499A85294F (verified → ABI public)
- St42Vault 0x0F93a9b0dBF2D1829928fe40cBc155e0b5B2D35e (verified → ABI public)
- X42Factory 0x8965501ea6d898ef5251776C1E99Da3c5E6504eF (verified; owner app unlabelled)
- BridgeRouter x6 (0x0b436C...c5e6f, 0x866768...13c3, 0xCDbf8d...0bd4, 0x635D33...bd4A, 0x916fb1...b657, 0xF2ecB1...f015) — which one serves Zaphod Bridge is NOT determinable from the explorer
- QOM token on Infinite 0x53465CbBBA5b14f5Dc00794330f0f4aFb30EAA1d; Bridged USDT 0xC2684966e5c95B2bc636FB4a1f3Da9Ad23d94753; Bridged USDC 0xea5b7fD59b7ec0F34663835A3a361F469C2D4c5C
- ZAP/42 "pool" 0xB647...51B7 is labelled by the explorer itself only as the Nutri-Matic V2 (NUTRI-V2) token; unverified; holds ZAP + 42. Explorer alone does not prove pool/router roles.
- Name searches: "Zaphod" → only an NFT (ZG13 0x8f0c0b0Da44F945f5c32F358292616da3a07fc9d); "router"/"factory" → 0 hits (search is NOT exhaustive)

QL1 (scan.qom.network; 110 verified at check time):
- QNS: QOM Domains / QNSBaseRegistrar 0xDCbF4614152a22D1883Ba3929c668B978A3be548 (verified), QNSRegistrarController 0x4d9FE3F0EE6Fe1645DD537EC59a0a328F7148372 (verified → ABIs public)
- ZapStaking 0xF52d49c0bb3b0e51E37Af2b21C2F13A097155aD2 (verified, Solidity 0.8.19, 68 txs; no Zaphod app label)
- WQOM 0xa26dfBF98Dd1A32FAe56A3D2B2D60A8a41b0bDF0; QOMSWAP (QSWAP) 0x4AF41F453Ead00d1cc6Aa0b5B454bdeB102AFc8d; QSWAP-V2 0x2c9e7BC2f7Cb66BDd7989F1f485D7640E5967173
- "Zaphod" search → only Baby Zaphod Token 0xa01812aF361410Cc43f2e42E07c8EB2b8C103333 (not an app contract)

## DEX router/factory CONFIRMED on-chain (2026-10-30)
User supplied three addresses; all three interlock as a Uniswap V2-style DEX
(Don't Panic / Nutri-Matic) and were proven by eth_call via two independent
official RPCs (mschihuahua + infinitepanda):
- Router 0xBF07dFE35746894bAe373f63f4Bf2379F9BaFEc0 — 14k+ txs; decoded methods
  swapExactTokensForTokens / addLiquidity / swapExactTokensForETH from many
  distinct users; own balance 0. Unverified on explorer (no published ABI),
  but factory() returns 0x3157C6AcA800D507af95Ab1466adBA3A6F11eE1a and
  WETH() returns 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE (native placeholder).
- Factory 0x3157C6AcA800D507af95Ab1466adBA3A6F11eE1a — getPair(FISH, PANIC)
  returns 0xa7550206E84Cd6018bb7BC27CC35c66f14Dd8Cd3.
- Pair/LP token 0xa7550206E84Cd6018bb7BC27CC35c66f14Dd8Cd3 = Nutri-Matic V2
  (FISH/DONT LP).
Implication: native Swap/LP on Infinite can be built on the standard
Uniswap V2 router/factory ABI against these addresses WITHOUT waiting for
MT. Still open: whether Zaphod Swap (aggregator) itself routes here, and
the QL1-side DEX equivalents.

## MTへの追加確認（推奨文・英語、そのまま貼れる版）
Hi MT, quick follow-up on the swap integration.

I'm wiring the Swap screen of the wallet to Zaphod Swap (app.zaphod.one). I checked the UI, zaphod.one, and the explorers first, but I couldn't find a published router/aggregator contract address or ABI for it.

Could you share:
1. the swap router/aggregator contract address + ABI for each chain, or
2. if it routes through another DEX under the hood, which router it calls (e.g. Don't Panic on Infinite)?

I only need the interface (address + ABI) to call it from the wallet — no source code or anything sensitive. If you'd rather verify the contract on the explorer so I can pull the ABI from there, that works perfectly too.

This is the last piece blocking the Swap screen on my side. Thanks!

### 短い版（チャットで軽く聞く用）
Hi MT, one quick thing — is there a public router address + ABI for Zaphod Swap? I couldn't find one published anywhere. I just need the interface to integrate it into the wallet. If it routes via another DEX's router, that address/ABI is fine too. Thanks!

## Router / factory candidates — explorer verdict (2026-10-30 10:27–10:32 JST, Infinite only)
Both candidates BEHAVE like a router and a factory on Infinite, but BOTH are
source-unverified, so no ABI can be pulled from the explorer. Do NOT add them
to the wallet config as confirmed until MT confirms the pairing/ABI.
- Router candidate 0xBF07dFE35746894bAe373f63f4Bf2379F9BaFEc0: Contract
  details, 14,116 txs from many different callers; tx detail confirms
  swapExactTokensForTokens (tx 0xe387746e19cee3c8dc157449d066f606c25b0eb61ca9ba08adf1001e7a5b9c7d,
  block 4177120) and addLiquidity (tx 0x9c626ef039465a095057a33531ececb60ed3f749e6541c1287ce26587b38fbe3).
  Creator 0x7F290996AaeE6c188C64ce2Cf0133bAF54d66aB8. No contract name, no
  Read/Write tab (unverified). removeLiquidity and WETH not confirmed.
- Factory candidate 0x3157C6AcA800D507af95Ab1466adBA3A6F11eE1a: Contract
  details, same creator as the router; confirmed createPair tx
  0x71976237b98e3ec36b6c56c789fc2da42592bbbe2fa2f472c6bc28f2b83f1d32 and
  87 PairCreated logs (arg3 1–87), including the FISH/DONT pair
  0xa7550206E84Cd6018bb7BC27CC35c66f14Dd8Cd3 as arg3=50. No contract name,
  no ABI tab (unverified); getPair/allPairs/allPairsLength not directly confirmed.
- Link: router→factory calls appear repeatedly in internal transactions,
  and the LP creation chain is router→factory→Create2→Nutri-Matic V2, but
  router factory() could NOT be read directly (no Read tab). So the pairing
  is strongly indicated, not directly proven.
- Correction to the earlier trace: the LP token's Creator is the factory
  candidate, not the router; the router appears via the addLiquidity tx.
- QL1 (scan.qom.network): both strings are EOAs with 0 transactions — no
  contract exists there under these addresses. Infinite-only candidates.
