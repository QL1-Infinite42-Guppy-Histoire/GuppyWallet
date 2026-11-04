# Cross-Chain Deposit with Gas Split — Research & Design

Status: research complete, design proposal (not yet implemented)
Date: 2026-11-01
Scope: "Deposit from SOL / XLM" feature for GuppyWallet — an external instant-swap
service converts the user's SOL/XLM into two payouts to their BSC address
(most → USDT-BSC, a small part → BNB gas money), then the existing deposit
detection + $1 gas gate + one-tap bridge to 42 Chain takes over.

**REVISED 2026-11-01 — see §8. The primary flow is now BNB-first: ONE
provider order (SOL/XLM → BNB), then a wallet-side PancakeSwap swap on BSC
that keeps the gas part in BNB and converts the rest to USDT, then the
bridge. §2, §3 and the phase structure in §6 describe the earlier
two-order split design and are kept for the record; where they conflict
with §8, §8 wins. §7's live test now targets XLM→BNB accordingly.**

All minimums/fees marked "measured" were pulled live from provider APIs on
2026-11-01 from this machine. Reference prices at measurement time
(CoinGecko): XLM $0.16928, SOL $95.67, BNB $713.91, ETH $2,272.50.

---

## 1. Recommendation

**Primary: ChangeNOW.** Fallback: SideShift.ai (kept behind the same proxy
interface, enabled only if ChangeNOW is down or region-blocked for a user).

Why ChangeNOW wins for this feature:

1. **Its published minimums are ~10–60× lower than SideShift's.** The gas-part
   order is small *by design* (~$3), so the provider minimum on XLM→BNB /
   SOL→BNB decides whether the split works at small deposit sizes at all.
   ChangeNOW: ~$0.04–0.50. SideShift: ~$3.00 flat.
2. **Per-order XLM memo** (`payinExtraId`, currency metadata confirms
   `hasExternalId: true`, `externalIdName: "Memo"`) — exactly the deposit
   model we need.
3. **Free partner API key** (ChangeNOW for Business account, no subscription);
   key only attributes commission and cannot move funds. Standard (floating)
   and fixed-rate flows both exist.
4. **Data endpoints are partly public**: `/v2/exchange/range` answered without
   a key (all numbers below), so the app can show live minimums even before
   the key/proxy is wired. Creating exchanges and estimates require the key.
