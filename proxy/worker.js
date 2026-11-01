/**
 * GuppyWallet — cross-chain deposit proxy (Cloudflare Workers).
 *
 * A tiny, stateless passthrough to the ChangeNOW v2 API. Its only jobs:
 *   1. Hold the ChangeNOW partner API key server-side (Worker secret
 *      CHANGENOW_API_KEY) so it never ships inside the app.
 *   2. Restrict traffic to exactly the pairs this feature uses
 *      (XLM/SOL -> BNB on BSC) and sanity-check inputs.
 *   3. Give us a kill switch (env KILL_SWITCH = "1") without an app
 *      release.
 *
 * It stores nothing, keeps no database, and does not log request
 * bodies or addresses. Funds never pass through here — this worker
 * only creates exchange orders and reads their status. The user's
 * money flows: their own XLM/SOL wallet -> ChangeNOW -> their own
 * BSC address.
 *
 * Routes:
 *   GET  /              health check (no key material, ever)
 *   POST /create        {fromCurrency, fromNetwork, toCurrency,
 *                        toNetwork, fromAmount, payoutAddress}
 *                       -> POST api.changenow.io/v2/exchange
 *   GET  /status/:id    -> GET  api.changenow.io/v2/exchange/by-id
 *   GET  /estimate?from=xlm&to=bnbbsc&amount=30
 *                       -> GET  api.changenow.io/v2/exchange/estimated-amount
 *   GET  /range?from=xlm
 *                       -> GET  api.changenow.io/v2/exchange/range
 */

const UPSTREAM = "https://api.changenow.io";

/** Source assets this feature may start from (ticker -> network). */
const SOURCES = {
  xlm: "xlm", // Stellar
  sol: "sol", // Solana
};

/** The only payout this feature uses: BNB on BSC. */
const DEST = { currency: "bnb", network: "bsc" };

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ORDER_ID = /^[A-Za-z0-9_-]{1,64}$/;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function pairAllowed(fromCurrency, fromNetwork, toCurrency, toNetwork) {
  const from = String(fromCurrency ?? "").toLowerCase();
  const expectedNetwork = SOURCES[from];
  if (!expectedNetwork) return false;
  return (
    String(fromNetwork ?? "").toLowerCase() === expectedNetwork &&
    String(toCurrency ?? "").toLowerCase() === DEST.currency &&
    String(toNetwork ?? "").toLowerCase() === DEST.network
  );
}

/** Resolve the ?from= / ?to= shorthand used by /estimate and /range. */
function resolvePair(url) {
  const from = (url.searchParams.get("from") ?? "").toLowerCase();
  const to = (url.searchParams.get("to") ?? "bnbbsc").toLowerCase();
  const fromNetwork = SOURCES[from];
  if (!fromNetwork) return null;
  if (to !== "bnbbsc" && to !== "bnb") return null;
  return {
    fromCurrency: from,
    fromNetwork,
    toCurrency: DEST.currency,
    toNetwork: DEST.network,
  };
}

async function upstream(env, path, init = {}) {
  const res = await fetch(`${UPSTREAM}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-changenow-api-key": env.CHANGENOW_API_KEY,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: "upstream_non_json", raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

/** Forward an upstream result, keeping its status code and JSON body. */
function forward({ status, body }) {
  return json(status, body);
}

async function handleCreate(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const {
    fromCurrency,
    fromNetwork,
    toCurrency,
    toNetwork,
    fromAmount,
    payoutAddress,
  } = payload ?? {};

  if (!pairAllowed(fromCurrency, fromNetwork, toCurrency, toNetwork)) {
    return json(400, { error: "pair_not_allowed" });
  }
  const amount = Number(fromAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return json(400, { error: "invalid_amount" });
  }
  if (typeof payoutAddress !== "string" || !EVM_ADDRESS.test(payoutAddress)) {
    return json(400, { error: "invalid_payout_address" });
  }

  const result = await upstream(env, "/v2/exchange", {
    method: "POST",
    body: JSON.stringify({
      fromCurrency: String(fromCurrency).toLowerCase(),
      fromNetwork: String(fromNetwork).toLowerCase(),
      toCurrency: DEST.currency,
      toNetwork: DEST.network,
      fromAmount: String(fromAmount),
      address: payoutAddress,
      flow: "standard",
      type: "direct",
    }),
  });
  return forward(result);
}

async function handleStatus(id, env) {
  if (!ORDER_ID.test(id)) return json(400, { error: "invalid_id" });
  const result = await upstream(
    env,
    `/v2/exchange/by-id?id=${encodeURIComponent(id)}`,
  );
  return forward(result);
}

async function handleEstimate(url, env) {
  const pair = resolvePair(url);
  if (!pair) return json(400, { error: "pair_not_allowed" });
  const amount = Number(url.searchParams.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return json(400, { error: "invalid_amount" });
  }
  const q = new URLSearchParams({
    ...pair,
    fromAmount: String(amount),
    fromAmountType: "from",
    flow: "standard",
    type: "direct",
  });
  const result = await upstream(env, `/v2/exchange/estimated-amount?${q}`);
  return forward(result);
}

async function handleRange(url, env) {
  const pair = resolvePair(url);
  if (!pair) return json(400, { error: "pair_not_allowed" });
  const q = new URLSearchParams({ ...pair, flow: "standard" });
  const result = await upstream(env, `/v2/exchange/range?${q}`);
  return forward(result);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return json(200, { ok: true, service: "guppy-deposit-proxy" });
    }
    if (env.KILL_SWITCH === "1") {
      return json(503, { error: "disabled" });
    }
    if (!env.CHANGENOW_API_KEY) {
      return json(500, { error: "proxy_not_configured" });
    }

    try {
      if (url.pathname === "/create" && request.method === "POST") {
        return await handleCreate(request, env);
      }
      const statusMatch = url.pathname.match(/^\/status\/(.+)$/);
      if (statusMatch && request.method === "GET") {
        return await handleStatus(statusMatch[1], env);
      }
      if (url.pathname === "/estimate" && request.method === "GET") {
        return await handleEstimate(url, env);
      }
      if (url.pathname === "/range" && request.method === "GET") {
        return await handleRange(url, env);
      }
      return json(404, { error: "not_found" });
    } catch {
      return json(502, { error: "upstream_unreachable" });
    }
  },
};
