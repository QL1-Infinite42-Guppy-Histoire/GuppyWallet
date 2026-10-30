# Contract Specs — from verified ABIs (2026-10-30)

Sources: Blockscout verified-contract APIs (`/api/v2/smart-contracts/<addr>`) on
scan.infinitedrive.xyz (Infinite) and scan.qom.network (QL1). Raw ABIs saved next
to this file as `abi-*.json`. Behavior summaries stick to function names,
signatures, types, events, and the contracts' own verified-source field names
where ABI outputs are unnamed tuples. Anything beyond that is flagged.

---

## 1. St42Vault — Infinite `0x0F93a9b0dBF2D1829928fe40cBc155e0b5B2D35e`

The liquid-staking vault **and** the st42 token itself: it is an ERC-20
(name/symbol/decimals, transfer/approve/permit) whose shares are minted against
native 42. UUPS-upgradeable, ownable, keeper-operated. Solidity 0.8.26, 271 ABI entries.

### User-facing write functions
| Function | Inputs (plain words) | Returns / notes |
|---|---|---|
| `deposit()` payable | send native 42 as msg.value | → shares minted to caller (`Deposited(user, assets, shares)`) |
| `depositTo(address validator)` payable | native 42 + chosen validator | → shares; deposit steered to a specific validator |
| `requestRedeem(uint256 shares)` | st42 amount to exit | → `ticketId`; shares move into the current open epoch (`RedeemRequested(user, shares, ticketId, epoch)`) |
| `claim(uint256 ticketId)` | redemption ticket id | pays out 42 to the ticket owner (`Claimed(user, ticketId, recipient, assets)`) |
| `claimTo(uint256 ticketId, address recipient)` | ticket id + payout address | same, to a different recipient |
| `instantExit(uint256 shares, uint256 minAssetsOut)` | st42 + slippage floor | → assets out immediately, minus an exit fee (`InstantExit(user, shares, assetsOut, fee, feeToRecipient)`) |
| `transfer / transferFrom / approve / permit` | standard ERC-20 | st42 is freely transferable |

Operator/keeper-only (not user flow): `processEpoch()`, `updateRate()`,
`initialize(...)`, ownership/upgrade functions.

### Views that reveal state
- **Exchange rate**: `rateNum()` / `rateDen()` (rate = num/den), plus
  `lastRate()`, `lastRateUpdate()`, `rateFresh()`, `rateValid()`. Deposits also
  expose `depositRateNum()`. `totalAssets()` / `totalSupply()` give the raw backing ratio.
- **Your position**: `balanceOf(user)` (st42), `tickets(ticketId)` →
  (owner, shares, epoch, claimed, claimedAmount, + one uint16 field whose name
  the ABI does not give), `lastUnbondAt(user)`.
- **Timing**: `unbondingPeriod()`, `observedUnbonding()`, `epochLength()`,
  `openEpoch()`, `epochs(id)` (per-epoch shares/assets, priced/finalized flags),
  `nextTicketId()`, `queueWindow()`.
- **Limits / status**: `minStakeAmount()`, `depositCap()`, `depositsPaused()`,
  `breakerActive()`, `buffer42()` (liquid buffer), `pendingUnbond()`,
  `maturedOwed()`, `validatorCount()`, `vals(i)` → (bech32 valoper string, EVM
  address, weights/flags…) — delegation targets are Cosmos validators.
- Fees: `rewardFeeBps()`, `exitFeeMinBps()` / `exitFeeMaxBps()`,
  `exitFeeRecipientShareBps()`, `feeRecipient()`, `feesOwed()`.

### Key events
`Deposited`, `RedeemRequested`, `Claimed`, `InstantExit`, `Delegated`,
`Undelegated(validator, amount, completionTime)`, `Harvested(rewards, fee)`,
`RateUpdated(round, rateNum, rateDen)`, `EpochClosed / EpochPriced /
EpochUnbonded(epoch, completionTime) / EpochFinalized`, `Transfer`, `Approval`.

### How st42 staking works (from the ABI)
1. **Stake**: user sends native 42 to `deposit()` (optionally `depositTo(validator)`)
   and receives st42 shares at the current rate (`rateNum/rateDen`). The vault
   delegates pooled 42 to Cosmos validators (`Delegated`, `vals()` carries
   bech32 valoper addresses) and folds rewards back in (`Harvested`), which is
   what moves the rate.
2. **Normal exit (epoch queue)**: `requestRedeem(shares)` burns/locks the shares
   into the open epoch and issues a ticket. The epoch is unbonded on-chain
   (`EpochUnbonded` with a completion time; `unbondingPeriod()` /
   `observedUnbonding()` expose the wait — consistent with Cosmos unbonding).
   After the epoch is priced/finalized, `claim(ticketId)` pays the 42.
   Claiming too early reverts (`NotFinalized`, `NotReady` errors exist).