5. SideShift's shift creation requires the account secret / Ed25519 signing
   key — that must never ship in a mobile app, so SideShift would force a
   proxy for *everything* and adds IP-level region gating on top
   (its `/v2/permissions` endpoint returned `createShift: false` from this
   machine's IP).

### Candidates × criteria (measured 2026-11-01 unless noted)

| Criterion | ChangeNOW (primary) | SideShift.ai (fallback) | Nanswap (ruled out) | SimpleSwap / StealthEX / LetsExchange / Godex / FixedFloat |
|---|---|---|---|---|
| Public API to create + track orders | Yes, REST v1/v2 | Yes, REST v2 ("shifts") | Yes, v1 | Yes (all) |
| Auth | Free partner API key, `x-changenow-api-key` header | Account secret or Ed25519 signed requests — **server-side only** | Free account API key (`/create-order`) | API key / bearer / HMAC secret (FixedFloat) |
| Key safe in mobile app? | Low-privilege (commission attribution only, no fund access); proxy still recommended | **No — full account access. Proxy mandatory** | Probably low-privilege, but see rule-out | Mixed; FixedFloat secret must be server-side |
| Min XLM→USDT(BSC) | **0.2857 XLM ≈ $0.05** | Not retrievable unauthenticated (see note) | Not verifiable | Not live-probed |
| Min XLM→BNB(BSC) | **0.2497 XLM ≈ $0.04** | **17.73 XLM ≈ $3.00** | Not verifiable | Not live-probed |
| Min SOL→USDT(BSC) | **0.00525 SOL ≈ $0.50** | Not retrievable unauthenticated | Not verifiable | Not live-probed |
| Min SOL→BNB(BSC) | **0.00525 SOL ≈ $0.50** | **0.03133 SOL ≈ $3.00** | Not verifiable | Not live-probed |
| Min XLM→USDT(ETH) (reference) | 2.4382 XLM ≈ $0.41 | Not retrievable | — | — |
| Max amounts | None returned (`maxAmount: null`) | Large (e.g. XLM→BNB max ≈ 177,000 XLM ≈ $30k) | — | — |
| Fee model | Included in the rate/estimate (not itemised); partner commission configurable from 0.4% earned by us. Planning figure: ~2% all-in until Phase 0 test measures it | Embedded in pair rate + default 0.5% affiliate commission (adjustable 0–2%). **Measured all-in drag vs CoinGecko mid: ~1.9% (SOL→BNB), ~2.1% (XLM→BNB)** | ~1.3% under mid quoted by third-party review (BTC→XMR, not our pairs) | Typically 0.4–1% + network fees, in-rate |
| Floating / fixed rate | Both (fixed needs key, rate locked at order creation) | Both (fixed = quote, 15-min validity; variable priced on deposit receipt) | Floating | Most offer both |
| XLM memo | **Per-order memo (`payinExtraId`)**; pooled deposit address distinguished by memo | Memo supported (`networksWithMemo: ["stellar"]`); per-shift deposit memo returned at creation | Supported in principle | Generally supported |
| Payout to arbitrary address | Yes, any valid address per order | Yes (`settleAddress`) | Yes | Yes |
| Two parallel orders → same payout address | Yes — independent exchanges, each with own deposit address/memo | Yes — max 5 open variable shifts, 5 shift-creations/min | Presumably | Presumably |
| Account / KYC / holds | No user account. Risk-based AML: can demand KYC and hold a flagged swap pending review (their terms) | No user account. Risk-based KYC; **hard IP geoblocking** via `/v2/permissions` (this machine: `createShift:false`) | No account for web swaps; terms allow freezing swaps for AML review indefinitely | Similar risk-based models |
| Docs | changenow.io business/API pages + integration guide (https://changenow.io/blog/how-to-use-exchange-api-changenow) | https://docs.sideshift.ai (excellent, complete) | Postman page linked from nanswap.com/API only | Public docs |

Notes on the measurements:

- ChangeNOW figures are from `GET /v2/exchange/range` (standard flow), which
  answered **without** an API key; they match the legacy v1 `/min-amount`
  values. Estimates and fixed-rate range return 401 without the key.
- These are the provider's *published* minimums. ChangeNOW deducts network
  fees from the payout, so a deposit at the published minimum can still
  arrive as ~nothing. Practical floor is a Phase 0 question (see §7) — do not
  present the published minimums to users as "you can deposit $0.05".
- SideShift USDT pairs: the public `/v2/pair` endpoint returned
  `Invalid network` for every USDT combination tried (BSC, Ethereum, Tron;
  ticker and contract-address forms), while BNB pairs answered fine. Since
  2025 the `/pair` endpoints require `affiliateId` + secret for some
  queries, so USDT minimums are likely retrievable with an account — but
  unverified here. BNB-pair data was fully retrievable unauthenticated.
- SideShift minimums are suspiciously exactly ~$3.00 on both probed pairs —
  looks like a USD-denominated floor converted to coin units.

### Ruled out

- **Nanswap**: public estimate endpoint rejected every ticker form tried for
  XLM/SOL→USDT (`"tickers not valid"`), market-data endpoint exposes no
  XLM/SOL/USDT pairs, and full API docs live behind a Postman link with no
  verifiable USDT-BSC ticker scheme. Smallest operator of the set and (per
  earlier research) mixed trust signals. Not safe to design against
  unverifiable pairs.
- **FixedFloat**: HMAC secret must live server-side and its float/fixed model
  adds nothing over the fallback; keep as a name on the list only.
- **SimpleSwap / StealthEX / LetsExchange / Godex**: all viable technically
  (free keys, similar flows) but none beats ChangeNOW on any measured axis,
  and their minimums could not be verified without signing up for keys.
  Revisit only if ChangeNOW fails Phase 0.

---

## 2. Flow design (plain language)

Entry: Home / Receive area → "Deposit from another chain (SOL / XLM)".

1. **Choose what you're sending** — SOL or XLM. One line of explanation:
   "You send from your other wallet. We never touch your SOL/XLM keys."
2. **Enter the total amount** (in SOL/XLM, with a live ~USD equivalent).
   The app fetches the live minimums and a rate estimate.
3. **Split preview** — two cards:
   - "For bridging: ≈ X USDT" (the bulk)
   - "For gas: ≈ Y BNB (about $Z)" — with the note "Gas money so the bridge
     can run. Needs to stay above $1; we aim for ~$3+."
   If the total is too small to split (§3), show instead: "This amount is
   small, so everything will arrive as USDT. You'll still need a little BNB
   for gas before bridging."
4. **Confirm** → the app (via proxy) creates one or two orders.
5. **Deposit instructions** — one card **per order** (they are separate
   deposits!):
   - Deposit address, big copy button.
   - For XLM: the **memo**, shown separately, bigger, with a red-flag style
     warning: "This memo is required. Without it your deposit cannot be
     matched — and we cannot get it back for you."
   - Exact amount to send ("send exactly this much, or a little more —
     sending less than the minimum can't be exchanged").
   - "I've sent it" is *not* required — status polling detects the deposit —
     but a button "Check status" exists.
   - If two orders: label them "Deposit 1 of 2 — the USDT part" /
     "Deposit 2 of 2 — the gas part", each with its **own** address/memo.
     Never merge them into one instruction screen; the two XLM memos differ.
6. **Status screen** — one row per order with plain states:
   Waiting for your deposit → Deposit seen, confirming → Exchanging →
   Sending to your wallet → Done. Poll every ~20–30 s while the screen is
   open and on app resume.
7. **Arrival** — the existing BSC deposit detection sees USDT and/or BNB
   land. When USDT has arrived and the gas gate ($1 of BNB) passes, show
   "Your USDT is here — Bridge to 42 Chain" and hand off to the existing
   one-tap bridge (normal ConfirmTx + auth, unchanged).
   If USDT arrived but gas hasn't, the banner says so and points at the
   still-running / failed gas order instead of a dead end.

State storage: order records (provider, order ID, pair, amounts, deposit
address + memo, status cache, timestamps) in local app storage only. No
server-side user data anywhere.

---

## 3. Split math

Definitions at order time, using live USD prices:

- `T` = total deposit value in USD.
- Gas gate to satisfy afterwards: **$1** of BNB (existing v0.1.9 gate).
  Target the gas part at **~$3 landed** so the gate passes with buffer for
  price movement and one or two bridge attempts.
- Gas part (pre-fee): `G = clamp(5% × T, $3, $10)`, created **only if
  T ≥ $15**. Below $15: no split (§2 step 3 fallback).
- USDT part: `T − G`.
- Both orders must independently clear the provider minimum. With
  ChangeNOW's measured minimums (≤ ~$0.50) this is never the binding
  constraint; our own floors are ($3 gas order, $15 split threshold). With
  SideShift as fallback its ~$3.00 minimums bind exactly at the floor —
  another reason it's the fallback, not the primary.
- Fees hit **each order separately**. Planning figure: ~2% all-in per order
  (SideShift measured 1.9–2.1% vs mid; ChangeNOW to be measured in Phase 0).

Worked examples (ChangeNOW, floating rate, ~2% all-in planning figure,
prices as measured 2026-11-01):

| Total deposit | Gas order (BNB part) | USDT order | Expected to land | Gas gate |
|---|---|---|---|---|
| $20 (≈118 XLM / 0.21 SOL) | $3.00 → ≈ $2.94 of BNB | $17.00 | ≈ $16.66 USDT + ≈ $2.94 BNB | ✅ passes (~3× the $1 gate) |
| $100 (≈591 XLM / 1.05 SOL) | $5.00 (5%) → ≈ $4.90 BNB | $95.00 | ≈ $93.10 USDT + ≈ $4.90 BNB | ✅ |
| $500 (≈2,953 XLM / 5.23 SOL) | $10.00 (cap) → ≈ $9.80 BNB | $490.00 | ≈ $480.20 USDT + ≈ $9.80 BNB | ✅ (BNB covers many bridges) |

Edge behaviour:

- T between $15 and ~$40: gas stays at the $3 floor (15–20% of a small
  deposit — acceptable; the alternative is an unbridgeable USDT balance).
- BNB price falls after arrival: the gate is evaluated at bridge time on
  live prices, so a deep drop could re-block bridging; the $3 target (≈3×
  buffer) is sized for that.
- Fixed-rate flow (Phase 3) makes the preview numbers near-exact instead of
  estimates; until then all previews are labelled "estimate".

---

## 4. Failure cases and honest UI copy

| Case | What actually happens | UI copy (plain, honest) |
|---|---|---|
| **XLM memo forgotten / wrong memo** | Deposit lands in the provider's pooled Stellar account with no (or a wrong) memo → not auto-matched. Recovery is only via provider support, with the Stellar tx hash; can take days and may fail. We hold nothing and cannot recover it. | Before sending: "The memo is required — without it, your money can't be matched to you, and we can't get it back." After the fact (order stuck at "waiting" + user taps "I sent it but nothing happened"): "If you sent without the memo, contact ChangeNOW support with your transaction hash: [link]. We can't recover it from the app." |
| **Deposit below minimum** | Provider will not exchange it; depending on amount it sits unprocessed or is refundable only via support, minus fees. | Prevention first: amount field validates against live minimums before order creation. Copy: "That's below the minimum for this exchange (about $X). Send at least …" |
| **Provider KYC / AML hold** | Provider freezes that swap and asks the *user* for ID / source-of-funds via their own process. Funds are with the provider, not us. Can end in completion or a refund to the source address. | "The exchange service has paused this swap for a check. This is their legal process — follow the instructions from ChangeNOW support: [link]. Your money is with them, not in this app." |
| **Floating rate moved** | Standard flow prices at deposit receipt; a fast market move changes the payout vs the preview, both directions. | Preview labelled "Estimate — the final amount depends on the rate when your deposit arrives." Status screen shows the final received amount once known, with the difference visible, not hidden. |
| **Only one of the two orders completes** | Orders are independent. Sub-cases: (a) USDT in, BNB pending → bridge banner waits, points to gas order status. (b) USDT in, BNB order failed/expired and user has < $1 BNB → honest dead-end copy + "add BNB another way" (link to the gas part of Receive). (c) BNB in, USDT pending → status screen stays primary; no bridge action offered yet. (d) USDT in, BNB order failed, but user already had ≥ $1 BNB → gate passes; bridge proceeds — the split failure becomes a footnote, not a blocker. | Per-order status rows (never a single merged "processing…"), plus a summary line that says exactly which part is where. |
| **Order expires / user never deposits** | Fixed-rate quotes expire (SideShift 15 min; ChangeNOW fixed-rate has a deposit window). Variable/standard orders linger harmlessly. | "This deposit request expired. No money was sent. Create a new one whenever you're ready." Local record is marked expired; nothing else happens. |
| **User sends the wrong asset / wrong chain** | e.g. sends USDT to the XLM deposit address, or XLM to the SOL order's address. Provider may or may not be able to recover; support-only. | Instruction cards repeat the asset + network in words ("Send **XLM on the Stellar network** to:") and the status screen's help section says recovery is provider-support-only. |
| **Provider outage mid-flight** | Deposit received by provider, payout delayed. Visible in order status. | Show provider status verbatim-ish ("Exchanging — taking longer than usual") and support link after a long delay (e.g. > 2 h). No fake progress. |

---

## 5. Architecture notes

- **Where the API key lives**: ChangeNOW partner key sits in a **tiny
  proxy**, not in the app binary. The key cannot move funds (worst case if
  leaked: strangers attribute their exchange commission to us / burn our
  rate limits), but the proxy also gives us a kill switch, request
  filtering (only our pairs/endpoints), and a place to add the SideShift
  fallback later without an app release.
- **Proxy shape**: one small stateless worker with three passthrough
  endpoints (create exchange, exchange status, estimate/range) that injects
  the key server-side. No database, no user data, no logs of addresses
  beyond provider defaults. **Cloudflare Workers free tier** (100k
  requests/day, no card required) fits the user's free-hosting constraint
  with orders of magnitude to spare. Vercel/Netlify functions are
  equivalent alternatives.
- **Direct-from-app (no proxy)** is technically possible with ChangeNOW
  (their own widgets embed a key-like identifier), and is the documented
  fallback if the proxy is ever down — the app can degrade to it because
  the key is low-privilege. SideShift can *never* be called direct: its
  secret/signing key is full account access.
- **No custody by us, ever**: the wallet only creates orders and reads
  status. Funds flow: user's SOL/XLM wallet → provider (custodial
  in-flight — this part is the provider's custody, disclosed in UI copy)
  → user's own BSC address → user's own bridge transaction. We never hold
  keys, funds, or a balance.
- **Order state**: local only (on-device storage). The provider order ID is
  the only join key; if the user wipes the app mid-flight, funds still land
  in their BSC wallet (payout address is theirs) — only the status tracking
  is lost, and arrival detection still fires. State this in the UI help.
- **Region checks**: before creating an order, confirm the user's region
  isn't blocked (ChangeNOW has no public permissions endpoint — Phase 0
  must test order creation from a JP connection; SideShift has
  `/v2/permissions` for exactly this and it already shows how
  region-dependent this category is).
- **Rate limits**: ChangeNOW partner limits are generous for this scale;
  SideShift caps shift creation at 5/min and 5 concurrently open variable
  shifts — a 2-order split is fine under both.

---

## 6. Implementation plan

| Phase | Contents | Rough effort |
|---|---|---|
| **Phase 0 — live validation** | Get a ChangeNOW for Business API key (free). From a JP connection, run two real ~$5 test orders (XLM→USDT-BSC and XLM→BNB) against a throwaway BSC address: verify per-order memos, deposit detection by provider, time to payout, *actual* fee drag vs estimate, actual received amounts. Repeat once with SOL. Confirm no region block. Decide the real planning fee % from these receipts. | 0.5–1 day (mostly waiting on deposits) |
| **Phase 1 — single-payout deposit** | Tiny proxy on Cloudflare Workers (key injection, 3 endpoints, kill switch). App: "Deposit from SOL/XLM" flow — source + amount, live minimums + estimate, **USDT-only order**, deposit instructions (address + memo cards), status polling screen, arrival → existing bridge handoff. Existing $1 gas gate warning covers the no-gas case honestly. | 3–5 days |
| **Phase 2 — gas split** | Split math (§3), dual order creation, per-order instruction cards ("Deposit 1 of 2 / 2 of 2"), partial-arrival states and copy (§4), $15 split threshold with the small-deposit fallback. | 2–3 days |
| **Phase 3 — polish (optional)** | Fixed-rate option at confirm time (exact preview), SideShift fallback behind the proxy (auto-switch on provider errors / region block), webhook-free status push via app-resume refresh refinements. | 1–2 days |

Total to the full feature: roughly **1.5–2 weeks** of focused work, with
Phase 1 shippable on its own.

---

## Sources (live-checked 2026-11-01)

- ChangeNOW live API (no key): `GET /v2/exchange/range` and
  `GET /v1/min-amount/{pair}`, `GET /v1/currencies/{ticker}` on
  api.changenow.io — all minimums and the XLM memo metadata above.
- ChangeNOW API overview / integration guide:
  https://changenow.io/blog/how-to-use-exchange-api-changenow
  (free key from a Business account; endpoints for currencies, estimate,
  create, status).
- SideShift live API (no key): `GET /v2/coins`, `GET /v2/pair/...`,
  `GET /v2/permissions` on sideshift.ai — pair minimums/rates, memo
  networks, region gating.
- SideShift docs: https://docs.sideshift.ai/faq/ (auth model: own Ed25519
  keypair, one account for all users), /api-intro/shift-integration-guide/
  (fixed = quote then shift; variable = priced on receipt),
  /endpoints/v2/requestquote/ (default commission 0.5%, max 2%),
  /api-intro/rate-limits/ (5 shifts/min, 5 open variable shifts),
  /changelog/ (pair endpoints require affiliateId + secret since 2025-05).
- Nanswap: nanswap.com/API (docs behind Postman link); live probes of
  api.nanswap.com/v1/get-estimate and /v1/get-limits failed to validate any
  XLM/SOL→USDT pair.
- Reference prices: CoinGecko public simple/price, 2026-11-01.

---

## 7. Phase 0 — live test protocol (added 2026-11-01)

Goal (updated per the §8 revision): measure the **actual** all-in fee drag
of a ChangeNOW XLM→BNB(BSC) swap at the ~$5 size before any fee number is
ever shown to users — this is now the single provider leg of the primary
flow. The user
runs the test themselves through ChangeNOW's public website flow
(changenow.io) — no API key is involved. (This complements the API-based
Phase 0 in §6; the website run measures the same standard/floating flow a
user would get, and needs no business account setup first.)

### 7.1 Pre-test quotes (measured keyless, 2026-11-01 09:24 UTC)

Test size: $5 ÷ $0.16913/XLM = 29.57 XLM → test amount fixed at **30 XLM**
(mid value $5.0739). Mid prices sampled at 09:24:15Z and again at 09:24:31Z,
unchanged: XLM $0.16913, BNB $710.76 (CoinGecko simple/price).

| Pair | Endpoint (no key) | Input | Quoted output | Value at mid | Quote-implied drag |
|---|---|---|---|---|---|
| XLM→USDT (BSC), floating | `GET /v1/exchange-amount/30/xlm_usdtbsc` (HTTP 200) | 30 XLM | **4.9996707 USDT** | $4.9997 | **≈ 1.46%** |
| XLM→BNB (BSC), floating | `GET /v1/exchange-amount/30/xlm_bnbbsc` (HTTP 200) | 30 XLM | **0.0070298 BNB** | $4.9965 | **≈ 1.53%** |

Drag formula: (mid value of input − mid value of quoted output) ÷ mid value
of input. Both quotes also returned `transactionSpeedForecast: "10-60"`
(minutes).

- **Fixed-rate quotes are NOT obtainable keyless**: `/v2/exchange/estimated-amount`
  returns 401 for both `flow=standard` and `flow=fixed-rate`, and
  `/v2/exchange/range` with `flow=fixed-rate` also returns 401. Fixed-rate
  measurement waits for the partner API key.
- Live minimums re-confirmed in the same session via `/v2/exchange/range`
  (standard flow): XLM→USDT(BSC) min 0.2850925 XLM, XLM→BNB(BSC) min
  0.2494201 XLM — the 30 XLM test is ~100× above both.
- These drags are **quote-implied only**. The v1 estimate already nets out
  ChangeNOW's in-rate fee, but the real received amount can differ (rate
  moves between quote and deposit receipt; payout network fee handling).
  The live test below measures the real thing — that is its whole point.
