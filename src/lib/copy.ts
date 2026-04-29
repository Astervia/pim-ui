/**
 * Phase 4 locked-string export module.
 *
 * Source of truth: `docs/COPY.md` §6 (Components — locked strings).
 * Decision authority: `04-CONTEXT.md` D-26.
 *
 * Every constant here mirrors a `docs/COPY.md` §6 entry verbatim. Any
 * change to a string in this file MUST round-trip through `docs/COPY.md`
 * — the audit script (`scripts/audit-copy.mjs`, `pnpm audit:copy`) uses
 * the doc as authority and will fail-build on drift.
 *
 * Brand absolutes (D-36, carried from Phases 1/2/01.1):
 * - No exclamation marks anywhere in any string literal here.
 * - Bang-free conditionals throughout — this module is data, not logic.
 * - TypeScript infers each constant's literal type from the string
 *   literal itself; we do not annotate `: string` so call sites can
 *   discriminate on the literal value when useful.
 *
 * Phase 4 plans (04-02 through 04-06) import from this module rather
 * than typing strings inline. The audit script then has a single
 * file to verify against `docs/COPY.md`.
 */

// ─── KillSwitchBanner (D-22) ─────────────────────────────────────────

export const KILL_SWITCH_HEADLINE = "✗ BLOCKING INTERNET — gateway unreachable";
export const KILL_SWITCH_BODY =
  "pim is keeping you off the internet because the routing gateway is gone. Turn off routing to use your normal connection.";
export const KILL_SWITCH_ACTION = "[ TURN OFF KILL-SWITCH ]";

// ─── RouteTogglePanel (D-11, D-12, D-26 §6) ──────────────────────────

export const ROUTE_OFF_BODY =
  "internet uses your normal connection · not routed through the mesh";
export const ROUTE_TOGGLE_TURN_ON = "[ TURN ON ROUTING ]";
export const ROUTE_TOGGLE_TURN_OFF = "[ TURN OFF ROUTING ]";
export const ROUTE_TOGGLE_CONFIRM = "[ CONFIRM TURN ON ]";
export const ROUTE_TOGGLE_CANCEL = "[ CANCEL ]";

// Pre-flight pass copy templates (D-12). Use these via small helpers
// in routing.ts; the literal strings here are the audit-locked source.
export const PREFLIGHT_INTERFACE_UP_TEMPLATE = "interface up ({iface_name})";
export const PREFLIGHT_GATEWAY_REACHABLE_TEMPLATE =
  "gateway reachable ({label} · {latency}ms)";
export const PREFLIGHT_SPLIT_DEFAULT_SUPPORTED =
  "split-default routing supported";

// Pre-flight failure copy.
export const PREFLIGHT_INTERFACE_DOWN_TEMPLATE =
  "interface {iface_name} is down · check transport logs";
export const PREFLIGHT_NO_GATEWAY =
  "no gateway is advertising itself · pair with a gateway-capable peer or run pim on a Linux device";
export const PREFLIGHT_DAEMON_TOO_OLD =
  "daemon does not advertise route.set_split_default · upgrade pim-daemon";

// ─── WelcomeScreen (D-02) ────────────────────────────────────────────

export const WELCOME_TITLE = "█ pim · ready";
export const WELCOME_SECTION = "YOU'RE SET";
export const WELCOME_SUBTITLE = "Two ways to start.";
export const WELCOME_ADD_LABEL = "[ ADD PEER NEARBY ]";
export const WELCOME_ADD_DESC =
  "pair with someone in the same room — uses broadcast on your local network.";
export const WELCOME_SOLO_LABEL = "[ RUN SOLO ]";
export const WELCOME_SOLO_DESC =
  "skip pairing for now. you can add peers anytime from the dashboard.";

// ─── InvitePeerSheet (D-08) ──────────────────────────────────────────

export const INVITE_TITLE = "INVITE A REMOTE PEER";
export const INVITE_BODY_INTRO =
  "Remote invites need an RPC the v1 daemon does not yet ship.";
export const INVITE_INSTALL_LINE =
  "For now, send your peer this link to install pim on their device:";
export const INVITE_URL = "github.com/Astervia/proximity-internet-mesh";
export const INVITE_PAIRING_LINE =
  "Once installed, both devices on the same Wi-Fi can pair via Add peer nearby.";
export const INVITE_ROADMAP_LINE = "Remote invite RPC: planned for v0.6.";
export const INVITE_COPY_LINK = "[ COPY LINK ]";
export const INVITE_COPIED = "[ COPIED ]";
export const INVITE_FULL_URL = "https://github.com/Astervia/proximity-internet-mesh";

// ─── PeerRow handshake-fail sub-line (D-24) ──────────────────────────

export const HANDSHAKE_FAIL_SUBLINE =
  "Couldn't verify this peer · → docs/SECURITY.md §3.2";
export const SECURITY_DOCS_URL =
  "https://github.com/Astervia/proximity-internet-mesh/blob/main/docs/SECURITY.md#32-handshake-failures";

// ─── RouteScreen empty states (D-17) ─────────────────────────────────

export const ROUTE_TABLE_EMPTY = "no routes yet · waiting for advertisements";
export const KNOWN_GATEWAYS_EMPTY =
  "no gateways known · pair with a gateway-capable peer or run pim on a Linux device";
export const ROUTE_TABLE_REFRESH = "[ refresh ]";

// ─── Phase 3 — empty-state teaching microcopy (UX-PLAN P5) ──────────
//
// Headlines mirror the previously-inline verbatim copy each panel used
// before Phase 3. The `_NEXT` lines are the new teaching microcopy that
// renders as a second line under the headline inside <TeachingEmptyState />.
// Same voice rules apply — present tense, no hedges, no exclamation marks.

export const EMPTY_PEERS_HEADLINE = "no peers connected";
export const EMPTY_PEERS_NEXT =
  "discovery is listening · invite a peer to join your mesh";

export const EMPTY_NEARBY_HEADLINE = "no devices discovered yet";
export const EMPTY_NEARBY_NEXT =
  "scanning local networks · auto-pair will surface peers here";

export const EMPTY_STATIC_PEERS_HEADLINE = "no static peers";
export const EMPTY_STATIC_PEERS_NEXT =
  "discovered peers appear above · use [ + add peer ] for a manual pin";

export const EMPTY_ROUTES_NEXT =
  "routes appear here as soon as a peer announces a destination";

export const EMPTY_GATEWAYS_NEXT =
  "gateways are peers offering internet egress · none yet";

// ─── Toasts (D-31) ───────────────────────────────────────────────────

export const KILL_SWITCH_TOAST = "kill-switch active · routing blocked";
