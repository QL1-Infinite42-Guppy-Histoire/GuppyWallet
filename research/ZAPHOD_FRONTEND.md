# Zaphod frontends — contract/ABI recovery for native wallet integration

Date: 2026-10-30. Method: public static assets only (Next.js HTML + JS chunks
fetched with curl; no logins). Every candidate address was then verified
on-chain via `eth_getCode` / `eth_call` against
`https://evm-rpc-infinite.mschihuahua.org` (Infinite, block ~4,179,000) and
`https://evm-rpc-ql1.mschihuahua.org` (QL1, block ~13,275,766), plus
Blockscout counters (`scan.infinitedrive.xyz` / `scan.qom.network` api/v2).

**Bottom line:** both Fluke and Bridge are fully recoverable from the
frontends — addresses *and* ABIs — and verified live on-chain. Native
integration (in-app wallet signing, no WalletConnect) is feasible for both.
Two caveats: Fluke's `settle` step needs a signature served by the Fluke
site's own public API, and the QL1 side of the bridge uses raw Hyperlane
warp routers (no Zaphod wrapper).

---

## 1. Fluke — https://fluke.zaphod.one

### What Fluke actually is
Not a standalone lottery contract. "Fluke" is a **roll-and-keep game built
directly into The Guide NFT contract itself**, plus a companion yield
system ("Starlight") in a second contract. The site config says it
verbatim: `"mechanic": "roll-and-keep (Fluke)"`.

### Where it was found (evidence)
- `fluke.zaphod.one` → Next.js chunks; chunk **`1794-7bb2fc9ee779b53d.js`**
  contains `JSON.parse('{...}')` — the full site config: `chainId 421018`,
  `core`, `renderer`, `token`, the **complete coreAbi JSON (92 entries)**,
  `tokenAbi`, `deployBlock`, `modules` (27 emblem contracts), and the
  `yield` sub-config (ledger address etc.).
- The page chunk (`app/[locale]/page-c6c795cbbee88e50.js`) holds the
  Starlight ledger ABI as viem `parseAbi` human-readable strings (3
  fragments, 69 entries after union) and all call sites.

### Contracts (all on Infinite, chain 421018)

| Role | Address | Verified |
|---|---|---|
| **Game core = The Guide (GUIDE, ERC-721)** | `0xF349E469C474048DEd6F9b914309E76880ED1bbD` | code 22,233 B; 8,832 txs (Blockscout); `name()="The Guide"`, `supply()=3876`, `nextId()=3911` |
| ZAP token (game currency, Infinite) | `0x89195Ca5C954b6f99b78f4A2Aa5435A75Dc5B256` | code 10,767 B; `cur()` on core returns this address |
| Renderer (on-chain art/tokenURI) | `0xA6d108386633D3c102d4e0b952A3a96322057Ac4` | code 21,568 B; `core.renderer()` returns exactly this |
| Art module | `0xB4321eae9dDF0C3aC11C7B7aE555dF626798FFA4` | code 23,932 B (config field `art`; role = art data) |
| **Starlight yield ledger** | `0xebC32E52a1AA52d8A0cD71402C4ffDf316f0Db07` | code 22,973 B; 1,005 txs; explorer name **"Starlight"**; views answered (below) |
| Emblem modules ×27 (`EmblemsA`…`EmblemsAA`) | see config/ABI file; e.g. A `0xe971CC4d1eeBE8c6370A98f7704CD5D72F4a0346`, AA `0xB83cF729829faf19545C168F5566C8F5Ae73211C` | spot-checked A + AA: code present (13,886 / 23,374 B). Form artwork modules, counts 3–10 forms each; `emblemPool = 201` |
| Previous renderers (dead, config `renderer_prev_*`) | `0xcEa3008393EB3aB2951F29Ef50E91e4a1584A6F0`, `0xC1005a440790739165c0E0a18EB4286A9a1c3Ca4` | listed in config as replaced — do not use |

### Game flow (from call sites in the page chunk + core ABI)
Core write functions (ABI in `research/abi-fluke.json` → `core`):
- `commit(uint256 maxCost) returns (uint256)` — frontend first does a max
  `approve` of ZAP to the core, then commits. `price()` = **50 ZAP**
  (verified live) is the commit cost basis; ZAP is burned as you play
  (`burned(id)`, Boost/Settle events, leaderboard "burned" totals).
