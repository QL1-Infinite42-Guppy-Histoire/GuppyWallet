import { Contract, keccak256, toUtf8Bytes } from "ethers";
import { QL1, QL1_CONTRACTS } from "../config/chains";
import { getProvider } from "./onchain";

/**
 * QNS (.qom domains) — READ-ONLY. New registrations (mint) have ENDED
 * (user-confirmed 2026-10-30); there is deliberately no register flow.
 *
 * The QNSBaseRegistrar is an ENS-style ERC-721 registrar. Verified live
 * from the VM on 2026-10-30:
 *  - tokenId == uint256(keccak256(label)) — proven against a real
 *    instance ("startup" → its Blockscout instance id)
 *  - ownerOf(id) / nameExpires(id) answer on-chain; permanent domains
 *    return nameExpires == uint256 max
 *  - tokenURI(id) is a base64 JSON data URI carrying the full name
 * Owned-domain enumeration uses the QL1 Blockscout API
 * (/api/v2/addresses/{addr}/nft), filtered to the QNS contract.
 */

export const QNS_REGISTRAR = QL1_CONTRACTS.qnsDomains;

const QNS_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function nameExpires(uint256 tokenId) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
] as const;

const MAX_UINT256 = (1n << 256n) - 1n;

function getQns(): any {
  return new Contract(QNS_REGISTRAR, QNS_ABI, getProvider(QL1));
}

/** ENS-style labelhash: the registrar's token id for a bare label. */
export function qnsTokenId(label: string): bigint {
  return BigInt(keccak256(toUtf8Bytes(label.trim().toLowerCase())));
}

export interface QnsLookup {
  label: string;
  name: string;
  tokenId: string;
  /** null when the name is not registered */
  owner: string | null;
  /** true when nameExpires is the permanent sentinel */
  permanent: boolean;
  /** ISO date string for expiring names, else null */
  expiresIso: string | null;
}

/** Look up one name on-chain: owner + expiry state. */
export async function lookupQnsName(rawLabel: string): Promise<QnsLookup> {
  const label = rawLabel.trim().toLowerCase().replace(/\.qom$/i, "");
  const id = qnsTokenId(label);
  const qns = getQns();
  let owner: string | null = null;
  try {
    owner = await qns.ownerOf(id);
  } catch {
    owner = null; // ownerOf reverts for unregistered ids
  }
  let permanent = false;
  let expiresIso: string | null = null;
  if (owner) {
    try {
      const exp: bigint = await qns.nameExpires(id);
      if (exp === MAX_UINT256 || exp > (1n << 200n)) {
        permanent = true;
      } else if (exp > 0n) {
        expiresIso = new Date(Number(exp) * 1000).toISOString();
      }
    } catch {
      /* leave unknown */
    }
  }
  return {
    label,
    name: `${label}.qom`,
    tokenId: id.toString(),
    owner,
    permanent,
    expiresIso,
  };
}

export interface OwnedQnsDomain {
  tokenId: string;
  /** full name like "startup.qom", from explorer metadata / tokenURI */
  name: string | null;
}

/**
 * Domains owned by `address`, via the QL1 explorer's NFT index
 * (first page, up to 50 instances across collections). Returns null
 * when the API is unreachable so the UI can say so honestly.
 */
export async function fetchOwnedQnsDomains(
  address: string,
): Promise<OwnedQnsDomain[] | null> {
  try {
    const res = await fetch(
      `${QL1.explorerUrl}/api/v2/addresses/${address}/nft?type=ERC-721`,
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    const mine = items.filter(
      (it) =>
        String(it?.token?.address_hash ?? "").toLowerCase() ===
        QNS_REGISTRAR.toLowerCase(),
    );
    const out: OwnedQnsDomain[] = [];
    for (const it of mine) {
      let name: string | null =
        typeof it?.metadata?.name === "string" ? it.metadata.name : null;
      if (!name) {
        // Fallback: decode the on-chain tokenURI (base64 JSON data URI).
        try {
          const uri: string = await getQns().tokenURI(BigInt(it.id));
          if (uri.startsWith("data:application/json;base64,")) {
            const json = JSON.parse(
              atob(uri.split(",")[1] ?? ""),
            ) as { name?: string };
            if (typeof json?.name === "string") name = json.name;
          }
        } catch {
          /* name stays null; the token id is still real */
        }
      }
      out.push({ tokenId: String(it.id), name });
    }
    return out;
  } catch {
    return null;
  }
}
