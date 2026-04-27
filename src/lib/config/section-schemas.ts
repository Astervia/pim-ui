/**
 * Registry of the nine settings sections (03-CONTEXT D-04) and the
 * form-mapped TOML keys each one owns. This is the source of truth
 * for:
 *   - Plan 03-04 / 03-05 form scaffolding (which fields each section renders)
 *   - schema-diff.ts (which keys count as "form-mapped" — any parsed
 *     TOML key outside this list flips raw-is-source-of-truth for
 *     that section, per CONF-07 / D-15)
 *   - assemble-toml.ts (which keys to overwrite with form values when
 *     building the save payload)
 *
 * Wire names are VERBATIM from docs/RPC.md / pim.toml — snake_case,
 * no translation. Labels / help text for UI display live in the
 * section components, not here.
 */
export const SECTION_IDS = [
  "identity",
  "transport",
  "discovery",
  "trust",
  "routing",
  "gateway",
  "notifications",
  "advanced",
  "about",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export interface SectionSchema {
  id: SectionId;
  /** Uppercase title rendered in CliPanel header (03-UI-SPEC §Settings page). */
  title: string;
  /**
   * Daemon TOML paths this section exposes in its form view.
   * "transport.listen_port", "discovery.broadcast", etc. A parsed
   * TOML key NOT in this list flips section rawWins = true.
   * Empty arrays are valid (gateway/about — no form knobs in Phase 3).
   */
  tomlKeys: readonly string[];
}

export const SECTION_SCHEMAS: Readonly<Record<SectionId, SectionSchema>> = {
  identity: {
    id: "identity",
    title: "IDENTITY",
    tomlKeys: ["node.name"],
  },
  transport: {
    id: "transport",
    title: "TRANSPORT",
    tomlKeys: [
      "transport.interface",
      "transport.mtu",
      "transport.mesh_ip.mode",
      "transport.mesh_ip.value",
      "transport.listen_port",
    ],
  },
  discovery: {
    id: "discovery",
    title: "DISCOVERY",
    tomlKeys: [
      "discovery.broadcast",
      "discovery.bluetooth",
      "discovery.wifi_direct",
      "discovery.auto_connect",
    ],
  },
  trust: {
    id: "trust",
    title: "TRUST",
    tomlKeys: ["security.authorization"],
    // Note: trust_store is read-only in Phase 3 per D-19; not listed here
    // because the form cannot write it (deferred-idea per CONTEXT).
  },
  routing: {
    id: "routing",
    title: "ROUTING",
    tomlKeys: ["routing.max_hops"],
  },
  gateway: {
    id: "gateway",
    title: "GATEWAY",
    // Phase 5 owns all gateway knobs (GATE-01..04). Phase 3 renders
    // the placeholder section only; no form fields.
    tomlKeys: [],
  },
  notifications: {
    id: "notifications",
    title: "NOTIFICATIONS",
    tomlKeys: [
      "notifications.all_gateways_lost",
      "notifications.kill_switch",
    ],
  },
  advanced: {
    id: "advanced",
    title: "ADVANCED — RAW CONFIG",
    // The raw TOML editor saves the textarea verbatim; no form-mapped keys.
    tomlKeys: [],
  },
  about: {
    id: "about",
    title: "ABOUT",
    tomlKeys: [],
  },
};