- `reveal(uint256 item, uint256 maxCost) returns (bytes32)` — paid in
  native [42]: `revealPrice()` = **12 [42]** (verified). Rolls a new form
  (emblem) for the item.
- `seed(uint256 a, uint256 b)` — seeds the revealed roll (frontend flow:
  approve ZAP → `seed` → "seeded").
- `settle(uint256 id, bytes sig)` — settles a record AND MINTS the new
  Guide NFT to the player (issuance = settle; proven on-chain
  2026-11-04: supply 3,876 → 3,983 in 5 days, sampled mint logs all
  from settle txs). **Signature source — CORRECTED 2026-11-04** (the
  original reading in this section was wrong): the signature is the
  **drand quicknet** BLS signature for the record's round `rn`,
  fetched from the public drand API
  (`https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/{rn}`,
  fallback drand.cloudflare.com) — NOT from the leaderboard API,
  which never carried signatures; the frontend converts the drand
  signature client-side (G1 decompress → affine (x, y), each
  hex-padded to 128 chars → 128-byte `sig`) and merely caches the
  result next to its entries, which is what the first extraction
  misread. Fully public, no Zaphod backend: if fluke.zaphod.one
  dies, settle still works. Verified end-to-end 2026-11-04:
  converted a real unsettled entry's (id 418) drand signature and
  its `settle` eth_call succeeded. Also corrected: `seed(a, b)`
  funds prize pools A/B with ZAP — it is NOT part of the player
  flow (commit → reveal → settle only).
