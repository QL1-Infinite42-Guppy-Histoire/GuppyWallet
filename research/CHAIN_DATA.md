# Chain Data Research — Task A (2026-10-30)

Read-only research. Every value below carries its source; nothing is guessed.
Checks were run on 2026-10-30 (JST) from this VM.

---

## 1. QL1 Cosmos parameters — RESOLVED

| Item | Value | Source |
|---|---|---|
| Cosmos chain ID | **`qom_766-1`** | QL1 genesis served by the chain's CometBFT RPC: `GET https://rpc.foxxone.one/genesis` → `"chain_id":"qom_766-1"`. Also used throughout the official QL1 validator guide (`--chain-id=qom_766-1`): https://qom.network/docs/set-up-validator-node/ |
| Base denomination | **`aqom`** | Same genesis: `app_state.staking.params.bond_denom = "aqom"` (bank supply/balances also in `aqom`). Validator guide: balances "displayed in units of `aqom`" |
| Decimals (base→display exponent) | **18** (1 QOM = 1 × 10¹⁸ aqom) | QL1 validator guide, verbatim: "1 QOM = 1 × 10¹⁸ aqom" and `--amount=1000000000000000000aqom` described as staking 1 QOM. https://qom.network/docs/set-up-validator-node/ |
| Bech32 prefixes | `qom` (accounts), `qomvaloper` (validators) | Same validator guide (addresses `qom1...`, `qomvaloper1...`) |
| Genesis time | 2024-05-28T22:33:01Z | `https://rpc.foxxone.one/genesis` |

This closes the long-standing `TODO_MT` for QL1 Cosmos ID / denom / decimals:
the values are publicly documented in QL1's own docs and genesis — MT
confirmation is no longer required for these three items. (The wallet's
current assumption of 18 native decimals for QL1 was correct.)

### Cosmos chain-registry check
- Searched `github.com/cosmos/chain-registry`: scanned the full root directory
  listing via the GitHub API (8 pages × 100 entries) — **no entry matching
  qom / infinite / 42chain**. Direct candidate paths also 404:
  `qom/chain.json`, `qomnetwork/chain.json`, `ql1/chain.json`,
  `qomone/chain.json`, `infinite/chain.json`, `infinitedrive/chain.json`.
- Conclusion: **neither QL1 nor Infinite is published in the Cosmos chain
  registry** (as of 2026-10-30). Do not expect registry `apis` data for either
  chain.

---

## 2. Cosmos REST (LCD) endpoints — NOT PUBLISHED for either chain

Checked listings:

**Infinite**
- Official endpoint registry, https://console.infinitedrive.xyz/endpoints
  (fetched 2026-10-30): categories are exactly **evm-rpc, comet-rpc,
  cosmos-grpc, p2p-seeds**. No REST/LCD category or URL.
- Project research of https://assets.infinitedrive.xyz/mainnet/ and the Docs
  "RPC Servers" page (2026-10-30, see LINKS.md) showed the same four
  categories. (In this session the Assets page itself could not be
  text-fetched — JS-rendered/no extractable content — so the Console registry
  above is the directly verified source here.)
- Verdict: **no Cosmos REST (LCD) endpoint is published for Infinite.**
  Cosmos-side access is via gRPC (`https://grpc.infinitedrive.xyz` +
  mschihuahua / infinitepanda variants) or CometBFT RPC.

**QL1**
- FoxxOne's endpoint reference https://foxxone.one/rpc/ (fetched 2026-10-30)
  lists for QL1: EVM RPC `https://evm-rpc-ql1.foxxone.one`, Comet RPC
  `https://rpc.foxxone.one`, a "JSON-RPC" `https://json-rpc.foxxone.one`
  (listed separately from the EVM RPC; the page does not describe it as a
  Cosmos REST/LCD API), gRPC `rpc.foxxone.one:9090`, P2P. Community mirrors
  (AYC / Panda) list EVM + Comet (+ Panda gRPC `ql1grpc.infinitepanda.xyz`).
  **No REST/LCD URL appears anywhere on the page.**
- QL1 validator guide (qom.network) likewise references only CometBFT RPC
  servers (`rpc.foxxone.one`, `comet-rpc-ql1.mschihuahua.org`).
- Verdict: **no Cosmos REST (LCD) endpoint is published for QL1 either.**

Practical implication: any Cosmos-side queries in the app should use gRPC
(CosmJS Stargate clients can use gRPC-web only if a proxy exists — otherwise
use CometBFT RPC +amino/ABCI queries, or the EVM precompiles in §4).