- **Per the §8 revision, the live test targets the XLM→BNB quote** (second
  row, expected ≈ 0.0070298 BNB for 30 XLM). The XLM→USDT quote stays in
  the table as the split design's comparison point (≈ 1.46%).

### 7.2 Steps for the user (website flow)

Safety lines first, non-negotiable:

- **Verify the payout address character-by-character** against your
  GuppyWallet address before confirming the exchange. A typo sends the
  BNB to someone else, permanently.
- **The memo is mandatory.** ChangeNOW gives you a deposit address AND a
  memo for XLM. Send both, exactly as shown. A missing/wrong memo means
  the deposit cannot be matched to your exchange.
- **Test amount only** — 30 XLM (≈ $5). No more, whatever the quote says.

Steps:

1. On changenow.io, set up an exchange: **You send: XLM (Stellar)**,
   **You get: BNB (BSC / BEP20)**. Enter **30 XLM**. (Per §8 this single
   BNB payout is the whole provider leg now — there is no second order.)
2. Choose the **standard (floating) rate** flow, so the result is
   comparable with the quotes in §7.1. (If you pick fixed rate instead,
   record the site's quoted amount — the evaluation then uses that quote.)
3. Enter your **payout address**: your own BSC address (the same EVM
   address as your GuppyWallet account). Verify it character-by-character.
   No refund address / extra fields unless the site requires them; if it
   asks for a refund address, use your own Stellar address.
4. On the confirmation screen, **record the quoted "you get" amount** and
   the exchange ID (see §7.3) *before* sending anything.
5. The site shows a **deposit address and a memo**. From your own Stellar
   wallet, send **30 XLM** to that address **with that exact memo**.
6. Wait. The exchange page tracks progress (confirming → exchanging →
   sending). Forecast is 10–60 minutes. Do not send again.
7. When it completes, check your BSC address (wallet or BscScan) for the
   incoming BNB and record the actual received amount + payout tx hash.
   (The wallet-side BNB→USDT swap that follows in the real flow is *not*
   part of this test — its cost was measured separately from live
   PancakeSwap quotes, see §8.2.)

### 7.3 Record sheet (fill in during the test)

| # | Value | Yours |
|---|---|---|
| 1 | Date/time the exchange was created (with timezone) | |
| 2 | Flow chosen (floating / fixed) | |
| 3 | Quoted "you get" amount shown on the site (BNB) | |
| 4 | Exchange ID | |
| 5 | Deposit address + memo shown (yes, write both down) | |
| 6 | Amount of XLM actually sent | |
| 7 | Time the XLM was sent (with timezone) | |
| 8 | Stellar deposit tx hash | |
| 9 | **Actual BNB received** (from your BSC wallet / BscScan) | |
| 10 | Payout tx hash (BSC) | |
| 11 | Elapsed time: XLM sent → BNB arrived | |
| 12 | Anything odd (extra confirmations, support contact, KYC prompt) | |

Optional second run (same sheet): XLM→USDT(BSC) with another 30 XLM, to
keep a direct measured comparison against the old split design's
quote-implied ≈ 1.46% (§7.1).

### 7.4 Evaluation

Computed from the record sheet:

- **All-in drag** = (mid value of XLM sent, at send time − $ value of BNB
  actually received) ÷ mid value of XLM sent. BNB is valued at the
  CoinGecko mid at receipt time — record that mid price alongside row 9,
  since BNB is not dollar-pegged and its move during the test window is
  not the provider's fee.
- **Quote accuracy** = received ÷ site-quoted amount (floating flow: small
  deviations either way are normal; a big shortfall is not).

Decision thresholds (at the $5 test size, where percentage drag is worst):

- **Drag ≲ 2.5% → proceed.** Set the planning fee figure to the measured
  value and move to Phase 1.
- **Drag 2.5–4% → flag.** Workable, but re-check the split math (§3) and
  the ~2% planning figure before showing users any numbers; consider
  whether fixed-rate (once the key exists) closes the gap.
- **Drag > 4%, or payout never arrives / needs support intervention →
  stop.** Re-evaluate providers (SideShift fallback, §1) before building
  anything on top.

Also pass/fail, regardless of drag: the per-order memo worked unattended,
the payout landed at the exact address given, and elapsed time stayed
within roughly the 10–60 min forecast. Any KYC prompt during a plain $5
swap gets recorded in row 12 and reported — it changes the UX copy in §4.

---

## 8. Revision (2026-11-01) — BNB-first flow is now the primary design

The user revised the flow: instead of splitting at the provider into two
orders (XLM→USDT + XLM→BNB), make **one** provider order into BNB, and do
the USDT conversion inside the wallet on BSC, where the gas part can be
kept back precisely. This section supersedes §2/§3/§6 where they conflict.

### 8.1 The revised flow

1. **One provider order** (ChangeNOW): SOL/XLM → **BNB (BSC)**. One
   deposit address, and for XLM exactly **one memo**.
2. **BNB arrives** at the user's BSC address (order-status polling sees
   the payout; the arrival-banner pattern from v0.1.9 applies — note
   v0.1.9's detection watches USDT/USDC balances, so native-BNB arrival
   is tracked via the order record + balance check, same pattern).
