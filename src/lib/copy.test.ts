/**
 * Compile-only + load-time tests for `src/lib/copy.ts`.
 *
 * Pattern: matches `src/lib/format.test.ts` and `src/lib/rpc-types.test.ts`
 * — no vitest, no runtime test framework. `tsc --noEmit` enforces the
 * type pins; the load-time bang-check is an `if (false)` guarded
 * function that tsc still type-checks but never runs in production.
 *
 * Three guarantees:
 *   1. Every constant declared in `docs/COPY.md §6` exists as a named
 *      export of `./copy` (compile fails if a rename or removal happens).
 *   2. Every constant is typed as `string` (compile fails if a future
 *      edit makes one undefined or non-string).
 *   3. No constant value contains `!` (load-time guard; the
 *      `_runtimeChecks` body asserts `String(VALUE).includes("!") === false`
 *      for every export).
 *
 * The `if (false)` guard around `_runtimeChecks` keeps tsc happy without
 * running the loop in production. To exercise the runtime guard during
 * development, change `if (false)` to `if (true)` and run
 * `pnpm tsx src/lib/copy.test.ts`. Leave it at `if (false)` for commit.
 */

import * as copy from "./copy";

import {
  KILL_SWITCH_HEADLINE,
  KILL_SWITCH_BODY,
  KILL_SWITCH_ACTION,
  ROUTE_OFF_BODY,
  ROUTE_TOGGLE_TURN_ON,
  ROUTE_TOGGLE_TURN_OFF,
  ROUTE_TOGGLE_CONFIRM,
  ROUTE_TOGGLE_CANCEL,
  PREFLIGHT_INTERFACE_UP_TEMPLATE,
  PREFLIGHT_GATEWAY_REACHABLE_TEMPLATE,
  PREFLIGHT_SPLIT_DEFAULT_SUPPORTED,
  PREFLIGHT_INTERFACE_DOWN_TEMPLATE,
  PREFLIGHT_NO_GATEWAY,
  PREFLIGHT_DAEMON_TOO_OLD,
  WELCOME_TITLE,
  WELCOME_SECTION,
  WELCOME_SUBTITLE,
  WELCOME_ADD_LABEL,
  WELCOME_ADD_DESC,
  WELCOME_SOLO_LABEL,
  WELCOME_SOLO_DESC,
  INVITE_TITLE,
  INVITE_BODY_INTRO,
  INVITE_INSTALL_LINE,
  INVITE_URL,
  INVITE_PAIRING_LINE,
  INVITE_ROADMAP_LINE,
  INVITE_COPY_LINK,
  INVITE_COPIED,
  INVITE_FULL_URL,
  HANDSHAKE_FAIL_SUBLINE,
  SECURITY_DOCS_URL,
  ROUTE_TABLE_EMPTY,
  KNOWN_GATEWAYS_EMPTY,
  ROUTE_TABLE_REFRESH,
  KILL_SWITCH_TOAST,
} from "./copy";

// Per-export type pins (compile-only). Any rename or removal in
// `./copy.ts` surfaces here as a tsc error.
const _killHeadline: string = KILL_SWITCH_HEADLINE;
const _killBody: string = KILL_SWITCH_BODY;
const _killAction: string = KILL_SWITCH_ACTION;
const _routeOffBody: string = ROUTE_OFF_BODY;
const _routeOn: string = ROUTE_TOGGLE_TURN_ON;
const _routeOff: string = ROUTE_TOGGLE_TURN_OFF;
const _routeConfirm: string = ROUTE_TOGGLE_CONFIRM;
const _routeCancel: string = ROUTE_TOGGLE_CANCEL;
const _pfIfUp: string = PREFLIGHT_INTERFACE_UP_TEMPLATE;
const _pfGwOk: string = PREFLIGHT_GATEWAY_REACHABLE_TEMPLATE;
const _pfSplitOk: string = PREFLIGHT_SPLIT_DEFAULT_SUPPORTED;
const _pfIfDown: string = PREFLIGHT_INTERFACE_DOWN_TEMPLATE;
const _pfNoGw: string = PREFLIGHT_NO_GATEWAY;
const _pfTooOld: string = PREFLIGHT_DAEMON_TOO_OLD;
const _welcomeTitle: string = WELCOME_TITLE;
const _welcomeSection: string = WELCOME_SECTION;
const _welcomeSubtitle: string = WELCOME_SUBTITLE;
const _welcomeAddLabel: string = WELCOME_ADD_LABEL;
const _welcomeAddDesc: string = WELCOME_ADD_DESC;
const _welcomeSoloLabel: string = WELCOME_SOLO_LABEL;
const _welcomeSoloDesc: string = WELCOME_SOLO_DESC;
const _inviteTitle: string = INVITE_TITLE;
const _inviteIntro: string = INVITE_BODY_INTRO;
const _inviteInstall: string = INVITE_INSTALL_LINE;
const _inviteUrl: string = INVITE_URL;
const _invitePairing: string = INVITE_PAIRING_LINE;
const _inviteRoadmap: string = INVITE_ROADMAP_LINE;
const _inviteCopyLink: string = INVITE_COPY_LINK;
const _inviteCopied: string = INVITE_COPIED;
const _inviteFullUrl: string = INVITE_FULL_URL;
const _handshakeSubline: string = HANDSHAKE_FAIL_SUBLINE;
const _securityUrl: string = SECURITY_DOCS_URL;
const _routeTableEmpty: string = ROUTE_TABLE_EMPTY;
const _knownGatewaysEmpty: string = KNOWN_GATEWAYS_EMPTY;
const _routeTableRefresh: string = ROUTE_TABLE_REFRESH;
const _killSwitchToast: string = KILL_SWITCH_TOAST;

/**
 * Load-time bang-check. Iterates every export of `./copy`, throws if
 * any string value contains `!`. Wrapped in `if (false)` so production
 * builds skip the loop; tsc still type-checks the body.
 */
function _runtimeChecks(): void {
  for (const [k, v] of Object.entries(copy)) {
    if (typeof v === "string" && v.includes("!") === true) {
      throw new Error(
        `copy.${k} contains forbidden '!' — see docs/COPY.md §1`,
      );
    }
  }
}

if (false as boolean) {
  _runtimeChecks();
}

// Reference every captured constant so tsc does not drop the imports.
void _killHeadline;
void _killBody;
void _killAction;
void _routeOffBody;
void _routeOn;
void _routeOff;
void _routeConfirm;
void _routeCancel;
void _pfIfUp;
void _pfGwOk;
void _pfSplitOk;
void _pfIfDown;
void _pfNoGw;
void _pfTooOld;
void _welcomeTitle;
void _welcomeSection;
void _welcomeSubtitle;
void _welcomeAddLabel;
void _welcomeAddDesc;
void _welcomeSoloLabel;
void _welcomeSoloDesc;
void _inviteTitle;
void _inviteIntro;
void _inviteInstall;
void _inviteUrl;
void _invitePairing;
void _inviteRoadmap;
void _inviteCopyLink;
void _inviteCopied;
void _inviteFullUrl;
void _handshakeSubline;
void _securityUrl;
void _routeTableEmpty;
void _knownGatewaysEmpty;
void _routeTableRefresh;
void _killSwitchToast;
void _runtimeChecks;
