import {
  Contract,
  formatUnits,
  getAddress,
  isAddress,
  zeroPadValue,
  type Wallet,
} from "ethers";
import type { TxJob } from "../components/ConfirmTx";
import {
  BRIDGE_PAIRS_QL1,
  BRIDGE_SOURCE_CHAINS,
  INFINITE,
  INFINITE_CONTRACTS,
  INFINITE_NFTS,
  INFINITE_TOKENS,
  type BridgeSourceChain,
} from "../config/chains";
import {
  ERC20_READ_ABI,
  getProvider,
  type ProviderChainLike,
} from "./onchain";
import {
  estimateOrFallback,
  gasCostNative,
  planExactApproval,
  sendAndWait,
} from "./tx";

/**
 * Zaphod services run NATIVELY in-app (no WalletConnect / external
 * browser): Fluke (the roll-and-keep game inside The Guide contract),
 * the Starlight yield ledger, and the Hyperlane BridgeRouters.
 *
 * Every address/ABI here comes from research/ZAPHOD_FRONTEND.md +
 * research/abi-fluke.json / research/abi-bridge.json, recovered from the
 * official frontends' public JS and verified on-chain 2026-10-30.
 * Anything the research does not document stays unimplemented.
 */

export const FLUKE_CORE_ADDRESS = INFINITE_NFTS.theGuide;
export const STARLIGHT_ADDRESS = INFINITE_CONTRACTS.starlightLedger;
export const ZAP_ADDRESS =
  INFINITE_TOKENS.find((t) => t.symbol === "ZAP")?.address ?? "";
/** Public API the official Fluke frontend itself reads (no auth). */
export const FLUKE_LEADERBOARD_API = "https://fluke.zaphod.one/api/leaderboard";

/** Subset of The Guide core ABI (research/abi-fluke.json -> core) —
 *  only the game/yield functions the app actually wires. */
export const FLUKE_CORE_ABI = [
  "function price() view returns (uint256)",
  "function revealPrice() view returns (uint256)",
  "function poolA() view returns (uint256)",
  "function poolB() view returns (uint256)",
  "function leader() view returns (uint256)",
  "function score(uint256 id) view returns (uint256)",
  "function burned(uint256 id) view returns (uint256)",
  "function tier(uint256 id) view returns (uint8)",
  "function currentEmblem(uint256 id) view returns (uint16)",
  "function formCount(uint256 id) view returns (uint256)",
  "function text(uint256 id) view returns (string)",
  "function paused() view returns (bool)",
  "function oddsInv() view returns (uint256)",
  "function delay() view returns (uint256)",
  "function supply() view returns (uint256)",
  "function ownerOf(uint256 id) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function recs(uint256 id) view returns (address o, uint64 rn, bool s, uint256 oi)",
  "function commit(uint256 maxCost) returns (uint256 id)",
  "function reveal(uint256 item, uint256 maxCost) returns (bytes32)",
  "function boost(uint256 item, uint256 amount)",
  "function settle(uint256 id, bytes sig)",
] as const;

/** Subset of the Starlight ledger ABI (research/abi-fluke.json ->
 *  yieldLedger). The ledger's market functions (list/buy/offer/…)
 *  exist in the shipped ABI but the site config disables the market
 *  (yield.market = null) — deliberately NOT wired. */
export const STARLIGHT_ABI = [
  "function currentEpoch() view returns (uint256)",
  "function EPOCH() view returns (uint256)",
  "function registerPaused() view returns (bool)",
  "function tokenCount() view returns (uint256)",
  "function tokens(uint256 index) view returns (address)",
  "function totalIn(address token) view returns (uint256)",
  "function items(uint256 id) view returns (bool registered, bool redeemed, uint32 tierIdx, uint256 tierSnap, uint256 baseW, uint256 bonusW, uint256 expEpoch)",
  "function earned(uint256 id, address token) view returns (uint256)",
  "function weightOf(uint256 id) view returns (uint256)",
  "function register(uint256[] ids)",
  "function claim(uint256[] ids)",
] as const;

