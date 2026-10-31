# Message to MT — first message (English, not sent yet)
> Updated 2026-10-30 (v4). Since v3, the Bridge and Fluke contracts were recovered
> from the official sites' public frontend code and verified on-chain, so those
> asks shrank to small confirmations. Still assumes MT has seen nothing from us
> yet; fully self-contained.

---

Hi MT, nice to meet you — I hope it's OK to message you here.

I'm building a dedicated wallet app for Infinite Drivechain and QL1 (Android first),
with an original UI on the infrastructure you have already developed: balances, Swap,
liquidity, staking, st42, Bridge, NFT, QNS (.qom), and a dashboard.

Quick status so you know where I am: the app already works end-to-end on mainnet.
I found and verified on-chain, without needing to bother you: the Don't Panic /
Nutri-Matic V2 router + factory on Infinite, the QomSwap router + factory on QL1,
the st42 vault, QL1's Cosmos parameters (qom_766-1 / aqom), Infinite's staking
precompile (delegation from the EVM side works), the BridgeRouter contracts behind
bridge.zaphod.one (Hyperlane-based), and the Fluke game built into The Guide NFT
contract plus the Starlight ledger. Swap, LP, staking, st42, transfers, Bridge
(Infinite-origin) and the Fluke commit/reveal flow are all connected in the app
already.

What I still genuinely need:

1. **Fluke settle signatures.** The Guide contract's settle(id, sig) needs a
   signature, and the public leaderboard API doesn't seem to serve one. How is
   settle meant to obtain its signature — is there an endpoint, or is settle
   currently not used by the site?

2. **QL1-origin bridge deliveries.** The bridge's own stats show zero deliveries
   originating from QL1, even though the QL1-side Hyperlane routers exist and have
   activity. Are QL1 → Infinite routes operational? (I keep QL1-origin sending
   disabled in the app until this is clear.)

3. **ZAP routing on QL1.** There is no direct ZAP pair in QomSwap's
   factory, so I could not trace how ZAP trades on QL1. Which venue/pairs
   does it use?

4. **Test environment.** Is there a testnet / test tokens available for
   either chain? I'm currently testing on mainnet with small amounts.

Just to be clear: I only need interfaces and operational facts — no source code,
no keys, nothing sensitive. Any format is fine.

Thank you very much!
