import { describe, expect, it } from "vitest";
import {
  buildIdentityCardText,
  parseIdentityCard,
} from "./identity-card";

const NODE_ID = "0123456789abcdef0123456789abcdef";
const X25519 =
  "1111111111111111111111111111111111111111111111111111111111111111";

describe("identity-card", () => {
  it("round-trips a fully populated card", () => {
    const text = buildIdentityCardText({
      name: "alice",
      nodeId: NODE_ID,
      meshIp: "10.77.0.10/24",
      x25519Pubkey: X25519,
    });
    const card = parseIdentityCard(text);
    expect(card).toEqual({
      name: "alice",
      nodeId: NODE_ID,
      meshIp: "10.77.0.10/24",
      x25519Pubkey: X25519,
    });
  });

  it("returns null for non-card bodies", () => {
    expect(parseIdentityCard("hello world")).toBeNull();
    expect(parseIdentityCard("")).toBeNull();
    expect(parseIdentityCard("# random heading\nfoo")).toBeNull();
  });

  it("requires a valid node_id", () => {
    const text = `# pim peer identity card\nname:    alice\nnode_id: not-hex\n`;
    expect(parseIdentityCard(text)).toBeNull();
  });

  it("rejects malformed x25519 silently (key cleared, card still parses)", () => {
    const text = `# pim peer identity card
name:    alice
node_id: ${NODE_ID}
x25519:  not-a-real-key
`;
    const card = parseIdentityCard(text);
    expect(card).not.toBeNull();
    expect(card?.x25519Pubkey).toBeNull();
    expect(card?.nodeId).toBe(NODE_ID);
  });

  it("ignores unknown keys (forward-compat)", () => {
    const text = `# pim peer identity card
name:    alice
node_id: ${NODE_ID}
future:  some-new-field
x25519:  ${X25519}
`;
    const card = parseIdentityCard(text);
    expect(card?.nodeId).toBe(NODE_ID);
    expect(card?.x25519Pubkey).toBe(X25519);
  });

  it("tolerates surrounding whitespace and blank lines", () => {
    const text = `\n\n   # pim peer identity card

name:    alice

node_id: ${NODE_ID}
x25519:  ${X25519}

`;
    const card = parseIdentityCard(text);
    expect(card?.nodeId).toBe(NODE_ID);
    expect(card?.name).toBe("alice");
  });

  it("omits x25519 line gracefully when key is missing on build", () => {
    const text = buildIdentityCardText({
      name: null,
      nodeId: NODE_ID,
      meshIp: null,
      x25519Pubkey: null,
    });
    expect(text).toContain("# pim peer identity card");
    expect(text).toContain(`node_id: ${NODE_ID}`);
    expect(text).toContain("x25519:  (not yet learned");
    // Parser should still recognise the card and surface the missing key.
    const card = parseIdentityCard(text);
    expect(card?.nodeId).toBe(NODE_ID);
    expect(card?.x25519Pubkey).toBeNull();
  });
});