/** Full BridgeRouter ABI (research/abi-bridge.json, recovered verbatim). */
export const BRIDGE_ROUTER_ABI = [
  "function transferRemote(uint32 destination, bytes32 recipient, uint256 amount) payable returns (bytes32 messageId)",
  "function quoteNative(uint32 destination, bytes data) view returns (uint256 nativeFee, uint256 gasPayment, uint256 totalNative, uint256 usdPer42, uint8 source)",
  "function quoteBridge(uint256 amount) view returns (uint256 forwardAmount, uint256 fee, uint256 totalRequired)",
  "function token() view returns (address)",
  "function underlying() view returns (address)",
  "function feeBps() view returns (uint16)",
  "function feeFlat() view returns (uint256)",
  "function minTransferAmount() view returns (uint256)",
  "function maxTransferAmount() view returns (uint256)",
  "function allowedDestinations(uint32 destination) view returns (bool)",
  "function destinationScaleFactor(uint32 destination) view returns (uint256)",
  "function paused() view returns (bool)",
  "function VERSION() view returns (string)",
] as const;

export function getFlukeCore(signerOrProvider?: any): any {
  return new Contract(
    FLUKE_CORE_ADDRESS,
    FLUKE_CORE_ABI,
    signerOrProvider ?? getProvider(INFINITE),
  );
}

export function getStarlight(signerOrProvider?: any): any {
  return new Contract(
    STARLIGHT_ADDRESS,
    STARLIGHT_ABI,
    signerOrProvider ?? getProvider(INFINITE),
  );
}

export function getBridgeRouter(address: string, signerOrProvider?: any): any {
  return new Contract(
    address,
    BRIDGE_ROUTER_ABI,
    signerOrProvider ?? getProvider(INFINITE),
  );
}

const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    return null;
  }
};

// ------------------------------------------------------------------ Fluke

export interface FlukeState {
  priceRaw: bigint;
  priceFormatted: string;
  revealPriceRaw: bigint;
  revealPriceFormatted: string;
  poolAFormatted: string | null;
  poolBFormatted: string | null;
  leaderId: string | null;
  leaderScoreFormatted: string | null;
  paused: boolean | null;
  oddsInv: string | null;
  delaySeconds: string | null;
  zapBalanceRaw: bigint | null;
  zapBalanceFormatted: string | null;
  guideBalance: string | null;
}

export async function fetchFlukeState(
  address: string | null,
): Promise<FlukeState> {
  const core = getFlukeCore();
  const zap = new Contract(ZAP_ADDRESS, ERC20_READ_ABI, getProvider(INFINITE)) as any;
  const [price, revealPrice, poolA, poolB, leader, paused, oddsInv, delay] =
    await Promise.all([
      core.price(),
      core.revealPrice(),
      safe<bigint>(core.poolA()),
      safe<bigint>(core.poolB()),
      safe<bigint>(core.leader()),
      safe<boolean>(core.paused()),
      safe<bigint>(core.oddsInv()),
      safe<bigint>(core.delay()),
    ]);
  const [leaderScore, zapBal, guideBal] = await Promise.all([
    leader !== null ? safe<bigint>(core.score(leader)) : Promise.resolve(null),
    address ? safe<bigint>(zap.balanceOf(address)) : Promise.resolve(null),
    address ? safe<bigint>(core.balanceOf(address)) : Promise.resolve(null),
  ]);
  return {
    priceRaw: price,
    priceFormatted: formatUnits(price, 18),
    revealPriceRaw: revealPrice,
    revealPriceFormatted: formatUnits(revealPrice, 18),
    poolAFormatted: poolA !== null ? formatUnits(poolA, 18) : null,
    poolBFormatted: poolB !== null ? formatUnits(poolB, 18) : null,
    leaderId: leader !== null ? leader.toString() : null,
    leaderScoreFormatted:
      leaderScore !== null ? formatUnits(leaderScore, 18) : null,
    paused,
    oddsInv: oddsInv !== null ? oddsInv.toString() : null,
    delaySeconds: delay !== null ? delay.toString() : null,
    zapBalanceRaw: zapBal,
    zapBalanceFormatted: zapBal !== null ? formatUnits(zapBal, 18) : null,
    guideBalance: guideBal !== null ? guideBal.toString() : null,
  };
}

export interface GuideItemState {
  id: string;
  owner: string;
  mine: boolean;
  scoreFormatted: string | null;
  burnedFormatted: string | null;
  tier: number | null;
  formCount: string | null;
  currentEmblem: string | null;
  text: string | null;
  starlight: {
    registered: boolean;
    redeemed: boolean;
    tierIdx: number;
    weight: string;
    earnedRaw: bigint;
    earnedFormatted: string;
  } | null;
}

