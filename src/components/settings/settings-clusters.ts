/**
 * Settings page domain clusters.
 *
 * UX-PLAN.md §1 P2 forbids organising Settings by user-skill tier
 * ("Basic" vs "Advanced"). Sections are grouped by domain — what they
 * actually do — and the cluster taglines tell the user, in plain
 * language, why these knobs live next to each other.
 *
 * The cluster order matches the existing SECTION_IDS order so every
 * section keeps its position; we only insert typographic dividers
 * between clusters and surface the same grouping in the sticky nav.
 *
 * Each cluster maps onto SECTION_IDS — see `section-schemas.ts`. If a
 * new section is added there, add it to the appropriate cluster too,
 * otherwise it will not be rendered (the cluster registry is the
 * source of truth for ordering on this screen post-redesign).
 */

import type { SectionId } from "@/lib/config/section-schemas";

export interface SettingsCluster {
  id: string;
  /** Lowercase display title — rendered in the nav and divider. */
  title: string;
  /** One-line plain-language framing of what this cluster decides. */
  tagline: string;
  /** Section ids in the order they should render inside this cluster. */
  sections: readonly SectionId[];
}

export const SETTINGS_CLUSTERS: readonly SettingsCluster[] = [
  {
    id: "core",
    title: "core",
    tagline: "who I am · where my data lives",
    sections: ["identity", "interface"],
  },
  {
    id: "reach",
    title: "reach",
    tagline: "how nodes find each other on this network",
    sections: ["discovery", "bluetooth", "bluetooth_rfcomm", "wifi_direct"],
  },
  {
    id: "traffic",
    title: "traffic",
    tagline: "what happens once peers are connected",
    sections: ["transport", "routing", "relay", "gateway"],
  },
  {
    id: "boundary",
    title: "boundary",
    tagline: "who gets in · what surfaces as a notification",
    sections: ["trust", "notifications"],
  },
  {
    id: "raw",
    title: "raw config",
    tagline: "edit pim.toml directly when forms aren't enough",
    sections: ["advanced"],
  },
];
