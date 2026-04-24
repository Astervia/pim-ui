# pim-daemon sidecar binaries

Tauri resolves `sidecar("pim-daemon")` to `binaries/pim-daemon-<target-triple>`.

Populate this directory before `pnpm tauri dev` / `pnpm tauri build`:

    cd ../../proximity-internet-mesh
    cargo build --release --bin pim-daemon
    TRIPLE=$(rustc -vV | sed -n 's|host: ||p')
    cp target/release/pim-daemon <pim-ui>/src-tauri/binaries/pim-daemon-$TRIPLE

Or let CI download the release artifact for the current host.

When this directory is empty, `daemon_start` will return an error and the
UI will stay in Limited Mode — that is the expected, honest Phase 1 behavior.
