import { Contract, formatUnits } from "ethers";
import {
  INFINITE,
  INFINITE_NFTS,
  INFINITE_TOKENS,
  QL1,
  QL1_CONTRACTS,
} from "../config/chains";
import { getProvider } from "./onchain";
import { valoperFromHex } from "./walletCrypto";

/**
 * Protocol reads (+ contract handles for the send flows):
 *  - Infinite staking precompile 0x…0800 (validators list)
 *  - st42: the live vault+token contract is the st42 token address in
 *    INFINITE_TOKENS (0x78F4…): St42Book.share()/vault() both point to it
 *    and it answers the full St42Vault ABI with a live rate/supply.
 *    INFINITE_CONTRACTS.st42Vault (0x0F93…) answers the same ABI but is
 *    dormant (rate 0/0, supply 0) — probed 2026-10-30.
 *  - QL1 ZapStaking, QNS controller, Infinite NFT collections.
 */

export const ST42_ADDRESS =
  INFINITE_TOKENS.find((t) => t.symbol === "st42")?.address ?? "";
export const STAKING_PRECOMPILE =
  "0x0000000000000000000000000000000000000800";
export const DISTRIBUTION_PRECOMPILE =
  "0x0000000000000000000000000000000000000801";

export const STAKING_ABI = [
  "function validators(string status, tuple(bytes key, uint64 offset, uint64 limit, bool countTotal, bool reverse) pageRequest) view returns (tuple(string operatorAddress, string consensusPubkey, bool jailed, uint8 status, uint256 tokens, uint256 delegatorShares, tuple(string moniker, string identity, string website, string securityContact, string details) description, int64 unbondingHeight, int64 unbondingTime, uint256 commission, uint256 minSelfDelegation)[] validators, tuple(bytes nextKey, uint64 total) pageResponse)",
  "function delegate(address delegatorAddress, string validatorAddress, uint256 amount) returns (bool success)",
  "function undelegate(address delegatorAddress, string validatorAddress, uint256 amount) returns (int64 completionTime)",
  "function redelegate(address delegatorAddress, string validatorSrcAddress, string validatorDstAddress, uint256 amount) returns (int64 completionTime)",
] as const;

export const DISTRIBUTION_ABI = [
  "function claimRewards(address delegatorAddress, uint32 maxRetrieve) returns (bool success)",
] as const;

export interface ValidatorInfo {
  moniker: string;
  /** operator address exactly as returned (hex string on this chain) */
  operatorAddress: string;
  /** bech32 valoper form used by the write functions */
  valoper: string;
  jailed: boolean;
  status: number;
  tokensFormatted: string;
}

const BOND_STATUS = [
  "Unspecified",
  "Unbonded",
  "Unbonding",
  "Bonded",
] as const;

export function bondStatusLabel(status: number): string {
  return BOND_STATUS[status] ?? `status ${status}`;
}

export async function fetchValidators(): Promise<{
  validators: ValidatorInfo[];
  total: number;
}> {
  const precompile = new Contract(
    STAKING_PRECOMPILE,
    STAKING_ABI,
    getProvider(INFINITE),
  ) as any;
  const [list, page] = await precompile.validators("BOND_STATUS_BONDED", {
    key: "0x",
    offset: 0,
    limit: 100,
    countTotal: true,
    reverse: false,
  });
  const validators: ValidatorInfo[] = (list as any[]).map((v) => {
    const operator: string = v.operatorAddress ?? v[0];
    const description = v.description ?? v[6];
    return {
      moniker: description?.moniker ?? description?.[0] ?? "(名称なし)",
      operatorAddress: operator,
      valoper: operator.startsWith("0x")
        ? valoperFromHex(operator, "infinitevaloper")
        : operator,
      jailed: Boolean(v.jailed ?? v[2]),
      status: Number(v.status ?? v[3]),
      tokensFormatted: formatUnits(v.tokens ?? v[4] ?? 0n, 18),
    };
  });
  const total = Number(page?.total ?? page?.[1] ?? validators.length);
  return { validators, total };
}