3. **Fast exit**: `instantExit(shares, minAssetsOut)` skips the queue, paid out
   of the vault's liquid buffer (`buffer42()`), for a fee bounded by
   `exitFeeMinBps..exitFeeMaxBps`, part going to `feeRecipient`.
4. There is **no fixed lockup on deposits themselves** visible in the ABI; the
   wait lives on the redemption side (epoch + unbonding). Rate staleness is
   guarded (`RateStale`, `rateFresh()`), so the UI should check rate freshness
   before quoting.

**Not determinable from the ABI alone**: current live values (rate, unbonding
seconds, fee bps, min stake) — must be read on-chain; the exact name of the 6th
`tickets()` field; how `depositTo` validator choice affects share pricing.

---

## 2. St42Book — Infinite `0x458f6b41d093bED5aBBc1527DaBDf5499A85294F`

**Not a staking contract.** It is an on-chain **order book / secondary market
for st42 shares**, priced against the vault's reference rate. `vault()` and
`share()` views point at the vault and its share token. Solidity 0.8.26.

### User-facing write functions
| Function | Inputs (plain words) | Notes |
|---|---|---|
| `placeBid(uint256 discountBps)` payable | send 42, name a discount vs reference price | → order id; a bid to buy st42 below rate |
| `placeAsk(uint256 shares, uint256 discountBps)` | st42 shares + discount | → order id; a sell offer below rate |
| `placeLimitBid(uint256 price, uint256[] askIds, bool ioc)` payable | explicit price, asks to take, immediate-or-cancel | limit buy |
| `placeLimitAsk(uint256 shares, uint256 price, uint256[] bidIds, bool ioc)` | explicit price version | limit sell |
| `placePeggedBid / placePeggedAsk` | discount + price bound + counter-orders + ioc | price tracks the reference rate within a band |
| `marketBuy(uint256[] askIds, uint256 maxPrice, uint256 minSharesOut)` payable | take listed asks now | market buy |
| `marketSell(uint256[] bidIds, uint256 shares, uint256 minPrice, uint256 minAssetsOut)` | take listed bids now | market sell |
| `fillAsks(uint256[] ids, uint256 minDiscountBps, uint256 minSharesOut)` payable | batch-fill asks | |
| `fillBids(uint256[] ids, uint256 shares, uint256 maxDiscountBps, uint256 minAssetsOut)` | batch-fill bids | |
| `cancel(uint256 id)` / `cancelMany(uint256[] ids)` | own order ids | refund escrow (`OrderCancelled(id, refunded)`) |
| `matchCrossed(uint256[] bidIds, uint256[] askIds)` | anyone can match crossed orders | earns a matcher tip (`MatchTip`) |
| `withdrawCredit(address to)` | pull internal credit balance | proceeds/refunds accrue as `credit` first |

Admin/keeper: `setParams(...)` (maker/taker fee, min order, band, tolerance,
tip, price cap), `sweep(ids)`, `flushFees()`, `resetAnchor(side)`, and a
two-step retire flow (`announceRetire()` → wait `RETIRE_WINDOW` → `retire()`).

### Views that reveal state
- `orders(id)` → (maker, isBid, pegged, price/discount fields…), `quote(id)` →
  (open, isBid, pegged, price, …) — "an order's current price and whether it
  may fill now" per the source doc comment.
- `refPrice(side)` / `refTime(side)` — reference (vault-rate) price per side.
- `credit(user)`, `totalCredit()`, `totalAskEscrow()`, `totalBidEscrow()`,
  `nextOrderId()`, fee views `makerFeeBps()` / `takerFeeBps()`, `minOrder()`,
  `priceCap()`, `bandBps()`, `retired()`.

### Key events
`OrderPlaced(id, maker, isBid, pegged, amount, price, discountBps)`,
`Trade(makerOrderId, takerOrderId, taker, takerBuys, shares, price, native,
makerFee, takerFee)`, `OrderCancelled`, `OrderSwept`, `Credited`,
`CreditWithdrawn`, `FeePaid`, `MatchTip`, `ParamsSet`, `BookRetired`.

### How it fits the system
St42Book is the **liquidity escape hatch for st42**: instead of waiting out the
vault's epoch + unbonding queue, a holder can sell shares on the book at a
discount to the vault rate (or place a pegged/limit ask), and a buyer with 42
can pick up st42 below rate. Prices are expressed relative to the vault
reference rate (discount bps, band, tolerance, price cap are all in the ABI).
Escrowed funds and sale proceeds sit in per-user `credit` until
`withdrawCredit`. For the wallet UI this is an advanced/Phase-later feature;
the ABI has no aggregation/sorting — the UI must aggregate orders itself
(the source says exactly that about `quote`).