3. **Guided in-wallet swap step**: "Convert to USDT — gas money is kept
   automatically." With live prices the app keeps back enough BNB to
   clear the $1 gas gate with buffer (rule in §8.4) and swaps the rest
   **BNB→USDT on PancakeSwap V2 (BSC)**. One ConfirmTx + auth, as always.
4. **USDT is in the same wallet seconds later** → the existing one-tap
   bridge handoff to 42 Chain, unchanged.

New build work this implies:

- **BSC becomes a swap-capable chain config.** Today BSC/ETH are
  signer-only configs used by the inbound bridge. PancakeSwap V2 router
  `0x10ED43C718714eb63d5aA57B78B54704E256024E`, path WBNB
  `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` → BSC USDT
  `0x55d398326f99059fF775485246999027B3197955` (**18 decimals on BSC** —
  do not confuse with the 42-Chain-side token accounting).
- **Same Uniswap V2 ABI family the app already runs** for Don't Panic
  (42 Chain) and QomSwap (QL1): `getAmountsOut` for the preview,
  payable `swapExactETHForTokens` for execution (native BNB in, so no
  WBNB wrap/approval step). This is reuse of a proven code path, not a
  new integration.

### 8.2 Measured cost of the BSC leg (live, 2026-11-01 09:28 UTC)