// ---------------------------------------------------------------- st42

export const ST42_VAULT_ABI = [
  "function rateNum() view returns (uint256)",
  "function rateDen() view returns (uint256)",
  "function rateFresh() view returns (bool)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function unbondingPeriod() view returns (uint256)",
  "function minStakeAmount() view returns (uint256)",
  "function depositsPaused() view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function tickets(uint256 ticketId) view returns (address owner, uint256 shares, uint64 epoch, bool claimed, uint256 claimedAmount, uint16 feeBps)",
  "function epochs(uint256 epochId) view returns (uint256 shares, uint256 assets, uint256 realized, uint256 prefunded, uint256 remaining, uint64 closeRound, uint64 firstCompletion, uint64 completionTime, bool processed, bool finalized, uint256 unbonded, uint256 nChunks, uint64 finalizedAt)",
  "function deposit() payable returns (uint256 shares)",
  "function requestRedeem(uint256 shares) returns (uint256 ticketId)",
  "function claim(uint256 ticketId)",
  "function instantExit(uint256 shares, uint256 minAssetsOut) returns (uint256 net)",
] as const;

export function getSt42Vault(signerOrProvider?: any): any {
  return new Contract(
    ST42_ADDRESS,
    ST42_VAULT_ABI,
    signerOrProvider ?? getProvider(INFINITE),
  );
}

export interface St42State {
  rate: number | null;
  rateFresh: boolean | null;
  totalAssetsFormatted: string | null;
  unbondingDays: number | null;
  minStakeFormatted: string | null;
  depositsPaused: boolean | null;
  yourShares: bigint | null;
  yourSharesFormatted: string | null;
}

export async function fetchSt42State(
  address: string | null,
): Promise<St42State> {
  const vault = getSt42Vault();
  const state: St42State = {
    rate: null,
    rateFresh: null,
    totalAssetsFormatted: null,
    unbondingDays: null,
    minStakeFormatted: null,
    depositsPaused: null,
    yourShares: null,
    yourSharesFormatted: null,
  };
  const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch {
      return null;
    }
  };
  const [num, den, fresh, assets, unbonding, minStake, paused, shares] =
    await Promise.all([
      safe<bigint>(vault.rateNum()),
      safe<bigint>(vault.rateDen()),
      safe<boolean>(vault.rateFresh()),
      safe<bigint>(vault.totalAssets()),
      safe<bigint>(vault.unbondingPeriod()),
      safe<bigint>(vault.minStakeAmount()),
      safe<boolean>(vault.depositsPaused()),
      address ? safe<bigint>(vault.balanceOf(address)) : Promise.resolve(null),
    ]);
  if (num !== null && den !== null && den > 0n) {
    state.rate = Number(num) / Number(den);
  }
  state.rateFresh = fresh;
  state.totalAssetsFormatted =
    assets !== null ? formatUnits(assets, 18) : null;
  state.unbondingDays =
    unbonding !== null ? Number(unbonding) / 86400 : null;
  state.minStakeFormatted =
    minStake !== null ? formatUnits(minStake, 18) : null;
  state.depositsPaused = paused;
  state.yourShares = shares;
  state.yourSharesFormatted =
    shares !== null ? formatUnits(shares, 18) : null;
  return state;
}

export interface TicketInfo {
  owner: string;
  sharesFormatted: string;
  epoch: number;
  claimed: boolean;
  claimedAmountFormatted: string;
  epochFinalized: boolean | null;
}

