<!-- GSD:project-start source:PROJECT.md -->
## Project

**pim-ui**

A cross-platform desktop + mobile app that lets anyone — from a complete
newcomer to a protocol researcher — configure, run, and monitor the
`pim-daemon` proximity mesh stack without touching TOML or the CLI.
Tauri 2 shell driving a React 19 frontend that speaks JSON-RPC 2.0 to
the local daemon over a Unix socket.

**Core Value:** One app that is honest about what the mesh is actually doing — never
abstracts packets into a happy green dot — yet stays reachable enough
that a first-time user can succeed in ≤ 3 interactions.

### Constraints

- **Tech stack**: Tauri 2 + React 19 + Vite 6 + Tailwind v4 + shadcn/ui (new-york) — cross-platform webview, Rust backend, single codebase for 5 OS targets
- **Daemon source of truth**: UI never stores state that isn't in `pim-daemon`; always poll/subscribe via RPC; daemon REJECT on save preserves user's edit buffer
- **Brand discipline**: tokens synced from `.design/branding/pim/patterns/pim.yml`; see `docs/UX-PLAN.md` §1 for immutable design principles (no gradients, no border-radius, no "Advanced" toggle, no native-platform UI idioms that fight the monospace aesthetic)
- **Security**: local Unix socket only for v1; TLS-over-TCP for remote mobile is out of scope until dedicated follow-up spec
- **Desktop first, mobile later**: mobile scope expanded to full-node requires Apple Developer enrollment (~$99/yr) + Network Extension entitlement review (multi-week); desktop must ship independently and first
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
