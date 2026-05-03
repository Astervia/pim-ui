/**
 * PALETTE_ACTIONS — single source of truth for the ⌘K command palette
 * registry per 05-CONTEXT D-26 + D-27.
 *
 * Registration order LOCKED (RESEARCH §7b): navigate → routing → peers →
 * gateway → logs → settings. cmdk uses substring + prefix + Levenshtein
 * scoring; registration order is the tie-breaker, so placing navigate
 * first ensures `g` resolves to "go to gateway" over "gateway preflight".
 *
 * Action labels are VERBATIM per D-27 — no exclamation marks, lowercase,
 * brand voice. Keywords expand search to include synonyms (RESEARCH §7b).
 */

import { emit } from "@tauri-apps/api/event";
import { toast } from "sonner";
import type { ActiveScreenId } from "@/hooks/use-active-screen";
import type { AppMode } from "@/hooks/use-app-mode";
import { callDaemon } from "@/lib/rpc";

export interface PaletteContext {
  setActive: (id: ActiveScreenId) => void;
  closePalette: () => void;
  setMode: (mode: AppMode) => void;
  openInvite: () => void;
}

export interface PaletteAction {
  id: string;
  group: "navigate" | "routing" | "peers" | "gateway" | "logs" | "settings";
  // NB. The "peers" group is preserved as a search/grouping label — the
  // dedicated peers screen has been removed and every peers.* action
  // now routes to the Dashboard, where peer management lives inline.
  label: string;
  shortcut?: string;
  keywords?: string[];
  run: (ctx: PaletteContext) => void;
}

function dispatchSettingsEvent(name: string): void {
  // SettingsScreen attaches its window listeners on mount via useEffect.
  // When the palette navigates from another tab, we have to wait for the
  // screen to render before the listener exists. A double rAF is enough
  // for React 19 to commit + run effects.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(name));
    });
  });
}

export const PALETTE_ACTIONS: readonly PaletteAction[] = [
  // ── navigate (8) ──
  {
    id: "nav.dashboard",
    group: "navigate",
    label: "go to dashboard",
    shortcut: "⌘1",
    keywords: ["home", "peers", "overview"],
    run: (ctx) => {
      ctx.setActive("dashboard");
      ctx.closePalette();
    },
  },
  {
    id: "nav.messages",
    group: "navigate",
    label: "go to messages",
    shortcut: "⌘2",
    keywords: ["chat", "conversation", "encrypted"],
    run: (ctx) => {
      ctx.setActive("messages");
      ctx.closePalette();
    },
  },
  {
    id: "nav.routing",
    group: "navigate",
    label: "go to routing",
    shortcut: "⌘3",
    keywords: ["routes", "split-default", "kill-switch"],
    run: (ctx) => {
      ctx.setActive("routing");
      ctx.closePalette();
    },
  },
  {
    id: "nav.gateway",
    group: "navigate",
    label: "go to gateway",
    shortcut: "⌘4",
    keywords: ["nat", "egress", "internet"],
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
    keywords: ["debug", "stream", "trace"],
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
    keywords: ["preferences", "config", "toml"],
    run: (ctx) => {
      ctx.setActive("settings");
      ctx.closePalette();
    },
  },
  {
    id: "nav.about",
    group: "navigate",
    label: "go to about",
    shortcut: "⌘7",
    keywords: ["version", "credits", "shortcuts", "build", "repo"],
    run: (ctx) => {
      ctx.setActive("about");
      ctx.closePalette();
    },
  },
  {
    id: "nav.simple_mode",
    group: "navigate",
    label: "switch to simple mode",
    shortcut: "⌘\\",
    keywords: ["one-button", "guided", "novice"],
    run: (ctx) => {
      ctx.setMode("simple");
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
      ctx.closePalette();
      void callDaemon("route.set_split_default", { on: true }).catch(
        (e: unknown) => {
          const msg =
            e !== null && typeof e === "object" && "message" in e
              ? String((e as { message: unknown }).message ?? "")
              : String(e);
          toast.error(`couldn't enable routing: ${msg}`);
        },
      );
    },
  },
  {
    id: "route.off",
    group: "routing",
    label: "route off (turn off split-default routing)",
    keywords: ["split-default", "internet via mesh", "route-off"],
    run: (ctx) => {
      ctx.closePalette();
      void callDaemon("route.set_split_default", { on: false }).catch(
        (e: unknown) => {
          const msg =
            e !== null && typeof e === "object" && "message" in e
              ? String((e as { message: unknown }).message ?? "")
              : String(e);
          toast.error(`couldn't turn off routing: ${msg}`);
        },
      );
    },
  },
  {
    id: "route.table",
    group: "routing",
    label: "show routing table",
    keywords: ["routes", "table", "topology"],
    run: (ctx) => {
      ctx.setActive("routing");
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
      // Emit the same Tauri event Plan 05-04's tray emits, so a single
      // listener can route the user to the existing Phase 2 Nearby
      // panel. The shell-level `pim://open-add-peer` listener owns the
      // actual navigation target.
      ctx.setActive("dashboard");
      ctx.closePalette();
      void emit("pim://open-add-peer", {}).catch(() => {});
    },
  },
  {
    id: "peers.invite",
    group: "peers",
    label: "invite peer",
    keywords: ["invite", "pim://", "remote", "share"],
    run: (ctx) => {
      ctx.openInvite();
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

  // ── settings (3) ──
  {
    id: "settings.filter",
    group: "settings",
    label: "filter settings sections",
    shortcut: "⌘F",
    keywords: ["search", "find", "filter"],
    run: (ctx) => {
      ctx.setActive("settings");
      ctx.closePalette();
      dispatchSettingsEvent("pim:settings-focus-search");
    },
  },
  {
    id: "settings.expand_all",
    group: "settings",
    label: "expand all settings sections",
    shortcut: "⌘↓",
    keywords: ["open", "unfold", "show"],
    run: (ctx) => {
      ctx.setActive("settings");
      ctx.closePalette();
      dispatchSettingsEvent("pim:settings-expand-all");
    },
  },
  {
    id: "settings.collapse_all",
    group: "settings",
    label: "collapse all settings sections",
    shortcut: "⌘↑",
    keywords: ["close", "fold", "hide"],
    run: (ctx) => {
      ctx.setActive("settings");
      ctx.closePalette();
      dispatchSettingsEvent("pim:settings-collapse-all");
    },
  },
];