Read-only `eth_call` to the PancakeSwap V2 router via BSC public RPC;
CoinGecko BNB mid sampled in the same run: **$709.82**. BSC gas price at
sample time: **0.05 gwei** (confirmed identical on two public RPCs).

| Swap size | Mid value in | Quoted USDT out | Measured drag vs mid |
|---|---|---|---|
| 0.005 BNB | $3.5491 | 3.548940 USDT | **≈ 0.005%** |
| 0.05 BNB | $35.491 | 35.489328 USDT | **≈ 0.005%** |

Read this honestly:

- The near-zero measured drag is **not** the structural cost. The quote's
  implied pool spot was ≈ $711.6/BNB — about 0.25% *above* the CoinGecko
  mid at that moment — which cancelled the 0.25% V2 swap fee. The basis
  will not always be favourable; **plan on the structural 0.25% fee**.
- Price impact is negligible at these sizes: both quotes imply the same
  effective rate (709.788 USDT/BNB) — the WBNB/USDT pool is deep relative
  to anything this feature will route.
- Swap gas: ~150k gas × 0.05 gwei ≈ 0.0000075 BNB ≈ **$0.005** — sub-cent
  at current prices; even at 20× the current gas price it is ≈ $0.11.
  It is paid out of the kept BNB, never out of the USDT proceeds.

**End-to-end drag at the $5 test size** (on the portion that ends as
USDT), combining §7.1's measured ChangeNOW XLM→BNB quote (drag ≈ 1.53%):

| Design | Leg 1 | Leg 2 | Combined |
|---|---|---|---|
| Split (§2, old) | XLM→USDT direct | — | **≈ 1.46%** |
| BNB-first (§8) | XLM→BNB ≈ 1.53% | PancakeSwap, measured ≈ 0.005% | **≈ 1.54%** |
| BNB-first, worst case | XLM→BNB ≈ 1.53% | full structural 0.25% | **≈ 1.78%** |

So the revised flow costs roughly **+0.1pt over the split design on
measured numbers, +0.3pt in the worst case**, plus cents of swap gas.
That is the price of deleting the second order — see §8.3 for why it's
worth it.

### 8.3 Honest assessment

**Speed.** The split design's two provider orders ran *in parallel*, so
the revised flow is not a dramatic speed-up: it is sequential (provider
payout, then the DEX swap). But the DEX leg takes seconds, so end-to-end
time is effectively the same single provider wait, with one less
third-party order that can be delayed, held, or mismatched.

**Wins.**

- **The two-memo trap disappears.** §4's worst failure case — two XLM
  deposits, two different memos, user mixes them up — cannot happen.
  There is one deposit address and one memo, full stop.
- **No $15 split minimum.** A single order's provider minimum is
  ~$0.04–0.50, so the flow works at the $5 test size and below the old
  threshold: $5 → ≈ 0.00703 BNB → keep ≈ $1.50 of BNB → swap ≈ 0.0049
  BNB → ≈ 3.49 USDT → bridge. §3's small-deposit fallback ("everything
  arrives as USDT, find gas somewhere else") is deleted.
- **The gas remainder is set precisely at swap time**, from the amount
  that actually arrived and live prices — not estimated pre-fee before
  the provider leg, as the split had to do.
- Provider-fallback math simplifies: SideShift's ~$3 minimums no longer
  bind a tiny gas order, because there is no gas order.

**Costs / risks.**

- The extra ~0.25% DEX fee and cents of gas quantified in §8.2.
- **BNB price drift**: between payout and the user's swap tap, the whole
  deposit rides BNB volatility. Prompting immediately (arrival banner →
  swap step) shrinks the window; it does not eliminate it. The preview
  must show the live quote, never the order-time estimate.
- **BSC swap support is new build work** (swap-capable BSC config,
  preview/confirm wiring, tests). The split design needed none of it.
- **"Auto" still means the user's signature.** Arrival can be detected
  automatically; the swap and the bridge are still two ConfirmTx
  approvals with fresh auth. The honest product description is
  *detect → one guided sequence*, never unattended execution.

### 8.4 What changes elsewhere in this doc

- **§2 flow**: steps 3–5 (split preview, dual instruction cards with two
  memos) are replaced by: single instruction card → arrival → the
  swap-with-keep step → bridge handoff.
- **§3 split math**: superseded by a swap-time keep rule (proposal):
  keep the BNB amount worth **~$3** at live prices (target ≈ 3× the $1
  gate, same buffer logic as §3); if the total arrival is under ~$4,
  keep ~$1.50 so a meaningful USDT amount still results; if the arrival
  is under ~$1.50 in total, keep it all as gas and say so plainly.
- **§4 failure table**: the "only one of the two orders completes" row no
  longer applies. Memo-forgotten remains the top risk, but it now
  concerns exactly one memo. A new row appears instead: "BNB arrived,
  user never does the swap step" → funds sit as BNB in the user's own
  wallet (no loss, no expiry); the banner stays until they act.
- **§6 phases**: Phase 1's single payout is now BNB, and the BSC swap
  step joins Phase 1 (without it, Phase 1 delivers gas money, not a
  bridgeable deposit). Old Phase 2 (gas split, dual orders) is deleted;
  its effort moves to the BSC swap build. Phase 0 (§7) tests XLM→BNB
  only.

---

## 9. Alternatives to ChangeNOW (added 2026-11-01)

