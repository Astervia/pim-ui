# Phase 3: Configuration & Peer Management — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 3-configuration-peer-management
**Mode:** `/gsd:discuss-phase 3 --auto` — Claude auto-selected recommended defaults for every gray area after loading PROJECT.md, REQUIREMENTS.md, STATE.md, Phase 1 + Phase 2 CONTEXT.md, UX-PLAN.md §6f + §7 + §8, kernel `docs/RPC.md` §5.2 + §5.5 + §5.6, and the live codebase.
**Areas discussed:** Navigation & IA, Section rendering, Form controls, Save semantics, Raw TOML editor, Raw-wins detection, Peer add/remove flow, Log search + time range, Debug snapshot export, Restart-required UX, Settings fetch lifecycle, Client-side TOML library

**Carrying forward from earlier phases:**
- "Raw TOML is source of truth" (PROJECT.md stakeholder decision 2026-04-24) — locks D-14 + D-15.
- Sidebar shell with grayed-reserved slots (Phase 2 D-01/D-02) — locks D-01.
- W1 single-listener contract (Phase 1 Plan 01) — locks D-07/D-28.
- Snake_case verbatim field names (Phase 1) — locks form field naming.
- `CliPanel` brand primitive (existing) — locks D-04.
- Daemon is source of truth (PROJECT.md constraint) — locks D-08 (no client-side schema validation beyond trivial hints).
- Brand discipline: no gradients, no border-radius, monospace only (PROJECT.md + `UX-PLAN §1`) — locks D-05/D-14 (plain textarea, not CodeMirror).

---

## Navigation & IA integration (D-01/D-02/D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Add `Settings` + richen `Peers` tab, keep `Dashboard` as peer-list host | Flip Settings from grayed-reserved to active (`⌘6`). Peers tab becomes a dedicated screen with add/remove actions. Dashboard still renders its own peer list. | ✓ |
| Only a `Settings` tab, leave Peers as Dashboard alias | Simpler IA; puts add-peer form in Settings → Identity. | |
| Tab-less: Settings as a modal overlay | Fastest to build; breaks the terminal-shell metaphor and `UX-PLAN §4a` sidebar pattern. | |

**Selected:** Recommended default. Rationale: the sidebar shell Phase 2 already reserves the slot; Phase 2 D-01 explicitly notes "Dedicated `Peers` tab distinct from Dashboard's peer list — Phase 3 absorbs this when the add-peer form + peer-remove flows exist." This IS that moment.

**Notes:** Settings is a long scrollable column with stacked `CliPanel` sections, not a left-subnav-tree. Ref `UX-PLAN §6f`.

---

## Section rendering strategy (D-04/D-05/D-06)

| Option | Description | Selected |
|--------|-------------|----------|
| `CollapsibleCliPanel` variant of existing `CliPanel` using Radix `Collapsible` | Reuses brand hero + standard primitive; summary-line in header | ✓ |
| New `Accordion` primitive (shadcn `accordion`) | Off-the-shelf but enforces "one open at a time" in default config — wrong for this use | |
| Custom details/summary HTML | Minimal JS; loses animation and keyboard control consistency | |

**Selected:** Recommended default. Custom `CollapsibleCliPanel` reuses the brand primitive while leaning on Radix for state + a11y.

---

## Form controls + validation (D-07/D-08/D-09)

| Option | Description | Selected |
|--------|-------------|----------|
| `react-hook-form` + daemon dry-run validation only | Per-section dirty tracking, minimal client schema, daemon is sole validator | ✓ |
| `react-hook-form` + `zod` schemas for every field | Client validates before daemon; duplicates `rpc-types.ts` + daemon schema | |
| Hand-rolled `useState`-per-field | Most code; weakest dirty tracking; no client validation standardization | |

**Selected:** Recommended. Respects "daemon is source of truth" (`PROJECT.md`). Avoids schema duplication.

---

## Save semantics (D-10/D-11/D-12/D-13)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-section Save, full-document write via `config.save`, dry-run → real-write pipeline, discard-confirm on tab switch | Aligns with the success-criteria wording ("save to the daemon"), preserves per-section dirty isolation | ✓ |
| Global "Save all" at top of Settings | Fewer buttons but loses isolation — dirty state in one section blocks another's save | |
| Autosave on blur | Invisible writes; breaks the `dry_run` gate + loses the explicit Save affordance users expect from config editors | |

**Selected:** Recommended. `config.save` returns `requires_restart[]` per daemon spec — surfaced per D-25.

---

## Raw TOML editor (D-14)

| Option | Description | Selected |
|--------|-------------|----------|
| Plain `<textarea>` + monospace line-number gutter + daemon inline errors | ~0 KB added, matches brand, daemon validates on `dry_run` | ✓ |
| CodeMirror 6 with `@codemirror/lang-toml` | ~200 KB bundle; syntax highlighting; value marginal since we don't validate TOML locally | |
| Monaco Editor | ~1 MB bundle; VSCode-grade; gross over-kill and fights the terminal aesthetic | |

**Selected:** Recommended. Brand discipline + bundle-size sanity + daemon-is-validator. Errors render via gutter markers + below-line messages.

---

## Form ↔ raw-TOML sync + raw-wins detection (D-15)

