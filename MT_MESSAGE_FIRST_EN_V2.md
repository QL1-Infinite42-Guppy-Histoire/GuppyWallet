# Message to MT — first message, REVISED (English, not sent yet)
> Prepared 2026-10-30 (after the on-chain research sweep and the tx-capable v2 APK).
> This SUPERSEDES MT_MESSAGE_FIRST_EN.md and MT_MESSAGE_ROUTER_CONFIRM_EN.md for
> sending purposes: those drafts are now out of date — they ask for QL1 chain ID,
> decimals and the staking method (all since confirmed on-chain), and they say
> signing is disabled (the v2 prototype now sends transactions). Do NOT send the
> old versions. This version assumes MT has seen nothing from us yet, so it is
> still fully self-contained, but it only asks for what is still genuinely unknown.

---

Hi MT, nice to meet you — I hope it's OK to message you here.

I'm building a dedicated wallet app for Infinite Drivechain and QL1 (Android first).
The idea is to build on the infrastructure you have already developed, design an original UI,
and bring it all together in one wallet: balances, Swap, liquidity, staking, st42,
Bridge, NFT, QNS (.qom), and a dashboard.

Where I am right now:
I have a working prototype (React Native + Expo, now tx-capable). I checked the public
sites, the explorers and the official link hub (infinitedrive42.xyz) first, and confirmed
a lot on-chain myself, so I am only asking for the pieces I could not find anywhere:

Already confirmed on my side (no need to send these unless I'm wrong):
- QL1 Cosmos chain ID `qom_766-1`, base denom `aqom`, 18 decimals; Infinite EVM 421018,
  Cosmos `infinite_421018-1`.
- Native DEX routers/factories, confirmed by direct contract calls: Infinite Don't Panic /
  Nutri-Matic router `0xBF07dFE35746894bAe373f63f4Bf2379F9BaFEc0`, factory
  `0x3157C6AcA800D507af95Ab1466adBA3A6F11eE1a`; QL1 QomSwap router
  `0xc1f90231035A52091eBCb7dddaCa3051a5F44f30`, factory
  `0x475f361993D6FAcBF32fB82B66be0fB40f3d974C` (645 pairs).
- Infinite staking via the live EVM precompile at `0x0800` (23 validators readable);
  QL1 staking is Cosmos-transaction style. All listed tokens on both chains are 18 decimals.
- st42, QNS, ZapStaking and The Guide NFT (`0xF349E469C474048DEd6F9b914309E76880ED1bbD`)
  are already wired in from their verified contracts. No Cosmos REST/LCD endpoint was
  found published on either chain, so the app is designed without one.

Could you help with just these?

1. Bridge: which BridgeRouter contract on Infinite serves Zaphod Bridge (the explorer
   lists six, with no app label)? And how it works — lock-and-mint or liquidity-based —
   plus fees, typical timing, and supported routes.
2. Zaphod Swap routing: does app.zaphod.one route through the native DEX routers above
   (Don't Panic / QomSwap), or through its own aggregator contract? If its own, its
   address + ABI per chain. Related: I found no direct ZAP pair in QomSwap, so how is
   ZAP exchanged on QL1?
3. st QOM: the NFT wrapper contract for staked QOM, if it exists, and its ABI.
4. Fluke: the game contract address + ABI (I could not identify the game contract itself).
5. Testnet / test tokens: is there a testnet or a way to get test tokens? No public
   faucet link was found.

Two quick verifications, only if you have a moment:
6. st42: the live vault I found is the token-side contract
   `0x78F40E828a92AF9e137FF7660E52Ac8B0f1D121E`, while
   `0x0F93a9b0dBF2D1829928fe40cBc155e0b5B2D35e` looks dormant. Is the first one the
   right live vault?
7. QNS: the registrar contract returns a price of 300 billion QOM per year for names of
   5+ characters. That looks extreme against QOM supply — is that really the intended
   price, or am I reading the wrong price function?

Just to be clear: I only need the interfaces (addresses + ABIs) to call the contracts
from the wallet — no source code, no keys, nothing sensitive. If you'd rather verify a
contract on the explorer so I can pull the ABI from there myself, that works perfectly too.

Any format is fine — files, a repo invite, whatever is easiest for you.
Thank you very much!
