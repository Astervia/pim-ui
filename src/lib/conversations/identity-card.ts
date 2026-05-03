/**
 * Identity-card message format — used by the "share peer" affordance to
 * forward a peer's `node_id + x25519_pubkey` over an existing E2E
 * conversation. The wire payload is just plain text (so older clients
 * still see something sensible); a small machine-readable header lets
 * newer clients render it as an interactive card with an [ Import ]
 * button instead of a raw monospace dump.
 *
 * The format is intentionally line-oriented + monospace-friendly so a
 * paste into Signal/email reads identically to what the UI renders.
 */

export const IDENTITY_CARD_SENTINEL = "# pim peer identity card";

export interface ParsedIdentityCard {
  /** Friendly label as advertised by the peer when the card was generated. */
  name: string | null;
  /** 32-char lowercase hex NodeId. */
  nodeId: string;
  /** CIDR (e.g. "10.77.0.10/24") if the sharer's daemon knew it. */
  meshIp: string | null;
  /** 64-char lowercase hex X25519 static public key, or null if missing. */
  x25519Pubkey: string | null;
}

const NODE_ID_RE = /^[0-9a-f]{32}$/;
const X25519_RE = /^[0-9a-f]{64}$/;
/**
 * Permissive mesh-ip matcher — accepts an IPv4 with optional CIDR
 * suffix. We only use this to round-trip the existing card format;
 * deeper validation belongs in the daemon if/when it consumes mesh_ip
 * directly from card text.
 */
const MESH_IP_RE = /^\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,3})?$/;

/**
 * Render the canonical identity-card text for a peer, using the same
 * key:value lines the conversation pane's identity card already emits
 * (kept consistent so a card pasted into a chat round-trips losslessly
 * through {@link parseIdentityCard}).
 */
export function buildIdentityCardText(input: {
  name: string | null;
  nodeId: string;
  meshIp: string | null;
  x25519Pubkey: string | null;
}): string {
  const lines = [IDENTITY_CARD_SENTINEL];
  if (input.name !== null && input.name !== "") {
    lines.push(`name:    ${input.name}`);
  }
  lines.push(`node_id: ${input.nodeId}`);
  if (input.meshIp !== null && input.meshIp !== "") {
    lines.push(`mesh_ip: ${input.meshIp}`);
  }
  if (input.x25519Pubkey !== null && input.x25519Pubkey !== "") {
    lines.push(`x25519:  ${input.x25519Pubkey}`);
  } else {
    lines.push("x25519:  (not yet learned — peer must come online or import out-of-band)");
  }
  return lines.join("\n");
}

/**
 * Parse a message body that begins with {@link IDENTITY_CARD_SENTINEL}
 * into a structured card. Returns null when the body does not look
 * like an identity card or when required fields (`node_id`) are
 * missing or malformed — callers should fall back to plain markdown
 * rendering in that case.
 *
 * Tolerates leading/trailing whitespace, extra blank lines, and
 * unrecognized key:value lines (forward-compat for additional fields
 * a future card format may include).
 */
export function parseIdentityCard(body: string): ParsedIdentityCard | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith(IDENTITY_CARD_SENTINEL)) return null;

  const lines = trimmed.split(/\r?\n/);
  let name: string | null = null;
  let nodeId: string | null = null;
  let meshIp: string | null = null;
  let x25519Pubkey: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (value === "") continue;
    switch (key) {
      case "name":
        name = value;
        break;
      case "node_id":
        if (NODE_ID_RE.test(value)) nodeId = value;
        break;
      case "mesh_ip":
        if (MESH_IP_RE.test(value)) meshIp = value;
        break;
      case "x25519":
        if (X25519_RE.test(value)) x25519Pubkey = value;
        break;
      default:
        // Unknown key — ignored for forward-compat.
        break;
    }
  }

  if (nodeId === null) return null;
  return { name, nodeId, meshIp, x25519Pubkey };
}
