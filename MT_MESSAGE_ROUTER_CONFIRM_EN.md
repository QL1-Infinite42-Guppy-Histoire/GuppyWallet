# Short follow-up to MT — router / factory confirmation (English, not sent yet)
> Prepared 2026-10-30, updated after the explorer check on 2026-10-30 10:27–10:32 JST.
> This is a SHORTER follow-up to MT_MESSAGE_FIRST_EN.md, not a replacement for it:
> send this only if the full first message has already gone out, or use its two
> candidate addresses as the concrete questions inside the first message.
> Do not send both blindly.
>
> Explorer verdict at drafting time (Infinite only; both strings are unused
> EOAs with 0 transactions on QL1, so this is an Infinite-only question):
> - Router candidate and factory candidate both BEHAVE like a router and a
>   factory on Infinite (see below), but BOTH are source-unverified on
>   scan.infinitedrive.xyz, so their ABIs cannot be pulled from the explorer.
>   That is why this message asks MT for the ABI (or for verification on the
>   explorer), rather than assuming the ABI is available.
> - The router→factory link is indirect evidence only: internal transactions
>   show repeated calls from the router to the factory, but the router's
>   factory() value could not be read directly because there is no Read
>   Contract tab for an unverified contract.

---

Hi MT, a quick follow-up on the Swap integration — I've narrowed it down
through the explorers and just need you to confirm two addresses on Infinite:

1. Router candidate: `0xBF07dFE35746894bAe373f63f4Bf2379F9BaFEc0`
   On the explorer this behaves like a router: 14,116 transactions from many
   different callers, with a confirmed swapExactTokensForTokens transaction
   and an addLiquidity transaction in its history. Is this the router that
   Zaphod Swap routes through (e.g. the Don't Panic router), or a different
   DEX's router? Note: it is currently source-unverified on the explorer,
   so I can't pull its ABI from there — could you share the ABI, or verify
   the contract on the explorer so I can pull it myself?

2. Factory candidate: `0x3157C6AcA800D507af95Ab1466adBA3A6F11eE1a`
   On the explorer this behaves like a factory: a confirmed createPair
   transaction and 87 PairCreated logs (including the FISH/DONT pair at
   `0xa7550206E84Cd6018bb7BC27CC35c66f14Dd8Cd3`). Is this the factory
   paired with the router above? (For reference, I already found a separate
   verified contract called X42Factory at
   `0x8965501ea6d898ef5251776C1E99Da3c5E6504eF` — I want to be sure I don't
   mix the two up.) Same note as above: it is currently source-unverified,
   so its ABI is not on the explorer either.

Two things I could already find on the explorers, so you don't need to send
those ABIs unless I'm wrong about them:
- st42: St42Book `0x458f6b41d093bED5aBBc1527DaBDf5499A85294F` and St42Vault
  `0x0F93a9b0dBF2D1829928fe40cBc155e0b5B2D35e` (both verified)
- QNS (.qom) on QL1: QOM Domains `0xDCbF4614152a22D1883Ba3929c668B978A3be548`
  and RegistrarController `0x4d9FE3F0EE6Fe1645DD537EC59a0a328F7148372`
  (both verified)

Still open on my side, if you have a moment:
- Which of the BridgeRouter contracts on Infinite serves Zaphod Bridge
  (the explorer lists six, with no app label)?
- QL1 Cosmos chain ID and base denomination/decimals, and how staking is
  implemented (Cosmos transactions or EVM precompiles).

As before, I only need interfaces (addresses + ABIs) — no source code, no keys.
Thanks so much!
