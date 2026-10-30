# Message to MT — first message (English, not sent yet)
> Updated 2026-10-30 (v3 of the draft). Much of the original checklist has since been
> solved from public sources / on-chain, so this version only asks for what is
> genuinely still missing. (The QNS item was dropped: minting has ended, per the
> user — the controllers=false state is presumably intentional.) Still assumes MT
> has seen nothing from us yet; fully self-contained.

---

Hi MT, nice to meet you — I hope it's OK to message you here.

I'm building a dedicated wallet app for Infinite Drivechain and QL1 (Android first),
with an original UI on the infrastructure you have already developed: balances, Swap,
liquidity, staking, st42, Bridge, NFT, QNS (.qom), and a dashboard.

Quick status so you know where I am: the app already works end-to-end on mainnet.
I found and verified on-chain, without needing to bother you: the Don't Panic /
Nutri-Matic V2 router + factory on Infinite, the QomSwap router + factory on QL1,
the st42 vault, QL1's Cosmos parameters (qom_766-1 / aqom), and Infinite's staking
precompile (delegation from the EVM side works). Swap, LP, staking, st42, transfers
are all connected in the app already.

What I still genuinely need:

1. **Bridge mechanics.** Which of the BridgeRouter contracts serves
   bridge.zaphod.one, and the basics: lock-and-mint or liquidity-based,
   supported routes/assets, fees, and typical completion time.

2. **ZAP routing on QL1.** There is no direct ZAP pair in QomSwap's
   factory, so I could not trace how ZAP trades on QL1. Which venue/pairs
   does it use?

3. **Fluke.** The game contract address(es) behind fluke.zaphod.one
   (The Guide NFT itself I found: 0xF349E469C474048DEd6F9b914309E76880ED1bbD).

4. **Test environment.** Is there a testnet / test tokens available for
   either chain? I'm currently testing on mainnet with small amounts.

5. One small confirmation: the live st42 vault appears to be the st42 token
   address 0x78F40E828a92AF9e137FF7660E52Ac8B0f1D121E (it answers the full
   vault interface with real values), while 0x0F93a9b0dBF2D1829928fe40cBc155e0b5B2D35e
   looks dormant (rate 0/0, zero supply). Is 0x78F4… the right one to use?

Just to be clear: I only need interfaces and operational facts — no source code,
no keys, nothing sensitive. Any format is fine.

Thank you very much!
