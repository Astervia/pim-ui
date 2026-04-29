/**
 * PALETTE_ACTIONS — single source of truth for the ⌘K command palette
 * registry per 05-CONTEXT D-26 + D-27.
 *
 * Registration order LOCKED (RESEARCH §7b): navigate (6) → routing (3) →
 * peers (3) → gateway (3) → logs (2). cmdk uses substring + prefix +
 * Levenshtein scoring; registration order is the tie-breaker, so
 * placing navigate first ensures `g` resolves to "go to gateway" over
 * "gateway preflight".
 *
 * Action labels are VERBATIM per D-27 — no exclamation marks, lowercase,
 * brand voice. Keywords expand search to include synonyms (RESEARCH §7b).
 *
 * TBD-PHASE-4 markers (greppable per RESEARCH §4):
 *   - TBD-PHASE-4-A: route on / route off run handlers — Phase 4 ROUTE-01
 *     wires route.set_split_default RPC. Until then, console.warn + close.
 *   - TBD-PHASE-4-F: show routing table run handler — Phase 4 ROUTE-03
 *     ships the routing screen. Note: post-Phase-4 reality, the routing
 *     screen DOES exist (src/screens/routing.tsx) and ActiveScreenId
 *     already includes "routing" — but per user directive the marker
 *     ships verbatim so a future audit grep finds it; the run handler
 *     stays as a console.warn no-op for now.
 *   - TBD-PHASE-4-G: add peer nearby run handler — emits the Tauri event
 *     pim://open-add-peer matching Plan 05-04's tray Add-peer flow.
 */

import { emit } from "@tauri-apps/api/event";
import type { ActiveScreenId } from "@/hooks/use-active-screen";

export interface PaletteContext {
  setActive: (id: ActiveScreenId) => void;
  closePalette: () => void;
}

export interface PaletteAction {
  id: string;
  group: "navigate" | "routing" | "peers" | "gateway" | "logs";
  // NB. The "peers" group is preserved as a search/grouping label — the
  // dedicated peers screen has been removed and every peers.* action
  // now routes to the Dashboard, where peer management lives inline.
  label: string;
  shortcut?: string;
  keywords?: string[];
  run: (ctx: PaletteContext) => void;
}