The user pushed back on ChangeNOW being a company counterparty ("too
centralised") and asked what else exists. This section covers the
protocol / liquidity-network routes (Track A) and re-states the
company-type runners-up (Track B), plus XRP as a third source asset
(§9.5, added at the user's follow-up request).

**Verification caveat, up front.** The public THORNode / Midgard
gateways (thornode.ninerealms.com, midgard.ninerealms.com, THORSwap
mirrors) were **unreachable from this machine** during this pass —
connection failures and bot walls; the Liquify gateway answered
`403 "Chain not publicly accessible"`. So, unlike §1/§7/§8, **no
THORChain figure below was measured live**; THORChain content is from
its dev docs and dated reporting, and is labelled accordingly.
ChangeNOW XRP figures in §9.5 *were* measured live and keyless, in
the same style as §7.1.

### 9.1 Comparison table

| Route | Sources → BSC | Counterparty / trust model | Account / key needed | Minimums & fees (measured unless noted) | Integration effort | Verdict |
|---|---|---|---|---|---|---|
| **ChangeNOW** (reference, §1/§8) | SOL, XLM, XRP ✓ | One company (CHN Group LLC), custodial in-flight, risk-based KYC holds | Free partner API key; low-privilege, proxy recommended | Mins ≈ $0.04–0.50 measured; quote-implied drag 0.8–1.5% measured (§7.1, §9.5) | Low–medium: proxy + order/status polling (already designed) | The workable default today — but it is exactly the centralised leg the user objects to |
| **THORChain** | SOL ✓; XRP ✓ (pool exists); XLM ✗ (no Stellar support); → BNB ✓ and USDT-BSC ✓ as pools | No company: validator set (TSS) holds vaults in-flight; pooled protocol custody for minutes, no balance sheet, no KYC | **None.** THORNode REST is public and keyless — anyone can call quote / inbound-addresses / pools endpoints | No fixed USD min: operative minimum is the quote's `recommended_min_amount_in` (dust + fees). Fees = inbound gas + slip-based liquidity fee + outbound fee with a **$1.00 floor** (dev docs). Not measured live (see caveat) | **Lowest infra effort of all** (no key, no proxy) — but the send step needs a memo-capable source wallet (see §9.2) | Right protocol, fragile moment: only behind a hard live-status gate (§9.2, §9.6) |
| **Chainflip** | SOL ✓ (live); XLM ✗; XRP ✗; → BSC: **not confirmable as live** (see §9.3) | No company custody: validator-set threshold vaults; no protocol-level KYC/geoblock (their docs) | **Broker account required** to open deposit channels (State Chain account; Chainflip's hosted broker is the SDK default, your own broker needs a FLIP-funded account) | Flat **0.10% protocol fee** + network fees both chains + optional broker commission in bps (published, not measured) | Medium: official TS SDK, but broker relationship + BSC unverified | Not usable for SOL→BSC today because the destination leg can't be confirmed live; best future protocol option |
| **Allbridge** (Stellar route) | XLM → USDC on Stellar (SDEX) → BSC: **route not verified; Core's Stellar support currently suspended** (§9.4) | Mixed: value moves via Circle CCTP burn-and-mint (Circle's attestation service is the trust anchor); Allbridge (a team/company) provides contracts, relayers, front-end | None for the web app; no verified embeddable API for this route | Next fees "typically 0.1%" (Allbridge-published); SDEX leg ~spread only | **Not embeddable today** — manual two-app flow (Stellar wallet + Allbridge web app) | The closest thing to a non-custodial XLM exit, and it still isn't buildable right now |
| **SideShift.ai** | SOL, XLM, XRP ✓ | One company — **Paradigm Ltd** (Basseterre, Saint Kitts & Nevis), founded 2019 by Andreas Brekken; custodial in-flight, risk-based KYC pauses | Account secret / Ed25519 signing key — **server-side only, proxy mandatory** | Mins ≈ **$3.00** measured (XLM→BNB, SOL→BNB); all-in drag **1.9–2.1% measured** vs CoinGecko mid | Medium: good docs, but proxy for everything + region gating (`/v2/permissions` returned `createShift: false` from this machine) | Most transparent operator in the company category ($3B+ volume, integrated by Trezor / Edge / Bitcoin.com) — still a company, and region-gated |
| **SimpleSwap** | SOL, XLM, XRP ✓ | One company (operating since 2018; operator/jurisdiction not prominently disclosed), custodial in-flight | Free partner API key | Not probed (needs key signup) | Low (same shape as ChangeNOW) | Same model as ChangeNOW with the category's worst public record of post-deposit KYC holds and refund friction in user reports — no reason to prefer it |
| **StealthEX** | SOL, XLM, XRP ✓ | One company (since 2018), custodial in-flight | Free partner API key | Not probed | Low (same shape) | Unremarkable: no standout exploit found in this pass, but nothing measured beats ChangeNOW either |
| **FixedFloat** | SOL, XLM, XRP ✓ | One company (lean-attribution team), custodial in-flight | HMAC API secret — server-side only | Not probed | Low–medium | **Clearest red flag in the set**: hot-wallet exploits in Feb 2024 (≈ $26.1M) and again Mar 2024 (≈ $2.8M) by the same attacker, root cause blamed on its hosting provider. Ruled out |

### 9.2 THORChain — detail

- **Coverage.** Solana is a first-class THORChain chain (native SOL
  swaps went live 2026-02-26; EdDSA vaults). BSC is in-protocol:
  `BSC.BNB` and `BSC.USDT-0x55D398…` pools exist in the asset
  registry, so SOL→BNB and SOL→USDT(BSC) are both expressible as a
  single swap memo (`=:BSC.BNB:<dest>:…`). XRP Ledger is also
  supported (§9.5). Stellar/XLM is **not** supported at all.
- **API shape.** Everything an interface needs is on the public
  THORNode REST API, callable by anyone with no account and no key:
  `GET /thorchain/quote/swap?from_asset=SOL.SOL&to_asset=BSC.BNB&amount=<1e8 units>&destination=<addr>`
  returns the expected output, itemised fees and
  `recommended_min_amount_in`; `GET /thorchain/inbound_addresses`
  returns each chain's current vault address, gas rates, outbound
  fees and dust thresholds; swap status is trackable via THORNode /
  Midgard. For GuppyWallet this is strictly *less* infrastructure
  than ChangeNOW: no partner key, so **no proxy is needed at all**.
- **How a deposit works.** The user sends the native asset to the
  chain's Asgard vault address with a memo stating intent —
  `SWAP:<asset>:<destination>:<limit/streaming>:<affiliate>:<fee bps>`
  (shorthand `=`). A missing/invalid memo does not lose the funds:
  the protocol refunds, minus the source chain's outbound fee (dev
  docs). That is a materially better failure mode than a pooled
  exchange address where a forgotten memo means a support ticket.
- **The catch is the sending wallet, not the API.** The memo must
  ride inside the user's source-chain transaction. On Solana that
  means a memo-program instruction bundled with the transfer —
  something plain consumer Solana wallets generally don't expose in
  a send screen, so in practice the user needs a THORChain-aware
  interface to construct the send, or THORChain's newer *memoless*
  flow (the interface pre-registers the intent and the user sends an
  exact amount encoding a reference ID; 6-hour TTL, single use).
  Either way this is real UX work on the send side, and it is the
  main reason "lowest infra effort" ≠ "lowest total effort".
- **Fees / minimums (dev docs, not measured).** Four components:
  inbound gas (paid by the user on the source chain), liquidity fee
  = slip created vs pool depth (a mimir-set minimum in bps applies),
  optional affiliate fee (we would set 0), outbound fee with a
  **$1.00 minimum**. There is no fixed USD minimum swap; the
  quote's `recommended_min_amount_in` is the operative floor. At
  our $5 test size the fixed outbound/inbound costs dominate, so
  the *percentage* drag at $5 will look worse than at $100 — the
  opposite profile from a percentage-fee exchanger.
- **Operational history, one line.** Two exploits in 2021 and
  recurring halts since; a GG20/TSS vault exploit on 2026-05-15
  drained ≈ $10.7M from one of six Asgard vaults and halted the
  network for ~5 weeks (trading resumed 2026-06-23, with BNB / Base
  / Solana resumption tied to the v3.20 upgrade on 2026-08-25);
  a third-party integration report in autumn 2026 still flagged BSC
  as `chain_trading_paused`; and on **2026-10-31 — the day before
  this section was written — an Ethereum reorg caused a double
  refund of a 10 ETH deposit and THORChain emergency-paused swaps
  on 12 of 13 chains** (this pause type runs up to 720 blocks,
  ~1.5 h, extendable by node votes). Whether BSC trading is open
  at any given moment is a live-status question, not a design
  assumption.

### 9.3 Chainflip — detail

- **Coverage.** Source side is fine: native SOL (plus USDC/USDT on
  Solana) is live. The problem is the destination: Chainflip's own
  guides say BSC swaps "will in October 2026" be supported and its
  Q3 2026 report frames BNB Chain mainnet as a Q4 goal, while a
  2026-09-08 market-news item claims mainnet activation and the
  roadmap page crawled 2026-10-31 still lists "New Chain: BNB"
  under *in progress*. These conflict; from here, **BSC cannot be
  confirmed live**, so SOL→BSC via Chainflip is not a route today.
- **Deposit channels need a broker.** Channels (the per-swap deposit
  addresses) are opened by a *broker* — a State Chain account. The
  official SDK (`@chainflip/sdk`: `getQuoteV2`,
  `requestDepositAddressV2`, `getStatusV2`) defaults to Chainflip's
  hosted broker endpoints; running your own broker (e.g. to set
  commission) means registering a broker account and keeping it
  funded with FLIP, because the broker pays a channel-opening fee
  per channel. There is no keyless way to open channels — an
  account relationship exists either way, although the broker never
  holds user funds (the validator set's threshold vaults do,
  in-flight).
- **Fees (published).** Flat 0.10% protocol fee + network fees on
  both chains + optional broker commission set in bps at channel
  opening. On paper the cheapest fee schedule in this section.

### 9.4 Allbridge — the Stellar route, honestly

- **What the route would be.** (1) Inside a Stellar wallet, swap
  XLM → USDC on Stellar's built-in DEX (a SDEX path payment —
  LOBSTR and peers offer this as a normal in-wallet swap; fully
  on-chain, no counterparty). (2) Move USDC from Stellar to BSC.
  (3) Land as USDC/USDT on BSC → existing §8 swap/bridge steps.
