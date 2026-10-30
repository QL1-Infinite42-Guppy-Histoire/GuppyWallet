# Research D — NFT (Guide / Fluke) contract addresses & price-source plan
Researched 2026-10-30 (read-only; no wallet connections). All addresses are
evidence-backed from public pages / explorer APIs / eth_call, as noted.

## Part 1 — NFT / Guide / Fluke

### Fluke (https://fluke.zaphod.one)
- Title: "Fluke — The Guide". A scratch/jackpot game: "Ignite" an entry,
  outcome sealed with randomness; prizes are a slice of a live "Scratch pool"
  plus a winner-take-all "Jackpot". Step III "INSCRIBE — Enter The Guide":
  "You always mint the numbered entry — inscribe it, burn to reveal new forms".
- The public page shows **no contract addresses, no explorer links, no chain
  selector** before wallet connection. The numbered-entry mint it describes
  matches The Guide NFT below (items are literally "The Guide #1, #2, …").

### Zaphod NFT marketplace (https://nft.zaphod.one/explore)
11 collections listed. Relevant ones (prices in [42] → Infinite chain):
- **The Guide — GUIDE · 45 owners · Volume 82.42 [42] · Items 3.9K**
- Zaphod Girls The Thirteen — ZG13 · 3 owners · Floor 4.20 [42] · Items 13
- Others: 42 Improbabilities (42PROB), IID Punks, Guppys Moonlit Dream,
  InfiniteDrivePunkz, I AM LUCKY!, Infinite Gyudon Knights, Thirteen Roses,
  Guppys Prayer, T The Thirteenth Hour.

### CONFIRMED — The Guide NFT (the Fluke "Guide")
- **Contract: 0xF349E469C474048DEd6F9b914309E76880ED1bbD** (Infinite)
- Evidence chain:
  1. Marketplace collection URL is /collection/0xf349e469c474048ded6f9b914309e76880ed1bbd
     with 3,876 items shown ("The Guide #1 …"), floor ≈ 0.27 [42].
  2. Infinite explorer search API (api/v2/search?q=Guide) returns exactly this
     address as token "The Guide", symbol GUIDE, type ERC-721.
  3. Explorer token API: holders_count = 45 — matches the marketplace's
     "45 owners" exactly.
  4. Same address searched on scan.qom.network returns nothing → not a QL1
     contract (as far as the QL1 explorer indexes); the collection lives on
     Infinite, consistent with [42]-denominated prices.
- Status: **confirmed** as the Guide NFT that Fluke mints into. (Explorer does
  not report a total_supply figure for it; the marketplace item count 3,876
  and the sequential numbering are the best public supply evidence.)

### Name collision warning
- A **different** contract also named with symbol GUIDE exists on Infinite:
  "The Guide Token", **ERC-20**, 0x31648Ee446704394A12BEaFb8fdFB8C2a113f1Ca,
  total supply 1,000,020,000 GUIDE (18 dp, raw 1000020000000000000000000000).
  This is a fungible token, NOT the NFT. The wallet must key on the contract
  address, never on the GUIDE symbol alone.

### Also confirmed
- Zaphod Girls The Thirteen (ZG13), ERC-721, Infinite:
  **0x8f0c0b0Da44F945f5c32F358292616da3a07fc9d** — total supply 13,
  holders 4 per explorer (marketplace showed 3 owners; explorer is the
  fresher source). Matches the previously known hit.

### NOT found / missing evidence
- "Fluke" as a token/contract name: **zero hits on both explorers**
  (api/v2/search?q=Fluke). Fluke's own game contracts (scratch pool,
  jackpot, ignite) are not publicly labelled anywhere we could see:
  the site publishes no addresses pre-connect, and no explorer label
  carries the name. To pin them down we would need either MT, or a known
  Fluke gameplay transaction hash to trace. The wallet's NFT tab can
  proceed with The Guide + ZG13; Fluke gameplay integration stays TODO_MT.
- QL1 side: "Guide" search → no results; "Zaphod" search → only Baby Zaphod
  Token (BABYZAP, ERC-20 meme, 0xa01812aF361410Cc43f2e42E07c8EB2b8C103333).
  No Guide/Fluke NFT on QL1 in public evidence.

## Part 2 — Price source for dashboard totals

### Public APIs of the two swap front-ends: none found
- app.dontpanic.finance: the app shows a "Pair quote" in its own UI (an
  on-chain pair-derived quote), but its public pages expose **no API docs,
  no developer links, no documented endpoints**. Web search for a
  Don't Panic quote API returned nothing relevant.
