import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEPOSIT_DEST,
  DEPOSIT_SOURCES,
  PROXY_BASE_URL,
  type DepositSourceDef,
} from "../config/deposit";
import { tr } from "../i18n";

/**
 * Cross-chain deposit orders (ChangeNOW via our proxy — see
 * proxy/README.md and research/CROSSCHAIN_DEPOSIT_DESIGN.md §8).
 *
 * The wallet only creates orders and reads their status. It never
 * holds the user's XLM/SOL and never holds a provider key. Order
 * records are stored locally only: wiping the app loses the tracking,
 * never the funds (the payout address is the user's own BSC address,
 * and the existing deposit detection still sees the BNB arrive).
 */

export interface DepositOrder {
  /** ChangeNOW exchange id — also the reference for their support. */
  id: string;
  source: DepositSourceDef["key"];
  /** Amount of the source asset the user must send, as entered. */
  fromAmount: string;
  /** Expected BNB out at creation time (estimate, may move). */
  expectedTo: string | null;
  /** Actual BNB out once known (finished orders). */
  actualTo: string | null;
  /** Where the user sends their XLM/SOL. */
  payinAddress: string;
  /** Memo for XLM deposits (ChangeNOW calls it payinExtraId). */
  payinExtraId: string | null;
  payoutAddress: string;
  /** Raw provider status string, mapped for display by depositPhase. */
  status: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "zaphod.depositOrders";

export function depositSourceDef(
  key: DepositSourceDef["key"],
): DepositSourceDef {
  return DEPOSIT_SOURCES.find((s) => s.key === key) ?? DEPOSIT_SOURCES[0];
}

export async function loadDepositOrders(): Promise<DepositOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is DepositOrder =>
        o &&
        typeof o.id === "string" &&
        (o.source === "xlm" || o.source === "sol") &&
        typeof o.fromAmount === "string" &&
        typeof o.payinAddress === "string" &&
        typeof o.status === "string" &&
        typeof o.createdAt === "number",
    );
  } catch {
    return [];
  }
}

export async function saveDepositOrders(
  orders: DepositOrder[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    /* best-effort, same discipline as customTokens */
  }
}

// ---- Proxy client ----

function proxyBase(): string {
  const base = PROXY_BASE_URL.trim().replace(/\/+$/, "");
  if (!base) throw new Error(tr("deposit.errProxyOff"));
  return base;
}

async function proxyJson(path: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${proxyBase()}${path}`, init);
  } catch {
    throw new Error(tr("deposit.errNetwork"));
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error bodies fall through to the status check */
  }
  if (!res.ok) {
    const message =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

function saneAmount(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Live minimum for a source (in the source asset), via the proxy. */
export async function fetchDepositMin(
  sourceKey: DepositSourceDef["key"],
): Promise<number | null> {
  const def = depositSourceDef(sourceKey);
  const data = await proxyJson(`/range?from=${def.currency}`);
  return saneAmount(data?.minAmount);
}

/** Expected BNB out for a given source amount, via the proxy. */
export async function fetchDepositEstimate(
  sourceKey: DepositSourceDef["key"],
  fromAmount: string,
): Promise<number | null> {
  const def = depositSourceDef(sourceKey);
  const q = new URLSearchParams({
    from: def.currency,
    to: `${DEPOSIT_DEST.currency}${DEPOSIT_DEST.network}`,
    amount: fromAmount,
  });
  const data = await proxyJson(`/estimate?${q.toString()}`);
  return saneAmount(data?.toAmount);
}

/** Create an exchange order; returns the locally stored record. */
export async function createDepositOrder(
  sourceKey: DepositSourceDef["key"],
  fromAmount: string,
  payoutAddress: string,
): Promise<DepositOrder> {
  const def = depositSourceDef(sourceKey);
  const data = await proxyJson("/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromCurrency: def.currency,
      fromNetwork: def.network,
      toCurrency: DEPOSIT_DEST.currency,
      toNetwork: DEPOSIT_DEST.network,
      fromAmount,
      payoutAddress,
    }),
  });
  if (!data?.id || !data?.payinAddress) {
    throw new Error(tr("deposit.errNetwork"));
  }
  const now = Date.now();
  return {
    id: String(data.id),
    source: sourceKey,
    fromAmount,
    expectedTo:
      data.amountExpectedTo != null
        ? String(data.amountExpectedTo)
        : data.amountTo != null
          ? String(data.amountTo)
          : null,
    actualTo: null,
    payinAddress: String(data.payinAddress),
    payinExtraId:
      data.payinExtraId != null && String(data.payinExtraId) !== ""
        ? String(data.payinExtraId)
        : null,
    payoutAddress,
    status: typeof data.status === "string" ? data.status : "waiting",
    createdAt: now,
    updatedAt: now,
  };
}

/** Refresh one order's status from the provider; returns the patch. */
export async function fetchDepositStatus(
  order: DepositOrder,
): Promise<Partial<DepositOrder>> {
  const data = await proxyJson(`/status/${encodeURIComponent(order.id)}`);
  const patch: Partial<DepositOrder> = { updatedAt: Date.now() };
  if (typeof data?.status === "string") patch.status = data.status;
  if (data?.amountTo != null && Number(data.amountTo) > 0) {
    patch.actualTo = String(data.amountTo);
  }
  return patch;
}

// ---- Status mapping (plain steps for the UI) ----

export type DepositPhase =
  | "waiting"
  | "confirming"
  | "exchanging"
  | "sending"
  | "finished"
  | "failed"
  | "refunded"
  | "verifying";

export function depositPhase(status: string): DepositPhase {
  switch (status) {
    case "new":
    case "waiting":
      return "waiting";
    case "confirming":
      return "confirming";
    case "exchanging":
      return "exchanging";
    case "sending":
      return "sending";
    case "finished":
      return "finished";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    case "verifying":
      return "verifying";
    default:
      // Unknown provider status: never claim progress we cannot see.
      return "waiting";
  }
}

/** The five plain steps shown for an in-flight order, in order. */
export const DEPOSIT_STEP_PHASES: DepositPhase[] = [
  "waiting",
  "confirming",
  "exchanging",
  "sending",
  "finished",
];

export function isDepositFinal(phase: DepositPhase): boolean {
  return phase === "finished" || phase === "failed" || phase === "refunded";
}