export const PALETTE_ACTIONS: readonly PaletteAction[] = [
  // ── navigate (6) ──
  {
    id: "nav.dashboard",
    group: "navigate",
    label: "go to dashboard",
    shortcut: "⌘1",
    run: (ctx) => {
      ctx.setActive("dashboard");
      ctx.closePalette();
    },
  },
  {
    id: "nav.peers",
    group: "navigate",
    label: "go to peers",
    shortcut: "⌘1",
    run: (ctx) => {
      // Peers tab removed — peer management lives on the Dashboard.
      ctx.setActive("dashboard");
      ctx.closePalette();
    },
  },
  {
    id: "nav.routing",
    group: "navigate",
    label: "go to routing",
    shortcut: "⌘3",
    // TBD-PHASE-4-F: routing screen lives in Phase 4 (ROUTE-03). Phase 4
    // already shipped post-plan-authoring, so setActive('routing') would
    // resolve cleanly; the marker stays so a future grep audit finds the
    // navigation surface and a future planner can decide whether to keep
    // the console.warn safety net or wire setActive directly.
    run: (ctx) => {
      // eslint-disable-next-line no-console
      console.warn("TBD-PHASE-4-F: routing screen lands in Phase 4 (ROUTE-03)");
      ctx.closePalette();
    },
  },
  {
    id: "nav.gateway",
    group: "navigate",
    label: "go to gateway",
    shortcut: "⌘4",
    run: (ctx) => {
      ctx.setActive("gateway");
      ctx.closePalette();
    },
  },
  {
    id: "nav.logs",
    group: "navigate",
    label: "go to logs",
    shortcut: "⌘5",
    run: (ctx) => {
      ctx.setActive("logs");
      ctx.closePalette();
    },
  },
  {
    id: "nav.settings",
    group: "navigate",
    label: "go to settings",
    shortcut: "⌘,",
    run: (ctx) => {
      ctx.setActive("settings");
      ctx.closePalette();
    },
  },

  // ── routing (3) ──
  {
    id: "route.on",
    group: "routing",
    label: "route on  (turn on split-default routing)",
    keywords: ["split-default", "internet via mesh", "route-on"],
    run: (ctx) => {
      // TBD-PHASE-4-A: route on requires Phase 4 ROUTE-01
      // (route.set_split_default RPC). Until then, log + close.
      // eslint-disable-next-line no-console
      console.warn("TBD-PHASE-4-A: route on requires ROUTE-01");
      ctx.closePalette();
    },
  },
  {
    id: "route.off",
    group: "routing",
    label: "route off (turn off split-default routing)",
    keywords: ["split-default", "internet via mesh", "route-off"],
    run: (ctx) => {
      // TBD-PHASE-4-A: route off requires Phase 4 ROUTE-01.
      // eslint-disable-next-line no-console
      console.warn("TBD-PHASE-4-A: route off requires ROUTE-01");
      ctx.closePalette();
    },
  },
  {
    id: "route.table",
    group: "routing",
    label: "show routing table",
    keywords: ["routes", "table", "topology"],
    // TBD-PHASE-4-F: same routing screen marker as nav.routing.
    run: (ctx) => {
      // eslint-disable-next-line no-console
      console.warn("TBD-PHASE-4-F: routing table screen lands in Phase 4 (ROUTE-03)");
      ctx.closePalette();
    },
  },

  // ── peers (3) ──
  {
    id: "peers.list",
    group: "peers",
    label: "peers list",
    keywords: ["peers", "list"],
    run: (ctx) => {
      ctx.setActive("dashboard");
      ctx.closePalette();
    },
  },
  {
    id: "peers.add_nearby",
    group: "peers",
    label: "add peer nearby",
    keywords: ["pair", "QR", "BLE", "nearby"],
    run: (ctx) => {
      // TBD-PHASE-4-G: emit the same Tauri event Plan 05-04's tray
      // emits, so a single listener can route the user to the existing
      // Phase 2 Nearby panel — Phase 4 PEER-05/06 may extend the flow.
      ctx.setActive("dashboard");
      ctx.closePalette();
      void emit("pim://open-add-peer", {}).catch(() => {});
    },
  },
  {
    id: "peers.invite",
    group: "peers",
    label: "invite peer",
    keywords: ["invite", "pim://", "remote"],
    run: (ctx) => {
      // Phase 4 owns the invite flow; for now navigate to peers where
      // Plan 04-05 mounted the InvitePeerSheet trigger.
      ctx.setActive("dashboard");
      ctx.closePalette();
    },
  },

  // ── gateway (3) ──
  {
    id: "gateway.preflight",
    group: "gateway",
    label: "gateway preflight",
    keywords: ["iptables", "cap_net_admin", "checks"],
    run: (ctx) => {
      ctx.setActive("gateway");
      ctx.closePalette();
    },
  },
  {
    id: "gateway.enable",
    group: "gateway",
    label: "gateway enable (linux)",
    keywords: ["nat", "linux"],
    run: (ctx) => {
      ctx.setActive("gateway");
      ctx.closePalette();
    },
  },
  {
    id: "gateway.disable",
    group: "gateway",
    label: "gateway disable (linux)",
    keywords: ["nat", "linux", "off"],
    run: (ctx) => {
      ctx.setActive("gateway");
      ctx.closePalette();
    },
  },

  // ── logs (2) ──
  {
    id: "logs.subscribe",
    group: "logs",
    label: "logs subscribe (open logs tab)",
    keywords: ["log", "stream", "tail"],
    run: (ctx) => {
      ctx.setActive("logs");
      ctx.closePalette();
    },
  },
  {
    id: "logs.export_snapshot",
    group: "logs",
    label: "export debug snapshot",
    keywords: ["json", "export", "debug", "snapshot"],
    run: (ctx) => {
      // OBS-03 shipped in Phase 3 (Plan 03-03 — D-23 schema). The palette
      // navigates to Logs where the [ Export debug snapshot ] button lives.
      ctx.setActive("logs");
      ctx.closePalette();
    },
  },
];