export async function fetchTicket(ticketId: bigint): Promise<TicketInfo> {
  const vault = getSt42Vault();
  const t = await vault.tickets(ticketId);
  let finalized: boolean | null = null;
  try {
    const e = await vault.epochs(t.epoch ?? t[2]);
    finalized = Boolean(e.finalized ?? e[9]);
  } catch {
    finalized = null;
  }
  return {
    owner: t.owner ?? t[0],
    sharesFormatted: formatUnits(t.shares ?? t[1], 18),
    epoch: Number(t.epoch ?? t[2]),
    claimed: Boolean(t.claimed ?? t[3]),
    claimedAmountFormatted: formatUnits(t.claimedAmount ?? t[4] ?? 0n, 18),
    epochFinalized: finalized,
  };
}

// ------------------------------------------------------- QL1 ZapStaking

export const ZAP_STAKING_ABI = [
  "function zapToken() view returns (address)",
  "function seasonActive() view returns (bool)",
  "function seasonInfo() view returns (uint256 start, uint256 windowClose, uint256 end, uint256 rewardLockEnd, uint256 stakers, uint256 totalStaked, uint256 pool, uint256 dailyPerZap)",
  "function totalStaked() view returns (uint256)",
  "function rewardPool() view returns (uint256)",
  "function stakeDuration() view returns (uint256)",
  "function stakeWindow() view returns (uint256)",
  "function rewardLock() view returns (uint256)",
  "function stakerCount() view returns (uint256)",
  "function getStake(address user) view returns (uint256 amount, uint256 rewardEarned, uint256 rewardLockEnd, uint256 unstakedAt, bool claimed, uint256 pending)",
  "function pendingReward(address user) view returns (uint256)",
  "function claimPreview(address user) view returns (uint256 received, uint256 burned)",
  "function stake(uint256 amount)",
  "function unstake()",
  "function claim()",
] as const;

export function getZapStaking(signerOrProvider?: any): any {
  return new Contract(
    QL1_CONTRACTS.zapStaking,
    ZAP_STAKING_ABI,
    signerOrProvider ?? getProvider(QL1),
  );
}

export interface ZapStakingState {
  seasonActive: boolean | null;
  seasonStart: number | null;
  windowClose: number | null;
  seasonEnd: number | null;
  rewardLockEnd: number | null;
  stakerCount: number | null;
  totalStakedFormatted: string | null;
  rewardPoolFormatted: string | null;
  yourStakeFormatted: string | null;
  yourPendingFormatted: string | null;
  claimReceivedFormatted: string | null;
  claimBurnedFormatted: string | null;
}

function tsOrNull(v: bigint | number | undefined): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

export async function fetchZapStakingState(
  address: string | null,
): Promise<ZapStakingState> {
  const staking = getZapStaking();
  const state: ZapStakingState = {
    seasonActive: null,
    seasonStart: null,
    windowClose: null,
    seasonEnd: null,
    rewardLockEnd: null,
    stakerCount: null,
    totalStakedFormatted: null,
    rewardPoolFormatted: null,
    yourStakeFormatted: null,
    yourPendingFormatted: null,
    claimReceivedFormatted: null,
    claimBurnedFormatted: null,
  };
  try {
    const info = await staking.seasonInfo();
    state.seasonStart = tsOrNull(info.start ?? info[0]);
    state.windowClose = tsOrNull(info.windowClose ?? info[1]);
    state.seasonEnd = tsOrNull(info.end ?? info[2]);
    state.rewardLockEnd = tsOrNull(info.rewardLockEnd ?? info[3]);
    state.stakerCount = Number(info.stakers ?? info[4] ?? 0);
    state.totalStakedFormatted = formatUnits(info.totalStaked ?? info[5] ?? 0n, 18);
    state.rewardPoolFormatted = formatUnits(info.pool ?? info[6] ?? 0n, 18);
  } catch {
    try {
      state.seasonActive = await staking.seasonActive();
      const total: bigint = await staking.totalStaked();
      state.totalStakedFormatted = formatUnits(total, 18);
      const pool: bigint = await staking.rewardPool();
      state.rewardPoolFormatted = formatUnits(pool, 18);
      const count: bigint = await staking.stakerCount();
      state.stakerCount = Number(count);
    } catch {
      /* leave nulls */
    }
  }
  if (state.seasonActive === null) {
    try {
      state.seasonActive = await staking.seasonActive();
    } catch {
      /* ignore */
    }
  }
  if (address) {
    try {
      const stake = await staking.getStake(address);
      state.yourStakeFormatted = formatUnits(stake.amount ?? stake[0] ?? 0n, 18);
      state.yourPendingFormatted = formatUnits(stake.pending ?? stake[5] ?? 0n, 18);
    } catch {
      /* ignore */
    }
    try {
      const preview = await staking.claimPreview(address);
      state.claimReceivedFormatted = formatUnits(preview.received ?? preview[0] ?? 0n, 18);
      state.claimBurnedFormatted = formatUnits(preview.burned ?? preview[1] ?? 0n, 18);
    } catch {
      /* ignore */
    }
  }
  return state;
}

