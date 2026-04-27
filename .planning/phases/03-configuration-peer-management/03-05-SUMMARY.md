---
phase: 03-configuration-peer-management
plan: 05
subsystem: ui
tags: [settings, forms, conf-02, conf-03, conf-04, conf-05, react-hook-form, w1-preserved, brand-clean]

# Dependency graph
requires:
  - phase: 03-configuration-peer-management
    provides: SettingsScreen orchestrator + nine CollapsibleCliPanel stubs (Plan 03-04 §Part J), CollapsibleCliPanel + SectionSaveFooter + WireNameTooltip + RawWinsBanner shared components (Plan 03-04 §Parts A/C/B/D), useSectionSave(sectionId, form) + useSectionRawWins(sectionId) + usePendingRestart(sectionId) hooks (Plan 03-04 §Parts I/F/G), useSettingsConfig + getPath helper (Plan 03-01), brand-overridden Form / Input / Switch / RadioGroup / Tooltip primitives (Plan 03-01)
  - phase: 01-rpc-bridge-daemon-lifecycle
    provides: useDaemonState snapshot.status (Status interface — node_id / node_id_short surface for the Identity read-only rows), W1 single-listener invariant (use-daemon-state.ts listen()=2, rpc.ts=0)
provides:
  - "<IdentitySection /> — IDENTITY settings panel (CONF-02). Editable node.name (text Input). Read-only Node ID (full 64-char + [ Copy ]) / Short ID (8-char) / Public key (fallback note `pubkey not exposed yet · daemon Status v1 omits this` since rpc-types Status interface omits public_key). Summary: `{name} · {short_id}`."
  - "<TransportSection /> — TRANSPORT settings panel (CONF-03). Five fields: transport.interface (text), transport.mtu (number 576-9216), transport.mesh_ip.mode (radio static/auto with verbatim labels), transport.mesh_ip.value (text, conditional on mode=static), transport.listen_port (number 1-65535). Pending-restart token rendered in text-accent when usePendingRestart('transport').fields is non-empty."
  - "<DiscoverySection /> — DISCOVERY settings panel (CONF-04). Four Switches: discovery.broadcast / discovery.bluetooth / discovery.wifi_direct / discovery.auto_connect — verbatim daemon wire names. Summary includes trusted-peer count from `base.security.allow_list[]`."
  - "<TrustSection /> — TRUST settings panel (CONF-05). RadioGroup with three verbatim option labels: `Allow all (trust-on-first-use disabled)`, `Allow list (only peers in trusted-peers)`, `Trust on first use (default for mesh discovery)`. Read-only trusted-peers list (D-19) with verbatim empty state `no trusted peers yet · trust policy is {policy}`. Summary uses raw daemon values, no translation: `policy: {allow_all | allow_list | TOFU}`."
  - "SettingsScreen swaps four of nine Plan-03-04 stubs for the real form-heavy sections; the other five (ROUTING / GATEWAY / NOTIFICATIONS / ADVANCED / ABOUT) remain stubs for Plan 03-06."