export async function fetchGuideItem(
  id: bigint,
  address: string | null,
): Promise<GuideItemState> {
  const core = getFlukeCore();
  const ledger = getStarlight();
  const owner: string = await core.ownerOf(id);
  const [score, burned, tier, forms, emblem, text, nativeToken] =
    await Promise.all([
      safe<bigint>(core.score(id)),
      safe<bigint>(core.burned(id)),
      safe<number>(core.tier(id)),
      safe<bigint>(core.formCount(id)),
      safe<number>(core.currentEmblem(id)),
      safe<string>(core.text(id)),
      safe<string>(ledger.tokens(0)),
    ]);
  let starlight: GuideItemState["starlight"] = null;
  if (nativeToken) {
    const [item, earned, weight] = await Promise.all([
      safe<any>(ledger.items(id)),
      safe<bigint>(ledger.earned(id, nativeToken)),
      safe<bigint>(ledger.weightOf(id)),
    ]);
    if (item) {
      starlight = {
        registered: Boolean(item.registered ?? item[0]),
        redeemed: Boolean(item.redeemed ?? item[1]),
        tierIdx: Number(item.tierIdx ?? item[2]),
        weight: (weight ?? 0n).toString(),
        earnedRaw: earned ?? 0n,
        earnedFormatted: formatUnits(earned ?? 0n, 18),
      };
    }
  }
  return {
    id: id.toString(),
    owner,
    mine:
      address !== null &&
      owner.toLowerCase() === address.toLowerCase(),
    scoreFormatted: score !== null ? formatUnits(score, 18) : null,
    burnedFormatted: burned !== null ? formatUnits(burned, 18) : null,
    tier: tier !== null ? Number(tier) : null,
    formCount: forms !== null ? forms.toString() : null,
    currentEmblem: emblem !== null ? String(emblem) : null,
    text,
    starlight,
  };
}

export interface FlukeRecord {
  id: string;
  owner: string;
  rn: string;
  settled: boolean;
  item: string;
  exists: boolean;
  mine: boolean;
}

export async function fetchFlukeRecord(
  id: bigint,
  address: string | null,
): Promise<FlukeRecord> {
  const core = getFlukeCore();
  const r = await core.recs(id);
  const owner: string = r.o ?? r[0];
  return {
    id: id.toString(),
    owner,
    rn: (r.rn ?? r[1]).toString(),
    settled: Boolean(r.s ?? r[2]),
    item: (r.oi ?? r[3]).toString(),
    exists: owner !== "0x0000000000000000000000000000000000000000",
    mine:
      address !== null && owner.toLowerCase() === address.toLowerCase(),
  };
}

/**
 * Settle signatures are issued by the official Fluke API — the frontend
 * reads them from GET /api/leaderboard (entries may carry `signature` /
 * `sigHex`, keyed by the commit record `rn`, per the recovered page
 * code). Probed live 2026-10-30: the public response currently contains
 * leaderboard stats only, with NO signature fields — so this returns
 * null and the UI stays in the「公式APIの署名待ち」state. If the API
 * starts serving signatures, settle lights up without an app update to
 * this function. Never invents an endpoint or parameter.
 */