- `boost(uint256 item, uint256 amount)` — spend ZAP to boost an item
  toward `leader()` (verified: leader = token 3326, score 684 [42]-units,
  matches the live leaderboard API rank #1 — strong cross-check).
- `write(uint256 item, string)` / `append(uint256 item, string, uint256 maxCost)`
  — inscribe text on your Guide (maxText 280 chars; first 42 free —
  `maxFreeText()=42`, `appendBps()=1000`). Verified: `text(536)` =
  "NEVER GIVE UP!!", matching leaderboard entry id 536.
- Views verified live: `poolA()=439.4959…`, `poolB()=2492.5` (prize pools,
  in ZAP — `cur()` = ZAP), `oddsInv()=750`, `delay()=45`, `halflife()=
  7776000` (90 d), splits `aBps/bBps/cBps = 1500/7000/1500`,
  `paused()=false`, `owner()=0x2fcfc23071E355aa75A6373D779Bf5E220b8ECAF`.

### Starlight yield ledger (companion system)
Register Guide NFTs → they accrue streamed [42] rewards by weight;
anyone can fund the stream (`publicFund: true` in config).
- ABI: `research/abi-fluke.json` → `yieldLedger` (converted from the
  frontend's parseAbi strings). Key functions: `register(uint256[] ids)`,
  `claim(uint256[] ids)` / `claimToken(ids, token)`, `earned(id, token)`,
  `refresh(id)`, `redeem(id)`, `fund(token, amount, windowDays)`,
  `collect(token)`, `setBeneficiary(id, to)`, plus an internal market:
  `list/unlist/buy/offer/accept/cancelOffer` (config field `yield.market`
  is `null` — the market functions exist in the ABI the frontend ships,
  but treat market UI as unconfirmed until used/tested).
- Verified live: `currentEpoch()=2965` (epoch = 604,800 s = 1 week),
  `WS()=WR()=69,228,700`, `mintCredit()=7.5`, `tokenCount()=1`,
  `tokens(0)=
...[truncated 10366 chars]0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` (native [42]),
  `totalIn(native)=3,133.4767… [42]`, `items(3326)` = registered,
  tierIdx 3, baseW = bonusW = 160,000, `successor()=0x0` (not migrated),
  `registerPaused()=false`, `streamBps()=5000`, fund windows 7–90 days.
  (Three market-fragment view names the frontend references — `feeBps`,
  `paused`, `offerCount` on the ledger — revert with no data; they may
  belong to the disabled market module, not the ledger core. Noted as
  JS-only.)
- Public mirror API (no auth): `GET /api/starlight/mirror` returns the
  ledger address + aggregates (funded ≈ 3,132 [42], claimed ≈ 211.68,
  19,487 events at probe time) — usable by the wallet for a dashboard.

Deploy blocks (for event indexing): core 3,051,279; ledger 3,800,202.

### Fluke readiness verdict: **READY (fully, since 2026-11-04)**
Addresses + full ABIs recovered and verified on-chain; the game is
active (pools funded, leaderboard live, not paused). Native integration
is straightforward ethers/viem calls from the in-app wallet. The
settle signature turned out to be public drand data (see the settle
bullet above), so there is NO remaining backend dependency; the app
implements the complete commit → reveal → settle (= new Guide
issuance) flow in `src/lib/drand.ts` + `zaphod.ts`, with an
oripa-style reveal presentation on a successful settle.

---

## 2. Bridge — https://bridge.zaphod.one

### Architecture
**Hyperlane-based.** A custom Zaphod **BridgeRouter** wrapper (VERSION
`1.3.0`) sits on Infinite/BSC/Ethereum in front of each Hyperlane warp
router (HypERC20Collateral / ScaledHypERC20Collateral / HypXERC20). On
**QL1 there is no wrapper**: tokens are HypXERC20Lockbox deployments and
the frontend calls `transferRemote` **directly on the Hyperlane warp
router** (`bridgeRouter: e.src.bridgeRouter || e.src.router` in the page
chunk — QL1 entries have an empty bridgeRouter). Delivery is by
Hyperlane validators + a Zaphod relayer (multisig ISM: threshold 5 for
ETH/BSC routes, 2 for QL1 routes). Hyperlane domain = EVM chain id.

### Where it was found (evidence)
- Chunk **`8701-09a3802b8808029b.js`**: embedded token registry
  (`JSON.parse`, 38 entries: id/kind/bridgeRouter/hyperlaneRouter/
  underlying/xerc20/lockbox/live), the per-chain Hyperlane config
  (mailbox, validatorAnnounce, ISM, validator sets, thresholds), and
  `NEXT_PUBLIC_*` env defaults naming every foundation router.
- Chunk **`9073-5a4ca7ebb2fe2632.js`**: the ABIs (export `s6` =
  bridgeRouter ABI, verbatim) + chain definitions.
- Page chunk (`app/page-a014ab387442e48e.js`): the send flow — approve →
  `quoteNative(dst, "0x")` → take `totalNative` as msg.value →
  `transferRemote(dstDomain, bytes32(recipient), amount)` →
  `BridgeInitiated` log parsing; min/max read from the router.
- **`GET https://bridge.zaphod.one/api/state`** (public, generated
  2026-10-23): the authoritative live route table used below (chains,
  6 directional routes with per-token src/dst router+bridgeRouter+
  lockbox+fees, relayer signers). `/api/stats` and `/api/reserves` also
  exist (stats probed: delivered counts ETH 116 / BSC 159 / Infinite 204
  / QL1-origin 0 — see caveat).

### BridgeRouter ABI (recovered verbatim → `research/abi-bridge.json`)
`transferRemote(uint32 destination, bytes32 recipient, uint256 amount)
payable returns (bytes32 messageId)`, `quoteNative(uint32, bytes)
returns (nativeFee, gasPayment, totalNative, usdPer42, source)`,
`quoteBridge(uint256) returns (forwardAmount, fee, totalRequired)`,
`token()`, `underlying()`, `feeBps()`, `feeFlat()`,
`minTransferAmount()`, `maxTransferAmount()`,
`allowedDestinations(uint32)`, `destinationScaleFactor(uint32)`,
`paused()`, `VERSION()`, event `BridgeInitiated(messageId, sender,
destination, recipient, amountIn, fee, amountForwarded)`.
Helper ABIs in the same file: mailbox `delivered(bytes32)`/`nonce()`,
ISM `validatorsAndThreshold(bytes)`, routing ISM `module(uint32)`,
hook `requiredHook()`/`minAmount(address)`.

### Verified routers — Infinite side (all: code 14,454 B, VERSION 1.3.0, paused=false, feeBps=0)

| Token | BridgeRouter (Infinite) | token() ✓ | underlying() = Hyperlane router | Destinations | feeFlat | min |
|---|---|---|---|---|---|---|
| QOM | `0x049a78Fe311cf1C23f09cdd4F12420FfC917C8db` | QOM-on-Infinite `0x53465C…` | `0xf4440822…` | 766 only | 0 | 1.0 |
| USDT | `0x8667682B62CacedA9e87B3CAA21D5B09D9Ae13c3` | USDT `0xC26849…` | `0xaf16100C…` | 1, 56 | **2.0 USDT** | 1.0 |
| USDC | `0xCDbf8dA81F0a24f25Bcd23c6232704BBfA410bd4` | USDC `0xea5b7f…` | `0xe20C0c64…` | 1, 56 | **2.0 USDC** | 1.0 |
| WBTC | `0xb436C84a634ccEECc13d29Dc3F933625522c5e6f` | WBTC-xERC20 `0x0185c7…` | `0x111031c2…` | 1 only | 0 | 3000 (8-dec) |
| BABY | `0x4aba9dBE8a990C19501C1c4C3E677f775006D2e2` | `0x77479226…` | `0x49b525D6…` | 766 only | 0 | 1.0 |
| CAW | `0x82bA5D61a70677f7f53A9894C63DfB61FD8bCb65` | `0xce8aEE71…` | `0xA8493DbB…` | 766 only | 0 | 1.0 |

Live probes: `quoteNative(766,"0x")` on QOM/BABY/CAW routers =
nativeFee 2.233671434851914711 [42], gasPayment 0, totalNative = same,
usdPer42 ≈ 0.895386… (source=1). `quoteBridge(1.0)` = 0 fee for QL1
pairs; for USDT/USDC it returns fee = flat 2.0 (so sending exactly the
1.0 minimum forwards 0 — in practice amounts must exceed amount+fee
accounting; replicate the frontend's `quoteBridge` usage in the UI).
USDT router `quoteNative(766)` reverts "No router enrolled for domain:
766" — consistent with allowedDestinations.
Explorer cross-check: USDT router is named **"BridgeRouter"** on
scan.infinitedrive.xyz; QOM router has 45 txs there.

Other Infinite BridgeRouters from /api/state (code-size/ABI family is
uniform, but only the six above were individually eth_call-verified;
treat these as **found-in-config, high confidence**): FATHER
`0x056c116c09ACb788d038E7dDc167249C26493D6e`, HAWK
`0x0d198200dC673e96217ddeA9560d26Ae0d092074`, KET
`0x3BC94E9F417561Ca37559E07dfC65496fcE94557`, O
`0xcB893a7e5f2932531f6e04c0Fc3b17AC4884475f`, OSAK
`0xA2093426c03ba6F0f6049532b6f13F1e36566358`. All pair only with QL1,
fee 0. (`live:false` registry entries — BONE/CAW/SHIB/TREAT/XFUND
ETH-variants, FUND — are excluded; the wallet should mirror the
`live`/api-state route set, not the raw registry.)

### QL1 <-> Infinite pairs (from /api/state; full table also in chains.ts `BRIDGE_PAIRS_QL1`)
QL1 side per token: Hyperlane warp **router** (the transferRemote
target), **lockbox**, and the **xERC20** (the token users actually hold
on QL1; its backing `erc20` is the QL1-native token, e.g. for QOM the
xERC20 is `0x91fe5fe31493de5e2eab71aa1006099627626fa8` — verified
name/symbol "QOM", 18 dp — backed by WQOM `0xa26dfBF9…`):

| Symbol | QL1 router | QL1 lockbox | QL1 xERC20 | Infinite router (warp) |
|---|---|---|---|---|
| QOM | `0x30da1e7c8de5FA75B593002E0b2D2910FFcAdCB6` | `0x32b78419711a58E8Cd9945430F696f7db996fD50` | `0x91fe5fe31493de5e2eab71aa1006099627626fa8` | `0xf4440822c681Ce4CB80b5a3A508876eE23b40F1b` |
| BABY | `0x8ff9452f309159828903d2D6cCa58CCcb2b5Cd16` | `0x8a9C80244E00baF719289f9CB10fd335B6BA77e5` | `0x40b60b0343a240c311561533667afd079e9c208d` | `0x49b525D647068E17892a66e08d197e7Faa036D3E` |
| CAW | `0xD14cF03D3753d80a1f6fb818Aa1c728D5c36B3bf` | `0xD3E886c616E17202cCB8a5f2932865F281c4Af86` | (usdc addr reuse in state file — see note) | `0xA8493DbB1be229Fbbc9127d6D2e387dbEA2AE214` |
| FATHER | `0x54718De5e064DcD1181b7847591c5864434ED92e` | `0x631376D745A56CA4EFD9e565BF4cE0d56A8828FC` | `0x7ab903bc6aad05ace51dbfb35a43e6aea17310d1` | `0xAe3fB59A4c950447386e7d2cA54ab05c857B817E` |
| HAWK | `0x916fb1a761d0Db8888C3F79d6c614C9FFf73b657` | `0x51BB05C603bc7D554D37be76cdE13360C1a84286` | (usdt addr reuse in state file — see note) | `0xBd0c6E7dA96F71cfD2E6651d697b048bAf5c91Cd` |
| KET | `0x59d6e50f5b0559A088e3eaAc21E520be18453704` | `0x2060fA8977B89E55021B592E11134c26b78eAd21` | `0x866abba86c6176c9cd48804a47829559a382270e` | `0xb1b313B3767c73398935E5bCDD7914340E73f3dD` |
| O | `0x488B1f39AA01196ec8a14891bAfFEe6630155A61` | `0xF2ecB173b63699C49ace3faae80af5ce677af015` | `0x4ad2d363bce045a7df7c9069cb517cc803409bea` | `0xE62ba8A1df1ED3628f2C22A245f7A47a76573CB5` |
| OSAK | `0xe3a35d9f4EF7eacD5bb47164Ee8d7bff75C2cF6B` | `0x49bA579c2cC70260a008809A8182FbCfABc8b45E` | `0x16630f46109774257a65b645ad26b14b48e78aab` | `0xB477ab5A53d8361b735BD812095325a35Fc29b1B` |

Note: in the embedded registry JSON (not /api/state), the CAW/HAWK
QL1 `xerc20` fields literally contain the Infinite USDC/USDT addresses
— an upstream data quirk; /api/state's per-route `erc20` + lockbox +
router fields are self-consistent and were preferred. Only QOM's QL1
xERC20 was identity-verified on-chain; treat the other xERC20 cells as
config-sourced.

QL1 verification: mailbox `0x2f136BaA37Eb5711483D295944EeDa01c4142dA0`
(code 8,783 B — same size as Infinite's mailbox; `nonce()=559`), QOM
warp router code 11,922 B with `mailbox()` = QL1 mailbox and
`interchainSecurityModule()` = `0x61ba8A9a3328e9Cb7adBd9F19c30416b218487A0`
(= QL1 routing ISM in the site config — strong identity check), lockboxes
1,547 B each. Blockscout: QL1 QOM router 135 txs / 724 token transfers.
Infinite mailbox `nonce()=321`.

**Caveat (delivery evidence):** bridge.zaphod.one `/api/stats` reports
0 delivered messages with QL1 as origin and its QL1 index height as 0,
even though the QL1 mailbox nonce is 559 and the QL1 routers show real
tx history. This looks like their stats indexer not covering QL1 rather
than the route being dead — but before shipping a QL1→Infinite send
flow, do one small live test transfer and watch delivery end-to-end.
Fees on QL1 pairs: feeBps 0, no flat fee — only the Hyperlane native
gas payment returned by `quoteNative` (paid in the source chain's
native token; on QL1 the frontend reserves 20,000,000 QOM gas reserve
in UI math per chunk 9073 config).

Foundation routes (for completeness; the wallet is Infinite/QL1-first):
BSC USDT router `0x2f136BaA37Eb5711483D295944EeDa01c4142dA0`, BSC USDC
`0x4F69A9cF19C7B291b1A2A5dA30B8Ce873d7849fa`, ETH USDT
`0x56d962fD360bA872115e77E3316909037bfB7E7E`, ETH USDC
`0x1613e840ef053a3eAcB3278F3982489354CA8199`, ETH WBTC
`0xF2ecB173b63699C49ace3faae80af5ce677af015` (from /api/state +
NEXT_PUBLIC defaults; not eth_call-verified — out of wallet scope).
Mailboxes: ETH `0xc005dc82818d67AF737725bD4bf75435d065D239`, BSC
`0x2971b9Aec44bE4eb673DF1B88cDB57b96eefe8a4`, Infinite
`0xac70cdD7F2B712AEF7A20661e0c2E96E1Da1d63E`, QL1
`0x2f136BaA37Eb5711483D295944EeDa01c4142dA0`.

### Bridge readiness verdict: **READY for Infinite→QL1 + Infinite→ETH/BSC; QL1→Infinite READY pending one live delivery test**
ABI + routers + fee model fully recovered and verified on the Infinite
side; QL1 side verified structurally (code, mailbox, ISM). The send
flow is 2 transactions (approve + payable transferRemote) — trivially
native-able with the in-app signer. Recipient = bytes32-padded address;
destination domain = chain id (766 / 421018 / 1 / 56).

---

## 3. NFT — https://nft.zaphod.one (The Guide mint?)

Findings (chunk `1873-56ee5978ab83ea22.js` + layout chunks): the site is
a **generic NFT marketplace**, not a Guide minting dApp.
- Infinite: marketplace `0x77e924E8C75083A723606B5634497d416ad16CB0`
  (133 B — a minimal proxy; verified responsive: `platformFeeInfo()` =
  recipient **0xebC32E52… (the Starlight ledger)**, 500 bps = 5%),
  collection factory `0xFa69cB9a144052096F24D35Bfa80b0B58dd174Cf`
  (code 2,781 B), wrapped native **W42** `0x8980Eb04Bab4F5DfE9Cc0768b5D6a8C0448A8F77`
  (verified on-chain: "Wrapped 42"/W42/18).
- QL1: marketplace `0x77a86674Fa8970EC2364a5f733EcB5b8c9c751cA` (same
  133 B proxy pattern), collection factory
  `0x048D4aBF84DEB96a4FA8162eA6c13b6e66c7331D`, stablecoin **qUSDT**
  `0xC276b91c0e8D10260af7b67009d2683bB7776308` (code verified; **6
  decimals** per site config — QL1 exception to the "all 18" pattern).
- **Mint verdict: no separate mint/sale contract for The Guide exists
  in this frontend, and the Guide core ABI has no public mint function**
  (only `supply()`/`nextId()` views; nextId 3911 vs supply 3876 implies
  burns, not open minting). The collection page HTML contains no mint
  flow. Acquiring a Guide = buy one on this marketplace
  (`buyFromListing` in the frontend ABI) or play Fluke with one you own.
  → This replaces the long-standing "Fluke game contract / Guide mint"
  TODO_MT items: **neither needs MT anymore** for the read/game/bridge
  scope; MT confirmation is still worthwhile for (a) the settle-signer
  API's stability commitment, (b) QL1→Infinite delivery status.

## 4. What was added to the app (config only, no flows built)
- `src/config/chains.ts`: `INFINITE_CONTRACTS` += flukeRenderer,
  flukeArt, starlightLedger, hyperlaneMailbox, bridgeRouter{Qom,Usdt,
  Usdc,Wbtc}; new `BRIDGE_PAIRS_QL1` (8 QL1 pairs); `QL1_CONTRACTS` +=
  hyperlaneMailbox. `npx tsc --noEmit` passes.
- `research/abi-fluke.json` (core 92 + ledger 69 + ZAP 12 entries),
  `research/abi-bridge.json` (BridgeRouter 14 + helpers).

## 5. Evidence map (JS source → finding)
- fluke `1794-*.js`: config JSON (core/renderer/token/coreAbi/tokenAbi/
  modules/yield.ledger/deployBlocks) · fluke page chunk: ledger parseAbi
  fragments, call sites (commit/reveal/seed/settle/boost/write/append/
  fund/register/claim), `/api/leaderboard`, `/api/starlight/mirror`.
- bridge `8701-*.js`: token registry JSON, chain/Hyperlane config,
  NEXT_PUBLIC router defaults · bridge `9073-*.js`: bridgeRouter ABI,
  chain defs, QL1 gas-reserve config · bridge page chunk: send flow ·
  bridge `/api/state` (public): authoritative routes/fees/relayers.
- nft `1873-*.js` + layout chunks: per-chain marketplace/factory/
  wNative/stablecoin config.