**Not determinable from the ABI alone**: the current order list (must be
rebuilt from `OrderPlaced`/`Trade` events + `orders()` reads), live fee/band
parameter values, and which address `vault()`/`share()` return (read on-chain).

---

## 3. QNSBaseRegistrar ("QOM Domains") — QL1 `0xDCbF4614152a22D1883Ba3929c668B978A3be548`

The ENS-style base registrar for `.qom` second-level names. It **is the ERC-721
NFT contract** for names: `ownerOf(tokenId)` = name owner, tokenId is the
uint256 name id. Solidity 0.8.23.

### Write functions
| Function | Inputs | Who |
|---|---|---|
| `register(uint256 id, address owner, uint256 duration, string label)` → expiry | name id, owner, rental seconds, label | **controllers only** (the RegistrarController) |
| `renew(uint256 id, uint256 duration)` → expiry | name id, added seconds | controllers only |
| `reclaim(uint256 id, address owner)` | re-assert registry ownership | name owner |
| `transferFrom / safeTransferFrom / approve / setApprovalForAll` | standard ERC-721 | name owner — names are transferable NFTs |
| `addController / removeController / setAdmin / setResolver` | admin | admin only |

### Views
`available(id)` → bool, `nameExpires(id)` / `expiries(id)` → unix expiry,
`GRACE_PERIOD()` (post-expiry grace constant), `baseNode()` (the `.qom` node),
`controllers(addr)`, `registry()`, `resolver()`, standard ERC-721 views
(`balanceOf`, `ownerOf`, `tokenURI`, `name`, `symbol`).

### Events
`NameRegistered(id, owner, expires)`, `NameRenewed(id, expires)`, `Transfer`,
`Approval`, `ApprovalForAll`, `ControllerAdded/Removed`.

---

## 4. QNSRegistrarController — QL1 `0x4d9FE3F0EE6Fe1645DD537EC59a0a328F7148372`

The **user-facing shop front** for `.qom` names: pricing, availability,
registration and renewal. Solidity 0.8.23. Users call this, not the registrar.

### User-facing write functions
| Function | Inputs | Payment |
|---|---|---|
| `register(string name, address owner, address resolver, bool setReverse, bool permanent)` | bare label (e.g. "alice"), owner, resolver to set, whether to set reverse record, permanent-vs-rental | **payable** (native coin) |
| `renew(string name)` | label | **payable** (native coin) |
| `upgradeToPermanent(string name)` | label | **payable** — converts a rental to permanent |
| `setName(string name)` / `removeName()` | set/clear your **reverse record** (primary name) | — |

Admin: `setPricing(p1..p5)`, `setPermanentPricing(p1..p5)`, `setTreasury`,
`setDefaultResolver`, `setAdmin`, `withdraw()`.

### Views that reveal state
- **Availability**: `available(name)` → bool, `valid(name)` → bool (format rules).
- **Price**: `rentPrice(name, duration)` → cost; length-tier price views
  `price1Letter()` … `price5PlusLetter()` and `permanentPrice1Letter()` …
  `permanentPrice5PlusLetter()`; `permanentRentPrice(name)`.
- **Terms**: `DURATION()` — a single fixed rental duration constant (register
  takes **no** duration argument, so rentals are sold in fixed `DURATION()`
  units; renew extends by the same unit); `PERMANENT()` constant;
  `MIN_NAME_LENGTH()` / `MAX_NAME_LENGTH()`.
- Wiring: `registrar()`, `registry()`, `defaultResolver()`, `treasury()`,
  `baseNode()`, `reverseNode()`.

### Events
`NameRegistered(name, label, owner, baseCost, expires)`,
`NameRenewed(name, label, cost, expires)`, `ReverseClaimed(addr, name)`.

### How .qom registration works (from the ABIs)
1. Check `valid(name)` and `available(name)` on the controller.
2. Quote with `rentPrice(name, DURATION())` (price depends on label length:
   1 / 2 / 3 / 4 / 5+ letter tiers). A **permanent** (buy-out) option exists at
   separate tier prices (`permanentRentPrice`).
3. Call `register(name, owner, resolver, setReverse, permanent)` with the price
   attached as native value. The controller (an authorized "controller" on the
   registrar) calls registrar `register(id, owner, duration, label)`, which
   mints the ERC-721 name NFT and sets expiry = now + duration (rental) —
   `NameRegistered` fires on both contracts.
4. Renew with `renew(name)` + value; upgrade a rental via
   `upgradeToPermanent(name)`. Over/underpayment errors: `InsufficientValue`.
   Fees accumulate to the controller and are swept to `treasury()` via `withdraw()`.
5. Ownership/expiry live on the registrar: `ownerOf(id)`, `nameExpires(id)`,
   with a `GRACE_PERIOD()` after expiry.