---

## 3. Token decimals — ALL CONFIRMED = 18 via eth_call

Method: `eth_call` of `decimals()` (selector `0x313ce567`) and `symbol()`
(`0x95d89b41`) on 2026-10-30.
Infinite RPC: `https://evm-rpc-infinite.mschihuahua.org`.
QL1 RPC: `https://evm-rpc-ql1.mschihuahua.org`.
Every call succeeded (no failures/reverts). Raw decimals result for every
token: `0x…12` = **18**.

### Infinite (EVM 421018)

| Symbol (as listed) | Address | decimals() | symbol() returned on-chain | Note |
|---|---|---|---|---|
| FISH | 0x2c32120a12B754272d9E85C57F64b50cA2C43513 | 18 | FISH | |
| PANIC | 0xfAA842c8871f7F99c183F77871f79ce07DD056Cd | 18 | **DONT** | name() = "Dont Panic". The token's on-chain symbol is **DONT**, not PANIC — display code should use DONT or map explicitly |
| STARSHIP | 0x645D71e49B86CfBE3FB93081deC2c17a496Cd57d | 18 | STARSHIP | |
| ZAP | 0x89195Ca5C954b6f99b78f4A2Aa5435A75Dc5B256 | 18 | ZAP | |
| MARVIN | 0xa307362f8a756722541dde6255AECf64F35Ba337 | 18 | MARVIN | |
| FOXXEY | 0x68D5A28D3bf09a32d3b9C35714aB7A6166Ae2a00 | 18 | FOXXEY | |
| TOWEL | 0xD0f48123638BD243C3a0eE49D0D7BEb7404F9DE4 | 18 | TOWEL | |
| CAT42 | 0x7386719EBbBeB4d810fF89027Bfb8A1CDf696310 | 18 | CAT42 | |
| st42 | 0x78F40E828a92AF9e137FF7660E52Ac8B0f1D121E | 18 | **stC2** | name() = "Staked 42". On-chain symbol bytes decode to **stC2**, not "st42" — the "st42" label used in the UI/hub is a display name |
| QOM | 0x53465CbBBA5b14f5Dc00794330f0f4aFb30EAA1d | 18 | QOM | QOM token on Infinite |
| USDT | 0xC2684966e5c95B2bc636FB4a1f3Da9Ad23d94753 | 18 | USDT | Bridged USDT — note: 18 decimals here, unlike Ethereum USDT (6) |
| USDC | 0xea5b7fD59b7ec0F34663835A3a361F469C2D4c5C | 18 | USDC | Bridged USDC — 18 decimals here, unlike Ethereum USDC (6) |

### QL1 (EVM 766)

| Symbol | Address | decimals() | symbol() returned on-chain |
|---|---|---|---|
| ZAP | 0x6041B64618434B9D0a9558B5975C5c1DEb45CEE6 | 18 | ZAP |
| WQOM | 0xa26dfBF98Dd1A32FAe56A3D2B2D60A8a41b0bDF0 | 18 | WQOM |

Result: the whole listed token set is uniformly 18 decimals on-chain, so
per-token decimal handling is simple — but keep the two symbol quirks
(PANIC→DONT, st42→stC2) in mind for any code that keys off `symbol()`.

---

## 4. Staking method — evidence

### 4a. Infinite: EVM staking precompile EXISTS and is LIVE (proven on-chain)

- Framework documentation: Cosmos EVM (the stack Infinite's genesis matches —
  modules include `evm`, `erc20`, `precisebank`, `feemarket`) documents
  stateful precompiles with **Staking at
  `0x0000000000000000000000000000000000000800`** and Distribution at
  `0x…0801`: https://docs.cosmos.network/evm/v0.5.0/documentation/evm-compatibility/overview
  and https://docs.cosmos.network/evm/latest/documentation/getting-started/faq
- **Direct on-chain probe (2026-10-30, this research):** called
  `validators("BOND_STATUS_BONDED", pageRequest{limit:3})` on
  `0x0000000000000000000000000000000000000800` via
  `https://evm-rpc-infinite.mschihuahua.org`, using the `validators()`
  signature from cosmos/evm `precompiles/staking/StakingI.sol`
  (https://raw.githubusercontent.com/cosmos/evm/main/precompiles/staking/StakingI.sol,
  selector `0x186b2167`). The call returned structured data that decoded
  cleanly with the StakingI `Validator` struct:
  - total bonded validators: **23**
  - examples returned: "Metal Raptor" (operator
    0x1077c77b5E56Cea994e3F385e50F9Ff4Fa2e3514, tokens 14303×10¹⁸), "Popo"
    (0x27dc6759b32216c79E1E3A57cD64415E4136DDbE), "farmer"
    (0x46C7ca2E2ef5304CBF9BAF5ae2a2EDe7DCD5DE41)
  - Note: this implementation returns `operatorAddress` as a hex (0x) string
    rather than a bech32 `infinitevaloper1…` string — an implementation
    detail to handle in client code.