export async function fetchSettleSignature(
  rn: string,
): Promise<string | null> {
  try {
    const res = await fetch(FLUKE_LEADERBOARD_API);
    if (!res.ok) return null;
    const data: any = await res.json();
    const pools: any[] = [
      ...(Array.isArray(data?.entries) ? data.entries : []),
      ...(Array.isArray(data?.pending) ? data.pending : []),
      ...(Array.isArray(data?.records) ? data.records : []),
    ];
    for (const e of pools) {
      const key = e?.rn ?? e?.recordRn ?? e?.record;
      if (key !== undefined && String(key) === rn) {
        const sig = e?.signature ?? e?.sigHex ?? e?.sig;
        if (typeof sig === "string" && sig.startsWith("0x")) return sig;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------- Starlight

export interface StarlightState {
  currentEpoch: string | null;
  epochSeconds: string | null;
  registerPaused: boolean | null;
  nativeToken: string | null;
  totalInFormatted: string | null;
}

export async function fetchStarlightState(): Promise<StarlightState> {
  const ledger = getStarlight();
  const [epoch, epochLen, paused, nativeToken] = await Promise.all([
    safe<bigint>(ledger.currentEpoch()),
    safe<bigint>(ledger.EPOCH()),
    safe<boolean>(ledger.registerPaused()),
    safe<string>(ledger.tokens(0)),
  ]);
  const totalIn = nativeToken
    ? await safe<bigint>(ledger.totalIn(nativeToken))
    : null;
  return {
    currentEpoch: epoch !== null ? epoch.toString() : null,
    epochSeconds: epochLen !== null ? epochLen.toString() : null,
    registerPaused: paused,
    nativeToken,
    totalInFormatted: totalIn !== null ? formatUnits(totalIn, 18) : null,
  };
}

// ------------------------------------------------------------ Fluke jobs

export function flukeCommitJob(state: FlukeState): TxJob {
  const price = state.priceRaw;
  return {
    title: "Fluke — 参加",
    chain: INFINITE,
    lines: [
      { label: "アクション", value: "参加" },
      { label: "支払い", value: `${state.priceFormatted} ZAP` },
      { label: "コントラクト", value: FLUKE_CORE_ADDRESS },
      {
        label: "注意",
        value: "ZAPは参加料として使われます。少額でどうぞ。",
      },
    ],
    prepare: async (signer: Wallet) => {
      const approval = await planExactApproval(
        signer,
        ZAP_ADDRESS,
        FLUKE_CORE_ADDRESS,
        price,
      );
      const core = getFlukeCore(signer);
      const data: string = core.interface.encodeFunctionData("commit", [price]);
      const tx = { to: FLUKE_CORE_ADDRESS, data };
      const gas = await estimateOrFallback(signer, tx, 300000n);
      const totalGas = approval.estimate + gas;
      return {
        gasEstimateText: await gasCostNative(signer, totalGas, "42"),
        send: async () => {
          const hashes: string[] = [];
          if (approval.needed) hashes.push(await approval.send());
          hashes.push(await sendAndWait(signer, tx));
          return hashes;
        },
      };
    },
  };
}

export function flukeRevealJob(itemId: string, state: FlukeState): TxJob {
  const maxCost = state.revealPriceRaw;
  return {
    title: "Fluke — めくる",
    chain: INFINITE,
    lines: [
      { label: "アクション", value: "めくる" },
      { label: "対象Guide", value: `#${itemId}` },
      {
        label: "コスト上限",
        value: `${state.revealPriceFormatted}（revealPrice）`,
      },
      { label: "コントラクト", value: FLUKE_CORE_ADDRESS },
    ],
    prepare: async (signer: Wallet) => {
      const core = getFlukeCore(signer);
      const data: string = core.interface.encodeFunctionData("reveal", [
        BigInt(itemId),
        maxCost,
      ]);
      const tx = { to: FLUKE_CORE_ADDRESS, data };
      const gas = await estimateOrFallback(signer, tx, 300000n);
      return {
        gasEstimateText: await gasCostNative(signer, gas, "42"),
        send: async () => [await sendAndWait(signer, tx)],
      };
    },
  };
}

export function flukeBoostJob(
  itemId: string,
  amountRaw: bigint,
  amountFormatted: string,
): TxJob {
  return {
    title: "Fluke — ブースト",
    chain: INFINITE,
    lines: [
      { label: "アクション", value: "ブースト" },
      { label: "対象Guide", value: `#${itemId}` },
      { label: "支払い", value: `${amountFormatted} ZAP` },
      { label: "コントラクト", value: FLUKE_CORE_ADDRESS },
      { label: "注意", value: "ZAPは消費（バーン）されます。" },
    ],
    prepare: async (signer: Wallet) => {
      const approval = await planExactApproval(
        signer,
        ZAP_ADDRESS,
        FLUKE_CORE_ADDRESS,
        amountRaw,
      );
      const core = getFlukeCore(signer);
      const data: string = core.interface.encodeFunctionData("boost", [
        BigInt(itemId),
        amountRaw,
      ]);
      const tx = { to: FLUKE_CORE_ADDRESS, data };
      const gas = await estimateOrFallback(signer, tx, 300000n);
      const totalGas = approval.estimate + gas;
      return {
        gasEstimateText: await gasCostNative(signer, totalGas, "42"),
        send: async () => {
          const hashes: string[] = [];
          if (approval.needed) hashes.push(await approval.send());
          hashes.push(await sendAndWait(signer, tx));
          return hashes;
        },
      };
    },
  };
}

export function flukeSettleJob(recordId: string, signature: string): TxJob {
  return {
    title: "Fluke — 精算",
    chain: INFINITE,
    lines: [
      { label: "アクション", value: "精算" },
      { label: "レコードID", value: recordId },
      { label: "署名", value: "公式サイト発行" },
      { label: "コントラクト", value: FLUKE_CORE_ADDRESS },
    ],
    prepare: async (signer: Wallet) => {
      const core = getFlukeCore(signer);
      const data: string = core.interface.encodeFunctionData("settle", [
        BigInt(recordId),
        signature,
      ]);
      const tx = { to: FLUKE_CORE_ADDRESS, data };
      const gas = await estimateOrFallback(signer, tx, 300000n);
      return {
        gasEstimateText: await gasCostNative(signer, gas, "42"),
        send: async () => [await sendAndWait(signer, tx)],
      };
    },
  };
}

export function starlightRegisterJob(ids: bigint[]): TxJob {
  return {
    title: "Starlight — Guideを登録",
    chain: INFINITE,
    lines: [
      { label: "アクション", value: "登録" },
      {
        label: "対象Guide",
        value: ids.map((i) => `#${i.toString()}`).join(", "),
      },
      { label: "コントラクト", value: STARLIGHT_ADDRESS },
      {
        label: "注意",
        value: "登録中は42の報酬が少しずつたまります。",
      },
    ],
    prepare: async (signer: Wallet) => {
      const ledger = getStarlight(signer);
      const data: string = ledger.interface.encodeFunctionData("register", [
        ids,
      ]);
      const tx = { to: STARLIGHT_ADDRESS, data };
      const gas = await estimateOrFallback(signer, tx, 300000n);
      return {
        gasEstimateText: await gasCostNative(signer, gas, "42"),
        send: async () => [await sendAndWait(signer, tx)],
      };
    },
  };
}

export function starlightClaimJob(ids: bigint[]): TxJob {
  return {
    title: "Starlight — 報酬の受け取り",
    chain: INFINITE,
    lines: [
      { label: "アクション", value: "報酬の受け取り" },
      {
        label: "対象Guide",
        value: ids.map((i) => `#${i.toString()}`).join(", "),
      },
      { label: "コントラクト", value: STARLIGHT_ADDRESS },
    ],
    prepare: async (signer: Wallet) => {
      const ledger = getStarlight(signer);
      const data: string = ledger.interface.encodeFunctionData("claim", [ids]);
      const tx = { to: STARLIGHT_ADDRESS, data };
      const gas = await estimateOrFallback(signer, tx, 300000n);
      return {
        gasEstimateText: await gasCostNative(signer, gas, "42"),
        send: async () => [await sendAndWait(signer, tx)],
      };
    },
  };
}

// ----------------------------------------------------------------- Bridge

export interface BridgeRouterEntry {
  symbol: string;
  router: string;
}

/** Infinite BridgeRouters individually eth_call-verified 2026-10-30
 *  (research/ZAPHOD_FRONTEND.md verified table: QOM/USDT/USDC/WBTC/
 *  BABY/CAW). The remaining /api/state routers (FATHER/HAWK/KET/O/
 *  OSAK) are config-sourced only and deliberately excluded. */
export const BRIDGE_ROUTERS_INFINITE: BridgeRouterEntry[] = [
  { symbol: "QOM", router: INFINITE_CONTRACTS.bridgeRouterQom },
  { symbol: "USDT", router: INFINITE_CONTRACTS.bridgeRouterUsdt },
  { symbol: "USDC", router: INFINITE_CONTRACTS.bridgeRouterUsdc },
  { symbol: "WBTC", router: INFINITE_CONTRACTS.bridgeRouterWbtc },
  {
    symbol: "BABY",
    router:
      BRIDGE_PAIRS_QL1.find((p) => p.symbol === "BABY")
        ?.infiniteBridgeRouter ?? "",
  },
  {
    symbol: "CAW",
    router:
      BRIDGE_PAIRS_QL1.find((p) => p.symbol === "CAW")
        ?.infiniteBridgeRouter ?? "",
  },
];

export const BRIDGE_DESTINATIONS = [
  { domain: 766, label: "QL1" },
  { domain: 1, label: "Ethereum" },
  { domain: 56, label: "BNB Smart Chain" },
] as const;

/** uint256 max sentinel the routers return for "no cap". */
const NO_CAP =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

export interface BridgeDestinationQuote {
  domain: number;
  totalNativeRaw: bigint | null;
  totalNativeFormatted: string | null;
}

export interface BridgeRouterState {
  router: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  version: string | null;
  paused: boolean | null;
  feeBps: number | null;
  feeFlatRaw: bigint | null;
  feeFlatFormatted: string | null;
  minRaw: bigint | null;
  minFormatted: string | null;
  maxRaw: bigint | null;
  maxFormatted: string | null;
  destinations: BridgeDestinationQuote[];
}

export async function fetchBridgeRouterState(
  routerAddress: string,
  chainLike: ProviderChainLike = INFINITE,
  destinations: readonly { domain: number; label: string }[] = BRIDGE_DESTINATIONS,
): Promise<BridgeRouterState> {
  const router = getBridgeRouter(routerAddress, getProvider(chainLike));
  const token: string = await router.token();
  const tokenContract = new Contract(
    token,
    ERC20_READ_ABI,
    getProvider(chainLike),
  ) as any;
  const [symbol, decimals, version, paused, feeBps, feeFlat, min, max] =
    await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals(),
      safe<string>(router.VERSION()),
      safe<boolean>(router.paused()),
      safe<number>(router.feeBps()),
      safe<bigint>(router.feeFlat()),
      safe<bigint>(router.minTransferAmount()),
      safe<bigint>(router.maxTransferAmount()),
    ]);
  const dec = Number(decimals);
  const destQuotes: BridgeDestinationQuote[] = [];
  for (const d of destinations) {
    const allowed = await safe<boolean>(
      router.allowedDestinations(d.domain),
    );
    if (!allowed) continue;
    const q = await safe<any>(router.quoteNative(d.domain, "0x"));
    destQuotes.push({
      domain: d.domain,
      totalNativeRaw: q ? (q.totalNative ?? q[2]) : null,
      totalNativeFormatted: q ? formatUnits(q.totalNative ?? q[2], 18) : null,
    });
  }
  return {
    router: routerAddress,
    token,
    tokenSymbol: symbol,
    tokenDecimals: dec,
    version,
    paused,
    feeBps: feeBps !== null ? Number(feeBps) : null,
    feeFlatRaw: feeFlat,
    feeFlatFormatted:
      feeFlat !== null ? formatUnits(feeFlat, dec) : null,
    minRaw: min,
    minFormatted: min !== null ? formatUnits(min, dec) : null,
    maxRaw: max,
    maxFormatted:
      max !== null && max < NO_CAP ? formatUnits(max, dec) : null,
    destinations: destQuotes,
  };
}

export interface BridgeQuote {
  forwardRaw: bigint;
  forwardFormatted: string;
  feeRaw: bigint;
  feeFormatted: string;
  totalRequiredRaw: bigint;
  totalNativeRaw: bigint;
  totalNativeFormatted: string;
  /** false when quoteNative reverted and totalNative fell back to 0
   *  (only possible with `nativeOptional` — the older BSC/ETH routers) */
  nativeQuoteOk: boolean;
}

export async function fetchBridgeQuote(
  routerAddress: string,
  domain: number,
  amountRaw: bigint,
  tokenDecimals: number,
  chainLike: ProviderChainLike = INFINITE,
  opts?: { nativeOptional?: boolean },
): Promise<BridgeQuote> {
  const router = getBridgeRouter(routerAddress, getProvider(chainLike));
  const qb = await router.quoteBridge(amountRaw);
  // The v1.1/v1.2 routers on BSC/Ethereum REVERT quoteNative (verified
  // on-chain 2026-10-30); the official frontend catches that and sends
  // with value 0. `nativeOptional` mirrors that behaviour exactly.
  const qn = opts?.nativeOptional
    ? await safe<any>(router.quoteNative(domain, "0x"))
    : await router.quoteNative(domain, "0x");
  const forward: bigint = qb.forwardAmount ?? qb[0];
  const fee: bigint = qb.fee ?? qb[1];
  const totalRequired: bigint = qb.totalRequired ?? qb[2];
  const totalNative: bigint = qn ? (qn.totalNative ?? qn[2]) : 0n;
  return {
    forwardRaw: forward,
    forwardFormatted: formatUnits(forward, tokenDecimals),
    feeRaw: fee,
    feeFormatted: formatUnits(fee, tokenDecimals),
    totalRequiredRaw: totalRequired,
    totalNativeRaw: totalNative,
    totalNativeFormatted: formatUnits(totalNative, 18),
    nativeQuoteOk: qn !== null && qn !== undefined,
  };
}

export function bridgeSendJob(args: {
  routerAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  domain: number;
  destinationLabel: string;
  recipient: string;
  amountRaw: bigint;
  amountFormatted: string;
}): TxJob {
  const recipient = getAddress(args.recipient);
  const recipientBytes32 = zeroPadValue(recipient, 32);
  return {
    title: `ブリッジ — ${args.tokenSymbol} を送る`,
    chain: INFINITE,
    lines: [
      { label: "アクション", value: "別のチェーンへ送る" },
      { label: "トークン", value: `${args.amountFormatted} ${args.tokenSymbol}` },
      { label: "送信先チェーン", value: args.destinationLabel },
      { label: "送り先", value: recipient },
      { label: "ルーター", value: args.routerAddress },
      {
        label: "注意",
        value:
          "片道の送信です。届くまで時間がかかる場合があります。",
      },
    ],
    prepare: async (signer: Wallet) => {
      // Fresh quotes at signing time — fees float with the 42 price.
      const quote = await fetchBridgeQuote(
        args.routerAddress,
        args.domain,
        args.amountRaw,
        args.tokenDecimals,
      );
      const approval = await planExactApproval(
        signer,
        args.tokenAddress,
        args.routerAddress,
        args.amountRaw,
      );
      const router = getBridgeRouter(args.routerAddress, signer);
      const data: string = router.interface.encodeFunctionData(
        "transferRemote",
        [args.domain, recipientBytes32, args.amountRaw],
      );
      const tx = {
        to: args.routerAddress,
        data,
        value: quote.totalNativeRaw,
      };
      const gas = await estimateOrFallback(signer, tx, 400000n);
      const totalGas = approval.estimate + gas;
      return {
        gasEstimateText: await gasCostNative(signer, totalGas, "42"),
        send: async () => {
          const hashes: string[] = [];
          if (approval.needed) hashes.push(await approval.send());
          hashes.push(await sendAndWait(signer, tx));
          return hashes;
        },
      };
    },
  };
}

// ------------------------------------------------------- Bridge inbound
// BSC / Ethereum → 42 Chain. Router addresses come from the official
// bridge registry (bridge.zaphod.one /api/state, fetched 2026-10-30)
// and EVERY entry below was verified on-chain the same day via public
// RPCs: getCode non-empty, VERSION() answered, token()/underlying()
// match the registry exactly, allowedDestinations(421018) == true,
// paused() == false, quoteBridge() answers (fee 0, forward quoted in
// source-token units). These routers are v1.1.0/v1.2.0: quoteNative()
// reverts, and the official frontend's own send flow catches that and
// sends transferRemote with value 0 (page chunk, verified) — the
// inbound job mirrors that. Unverified future entries must be added
// with `verified: false` and render as 「準備中」 (never sendable).

export interface BridgeInboundEntry {
  chain: BridgeSourceChain;
  symbol: string;
  router: string;
  verified: boolean;
}

const bscChain = BRIDGE_SOURCE_CHAINS.find((c) => c.key === "bsc")!;
const ethChain = BRIDGE_SOURCE_CHAINS.find((c) => c.key === "ethereum")!;

export const BRIDGE_INBOUND: BridgeInboundEntry[] = [
  { chain: bscChain, symbol: "USDT", router: "0x2f136BaA37Eb5711483D295944EeDa01c4142dA0", verified: true },
  { chain: bscChain, symbol: "USDC", router: "0x4F69A9cF19C7B291b1A2A5dA30B8Ce873d7849fa", verified: true },
  { chain: ethChain, symbol: "USDT", router: "0x56d962fD360bA872115e77E3316909037bfB7E7E", verified: true },
  { chain: ethChain, symbol: "USDC", router: "0x1613e840ef053a3eAcB3278F3982489354CA8199", verified: true },
  { chain: ethChain, symbol: "WBTC", router: "0xF2ecB173b63699C49ace3faae80af5ce677af015", verified: true },
];

/** Destination Hyperlane domain for inbound sends: 42 Chain's EVM id. */
export const BRIDGE_INBOUND_DOMAIN = 421018;
/** All bridged tokens are 18-decimal on 42 Chain. */
const BRIDGE_INBOUND_DST_DECIMALS = 18;

/**
 * Mirror of the official frontend's amount adjustment: amounts are
 * passed to transferRemote in SOURCE-token units, truncated down so
 * they are exactly representable in the destination's decimals.
 */
export function truncateToDstDecimals(
  amountRaw: bigint,
  srcDecimals: number,
  dstDecimals: number = BRIDGE_INBOUND_DST_DECIMALS,
): bigint {
  if (dstDecimals >= srcDecimals) return amountRaw;
  const step = 10n ** BigInt(srcDecimals - dstDecimals);
  return (amountRaw / step) * step;
}

/** The user's native + token balances on a bridge source chain. */
export async function fetchBridgeSourceBalances(
  entry: BridgeInboundEntry,
  tokenAddress: string,
  owner: string,
): Promise<{ nativeRaw: bigint; tokenRaw: bigint }> {
  const provider = getProvider(entry.chain);
  const token = new Contract(tokenAddress, ERC20_READ_ABI, provider) as any;
  const [nativeRaw, tokenRaw] = await Promise.all([
    provider.getBalance(owner),
    token.balanceOf(owner).then((v: any) => BigInt(v)),
  ]);
  return { nativeRaw: BigInt(nativeRaw), tokenRaw };
}

export function bridgeInboundSendJob(args: {
  entry: BridgeInboundEntry;
  tokenAddress: string;
  tokenDecimals: number;
  recipient: string;
  amountRaw: bigint;
  amountFormatted: string;
}): TxJob {
  const { entry } = args;
  const recipient = getAddress(args.recipient);
  const recipientBytes32 = zeroPadValue(recipient, 32);
  const amount = truncateToDstDecimals(args.amountRaw, args.tokenDecimals);
  return {
    title: `ブリッジ — ${entry.symbol} を 42 Chain へ送る`,
    chain: entry.chain,
    lines: [
      { label: "アクション", value: "42 Chainへ送る" },
      {
        label: "トークン",
        value: `${args.amountFormatted} ${entry.symbol}`,
      },
      { label: "送り元", value: entry.chain.displayName },
      { label: "送り先", value: recipient },
      { label: "ルーター", value: entry.router },
      {
        label: "注意",
        value:
          "片道の送信です。届くまで時間がかかる場合があります。",
      },
    ],
    prepare: async (signer: Wallet) => {
      // Fresh quote at signing time; quoteNative may revert on these
      // routers → the native fee falls back to 0, exactly like the
      // official frontend (see fetchBridgeQuote / nativeOptional).
      const quote = await fetchBridgeQuote(
        entry.router,
        BRIDGE_INBOUND_DOMAIN,
        amount,
        args.tokenDecimals,
        entry.chain,
        { nativeOptional: true },
      );
      const approval = await planExactApproval(
        signer,
        args.tokenAddress,
        entry.router,
        amount,
      );
      const router = getBridgeRouter(entry.router, signer);
      const data: string = router.interface.encodeFunctionData(
        "transferRemote",
        [BRIDGE_INBOUND_DOMAIN, recipientBytes32, amount],
      );
      const tx = {
        to: entry.router,
        data,
        value: quote.totalNativeRaw,
      };
      const gas = await estimateOrFallback(signer, tx, 400000n);
      const totalGas = approval.estimate + gas;
      return {
        gasEstimateText: await gasCostNative(
          signer,
          totalGas,
          entry.chain.nativeSymbol,
        ),
        send: async () => {
          const hashes: string[] = [];
          if (approval.needed) hashes.push(await approval.send());
          hashes.push(await sendAndWait(signer, tx));
          return hashes;
        },
      };
    },
  };
}

export function isValidRecipient(v: string): boolean {
  return isAddress(v.trim());
}
