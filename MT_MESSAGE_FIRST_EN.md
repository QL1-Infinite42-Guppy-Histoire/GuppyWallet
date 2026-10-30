# Message to MT — first message, from scratch (English, not sent yet)
> Created 2026-10-30. The earlier draft/message was deleted by the user, so this text
> assumes MT has seen nothing from us yet. It is fully self-contained.

---

Hi MT, nice to meet you — I hope it's OK to message you here.

I'm building a dedicated wallet app for Infinite Drivechain and QL1 (Android first).
The idea is to build on the infrastructure you have already developed, design an original UI,
and bring it all together in one wallet: balances, Swap, liquidity, staking, st42,
Bridge, NFT, QNS (.qom), and a dashboard.

Where I am right now:
I have a working prototype (React Native + Expo). The Dashboard and Wallet screens already
fetch real balances for Infinite (42) and QL1 (QOM) from the RPCs using a public address.
Signing and transfers are deliberately disabled for now — the prototype is unaudited,
so no real funds are involved.

To connect the remaining screens, I need the contract interfaces. I checked the public sites,
the explorers, and the official link hub (infinitedrive42.xyz) first, and I could find the
public RPCs and token addresses — but not the ABIs below, so I'm asking you directly.

Could you share the following?

1. Contract addresses + ABIs, by chain:
   Swap router/aggregator (including Zaphod Swap — I couldn't find a public router address
   or ABI for app.zaphod.one, so if it routes through another DEX such as Don't Panic,
   that router's address + ABI is fine), LP/factory, staking, st42, Bridge, NFT, and QNS.
2. The official RPC / REST / gRPC endpoints you use, for both QL1 and Infinite
   (for Infinite I found the evm-rpc / comet-rpc / grpc endpoints listed on Assets/Console —
   please let me know if there is a Cosmos REST (LCD) endpoint as well).
3. QL1 basics: Cosmos chain ID, base denomination and decimals (e.g. aqom).
   For Infinite I have: EVM 421018, Cosmos infinite_421018-1, native 42, base denom "drop".
4. How staking is implemented — Cosmos transactions, or EVM precompiles.
5. How the Bridge works (lock-and-mint or liquidity-based), its fees and typical timing.
6. Any test account / test tokens, and whether a testnet is available.
7. API docs for price/quote data (dontpanic.finance / Zaphod), if they exist.
8. Logo / token icon assets, if you have them (otherwise I'll create them).

Just to be clear: I only need the interfaces (addresses + ABIs) to call the contracts
from the wallet — no source code, no keys, nothing sensitive. If you'd rather verify a
contract on the explorer so I can pull the ABI from there myself, that works perfectly too.

Any format is fine — files, a repo invite, whatever is easiest for you.
Once I have these, I can connect Swap and staking right away.

Thank you very much!