- **Conclusion (documented + proven):** on Infinite, delegation can be done
  from the EVM side via the standard Cosmos EVM staking precompile
  (`delegate` / `undelegate` / `redelegate` in StakingI), i.e. an ordinary
  EVM transaction to 0x…0800 — no Cosmos transaction construction is needed
  for the EVM-wallet flow. Cosmos-tx staking also exists at protocol level
  (genesis has a standard `staking` module: bond_denom `drop`, unbonding
  1814400s = 21 days, max_validators 100 — from
  https://assets.infinitedrive.xyz/mainnet/genesis.json), so both routes
  exist on paper; the precompile route is the one verified live here.
  Caveat: only read methods were probed (per read-only scope). A write-path
  test (`delegate` with a real account) was NOT performed.

### 4b. QL1: Cosmos-tx staking documented; 0x0800 precompile does NOT respond

- Official QL1 validator guide documents staking purely as Cosmos
  transactions with the chain binary: `qomd tx staking delegate
  qomvaloper1… <amount>aqom --chain-id qom_766-1`, `qomd tx staking
  create-validator …`, rewards via `qomd tx distribution withdraw-rewards …`.
  https://qom.network/docs/set-up-validator-node/
- **Direct on-chain probe (same method as 4a):** the identical
  `validators()` call to `0x0000000000000000000000000000000000000800` via
  `https://evm-rpc-ql1.mschihuahua.org` returned **`0x` (empty)** — the
  Cosmos EVM v0.5-style staking precompile does not answer on QL1 (QL1's
  QomApp is an older Evmos-lineage stack; if it ships a staking precompile at
  all, it is not responsive at this address/ABI).
- **Conclusion:** for QL1, plan on **Cosmos transactions** for delegation
  (documented route). EVM-precompile staking on QL1 is **not** evidenced —
  treat as unavailable until MT or a successful QL1-specific probe says
  otherwise.

### 4c. staking.zaphod.one — what it appears to use

- Fetched 2026-10-30 (page text only; no wallet interaction):
  https://staking.zaphod.one shows three "Live" products:
  - **"st QOM — Stake QOM to validators, earn rewards, and receive a
    tradeable NFT position."** — i.e. validator delegation on QL1 wrapped in
    an NFT position (liquid-staking-style), not plain delegation.
  - "ZAP — Stake ZAP tokens, earn ZAP rewards. Locked staking with bonus
    rewards." — contract-style locked token staking.
  - "QNS — Stake your .qom domains. Earn from 700K ZAP in rewards." —
    NFT/domain staking.
- Evidence limit: the landing page text does not disclose contracts or
  mechanics. Given §4b, the "st QOM" validator delegation almost certainly
  settles through QL1 Cosmos staking underneath (documented route), with the
  NFT position issued by Zaphod's own contract(s) — **this last step is
  inference, not documented**; the underlying Zaphod contract addresses/ABIs
  remain a TODO_MT item. DriveStats' Staking section exists
  (https://drivestats.online/) but renders client-side and yielded no
  staking-mechanism text to this fetch.

---

## 5. What this changes for the TODO_MT list

- ✅ QL1 Cosmos ID / denom / decimals — **closed** (`qom_766-1`, `aqom`, 18).
- ✅ Token decimals (14 tokens) — **closed**, all 18; note DONT / stC2 symbol
  quirks.
- ✅ Infinite staking method — **closed for the read side**: EVM staking
  precompile 0x…0800 live (23 bonded validators). Write-path untested.
- ✅ QL1 staking method — **Cosmos tx** (documented); precompile not
  evidenced.
- ❌ Cosmos REST (LCD) — **not published on either chain**; use gRPC /
  CometBFT / precompiles instead. (No longer a question for MT unless he
  runs a private LCD.)
- Still open for MT: Zaphod staking/aggregator contract addresses + ABIs,
  bridge mechanics, testnet/test tokens, QL1 staking precompile (if any
  non-standard variant exists).