// ------------------------------------------------------------------ NFT

const ERC721_READ_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
] as const;

export interface NftCollectionState {
  label: string;
  address: string;
  name: string | null;
  symbol: string | null;
  totalSupply: string | null;
  owned: string | null;
}

export async function fetchNftCollections(
  address: string | null,
): Promise<NftCollectionState[]> {
  const targets: { label: string; address: string }[] = [
    { label: "The Guide", address: INFINITE_NFTS.theGuide },
    { label: "Zaphod Girls The Thirteen", address: INFINITE_NFTS.zg13 },
  ];
  const provider = getProvider(INFINITE);
  return Promise.all(
    targets.map(async (t) => {
      const contract = new Contract(t.address, ERC721_READ_ABI, provider) as any;
      const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
        try {
          return await p;
        } catch {
          return null;
        }
      };
      const [name, symbol, supply, owned] = await Promise.all([
        safe<string>(contract.name()),
        safe<string>(contract.symbol()),
        safe<bigint>(contract.totalSupply()),
        address ? safe<bigint>(contract.balanceOf(address)) : Promise.resolve(null),
      ]);
      return {
        label: t.label,
        address: t.address,
        name,
        symbol,
        totalSupply: supply !== null ? supply.toString() : null,
        owned: owned !== null ? owned.toString() : null,
      };
    }),
  );
}

// ------------------------------------------------------------------ QNS

export const QNS_CONTROLLER_ABI = [
  "function available(string name) view returns (bool)",
  "function valid(string name) view returns (bool)",
  "function rentPrice(string name, uint256 duration) view returns (uint256)",
  "function DURATION() view returns (uint256)",
  "function defaultResolver() view returns (address)",
  "function register(string name, address owner, address resolver, bool setReverse, bool permanent) payable",
] as const;

export function getQnsController(signerOrProvider?: any): any {
  return new Contract(
    QL1_CONTRACTS.qnsRegistrarController,
    QNS_CONTROLLER_ABI,
    signerOrProvider ?? getProvider(QL1),
  );
}

export interface QnsCheck {
  name: string;
  valid: boolean | null;
  available: boolean | null;
  priceRaw: bigint | null;
  priceFormatted: string | null;
  durationSeconds: number | null;
}

export async function checkQnsName(rawName: string): Promise<QnsCheck> {
  const name = rawName.trim().toLowerCase().replace(/\.qom$/, "");
  const controller = getQnsController();
  const check: QnsCheck = {
    name,
    valid: null,
    available: null,
    priceRaw: null,
    priceFormatted: null,
    durationSeconds: null,
  };
  if (!name) return check;
  const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch {
      return null;
    }
  };
  check.valid = await safe<boolean>(controller.valid(name));
  check.available = await safe<boolean>(controller.available(name));
  const duration = await safe<bigint>(controller.DURATION());
  check.durationSeconds = duration !== null ? Number(duration) : null;
  if (duration !== null) {
    const price = await safe<bigint>(controller.rentPrice(name, duration));
    check.priceRaw = price;
    check.priceFormatted = price !== null ? formatUnits(price, 18) : null;
  }
  return check;
}
