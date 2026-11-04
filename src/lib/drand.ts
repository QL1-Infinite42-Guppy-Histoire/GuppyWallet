import { bls12_381 } from "@noble/curves/bls12-381.js";

/**
 * drand (public randomness beacon) — the real source of Fluke's
 * settle "passcode".
 *
 * How it actually works (recovered 2026-11-04 from the official
 * frontend's own code, then proven end-to-end against the chain):
 * every Fluke entry (commit) is assigned a future drand round number
 * (`rn` in the contract's `recs`). Once that round publishes — the
 * quicknet beacon emits one every 3 seconds — its BLS signature is
 * public data, served by the drand APIs below with no key and no
 * Zaphod backend involved. The Guide contract verifies that
 * signature inside `settle(id, sig)`, so ANYONE can fetch it and
 * settle; the earlier belief that the signature came from
 * fluke.zaphod.one's leaderboard API was a misreading (that API
 * never carried signatures — the frontend computed them from drand
 * client-side and cached them next to its entries).
 *
 * The contract expects the signature NOT in drand's compressed
 * form but as the G1 point's affine coordinates, each hex-padded
 * to 128 chars (64 bytes): 0x ‖ pad(x) ‖ pad(y) = 128 bytes. The
 * official frontend performs exactly this conversion; the identical
 * conversion here was verified by dry-running a real unsettled
 * entry's settle() through eth_call (2026-11-04, entry 418).
 */

const DRAND_CHAIN_HASH =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const DRAND_BASES = ["https://api.drand.sh", "https://drand.cloudflare.com"];

interface DrandRound {
  round: number;
  randomness: string;
  signature: string;
}

async function fetchDrandRound(rn: string): Promise<DrandRound | null> {
  for (const base of DRAND_BASES) {
    try {
      const res = await fetch(`${base}/${DRAND_CHAIN_HASH}/public/${rn}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      if (typeof data?.signature === "string" && data.signature.length > 0) {
        return data as DrandRound;
      }
    } catch {
      // try the next base
    }
  }
  return null;
}

/** Convert a drand G1 signature (compressed hex) to the 128-byte
 *  affine form the Guide contract's settle() verifies. */
export function drandSignatureToSettleBytes(sigHex: string): string {
  const s = sigHex.startsWith("0x") ? sigHex.slice(2) : sigHex;
  const affine = bls12_381.G1.Point.fromHex(s).toAffine();
  const pad = (v: bigint) => v.toString(16).padStart(128, "0");
  return `0x${pad(affine.x)}${pad(affine.y)}`;
}

/**
 * Fetch the settle signature for record round `rn`, polling briefly
 * because the round may publish a few seconds in the future (the
 * official frontend polls 40 × 2 s; here ~30 s, after which the
 * caller can simply let the user retry — nothing is lost).
 * Returns null when the round is not published yet or drand is
 * unreachable; never fabricates a value.
 */
export async function fetchSettleSignatureFromDrand(
  rn: string,
  tries = 15,
  delayMs = 2000,
): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    const round = await fetchDrandRound(rn);
    if (round) {
      try {
        return drandSignatureToSettleBytes(round.signature);
      } catch {
        return null;
      }
    }
    if (i < tries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}