**Not determinable from the ABI alone**: the actual price numbers, `DURATION()`
seconds, `PERMANENT()` value, length limits (read on-chain); whether payment is
strictly native QOM — the ABI shows payable/native value and no ERC-20 address
parameter anywhere, so native coin is the only reading, but the contracts never
name the currency; how the uint256 name `id` is derived from the label
(ENS-style label hash is the pattern the signatures imply; not stated in the ABI).

---

## 5. ZapStaking — QL1 `0xF52d49c0bb3b0e51E37Af2b21C2F13A097155aD2`

Season-based staking: **stake ZAP, earn ZAP** (per the contract title and
`zapToken()`). Solidity 0.8.19. Rewards are partly **burned** if claimed early
(see vesting below).

### User-facing write functions
| Function | Inputs | Notes |
|---|---|---|
| `stake(uint256 amount)` | ZAP amount | during the season's stake window (`Staked(user, amount, totalStaked)`) |
| `unstake()` | — (whole position) | ends the stake; locks in `rewardEarned` and starts reward vesting (`Unstaked(user, stakeAmount, rewardAmount)`) |
| `claim()` | — | pays the vested part of the reward; the unvested remainder is burned (`Claimed(user, received, burned)`) |

Admin: `startSeason(uint256 rewardAmount)`, `depositRewards(uint256 amount)`
(funds the reward pool), `setParams(stakeDuration, stakeWindow, rewardLock)`,
`recoverIfNoStakers()`, `renounceAdmin()`.

### Views that reveal state
- **Token**: `zapToken()` — the one token staked and paid out.
- **Season clock**: `seasonActive()`, `seasonStart()`, `seasonEnd()`,
  `windowClose()` (last moment to stake), `seasonInfo()` → (start, windowClose,
  end, rewardLockEnd, stakers, totalStaked, + 2 further uints), `stakerCount()`.
- **Your position**: `getStake(user)` → (amount, rewardEarned, rewardLockEnd,
  unstakedAt, claimed, pending); `pendingReward(user)`;
  `claimPreview(user)` → (received, burned) — exactly what a claim now would
  pay vs burn; `stakes(user)` raw record.
- **Terms / pool**: `stakeDuration()`, `stakeWindow()`, `rewardLock()` (vesting
  length), `rewardPool()`, `rewardsDeposited()`, `totalStaked()`,
  `totalClaimed()`, `totalBurned()`, `previewDaily(amount)` (estimated daily
  reward for a hypothetical stake).

### Events
`SeasonStarted(rewardPool, windowClose, seasonEnd)`, `Staked`,
`Unstaked(user, stakeAmount, rewardAmount)`, `Claimed(user, received, burned)`,
`RewardsDeposited(amount, totalDeposited)`, `SeasonRecovered`,
`ParamsUpdated(stakeDuration, stakeWindow, rewardLock)`, `AdminRenounced`.

### How ZapStaking works (from the ABI + verified field names)
1. Admin opens a season with `startSeason(rewardAmount)`: staking is only
   possible until `windowClose()`; the season runs to `seasonEnd()`.
2. Users `stake(amount)` ZAP (one position per address — `stakes` is a single
   record per user, and `unstake()` takes no amount, so exit is all-or-nothing).
3. Rewards accrue against the season pool (`pendingReward`, `previewDaily`).
4. `unstake()` returns the principal and fixes `rewardEarned`, but the reward
   **vests linearly over `rewardLock` measured from season end**:
   `claimPreview` = (received, burned) where claiming early pays only the
   vested slice and **burns the rest** (`totalBurned()`); after
   `rewardLockEnd` the full reward is claimable with zero burn.
5. `claim()` settles it. Unclaimed-after-unstake state is readable via
   `getStake(user).claimed / rewardLockEnd`.

**Not determinable from the ABI alone**: live parameter values (durations,
window, pool size) and the reward formula internals (`_calcReward` is internal);
the last two `seasonInfo()` fields' names; whether staking is limited to one
stake transaction per user per season (the single-record shape suggests it;
the ABI alone doesn't prove a second `stake()` reverts vs tops up).

---

## Cross-system notes for the wallet build
- **st42**: integration = Vault only for stake/unstake (deposit → shares;
  requestRedeem → ticket → claim; instantExit for a fee). Book is a separate,
  optional secondary-market screen and needs event-indexed order aggregation.
- **QNS**: integration = Controller for everything user-facing
  (available/valid/rentPrice/register/renew), Registrar (ERC-721) for
  "my names" (balanceOf/ownerOf/nameExpires). Payment is native value.
- **ZapStaking**: integration = stake/unstake/claim + getStake/claimPreview
  for display; the burn-on-early-claim mechanic MUST be surfaced in the UI
  (show `claimPreview`'s burned amount before confirming).
- All live parameter values (rates, prices, durations, fees) must be read
  on-chain at runtime — none are in the ABIs.
