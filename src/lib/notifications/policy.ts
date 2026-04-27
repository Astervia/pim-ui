/**
 * Notification channel policy — single source of truth for the per-event
 * delivery mapping per 05-CONTEXT D-31 + D-33 + RESEARCH §8.
 *
 * Channel semantics:
 *   silent  — no user-facing surface; rely on the dashboard / peer row to update.
 *   toast   — sonner in-app toast (existing Toaster mount in AppShell).
 *   system  — OS notification via tauri-plugin-notification.
 *   both    — OS notification AND toast (rare; critical events only).
 *
 * UX-04 (REQUIREMENTS verbatim): "Toast notifications fire for non-critical
 * lifecycle events (gateway failover, peer connected) — never system
 * notifications except for all-gateways-lost + kill-switch-active".
 *
 * 2026-04-24 STATE.md decision row 5: "Notifications system-fires only
 * on critical events (all-gateways-lost, kill-switch-active)".
 *
 * TBD-PHASE-4-C: kill_switch event consumer — Phase 4 wires the in-app
 * banner via UX-03; Phase 5 owns the OS notification + the toast variant
 * of the `both` channel. Plan 04-06 already shipped the in-app banner;
 * the marker stays for the Plan 05-07 audit grep and so a future audit
 * can locate every kill-switch escalation site.
 *
 * TBD-PHASE-4-D: COPY.md (UX-08) audit. Phase 4 already shipped COPY.md,
 * but Plan 05-07's audit task re-verifies these copy strings against the
 * Aria-copy column of COPY.md. Until that re-audit lands, copy follows
 * UX-PLAN §7 + STYLE.md voice (declarative, no exclamation marks, named
 * events). The marker stays so the re-audit grep is deterministic.
 *
 * Plan 03-06 (Phase 3 Settings → Notifications display) consumes this
 * module's exports for read-only display. Plan 05-06 does NOT modify the
 * Settings file directly to avoid cross-phase file-conflict.
 */

export type NotificationChannel = "silent" | "toast" | "system" | "both";

/**
 * Event keys — composite of source + kind for table-lookup uniqueness.
 * Examples:
 *   "peers.event:connected" → toast
 *   "status.event:kill_switch:engaged" → both (note the engaged sub-key)
 *   "gateway.event:conntrack_pressure:1" → toast
 *   "gateway.event:conntrack_pressure:2" → system
 *   "synthesized:all_gateways_lost" → system
 */
export type EventKey = string;

const CHANNEL_TABLE: Readonly<Record<EventKey, NotificationChannel>> = {
  // peers.event
  "peers.event:connected": "toast",
  "peers.event:disconnected": "silent",
  "peers.event:discovered": "silent",
  "peers.event:pair_failed": "toast",
  "peers.event:state_changed": "silent",

  // status.event (TBD-PHASE-4-C: kill_switch — Phase 4 owns the in-app banner)
  "status.event:interface_up": "silent",
  "status.event:interface_down": "toast",
  "status.event:gateway_selected": "silent",
  "status.event:gateway_lost": "toast",          // failover succeeded — toast only
  "status.event:kill_switch:engaged": "both",    // CRITICAL: D-33
  "status.event:kill_switch:disengaged": "toast",
  "status.event:role_changed": "toast",
  "status.event:route_on": "silent",
  "status.event:route_off": "silent",

  // gateway.event (Plan 05-01 added)
  "gateway.event:enabled": "toast",
  "gateway.event:disabled": "toast",
  "gateway.event:conntrack_pressure:1": "toast",
  "gateway.event:conntrack_pressure:2": "system", // CRITICAL: D-33

  // synthesized — Plan 05-06 detects these UI-side
  "synthesized:all_gateways_lost": "system",      // CRITICAL: D-33
};

export function getChannelFor(eventKey: EventKey): NotificationChannel {
  const channel = CHANNEL_TABLE[eventKey];
  if (channel === undefined) return "silent";
  return channel;
}

/**
 * TOAST_COPY — verbatim per 05-CONTEXT D-34.
 *
 * Each entry is a function that takes any per-event data and returns the
 * final string. Templates use the daemon's verbatim string fields
 * (snake_case from rpc-types.ts) — no translation layer.
 */
export const TOAST_COPY = {
  peerConnected: (label: string | null, shortId: string): string =>
    `${label ?? shortId} connected`,
  gatewayFailover: (newGateway: string, oldGateway: string): string =>
    `Failed over to ${newGateway} — ${oldGateway} lost`,
  killSwitchEngageToast: (): string =>
    `Blocking internet — gateway unreachable. Open pim to fix.`,
  killSwitchDisengage: (): string =>
    `Internet routing restored.`,
  conntrackNearLimit: (pct: number): string =>
    `gateway conntrack near limit (${pct}%).`,
  conntrackSaturatedToast: (): string =>
    `gateway conntrack saturated — connections will drop.`,
  allGatewaysLostToast: (): string =>
    `Mesh has no gateway — internet routing lost.`,
  gatewayEnabled: (natInterface: string): string =>
    `gateway active on ${natInterface}.`,
  gatewayDisabled: (): string =>
    `gateway off.`,
  pairFailed: (label: string | null, shortId: string): string =>
    `Couldn't verify ${label ?? shortId}. See logs.`,
  interfaceDown: (iface: string): string =>
    `interface ${iface} is down — show why →`,
  roleChanged: (role: string): string =>
    `node role: ${role}`,
} as const;

/**
 * SYSTEM_COPY — verbatim per 05-CONTEXT D-34 for the three system / both events.
 *
 * Title is the brand wordmark "pim" (lowercase per STYLE.md logo-usage rule).
 * Body strings are rendered verbatim in the OS notification center; Plan
 * 05-07 audit greps for the verbatim substrings in this file.
 */
export const SYSTEM_COPY = {
  killSwitchEngageSystem: (): { title: string; body: string } => ({
    title: "pim",
    body: "Blocking internet — gateway unreachable. Open pim to fix.",
  }),
  conntrackSaturatedSystem: (): { title: string; body: string } => ({
    title: "pim",
    body: "gateway conntrack saturated — connections will drop.",
  }),
  allGatewaysLostSystem: (): { title: string; body: string } => ({
    title: "pim",
    body: "Mesh has no gateway — internet routing lost.",
  }),
} as const;