- app.zaphod.one: marketing copy only ("best price across every venue on
  42chain · fee shown with every quote"); **no public/documented quote or
  price API** found on its pages or via web search. (Consistent with the
  earlier router-ABI investigation.)
- CoinGecko/aggregators: these ecosystem tokens are not listed there
  (a DEX-listings check is covered by research task B; nothing was relied
  on here).

### DEX-reserve fallback — VERIFIED WORKABLE
Factory 0x3157C6AcA800D507af95Ab1466adBA3A6F11eE1a, getPair (0xe6a43905)
via https://evm-rpc-infinite.mschihuahua.org — all 21 pairs among
{42ph, USDT, USDC, ZAP, FISH, PANIC, QOM} checked 2026-10-30:

Pairs that EXIST (10):
| Pair | Address |
|---|---|
| 42/USDT | 0xfac6a97837fd3ef5876e18457eea52415296c613 |
| 42/ZAP | 0xb647ce2aa7d436cce95dc961d066ef610ca451b7 |
| 42/FISH | 0x46cce7b6b48e1627d7e3f69a68f425cba833dcc3 |
| 42/PANIC | 0x80bacfb358a3c7d7d1b549c2028001e2ba3acdac |
| 42/QOM | 0x259c54ee0f0c4a90d11376444dc82f4b9ec19d15 |
| USDT/FISH | 0xc7a36397c1dd8c7bb9daa26c0639dfaa991d21a3 |
| ZAP/FISH | 0x2128ac647fe532484c4c9f065cdf7fc14f9aa17e |
| ZAP/PANIC | 0xcbdc9553bb48e6de492e110e61f1efacb225f769 |
| FISH/PANIC | 0xa7550206e84cd6018bb7bc27cc35c66f14dd8cd3 |
| FISH/QOM | 0x1bad45bbdf6ec8a6477fc84f63b383d331510d99 |

No pair (zero address): 42/USDC, USDT/USDC, USDT/ZAP, USDT/PANIC, USDT/QOM,
USDC with anything, ZAP/QOM, PANIC/QOM. **USDC is a dead end for pricing**
(no pairs at all); USDT is the only stable anchor.

Anchor design:
- Every ecosystem token has a pair against the 42 placeholder, and 42 has a
  direct USDT pair → 2-hop pricing works for everything:
  token → (token/42 reserves) → 42 → (42/USDT reserves) → USD.
- FISH additionally has a direct USDT pair (cross-check route).
- All tokens involved read decimals() = **18** on-chain — including the
  bridged USDT/USDC (unlike their 6-decimal mainnet versions). Pricing code
  must still read decimals per token rather than assume.

Spot snapshot from getReserves (2026-10-30 ~10:44 JST; indicative only):
| Token | Pool reserves | Spot |
|---|---|---|
| 42 | 12,184 USDT / 850 42 | 1 42 ≈ 14.33 USDT |
| ZAP | 12,703 ZAP / 1,746 42 | 1 ZAP ≈ 0.1375 42 ≈ $1.97 |
| FISH | 24,688 FISH / 47,398 42 | 1 FISH ≈ 1.920 42 ≈ $27.50 |
| FISH (direct) | 2,161 FISH / 3,719 USDT | 1 FISH ≈ 1.72 USDT ⚠ |
| PANIC | 29,855 42 / 51.03M PANIC | 1 PANIC ≈ 0.000585 42 ≈ $0.0084 |
| QOM (on Infinite) | 212.7 billion QOM / 141 42 | ≈ dust (≈ $0) |

⚠ **Thin-pool divergence warning (important):** FISH prices to ≈ $27.50 via
the 42 route but only ≈ $1.72 via its direct USDT pool — the routes disagree
by an order of magnitude. The pools are small (42/USDT holds only ~$12k;
FISH/USDT ~$3.7k), so reserve-ratio prices are easily skewed/stale.
Dashboard totals built on this must be labelled estimates, should prefer
the deepest available USD route per token, cross-check routes when two
exist, and ideally sanity-band or suppress a price whose routes diverge
wildly. Do not present these as exact market prices.

### Implementation recipe (for the wallet)
1. eth_call getReserves() (0x0902f1ac) + token0() (0x0dfe1681) on the
   anchor pairs above; compute spot = reserve ratios with per-token
   decimals; route via 42 placeholder as the hub.
2. Cache 30–60 s; refresh on Dashboard focus. All calls are read-only
   against the already-configured official RPCs.
3. Treat bridged USDT ≈ $1 as the numéraire; no JPY source exists
   on-chain (JPY conversion, if wanted, needs an off-chain FX rate —
   out of scope here).
4. QL1-side (QOM native) pricing is NOT covered by this factory (it's the
   Infinite DEX); QL1 DEX pairs are research task A's territory.