| Option | Description | Selected |
|--------|-------------|----------|
| Client parses TOML via `@iarna/toml`, diffs parsed keys vs form schema per section, sets `sectionRawIsSourceOfTruth[section]` flag persisted in `localStorage` | Exact mechanism UX-PLAN / ROADMAP success criterion 4 describes | ✓ |
| Server exposes a new `config.coverage` RPC | Cleaner but v1 daemon doesn't have it — adds kernel-repo dependency | |
| No detection — always show the banner | Degrades to noise | |

**Selected:** Recommended. Banner wording is locked verbatim per `CONF-07`: `"Raw is source of truth — form view shows a subset"`.

---

## Peer add/remove UX (D-16/D-17/D-18/D-19/D-20)

| Option | Description | Selected |
|--------|-------------|----------|
| Add-peer form as right-edge `Sheet` on Peers tab, Remove as per-row AlertDialog | Consistent with Phase 2's Peer Detail slide-over pattern (D-15) | ✓ |
| Add-peer as full modal Dialog | Takes visual center; disrupts the "list is the primary surface" metaphor | |
| Add-peer inline-expanding row at top of list | Saves clicks but no space for the mechanism radio + label; breaks at narrow widths | |
| Place add/remove in Settings → Identity | Wrong mental model — `peers.add_static` is a peer action, not an identity one | |

**Selected:** Recommended. Non-static peers (`static: false`) get no Remove action in Phase 3 (noted in deferred — daemon doesn't expose `peers.unpair`).

---

## Log search + time-range filter (D-21/D-22)

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side substring search + dropdown time-range over existing Phase 2 in-memory ring buffer | Zero new RPC calls; 2000-entry buffer handles it fast | ✓ |
| Server-side search via a new `logs.search` RPC | Requires kernel-repo work; delays Phase 3 | |
| Full regex search client-side | Attractive for Mira; complexity creep — v1 ships substring only | |

**Selected:** Recommended. Custom time-range uses a Dialog with from/to time inputs. Regex deferred.

---

## Debug snapshot export (D-23/D-24)

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side JSON assembly + `<a download>` Blob URL | Works in Tauri today AND future mobile without platform-specific file APIs | ✓ |
| Tauri `fs` + native save dialog | Desktop-only; blocks the mobile-parity path | |
| Ship a daemon `debug.snapshot` RPC | Moves complexity to kernel repo; unnecessary given we already have the data client-side | |

**Selected:** Recommended. Filename format `pim-debug-snapshot-{ISO-z-colons-as-hyphens}.json` — Windows-safe.

---

## Restart-required UX (D-25/D-26)

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with `[ Restart ]` action + per-section `⚠ Pending restart: {fields}` in collapsed summary | Honest surfacing; user can defer | ✓ |
| Auto-restart immediately on save if `requires_restart[] !== []` | Too invasive — user's work in other surfaces (Logs, etc.) gets interrupted | |
| Silent noop (apply at next manual daemon restart) | Violates `UX-PLAN §1 P1` honest-over-polished | |

**Selected:** Recommended. `[ Restart ]` calls the Phase 1 `daemon.stop` → `daemon.start` sequence.

---

## Settings fetch lifecycle (D-28/D-29/D-30)

| Option | Description | Selected |
|--------|-------------|----------|
| Single `config.get` on mount + refetch after each save | v1 daemon has no config-change event; user is the only writer | ✓ |
| Subscribe to a nonexistent `config.event` stream | Premature; would require kernel-repo work | |
| Poll every N seconds | Wastes cycles; user doesn't need sub-second config refresh | |

**Selected:** Recommended. Matches daemon capability; avoids kernel-repo scope creep.

---

## Client-side TOML library (D-31)

| Option | Description | Selected |
|--------|-------------|----------|
| `@iarna/toml` (JS, 30 KB, 0 deps, maintained) | Proven, minimal, parses v1.0 TOML | ✓ |
| Roll our own parser | Owns bugs for no benefit | |
| Call back to daemon for every parse | Round-trip latency on every keystroke in raw editor; absurd | |
| Tauri-side Rust parse exposed as `#[tauri::command]` | Adds backend surface area Phase 1 explicitly kept generic | |

**Selected:** Recommended. Adds one dependency; no native builds.

---

## Claude's Discretion

Areas the user explicitly delegated to Claude during auto-select:
- Exact Tailwind class choices for section spacing, typography, and collapse icons.
- Animation timing for the collapse/expand transitions.
- File decomposition inside `src/screens/settings.tsx` (one file vs per-section files).
- Precise mapping of daemon `errors[].path` strings to form field names — handle the 95% case, fallback to section-level banner for unmapped paths.
- Whether to name the Settings tab icon (recommendation: text-only, no glyph).
- Textarea line-height and gutter width precise values (target 22 px row, 48 px gutter).

## Deferred Ideas

Captured in `03-CONTEXT.md` `<deferred>` section. Briefly: syntax-highlighted editor, TOML file import/export, identity key regen, allow-list editor, Gateway Phase-5 controls, Notifications-actual-firing, non-static peer removal, command palette, settings deep-links, reset-to-default buttons.

---

*Log captured: 2026-04-24 via `/gsd:discuss-phase 3 --auto`*