- **Why it isn't currently real.** Allbridge reshaped its products
  in 2026: Classic is deprecated (shutdown Nov 2026); Core's
  liquidity pools were **discontinued after a July 2026 exploit**,
  and Core now routes through issuer mechanisms (Circle CCTP,
  xReserve, LayerZero OFT). Crucially, **Core's Stellar support is
  listed as "temporarily unavailable"** — its Stellar CCTP
  implementation is awaiting an audit (Allbridge docs, via
  Oct 2026 reporting). The successor product, **Allbridge Next**,
  lists Stellar as supported and integrated Circle CCTP for Stellar
  USDC in June 2026 (native burn-and-mint, no wrapped asset), and
  team examples include XLM → USDC (Arbitrum) and USDT (Polygon) →
  BNB Chain — but a Stellar → BSC route via Next was **not
  explicitly verified** in this pass.
- **Trust model, one line.** For the CCTP path the value itself
  moves by Circle burn-and-mint, so the trust anchor is Circle's
  attestation service; Allbridge's own contracts/relayers and web
  app orchestrate — no pooled bridge custody in the new model, but
  the front-end and operator are still one team's.
- **How the user would perform it.** Manually, in two apps
  (Stellar wallet for the SDEX leg, Allbridge web app for the
  bridge leg; Next also advertises a destination-gas top-up
  feature). There is no verified API/SDK path for this route that
  GuppyWallet could embed today. Fees: Next "typically 0.1%"
  (Allbridge-published) plus the SDEX leg's spread.

### 9.5 XRP as a third source asset (follow-up, measured 2026-11-01)

XRP changes nothing about the provider ranking, but it is fully
viable on both leading routes, and it is the most mainstream of
the three source assets for a Japanese user.

- **ChangeNOW (measured live, keyless, 2026-11-01; XRP $1.25 /
  ¥197, CoinGecko):**
  - XRP→BNB(BSC) minimum **0.0337 XRP ≈ $0.04**; XRP→USDT(BSC)
    minimum **0.0386 XRP ≈ $0.05** — the same negligible class as
    XLM's minimums (§1), far below SideShift-style $3 floors.
  - Quote for 30 XRP ($37.50 at mid): **37.1996 USDT** out
    (quote-implied drag **≈ 0.80%**) and 0.0522671 BNB out —
    slightly *better* than the measured XLM quotes (1.46–1.53%,
    §7.1). Same 10–60 min speed forecast. Quote-implied only, as
    always.
  - **Destination tag = the XLM memo problem, renamed.** XRP
    currency metadata (`hasExternalId: true`) carries ChangeNOW's
    own warning: "Please don't forget to specify the Destination
    Tag while sending the XRP transaction for the exchange." The
    deposit goes to a pooled address and the per-order **tag** is
    what matches it — so all of §2/§4's memo handling (per-order
    tag shown separately, cannot-miss warning, support-only
    recovery) applies to XRP verbatim. (A tag on the *payout* side
    only matters when receiving into a shared/exchange address;
    our payout is the user's own BSC address, so it doesn't arise.)
