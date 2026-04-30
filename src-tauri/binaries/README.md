# pim-daemon sidecar binaries

Tauri resolves `sidecar("pim-daemon")` to `binaries/pim-daemon-<target-triple>`.

## Option 1 — fetch a published release (fastest)

    bash scripts/fetch-daemon.sh

Downloads the pre-built tarball from `Astervia/proximity-internet-mesh`
release `$PIM_DAEMON_VERSION` (defaults to the latest GitHub release),
verifies sha256, and drops the binary in this directory under the host
triple. This is what CI does — same artifact, same sha. ≈ 5 s.

## Option 2 — build from crates.io (no kernel checkout)

The `pim-daemon` crate is published to crates.io; install it into a
scratch directory and copy the binary into place:

    TRIPLE=$(rustc -vV | sed -n 's|host: ||p')
    cargo install pim-daemon --version 0.1.8 --root /tmp/pim-bin --locked
    cp /tmp/pim-bin/bin/pim-daemon binaries/pim-daemon-$TRIPLE

Useful when you need the daemon for local UI dev but don't want to clone
`proximity-internet-mesh`. Compile time is ≈ 5–10 min the first time.

## Option 3 — build from a local kernel checkout

When you're co-developing the kernel:

    cd ../../proximity-internet-mesh
    cargo build --release --bin pim-daemon
    TRIPLE=$(rustc -vV | sed -n 's|host: ||p')
    cp target/release/pim-daemon <pim-ui>/src-tauri/binaries/pim-daemon-$TRIPLE

## When this directory is empty

`daemon_start` returns an error and the UI stays in Limited Mode — that
is the expected, honest Phase 1 behavior.