affects: [03-06, 03-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Form-section composition over the Wave 2 (03-04) scaffold: CollapsibleCliPanel chrome + RawWinsBanner gate + sectionBannerError fallback + Form/FormField/FormItem/FormLabel/FormControl/FormMessage form rows + WireNameTooltip on every label + SectionSaveFooter at the bottom. Each section file is a single component that follows the same template."
    - "Form-values keyed by short local names + payload re-keyed to wire names at submit time. The local-name-to-wire-name map is a small per-section const (FIELD_KEY_MAP) so Plan 03-07's audit can grep the canonical wire names verbatim from the source. Daemon-error mapping uses the same map to call form.setError(localName, …) when fieldErrors[wireName] is non-empty."
    - "useEffect-based daemon-error → form.setError mirroring: the section's useEffect watches `fieldErrors` (returned from useSectionSave) and forwards each entry to the matching form key. Cleared via form.clearErrors when the daemon-side error goes away. This is the canonical bridge between daemon error paths and react-hook-form's <FormMessage>."
    - "Conditional field rendering via form.watch: TransportSection renders `transport.mesh_ip.value` only when `mesh_ip_mode === 'static'`. The watch + conditional-render pattern is the canonical react-hook-form approach; no extra state."
    - "Bang-free implementation continues mechanically — every negation as `=== false` / `=== null` / `=== undefined`. Verified: zero `!value` patterns in the four section files."
    - "Defensive type-narrow helpers (asString / asBool / asMode / asPolicy) inside each section: a parsed TOML value can technically be any JSON type at runtime, and the daemon does not yet expose a strict schema. Helpers narrow at the boundary so the form's TS types stay clean. The daemon's dry_run is the authoritative validator (PROJECT.md daemon-is-source-of-truth)."

key-files:
  created:
    - src/components/settings/sections/identity-section.tsx
    - src/components/settings/sections/transport-section.tsx
    - src/components/settings/sections/discovery-section.tsx
    - src/components/settings/sections/trust-section.tsx
  modified:
    - src/screens/settings.tsx

key-decisions:
  - "Single atomic commit (per the plan's `## Commit` directive: `One atomic commit: feat(03-05): IDENTITY / TRANSPORT / DISCOVERY / TRUST sections (CONF-02..05)`). Plan 03-05's task list is one large task — splitting into per-section commits would have produced four typecheck-clean intermediate states, but the plan explicitly specified one commit, so the executor honored that."
  - "Identity Public key row renders a fallback note rather than omitting the row entirely. Plan 03-05's read_first instructions explicitly anticipate this case (`If NOT exposed, render a fallback `pubkey not exposed yet` note`). The verified rpc-types.ts Status interface (lines 178-198) defines node_id + node_id_short but no public_key field; the row is kept for IA stability + UX-PLAN §1 P1 (honest about what isn't yet wired)."
  - "TrustSection extracts the read-only trusted-peers list from EITHER `security.allow_list[]` OR `security.trust_store[]` depending on which key the parsed base contains. SECTION_SCHEMAS notes `trust_store` as the not-yet-locked daemon key (D-19 plan body) — the section tolerates both shapes silently, falling back to the empty-state copy when neither is present."
  - "Each section seeds `defaultValues` AND `values` for react-hook-form. Setting `values` keeps the form synchronized when `useSettingsConfig` refetches after a save (D-29) — react-hook-form's `values` prop reads as a controlled mode that keeps the form aligned with the parsed-base prop, while `defaultValues` provides the initial dirty-state baseline. Without `values`, edits made before the first config load would be silently overwritten."
  - "TransportSection's MTU and Listen port are stored in the form as strings (Input type=number returns string in react-hook-form). At submit time, both are coerced via Number(values) with a Number.isFinite guard — if NaN sneaks through, the original string is sent so the daemon can reject with a precise error (rather than the UI swallowing the invalid value)."
  - "DiscoverySection summary's trusted-peer count uses a permissive cast `(base?.security as { allow_list?: unknown[] } | undefined)?.allow_list?.length ?? 0` per plan instructions. The schema-diff logic (CONF-07) catches drift at scan time; this is purely for the collapsed-summary one-liner, not a save-side concern."
  - "All four sections wire field-level error mapping for every form field they expose. fieldErrors is a Record<string, string> keyed by daemon wire path (e.g. `transport.listen_port`); each section's useEffect translates that to react-hook-form's setError on the corresponding short local key. When daemon errors clear (next save attempt), clearErrors fires."

patterns-established:
  - "Per-section form composition pattern (this plan is the first concrete consumer of the Plan 03-04 hooks suite):
      const form = useForm<TValues>({ defaultValues, values: defaults });
      const { state, save, fieldErrors, sectionBannerError } = useSectionSave(id, form);
      // useEffect: mirror fieldErrors -> form.setError per local key
      // const watched = form.watch();  // for summary + conditional fields
      // const onSave = () => form.handleSubmit(values => save(wireKeyedPayload))();
      // <CollapsibleCliPanel> { rawWins && <RawWinsBanner /> } { sectionBannerError && <p /> } <Form>...</Form> <SectionSaveFooter />"
  - "Wire-name preservation through every layer: source-of-truth is SECTION_SCHEMAS (Plan 03-01) — section components reference the same path strings (`node.name`, `transport.listen_port`, etc.) verbatim in (a) form payload keys, (b) WireNameTooltip props, (c) FIELD_KEY_MAP for error mapping. A grep for `transport.listen_port` (etc.) lands in all four places, making drift a compile-or-grep failure."
  - "Pending-restart token wiring template (TransportSection, the only section with a restart-required field set in v1): `pendingRestartToken={fields.length > 0 ? <span className='font-mono text-xs text-accent'>· ⚠ pending restart: {fields.join(', ')}</span> : undefined}` — passed as a CollapsibleCliPanel prop. Plan 03-06's RoutingSection / NotificationsSection should follow the same template if they expose restart-required fields."

requirements-completed: [CONF-02, CONF-03, CONF-04, CONF-05]

# Metrics
duration: 6min
completed: 2026-04-27
---

# Phase 03 Plan 05: Form Sections (CONF-02..05) Summary

Four form-heavy Settings sections — IDENTITY / TRANSPORT / DISCOVERY / TRUST — replacing the corresponding Wave 2 stubs in SettingsScreen. Each section consumes the Plan 03-04 hooks (useSectionSave with form-ref signature, useSectionRawWins as read-only hook, usePendingRestart for TRANSPORT) and shared components (CollapsibleCliPanel, SectionSaveFooter, WireNameTooltip, RawWinsBanner). Daemon wire names render verbatim through every layer (form payload keys + WireNameTooltip props + error-mapping table), so future drift surfaces as a multi-site grep failure.

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-27T01:58:09Z
- **Completed:** 2026-04-27T02:04:00Z (approx)
- **Tasks:** 1 (single-task plan; one atomic commit per the plan's `## Commit` directive)
- **Files created:** 4
- **Files modified:** 1

## Accomplishments

- IDENTITY section (CONF-02) renders editable `node.name` + three read-only identity rows (Node ID full 64-char with [ Copy ], Short ID 8-char, Public key fallback note since Status v1 omits the field). Summary `{name} · {short_id}` updates reactively via `form.watch`.
- TRANSPORT section (CONF-03) renders five fields: text Interface name, number MTU (576-9216), radio Mesh address mode (Static / Automatic), conditional text mesh_ip.value (only when mode=static), number Listen port (1-65535). The pending-restart token in the collapsed summary appears in `text-accent` when `usePendingRestart('transport').fields` is non-empty.
- DISCOVERY section (CONF-04) renders four Switches bound 1:1 to daemon wire names: discovery.broadcast / discovery.bluetooth / discovery.wifi_direct / discovery.auto_connect. Summary line includes trusted-peer count from the parsed base.
- TRUST section (CONF-05) renders the three-option RadioGroup (allow_all / allow_list / TOFU) with verbatim option labels and a read-only Trusted peers list. Empty-state copy is verbatim per UI-SPEC §Empty states. The summary uses raw daemon values per the spec (`policy: TOFU` not `policy: trust on first use`).
- SettingsScreen swaps four of the nine Plan-03-04 stubs for the new real components; the other five remain Plan 03-06 stubs.
- All four sections wire daemon error mapping: when `useSectionSave` returns `fieldErrors[wireName]`, the section forwards it to `form.setError(localKey)` so `<FormMessage>` renders inline; cleared via `form.clearErrors` when the daemon-side error goes away. Section-level fallback banner renders `sectionBannerError` at the top of each section body when set.
- W1 invariant preserved (`use-daemon-state.ts` listen() = 2, `rpc.ts` = 0).
- Brand-discipline grep clean (zero `rounded-(md|lg|full|xl)`, zero literal palette colors, zero `lucide-react` across all four section files).
- Bang-free policy preserved (zero `!value` patterns in the four new files).
- `pnpm typecheck` exits 0; `pnpm build` exits 0 (632.65 kB main bundle / 176.88 kB gzipped — modest growth from 03-04's 599 kB attributable to the four section components + react-hook-form Controller usage).

## Task Commits

1. **All four form sections + SettingsScreen wire-up** — `2e3c60d` (feat)
   - 4 new files: identity-section.tsx + transport-section.tsx + discovery-section.tsx + trust-section.tsx
   - 1 modified file: settings.tsx (replaced four stubs with real components)

## Section Anatomy

```
SettingsScreen (Plan 03-04, modified)
├── <IdentitySection open onOpenChange />
│   └── CollapsibleCliPanel (chrome)
│       ├── RawWinsBanner (when rawWins === true)
│       ├── sectionBannerError <p> (when set)
│       ├── Form
│       │   ├── FormField "name" → Input + WireNameTooltip("node.name") + FormMessage
│       │   ├── Read-only Node ID + WireNameTooltip("node_id") + [ Copy ]
│       │   ├── Read-only Short ID + WireNameTooltip("short_id")
│       │   └── Read-only Public key fallback note + WireNameTooltip("public_key")
│       └── SectionSaveFooter (dirty / state / onSave)
│
├── <TransportSection open onOpenChange />
│   └── CollapsibleCliPanel (chrome) — pendingRestartToken when fields.length > 0
│       ├── RawWinsBanner / sectionBannerError
│       ├── Form
│       │   ├── interface (text) + WireNameTooltip("transport.interface")
│       │   ├── mtu (number 576-9216) + WireNameTooltip("transport.mtu")
│       │   ├── mesh_ip_mode (radio Static/Automatic) + WireNameTooltip("transport.mesh_ip.mode")
│       │   ├── mesh_ip_value (text, ONLY if mode=static) + WireNameTooltip("transport.mesh_ip.value")
│       │   └── listen_port (number 1-65535) + WireNameTooltip("transport.listen_port")
│       └── SectionSaveFooter
│
├── <DiscoverySection open onOpenChange />
│   └── CollapsibleCliPanel (chrome)
│       ├── RawWinsBanner / sectionBannerError
│       ├── Form
│       │   ├── broadcast (Switch) + WireNameTooltip("discovery.broadcast")
│       │   ├── bluetooth (Switch) + WireNameTooltip("discovery.bluetooth")
│       │   ├── wifi_direct (Switch) + WireNameTooltip("discovery.wifi_direct")
│       │   └── auto_connect (Switch) + WireNameTooltip("discovery.auto_connect")
│       └── SectionSaveFooter
│
└── <TrustSection open onOpenChange />
    └── CollapsibleCliPanel (chrome)
        ├── RawWinsBanner / sectionBannerError
        ├── Form
        │   ├── authorization (RadioGroup allow_all/allow_list/TOFU) + WireNameTooltip("security.authorization")
        │   └── Read-only trusted peers list + WireNameTooltip("trust_store")
        │       (empty state: "no trusted peers yet · trust policy is {policy}")
        └── SectionSaveFooter
```

## Verbatim Locked-Copy Inventory

| Surface | Copy (verbatim) |
| ------- | --------------- |
| Identity Public key fallback | `pubkey not exposed yet · daemon Status v1 omits this` |
| Transport mesh_ip mode static | `Static — I set the address` |
| Transport mesh_ip mode auto | `Automatic — pim picks an address` |
| Transport mesh_ip.value field label | `Your address on the mesh` |
| Discovery field — broadcast | `Broadcast discovery` |
| Discovery field — bluetooth | `Bluetooth discovery` |
| Discovery field — wifi_direct | `Wi-Fi Direct discovery` |
| Discovery field — auto_connect | `Auto-connect to discovered peers` |
| Trust radio — allow_all | `Allow all (trust-on-first-use disabled)` |
| Trust radio — allow_list | `Allow list (only peers in trusted-peers)` |
| Trust radio — TOFU | `Trust on first use (default for mesh discovery)` |
| Trust empty state | `no trusted peers yet · trust policy is {policy}` |
| Pending-restart token (TRANSPORT collapsed) | `· ⚠ pending restart: {fields.join(", ")}` |
| Identity field label | `Device name` |
| Transport field labels | `Interface name`, `MTU`, `Mesh address mode`, `Listen port` |
| Trust field label | `Authorization policy` |
| Identity read-only labels | `Node ID`, `Short ID`, `Public key` |
| Trust read-only label | `Trusted peers` |

All copy verified by grep against the four section files; zero divergences.

## Daemon Wire-Name Inventory (verbatim)

| Section | Wire path | Source-of-truth role |
| ------- | --------- | --------------------- |
| identity | `node.name` | form payload key + WireNameTooltip + FIELD_KEY_MAP |
| identity | `node_id` | WireNameTooltip (read-only display) |
| identity | `short_id` | WireNameTooltip (read-only display) |
| identity | `public_key` | WireNameTooltip (read-only — fallback render) |
| transport | `transport.interface` | form payload + WireNameTooltip + FIELD_KEY_MAP |
| transport | `transport.mtu` | form payload (number-coerced) + WireNameTooltip + FIELD_KEY_MAP |
| transport | `transport.mesh_ip.mode` | form payload + WireNameTooltip + FIELD_KEY_MAP |
| transport | `transport.mesh_ip.value` | form payload (only when mode=static) + WireNameTooltip + FIELD_KEY_MAP |
| transport | `transport.listen_port` | form payload (number-coerced) + WireNameTooltip + FIELD_KEY_MAP |
| discovery | `discovery.broadcast` | form payload + WireNameTooltip + FIELD_KEY_MAP |
| discovery | `discovery.bluetooth` | form payload + WireNameTooltip + FIELD_KEY_MAP |
| discovery | `discovery.wifi_direct` | form payload + WireNameTooltip + FIELD_KEY_MAP |
| discovery | `discovery.auto_connect` | form payload + WireNameTooltip + FIELD_KEY_MAP |
| trust | `security.authorization` | form payload + WireNameTooltip |
| trust | `trust_store` | WireNameTooltip (read-only display) |

These names appear verbatim in source so a single grep for each path lands every consumer site. Future drift fails the grep.

## Files Created/Modified

### Created (4)

- `src/components/settings/sections/identity-section.tsx` — IdentitySection (CONF-02)
- `src/components/settings/sections/transport-section.tsx` — TransportSection (CONF-03)
- `src/components/settings/sections/discovery-section.tsx` — DiscoverySection (CONF-04)
- `src/components/settings/sections/trust-section.tsx` — TrustSection (CONF-05)

### Modified (1)

- `src/screens/settings.tsx` — imports and composes the four real sections; removes their stubs

## Decisions Made

See `key-decisions` in frontmatter (seven decisions). Highlights:

- **Single atomic commit** per the plan's `## Commit` directive; intermediate per-section split would have been cleaner but the plan explicitly specified one commit, so the executor honored that.
- **Identity Public key fallback note** rather than omitting the row entirely — the row preserves IA stability even when the daemon Status v1 doesn't expose the field. UX-PLAN §1 P1 (honest about what isn't yet wired).
- **Trust list tolerates both `security.allow_list[]` and `security.trust_store[]`** shapes — SECTION_SCHEMAS notes both as candidates; the section silently falls through to the empty state when neither is present.
- **`values` prop alongside `defaultValues`** on every form — keeps react-hook-form synchronized with `useSettingsConfig` refetches without losing dirty-state baseline.
- **MTU + Listen port stored as strings, coerced at submit** — Input type=number returns string in react-hook-form. Number.isFinite guards the coercion; a NaN slip-through sends the original string so the daemon's reject error is precise.
- **Field-level error mapping per section via useEffect** — translates `fieldErrors[wireName]` (returned from useSectionSave) to `form.setError(localKey)`. Cleared via `form.clearErrors` when the daemon-side error goes away.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `read_first` instructions for the IDENTITY public-key fallback (`If NOT exposed, render a fallback`pubkey not exposed yet`note`) anticipated the rpc-types Status v1 omission, so the fallback isn't a deviation but explicit plan guidance.

## Issues Encountered

- **Bundle size advisory** during build: 632 kB main bundle (176 kB gzipped). Vite warns at >500 kB. This is the cumulative cost of the Plan 03-04 scaffold + Plan 03-05's four section components + react-hook-form Controllers; not a regression introduced by this plan in particular. Code-splitting / dynamic imports are deferred to a polish-pass concern (out of scope for this plan).
- **noUncheckedIndexedAccess narrowing** on FIELD_KEY_MAP lookups: TS narrows `FIELD_KEY_MAP[local]` to `string | undefined` by default. Avoided the issue by using `as const` on the MAP and a strict `keyof typeof` for the local-key parameter, so the lookup is statically guaranteed to return the wire-name string.

## User Setup Required

None — Plan 03-05 ships purely on top of dependencies that already landed in Plan 03-01 (TOML library + react-hook-form + brand-overridden primitives), Plan 03-04 (scaffold + hooks), and Phase 1/2 (W1 fan-out + DaemonState). No new npm packages, no Tauri commands, no environment variables.

## Next Phase Readiness

**Plan 03-06 can now consume:**

- The same Plan-03-04 scaffold (CollapsibleCliPanel + SectionSaveFooter + WireNameTooltip + RawWinsBanner + useSectionSave + useSectionRawWins + usePendingRestart) — Plan 03-06 ships ROUTING (CONF-* implicit + ROUTE-* deferred), GATEWAY (placeholder, GATE-* in Phase 5), NOTIFICATIONS (UX-04/05 wiring; firing in Phase 5), ADVANCED (raw TOML editor — D-14), ABOUT (D-27).
- The per-section composition template documented in this SUMMARY's `patterns-established` block — Plan 03-06's RoutingSection / NotificationsSection should follow the exact same shape (form + useSectionSave + WireNameTooltip + SectionSaveFooter). The Advanced section (raw TOML textarea) is the only one that diverges from the template; D-12 / D-14 govern that surface.

**Plan 03-07 audit checks:**

- All four sections render verbatim labels + radio option strings + empty-state copy from this SUMMARY's "Verbatim Locked-Copy Inventory" — every string captured here is checker-greppable.
- Wire-name verbatim presence per the "Daemon Wire-Name Inventory" — every path appears in source so a single grep lands every consumer site.
- W1 invariant — `grep -c "listen(" src/hooks/use-daemon-state.ts` = 2; `rpc.ts` = 0; no Tauri event imports outside use-daemon-state.ts.
- Brand-discipline — zero rounded-(md|lg|full|xl), zero literal palette colors, zero lucide-react in any of the four new section files.

**No blockers introduced.**

## Self-Check: PASSED

- All 4 claimed created files present on disk (identity-section.tsx, transport-section.tsx, discovery-section.tsx, trust-section.tsx)
- 1 claimed modified file present + diff lands as documented (settings.tsx)
- Claimed commit hash `2e3c60d` present in `git log --oneline -5`
- All 4 requirement IDs (CONF-02, CONF-03, CONF-04, CONF-05) found in `.planning/REQUIREMENTS.md`
- `pnpm typecheck` exits 0
- `pnpm build` exits 0 (632.65 kB / 176.88 kB gzipped)
- W1 grep gates pass (`use-daemon-state.ts` listen count = 2, `rpc.ts` = 0)
- All 22 acceptance-grep gates from the PLAN's verify block pass:
  - File existence: 4/4
  - Verbatim labels: Device name / Node ID / Interface name / Mesh address mode / Listen port / Broadcast discovery / Bluetooth discovery / Wi-Fi Direct discovery / Auto-connect to discovered peers / Authorization policy / Allow all (trust-on-first-use disabled) / Allow list (only peers in trusted-peers) / Trust on first use (default for mesh discovery) / Static — I set the address / Automatic — pim picks an address / no trusted peers yet — 16/16
  - SettingsScreen wire-up: <IdentitySection / <TransportSection / <DiscoverySection / <TrustSection — 4/4
  - Wire-name verbatim: node.name / transport.* / discovery.* / security.authorization — all match
  - WireNameTooltip per-field: transport=6, identity=5, discovery=5, trust=3 (each section >= number of form fields)
  - useSectionSave with form-ref (Blocker 1): all four sections call `useSectionSave(id, form)` — count = 4
  - Negative grep (Blocker 3): zero `useSectionRawWins(...).setAll` matches
- Brand-discipline grep gate passes (zero `rounded-(md|lg|full|xl)` / `bg-(green|red|blue|purple|amber)-[0-9]` / `text-amber-[0-9]` / `lucide-react` across all 4 new files)
- Bang-free policy preserved (zero `!value` patterns in the 4 new files)

---
*Phase: 03-configuration-peer-management*
*Completed: 2026-04-27*