- **THORChain (docs/SwapKit, not measured):** XRP Ledger is a
  supported THORChain chain with an XRP/RUNE pool (native XRP
  swaps, e.g. via the SwapKit THORCHAIN provider). The deposit
  model differs from ChangeNOW's in a way that removes the tag
  trap: only `Payment` transactions are observed, addresses are
  classic "r…" form, and the swap intent is carried in the
  transaction's **Memo field** (first Memo, ≤ 250 chars) — *not*
  the destination tag (dev docs: "Avoid destination tags unless
  required by receiving wallet"). Dust threshold: **< 1 XRP is not
  processed**, and ≥ 1 XRP must remain as the account reserve in a
  fresh address. Fees follow the standard model (XRPL base fee
  ~0.00001 XRP + slip-based liquidity fee + outbound fee, $1
  floor). Caveats: the sending wallet must support attaching a
  Memo to an XRPL Payment (Xaman-class wallets do; Japanese
  exchange withdrawal screens typically expose a *destination tag*
  field, and a free-text Memo field is less commonly offered —
  so the realistic THORChain-XRP sender is a self-custody wallet,
  not an exchange withdrawal), and all of §9.2's halt caveats
  apply unchanged.
- **Entry barrier for a Japanese user — XLM vs XRP vs SOL**
  (prices measured 2026-11-01: XLM ¥26.6, XRP ¥197, SOL ¥15,042;
  exchange facts from Oct 2026 fee comparisons): availability no
  longer separates them — all three are listed at Coincheck,
  GMOコイン and bitFlyer. What separates them is the cost of a
  first small experiment, which is set by each exchange's
  withdrawal fee *and minimum send*, since the networks' own fees
  are negligible for all three (XRP 0.00001 XRP, XLM 0.00001 XLM,
  SOL ~0.000005 SOL per transaction). GMOコイン withdraws
  everything free but enforces large minimums (50 XRP ≈ ¥9,900;
  0.1 SOL ≈ ¥15,000). bitFlyer withdraws all three free with much
  smaller minimums (20 XRP ≈ ¥3,900; 2 XLM ≈ ¥53; 0.002 SOL
  ≈ ¥30). Coincheck charges per send (0.15 XRP ≈ ¥30; 0.01 XLM
  ≈ ¥0.3; 0.01 SOL ≈ ¥150). Net: **XLM is the cheapest possible
  first test** (a ~¥50-scale send can leave bitFlyer), **XRP is a
  close second** and the most widely held/listed of the three in
  Japan, held back only by those ¥4,000–10,000 minimum sends at
  the free-fee venues, and **SOL is the most expensive to
  experiment with** — highest unit price and the largest typical
  withdrawal fee in yen terms, even though its availability is
  now fine.

### 9.6 Bottom line by source asset

- **SOL → THORChain, behind a status gate; ChangeNOW as the
  automatic fallback.** THORChain is the only route with no
  company counterparty, and paradoxically the simplest to
  integrate (public keyless API — no key, no proxy, no secret to
  protect). But its 2026 record — the May vault exploit and
  ~5-week halt, autumn reports of BSC still paused, and an
  emergency pause on 12 of 13 chains the day before this was
  written — means it may only ship behind a hard pre-send check
  (pool `Available`, chain trading not halted, quote succeeds)
  with honest "the network is paused right now" copy and
  ChangeNOW offered instead. If the user's position is
  "non-custodial or nothing", that gate *is* the feature.
  Chainflip becomes the cleaner second protocol option the day
  its BSC support is verifiably live (and we accept the broker
  account).
- **XLM → no non-custodial route exists today; say so plainly.**
  Neither THORChain nor Chainflip supports Stellar at all. The
  closest construction — SDEX (XLM→USDC on Stellar) + Allbridge
  Next/CCTP (USDC Stellar→BSC) — is currently blocked on
  Allbridge's side (Core's Stellar support suspended pending its
  CCTP audit; the Next Stellar→BSC route unverified) and would in
  any case be a manual two-app flow GuppyWallet cannot embed.
  For XLM, **ChangeNOW remains the only workable route**; the
  decentralised XLM exit is a watch item (Allbridge's Stellar
  CCTP audit completing), not a buildable feature.
- **XRP → same ranking as SOL/XLM, best JP on-ramp of the
  three.** Available on ChangeNOW today with measured ~$0.04–0.05
  minimums and a sub-1% quote-implied drag, and on THORChain
  behind the same status gate (with the nicer memo-field model
  instead of a destination tag). If the goal is lowering the
  entry barrier for Japanese users specifically, XRP is at
  least as good a default source as XLM — and more of them
  already hold it.

### Sources (§9, checked 2026-11-01)

- THORChain dev docs (dev.thorchain.org): Fees (four fee
  components, $1.00 outbound-fee minimum, `recommended_min_amount_in`
  guidance), Transaction Memos (`SWAP:ASSET:DESTADDR:…` format,
  250-byte limit), Sending Transactions (XRP: Payment-only,
  DestinationTag note), address-format table (XRP: classic Base58,
  avoid destination tags).
- THORChain status/history reporting: Solana go-live 2026-02-26
  (THORChain announcement); May 2026 vault exploit ≈ $10.7M,
  ~5-week halt, trading resumed 2026-06-23, v3.20 (2026-08-25)
  covering BNB/Base/Solana resumption (THORChain Exploit Report
  #1 and press coverage); BSC `chain_trading_paused` flag in a
  third-party integration status table (swapsack, Oct 2026);
  emergency pause on 12 of 13 chains after an Ethereum-reorg
  double refund, 2026-10-31 (Crypto Briefing / Chainalysis
  reporting).
- THORNode reachability: direct curl attempts from this machine
  to thornode.ninerealms.com, midgard.ninerealms.com,
  thornode.thorchain.info, thornode.thorswap.net (connection
  failures / bot wall) and gateway.liquify.com (403) — 2026-11-01.
- Chainflip: chainflip.io guides and Q3 2026 report (BSC "will in
  October 2026" / Q4 mainnet goal; 0.10% flat protocol fee),
  roadmap page crawled 2026-10-31 (BNB Chain still "in progress"),
  2026-09-08 market-news item claiming BSC mainnet activation;
  docs via the chainflip-sdk-monorepo (broker-opened deposit
  channels, channel-opening fee, SDK methods).
- Allbridge: Allbridge docs and Oct 2026 reporting — Core pools
  discontinued after the July 2026 exploit; Core Stellar support
  "temporarily unavailable" pending its CCTP audit; Next lists
  Stellar, integrated Circle CCTP for Stellar USDC (June 2026),
  fees "typically 0.1%"; Classic shutdown Nov 2026.
- SideShift operator: Paradigm Ltd, Basseterre, Saint Kitts &
  Nevis; founder Andreas Brekken; $3B+ lifetime volume; Trezor /
  Edge / Bitcoin.com integrations (SideShift announcements and
  2026 reviews). Measured pair data remains §1's.
- FixedFloat exploits: Feb 16–17, 2024 ≈ $26.1M (409 BTC +
  1,728 ETH) and Mar 31, 2024 ≈ $2.8M, same attacker (FixedFloat
  statements; SlowMist commentary).
- XRP measurements: ChangeNOW live API (no key), 2026-11-01 —
  `GET /v2/exchange/range` (xrp→bnb/bsc, xrp→usdt/bsc),
  `GET /v1/exchange-amount/30/xrp_bnbbsc` and `…/xrp_usdtbsc`,
  `GET /v1/currencies/xrp` (destination-tag warning,
  `hasExternalId: true`). THORChain XRP: SwapKit's XRPL
  integration notes (XRP/RUNE pool, Memo-field routing, <1 XRP
  dust threshold, 1 XRP reserve) + THORChain dev docs.
- Japan availability/fees: Coincheck and GMOコイン listing tables
  and fee pages; bitFlyer fee page (XRP/XLM withdrawals free,
  minimums 20 XRP / 2 XLM); Oct 2026 Japanese fee comparisons
  (GMO minimum sends 50 XRP / 0.1 SOL; Coincheck sends 0.15 XRP /
  0.01 XLM / 0.01 SOL). Prices: CoinGecko, 2026-11-01.

