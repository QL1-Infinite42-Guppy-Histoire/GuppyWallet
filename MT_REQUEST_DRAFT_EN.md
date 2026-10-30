# Request to MT (Draft — English version, not sent yet)

> Created: 2026-10-30 (JST). English version of MT_REQUEST_DRAFT.md, prepared at the user's request.
> MT's contact details / delivery channel are not confirmed yet, so they are intentionally left out.

## Message

Hi MT,

I hope you're doing well.

I'm building a dedicated wallet for Infinite Drivechain and QL1, as an Android app.
The plan is to build on the infrastructure you have already developed, create an original UI, and bring everything together in a single wallet.

The prototype foundation is ready (React Native + Expo, Android first).
On the Dashboard and Wallet screens, I can already enter a public address and fetch real balances for Infinite (42) and QL1 (QOM) directly from the RPCs.
I have deliberately not included signing or transfer functions yet, because the prototype is unaudited — it is not meant to be used with real funds.

The Swap / LP / Staking / st42 screens are currently marked as "waiting for connection" until the contract details are available, and I have not filled in any guessed addresses or values.
To move forward from here, could I ask you for the following information?

## What I would like to request (checklist from BLUEPRINT.md §5)

- [ ] A full list of contract addresses, by chain (Swap router, LP / factory, staking, st42, Bridge, NFT, QNS)
- [ ] The ABI for each contract (or the source code / a repository link)
- [ ] The official RPC / REST / gRPC endpoints you use (for both QL1 and Infinite)
- [ ] QL1's Cosmos chain ID, the base denomination, and its decimals (e.g. aqom)
- [ ] How staking is implemented (Cosmos transactions, or EVM precompiles)
- [ ] How the Bridge works (lock-and-mint, or liquidity-based), plus its fees and typical transfer time
- [ ] A test account / test tokens, and whether a testnet is available
- [ ] API documentation for dontpanic.finance / the Zaphod services, if available (price feeds, quote endpoints)
- [ ] Logo and token icon assets (if none are available, I will create them on my side)

## Facts I have already used in the prototype (please correct me if any of these are wrong)

- Infinite: EVM Chain ID 421018 / Cosmos Chain ID infinite_421018-1 / native currency 42
- QL1: EVM Chain ID 766 / native currency QOM / EVM RPC https://evm-rpc-ql1.mschihuahua.org
- QL1's Cosmos chain ID and decimals are still unconfirmed, so I have intentionally left them out of the prototype

Any format is fine — file sharing, a repository invite, whatever is easiest for you.
Thank you very much in advance.
