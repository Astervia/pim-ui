---
status: partial
phase: 01-rpc-bridge-daemon-lifecycle
source: [01-04-PLAN.md Task 4 human-verify checkpoint]
started: 2026-04-24
updated: 2026-04-24
---

## Current Test

[awaiting Rust install + daemon binary for SC1/2/5/6]

## Tests

### SC1. Single-toggle start — stopped → starting → running ≤ 3s
expected: click [ START DAEMON ] → TUN permission modal → grant → status chip transitions through states within 3s, banner disappears, CliPanel fades in
result: pending (requires rustup + pim-daemon binary)

### SC2. Clean stop + window stays usable
expected: click [ STOP DAEMON ] → stop-confirm dialog if peers connected → confirm → status returns to stopped, banner reappears, window interactive
result: pending (requires rustup + pim-daemon binary)

### SC3. Limited-mode copy + Start action + no blank screen
expected: banner renders `LIMITED MODE` headline amber + body `pim daemon is stopped. Start it to join the mesh.` + `[ START DAEMON ]` primary; no spinner; no blank screen
result: ✓ passed (verified in browser via pnpm dev — approved-limited-mode-only)

### SC4. External-kill detection + auto-reconnect + subscription restore ≤ 5s
expected: pkill pim-daemon → within 5s banner shows RECONNECTING… or DAEMON STOPPED UNEXPECTEDLY; relaunch → status returns to running, subscriptions restore
result: partial — DAEMON ERROR / spawn-failure rendering verified (click [ START DAEMON ] without daemon binary triggers honest error copy in banner); full external-kill + reconnect pending daemon availability

### SC5. About footer shows daemon version + rpc_version + feature flags from rpc.hello
expected: footer row 2 `pim-daemon/<version> · rpc 1 · features: <list>` with version in signal green; destructive copy if rpc_version mismatch
result: pending (requires rpc.hello handshake — needs daemon)

### SC6. Uptime ticks + survives window close/reopen
expected: tabular-nums tick every 1s; close + relaunch → uptime reflects daemon-side value (not 0)
result: pending (requires daemon)

## Summary

total: 6
passed: 1
partial: 1
pending: 4
issues: 0

## Gaps

None. UI-layer is complete and honest; runtime-full-path verification deferred to post-rustup setup.

## Resume path

After user installs Rust and builds pim-daemon binary:
1. `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Build kernel daemon: `cd proximity-internet-mesh && cargo build --release --bin pim-daemon`
3. Drop binary at `pim-ui/src-tauri/binaries/pim-daemon-<target-triple>`
4. `cd pim-ui && pnpm tauri dev`
5. Walk SC1/2/4/5/6 on the real app
6. Run `/gsd:verify-work 1` to close remaining UAT items
