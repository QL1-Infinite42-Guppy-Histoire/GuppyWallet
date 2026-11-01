import AsyncStorage from "@react-native-async-storage/async-storage";
import { Contract, formatUnits } from "ethers";
import type { TxJob } from "../components/ConfirmTx";
import { tr } from "../i18n";
import {
  BRIDGE_SOURCE_CHAINS,
  BSC_DEX,
  type BridgeSourceChain,
} from "../config/chains";
import { ROUTER_ABI, applySlippage, deadline20Min } from "./dex";
import { ERC20_READ_ABI, getProvider } from "./onchain";
import { estimateOrFallback, gasCostNative, sendAndWait } from "./tx";

/**
 * BSC leg of the cross-chain deposit journey (design doc
 * research/CROSSCHAIN_DEPOSIT_DESIGN.md §8): BNB that arrived on BSC
 * is swapped to USDT on PancakeSwap V2, keeping a little BNB back for
 * gas, and the USDT is then bridged to 42 Chain by the existing
 * inbound bridge (lib/zaphod.ts bridgeInboundSendJob). This module is
 * sequence-internal — BSC does not join the Swap tab.
 *
 * The swap is a payable swapExactETHForTokens with path
 * [WBNB, USDT]: native BNB goes in, so there is no wrap and no
 * approval step. Same Uniswap V2 ABI family (lib/dex.ts ROUTER_ABI)
 * the app already runs for Don't Panic / QomSwap.
 */

export const BSC_CHAIN: BridgeSourceChain =
  BRIDGE_SOURCE_CHAINS.find((c) => c.key === "bsc")!;

export interface BscBalances {
  bnbRaw: bigint;
  usdtRaw: bigint;
}

/** The user's BNB + BSC-USDT balances (both 18 decimals on BSC). */
export async function fetchBscBalances(
  owner: string,
): Promise<BscBalances> {
  const provider = getProvider(BSC_CHAIN);
  const usdt = new Contract(BSC_DEX.usdt, ERC20_READ_ABI, provider) as any;
  const [bnbRaw, usdtRaw] = await Promise.all([
    provider.getBalance(owner),
    usdt.balanceOf(owner).then((v: any) => BigInt(v)),
  ]);
  return { bnbRaw: BigInt(bnbRaw), usdtRaw };
}

export interface BnbUsdtQuote {
  amountIn: bigint;
  amountOut: bigint;
  amountOutFormatted: string;
}

/** Live PancakeSwap V2 quote for BNB → USDT (path [WBNB, USDT]). */
export async function fetchBnbUsdtQuote(
  amountInRaw: bigint,
): Promise<BnbUsdtQuote> {
  const router = new Contract(
    BSC_DEX.router,
    ROUTER_ABI,
    getProvider(BSC_CHAIN),
  ) as any;
  const amounts: bigint[] = await router.getAmountsOut(amountInRaw, [
    BSC_DEX.wbnb,
    BSC_DEX.usdt,
  ]);
  const amountOut = amounts[amounts.length - 1];
  return {
    amountIn: amountInRaw,
    amountOut,
    amountOutFormatted: formatUnits(amountOut, BSC_DEX.usdtDecimals),
  };
}

/**
 * Swap-time keep rule (design doc §8.4): how much BNB, in USD terms,
 * stays behind for the bridge's gas. ~$3 normally (≈3× the $1 BSC
 * gas gate, BRIDGE_GAS_MIN_USD); ~$1.50 when the whole arrival is
 * under ~$4 so a meaningful USDT amount still results; under ~$1.50
 * total the swap is skipped entirely — everything is needed as gas.
 */
export function keepUsdFor(totalUsd: number): { skip: boolean; keepUsd: number } {
  if (totalUsd < 1.5) return { skip: true, keepUsd: totalUsd };
  if (totalUsd < 4) return { skip: false, keepUsd: 1.5 };
  return { skip: false, keepUsd: 3 };
}

/** ConfirmTx job for the journey's BNB → USDT swap (payable, no approval). */
export function bscBnbToUsdtJob(args: {
  amountInRaw: bigint;
  amountInFormatted: string;
  amountOutRaw: bigint;
  amountOutFormatted: string;
  slippageBps: number;
  slippageText: string;
  onDone?: (hashes: string[]) => void;
  onError?: (message: string) => void;
}): TxJob {
  const path = [BSC_DEX.wbnb, BSC_DEX.usdt];
  const minOutDisplay = applySlippage(args.amountOutRaw, args.slippageBps);
  return {
    title: tr("journey.jobTitle"),
    chain: BSC_CHAIN,
    onDone: args.onDone,
    onError: args.onError,
    lines: [
      { label: tr("label.action"), value: tr("journey.jobTitle") },
      { label: tr("label.route"), value: "BNB → USDT" },
      {
        label: tr("label.amountIn"),
        value: `${args.amountInFormatted} BNB`,
      },
      {
        label: tr("label.receiveEst"),
        value: `${args.amountOutFormatted} USDT`,
      },
      {
        label: tr("label.receiveMin"),
        value: `${formatUnits(minOutDisplay, BSC_DEX.usdtDecimals)} USDT${tr("swap.slippageNotePrefix")}${args.slippageText}${tr("swap.slippageNoteSuffix")}`,
      },
      { label: tr("label.router"), value: BSC_DEX.router },
    ],
    prepare: async (signer) => {
      const to = await signer.getAddress();
      const router = new Contract(BSC_DEX.router, ROUTER_ABI, signer) as any;
      // Fresh quote at signing time so the minimum-out tracks the
      // live pool, not the (possibly minutes-old) preview quote.
      const fresh = await fetchBnbUsdtQuote(args.amountInRaw);
      const minOut = applySlippage(fresh.amountOut, args.slippageBps);
      const tx = {
        to: BSC_DEX.router,
        value: args.amountInRaw,
        data: router.interface.encodeFunctionData("swapExactETHForTokens", [
          minOut,
          path,
          to,
          deadline20Min(),
        ]),
      };
      const gas = await estimateOrFallback(signer, tx, 400000n);
      return {
        gasEstimateText: await gasCostNative(signer, gas, "BNB"),
        send: async () => [await sendAndWait(signer, tx)],
      };
    },
  };
}

// ------------------------------------------------- journey persistence
// Where the guided sequence stopped, kept locally so a bridge send
// that failed (or was postponed) can resume from the bridge step
// later. Only the stage + the USDT amount are stored — no keys, and
// wiping it loses nothing but the place in the sequence.

export interface JourneyState {
  stage: "bridge";
  /** USDT amount (formatted, BSC-USDT units) waiting to be bridged */
  usdtAmount: string;
  updatedAt: number;
}

const JOURNEY_KEY = "zaphod.journeyBsc";

export async function loadJourneyState(): Promise<JourneyState | null> {
  try {
    const raw = await AsyncStorage.getItem(JOURNEY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.stage === "bridge" &&
      typeof parsed.usdtAmount === "string" &&
      typeof parsed.updatedAt === "number"
    ) {
      return parsed as JourneyState;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveJourneyState(
  state: JourneyState | null,
): Promise<void> {
  try {
    if (state === null) {
      await AsyncStorage.removeItem(JOURNEY_KEY);
    } else {
      await AsyncStorage.setItem(JOURNEY_KEY, JSON.stringify(state));
    }
  } catch {
    /* best-effort, same discipline as deposit orders */
  }
}
