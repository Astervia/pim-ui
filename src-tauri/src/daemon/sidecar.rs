//! Spawns `pim-daemon` as a Tauri externalBin sidecar (Linux/Windows) or via
//! a privileged osascript wrapper (macOS). Forwards stdout/stderr to the
//! `log` crate (so `tauri-plugin-log` picks it up), kills the child on app
//! exit to prevent orphans, and surfaces fast-failures through the existing
//! `daemon://state-changed` event channel — no new Tauri events.
//!
//! IMPORTANT: wire `WindowEvent::Destroyed -> Sidecar::kill` in `lib.rs`.
//!
//! Phase 01.1 D-18: extended with `spawned_at` capture + a 500 ms
//! crash-on-boot threshold. When the daemon process disappears within that
//! window, the supplied `on_crash_on_boot` closure is invoked with a
//! `CrashOnBootInfo` so the caller (`DaemonConnection`) can transition to
//! `Error` via the EXISTING `daemon://state-changed` event. NO new Tauri
//! event channel is introduced — preserves the W1 single-listener contract.
//!
//! ────────────────────────────────────────────────────────────────────────
//! macOS dev-mode privilege escalation (post-Phase-5, mac-perfection branch
//! 2026-04-27):
//!
//! `pim-daemon` needs root on macOS to create a `utun*` virtual interface
//! (`Operation not permitted` errno 1 from `connect(SYSPROTO_CONTROL)` on a
//! `PF_SYSTEM` socket). Rather than force the user to launch the entire app
//! from a terminal with `sudo`, we spawn the daemon through `osascript`'s
//! `do shell script with administrator privileges`. The user sees the
//! standard system Authorization Services dialog with TouchID / password;
//! on auth the daemon runs as root in the background and creates its
//! utun + binds the JSON-RPC socket.
//!
//! Wire-level details (Apple TN2065 + experimentation):
//!
//!   * The osascript wrapper exits immediately after backgrounding the
//!     daemon — its `CommandEvent::Terminated` cannot tell us anything
//!     about the daemon. We compensate with a PID-file liveness probe
//!     (`liveness_probe`) that wires the same `on_crash_on_boot`
//!     diagnostic the Linux/Windows path uses, so the UI's Limited Mode
//!     banner gets the same crash-on-boot information regardless of OS.
//!   * Daemon stdout + stderr go to a log file (`$TMPDIR/pim-daemon.log`)
//!     because pipes can't survive the osascript boundary. A tokio task
//!     (`tail_log_file`) tails that file and forwards each line to
//!     `log::info!(target = "pim-daemon", ...)` so users see the same
//!     output stream they get on Linux.
//!   * Daemon kill goes through a SECOND privileged osascript invocation
//!     (`kill_privileged`); user sees the auth dialog again on stop. This
//!     is verbose UX-wise but it's the only way to release the utun
//!     interface cleanly so the next start doesn't hit `Resource busy`.
//!   * macOS leaks `utun` interfaces when the daemon doesn't shut down
//!     cleanly (kernel only reaps utun when its kctl fd closes). We
//!     scan `ifconfig -l` pre-spawn and pick the first free `utunN` for
//!     N ≥ 7, then rewrite `[interface] name` in `pim.toml` atomically.
//!
//! Production migration path (out of scope for v0.1 dev): bundle a
//! `LaunchDaemon` plist with the .app and register it via `SMAppService`
//! on first run. The user authorizes once in System Settings, after which
//! the daemon runs as root forever with no per-spawn auth dialog. That
//! requires the bundle to be code-signed + notarized, which is the
//! Apple Developer Program prereq we're deferring.

use anyhow::{anyhow, Result};
// Path / PathBuf and Duration are used by the privileged-spawn helpers
// (macOS osascript path + Linux pkexec path). Gate Path to unix so the
// Windows pipe-only build doesn't trip `unused_imports` under `-D warnings`.
#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::time::Duration;
use std::time::Instant;
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

use crate::daemon::config_path::resolve_config_path;
use crate::daemon::state::CrashOnBootInfo;

/// Phase 01.1 D-18 crash-on-boot threshold (ms) for the pipe-observed
/// path. macOS's privileged path uses a longer `PID_LIVENESS_WINDOW_MS`
/// instead because the PID file takes a moment to appear after the
/// osascript auth dialog. macOS in `PIM_NO_PRIVILEGED_SPAWN=1` mode
/// (dev stub) still uses this 500 ms threshold via `spawn_default`.
const CRASH_ON_BOOT_THRESHOLD_MS: u64 = 500;

/// Phase 01.1 D-19: ring-cap on captured stderr/log tail (bytes). Keeps the
/// crash-on-boot payload bounded; the UI surfaces only the first line.
const STDERR_TAIL_BYTES: usize = 2048;

/// PID-liveness window for the privileged-spawn paths. After spawn, we
/// poll the daemon PID this long looking for a quick exit. After the
/// window closes, the `HANDSHAKE_TIMEOUT_SECS` watchdog in `state.rs`
/// (10 s) takes over.
#[cfg(any(target_os = "macos", target_os = "linux"))]
const PID_LIVENESS_WINDOW_MS: u64 = 2_000;

/// PID-liveness poll cadence for the privileged-spawn paths.
#[cfg(any(target_os = "macos", target_os = "linux"))]
const PID_POLL_INTERVAL_MS: u64 = 100;

/// Daemon-log tail poll cadence. We poll instead of inotify/kqueue
/// because the privileged-shell write pattern (open-truncate, append
/// until daemon exits, file may be removed on respawn) is uniform
/// across the macOS osascript path and the Linux pkexec path.
#[cfg(any(target_os = "macos", target_os = "linux"))]
const LOG_TAIL_POLL_MS: u64 = 200;

pub struct Sidecar {
    child: Arc<Mutex<Option<CommandChild>>>,
}

impl Sidecar {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }

    /// Spawn `pim-daemon`. Returns `Ok(())` the moment the child PROCESS is
    /// spawned (Phase 2 Plan 02-01 contract). Crash-on-boot detection runs
    /// in the inner tokio task — the outer return type is unchanged.
    ///
    /// `on_crash_on_boot` fires AT MOST ONCE per spawn, only when the
    /// daemon dies within `CRASH_ON_BOOT_THRESHOLD_MS`.
    ///
    /// `on_post_auth` fires AT MOST ONCE per spawn, the moment the daemon
    /// process is genuinely running and ready to receive `rpc.hello`. On
    /// Linux/Windows that's immediately after spawn (no auth gate). On
    /// macOS it fires after the user authenticates the osascript prompt
    /// (or is skipped to immediate when an existing daemon is detected on
    /// the socket fast-path). The caller (`DaemonConnection::start`) uses
    /// this signal to arm the rpc.hello handshake watchdog so its 10s
    /// budget doesn't count human-typing time in the auth dialog. The
    /// callback is NOT fired on auth-cancel / wrapper-error — those paths
    /// invoke `on_crash_on_boot` instead and the watchdog never arms.
    ///
    /// On macOS the spawn routes through `osascript do shell script with
    /// administrator privileges`; PID-file liveness probing replaces the
    /// pipe-based exit detection used on the other platforms.
    pub async fn spawn<F, G>(
        &self,
        app: &AppHandle,
        on_crash_on_boot: F,
        on_post_auth: G,
    ) -> Result<()>
    where
        F: Fn(CrashOnBootInfo) + Send + Sync + Clone + 'static,
        G: FnOnce() + Send + 'static,
    {
        #[cfg(target_os = "macos")]
        {
            // `PIM_NO_PRIVILEGED_SPAWN=1` opts out of the osascript admin
            // path on macOS. The real daemon needs root for `utun`
            // creation, so leave this var unset for production runs;
            // dev users with a non-utun build (e.g. a future
            // `--dev-mode` flag in proximity-internet-mesh) can flip
            // it on to skip the auth dialog.
            if std::env::var("PIM_NO_PRIVILEGED_SPAWN").as_deref() == Ok("1") {
                log::info!(
                    target: "pim-daemon",
                    "PIM_NO_PRIVILEGED_SPAWN=1 — skipping osascript path, using normal Tauri sidecar"
                );
                return self
                    .spawn_default(app, on_crash_on_boot, on_post_auth)
                    .await;
            }
            return self
                .spawn_macos_privileged(app, on_crash_on_boot, on_post_auth)
                .await;
        }
        #[cfg(target_os = "linux")]
        {
            // Linux mirror of the macOS escalation path: the daemon needs
            // CAP_NET_ADMIN to create the TUN interface, so we route the
            // spawn through `pkexec` which triggers the user's polkit
            // authentication agent (polkit-gnome / polkit-kde / lxqt-policykit)
            // and runs the daemon as root after a graphical password prompt.
            //
            // `PIM_NO_PRIVILEGED_SPAWN=1` opts out for users who have already
            // granted the daemon binary CAP_NET_ADMIN via `setcap`, or who
            // run it under systemd as a system service (UI then connects
            // to the existing /run/pim/pim.sock).
            if std::env::var("PIM_NO_PRIVILEGED_SPAWN").as_deref() == Ok("1") {
                log::info!(
                    target: "pim-daemon",
                    "PIM_NO_PRIVILEGED_SPAWN=1 — skipping pkexec path, using normal Tauri sidecar"
                );
                return self
                    .spawn_default(app, on_crash_on_boot, on_post_auth)
                    .await;
            }
            return self
                .spawn_linux_privileged(app, on_crash_on_boot, on_post_auth)
                .await;
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            self.spawn_default(app, on_crash_on_boot, on_post_auth)
                .await
        }
    }

    /// SIGTERM the child and wait briefly for graceful exit.
    ///
    /// On the macOS osascript path the stored child handle is the
    /// already-exited osascript wrapper — `child.kill()` returns Err which
    /// we log+ignore. The actual root-owned daemon is killed via a SECOND
    /// privileged osascript (`kill_privileged`).
    pub async fn kill(&self) -> Result<()> {
        if let Some(child) = self.child.lock().await.take() {
            if let Err(e) = child.kill() {
                #[cfg(any(target_os = "macos", target_os = "linux"))]
                log::debug!(
                    target: "pim-daemon",
                    "child.kill() returned err (privileged wrapper already exited — expected on the privileged paths): {e}"
                );
                #[cfg(not(any(target_os = "macos", target_os = "linux")))]
                log::warn!(target: "pim-daemon", "kill child handle failed: {e}");
            }
        }

        #[cfg(target_os = "macos")]
        {
            // Skip the privileged kill in dev-stub mode — the stub runs
            // as the user uid, so `child.kill()` above already delivered
            // SIGTERM successfully, no auth dialog needed.
            if std::env::var("PIM_NO_PRIVILEGED_SPAWN").as_deref() != Ok("1") {
                if let Err(e) = kill_privileged_macos().await {
                    log::warn!(
                        target: "pim-daemon",
                        "privileged daemon kill failed: {e}; daemon may still be running — operator can `sudo kill -9 $(cat {})`",
                        pid_file_path().display()
                    );
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            if std::env::var("PIM_NO_PRIVILEGED_SPAWN").as_deref() != Ok("1") {
                if let Err(e) = kill_privileged_linux().await {
                    log::warn!(
                        target: "pim-daemon",
                        "privileged daemon kill failed: {e}; daemon may still be running — operator can `sudo kill -9 $(cat {})`",
                        pid_file_path().display()
                    );
                }
            }
        }

        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────
    // Standard Tauri externalBin sidecar path — used on Linux/Windows
    // unconditionally, and on macOS when `PIM_NO_PRIVILEGED_SPAWN=1`
    // (dev stub mode).
    // ────────────────────────────────────────────────────────────────────

    /// Standard sidecar spawn. The daemon runs with the same uid as the
    /// UI — fine for the Linux daemon (CAP_NET_ADMIN or root via service
    /// unit), the Windows daemon (TBD), or the dev stub on macOS (binds
    /// only a Unix socket, needs no privileges).
    async fn spawn_default<F, G>(
        &self,
        app: &AppHandle,
        on_crash_on_boot: F,
        on_post_auth: G,
    ) -> Result<()>
    where
        F: Fn(CrashOnBootInfo) + Send + Sync + Clone + 'static,
        G: FnOnce() + Send + 'static,
    {
        let sidecar = app
            .shell()
            .sidecar("pim-daemon")
            .map_err(|e| anyhow!("externalBin 'pim-daemon' not configured: {e}"))?;
        let (mut rx, child) = sidecar
            .spawn()
            .map_err(|e| anyhow!("spawn pim-daemon: {e}"))?;

        // D-18: clock starts when the child PROCESS is alive.
        let spawned_at = Instant::now();

        // Forward child output to log + watch for crash-on-boot.
        tokio::spawn(async move {
            // D-19: 2 KiB ring buffer — last bytes win, no allocation churn.
            let mut stderr_buf: Vec<u8> = Vec::with_capacity(STDERR_TAIL_BYTES);

            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => log::info!(
                        target: "pim-daemon",
                        "{}",
                        String::from_utf8_lossy(&bytes).trim_end()
                    ),
                    CommandEvent::Stderr(bytes) => {
                        log::warn!(
                            target: "pim-daemon",
                            "{}",
                            String::from_utf8_lossy(&bytes).trim_end()
                        );
                        stderr_buf.extend_from_slice(&bytes);
                        if stderr_buf.len() > STDERR_TAIL_BYTES {
                            let drop = stderr_buf.len() - STDERR_TAIL_BYTES;
                            stderr_buf.drain(0..drop);
                        }
                    }
                    CommandEvent::Error(e) => log::error!(target: "pim-daemon", "{e}"),
                    CommandEvent::Terminated(payload) => {
                        let elapsed_ms = spawned_at.elapsed().as_millis() as u64;
                        log::warn!(
                            target: "pim-daemon",
                            "terminated: code={:?} signal={:?} elapsed_ms={}",
                            payload.code,
                            payload.signal,
                            elapsed_ms,
                        );
                        if elapsed_ms < CRASH_ON_BOOT_THRESHOLD_MS {
                            let stderr_tail = String::from_utf8_lossy(&stderr_buf).to_string();
                            let config_path = resolve_config_path().to_string_lossy().to_string();
                            (on_crash_on_boot.clone())(CrashOnBootInfo {
                                exit_code: payload.code,
                                signal: payload.signal,
                                stderr_tail,
                                elapsed_ms,
                                config_path,
                            });
                        }
                        break;
                    }
                    _ => {}
                }
            }
        });

        *self.child.lock().await = Some(child);
        // No auth gate on Linux/Windows (or on the macOS dev-stub path
        // that re-uses spawn_default) — daemon is running already, fire
        // on_post_auth immediately so the watchdog starts counting now.
        on_post_auth();
        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────
    // macOS privileged path — osascript + utun pre-pick + log tail + PID
    // liveness probe.
    // ────────────────────────────────────────────────────────────────────

    /// macOS privileged spawn. See module-doc for the full theory of
    /// operation.
    #[cfg(target_os = "macos")]
    async fn spawn_macos_privileged<F, G>(
        &self,
        app: &AppHandle,
        on_crash_on_boot: F,
        on_post_auth: G,
    ) -> Result<()>
    where
        F: Fn(CrashOnBootInfo) + Send + Sync + Clone + 'static,
        G: FnOnce() + Send + 'static,
    {
        let socket_path = crate::daemon::socket_path::resolve_socket_path();
        let pid_file = pid_file_path();
        let log_file = log_file_path();
        let config_path = resolve_config_path();

        // Fast-path: if a daemon is ALREADY serving the socket (e.g. user
        // launched it manually with `sudo` in another terminal, or a
        // previous spawn within this session is still alive), skip the
        // privileged spawn entirely. The state.rs connect loop will
        // handshake against the existing socket.
        //
        // CRITICAL: file existence alone is NOT sufficient. A previous
        // daemon that crashed or was force-killed without removing its
        // socket leaves an orphan file behind. `UnixStream::connect` on
        // an orphan returns `ECONNREFUSED` instantly. We use that as
        // the liveness probe: connect succeeds → real daemon, skip
        // spawn; connect fails → stale file, remove it and proceed to
        // spawn a fresh daemon.
        if socket_path.exists() {
            match std::os::unix::net::UnixStream::connect(&socket_path) {
                Ok(_) => {
                    log::info!(
                        target: "pim-daemon",
                        "socket {} alive — skipping privileged spawn (pre-existing daemon answering)",
                        socket_path.display()
                    );
                    // Pre-existing daemon — no auth dialog gate; arm the
                    // rpc.hello watchdog right away.
                    on_post_auth();
                    return Ok(());
                }
                Err(e) => {
                    log::info!(
                        target: "pim-daemon",
                        "socket {} stale ({e}); removing and proceeding to spawn",
                        socket_path.display()
                    );
                    if let Err(rm_err) = std::fs::remove_file(&socket_path) {
                        log::warn!(
                            target: "pim-daemon",
                            "remove stale socket {} failed: {rm_err}; spawn may fail to bind",
                            socket_path.display()
                        );
                    }
                }
            }
        }

        let daemon_bin = resolve_sidecar_binary_path(app)?;
        log::debug!(
            target: "pim-daemon",
            "spawn_macos_privileged: daemon={} cfg={} pid={} log={}",
            daemon_bin.display(),
            config_path.display(),
            pid_file.display(),
            log_file.display(),
        );

        // Pre-spawn: pick a free utunN and rewrite `[interface] name` in
        // `pim.toml`. macOS leaks utuns when the daemon doesn't shut down
        // cleanly; the daemon binary fails with `Resource busy` when its
        // configured utun index is already taken. This scan is the
        // dev-mode workaround until the daemon learns to retry, OR we
        // ship a Network Extension entitlement that routes utun creation
        // through the OS-managed path.
        if let Err(e) = pick_and_apply_free_utun(&config_path) {
            log::warn!(
                target: "pim-daemon",
                "could not auto-pick free utun (will use existing pim.toml value): {e}"
            );
        }

        // Build the privileged shell command. See module-doc for why this
        // exact incantation:
        //   cd /              suppress getcwd warning when admin osascript
        //                     inherits a TCC-blocked cwd
        //   umask 000         socket + pid file world-rw so user UI can
        //                     connect / read
        //   ( cmd & )         canonical TN2065 daemonize subshell — admin
        //                     osascript has no TTY for nohup, and setsid
        //                     doesn't ship by default
        //   TMPDIR=… inside   sh prefix-assignment only applies to simple
        //                     commands, not compound `( ... )` — outer
        //                     prefix gives a parse error (sh exit 2)
        //   >{log}            truncate-on-open is the privileged shell's
        //                     responsibility (root can always rewrite a
        //                     root-owned file from a previous run; the user
        //                     UI cannot, so pre-truncating in Rust would
        //                     fail half the time). The tail task detects
        //                     truncation via size shrinkage and exits.
        let user_tmpdir = std::env::var("TMPDIR").unwrap_or_else(|_| "/tmp/".to_string());
        // PATH prefix: macOS `do shell script with administrator privileges`
        // resets the shell PATH to a sanitized system default that does NOT
        // include `/opt/homebrew/bin` (where Homebrew installs `blueutil`,
        // the Bluetooth backend the daemon shells out to on macOS) or
        // `/usr/local/bin` (Intel-Homebrew path; already in default PATH but
        // listed here defensively). Without this, the daemon's
        // `Command::new("blueutil")` calls fail with `command not found` and
        // BT discovery silently never starts.
        let path_prefix = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin";
        let shell_cmd = format!(
            "cd /; umask 000; ( PATH={path}:\"$PATH\" TMPDIR={tmpdir} {daemon} {cfg} {pid} </dev/null >{log} 2>&1 & )",
            path = shell_quote(path_prefix),
            tmpdir = shell_quote(&user_tmpdir),
            daemon = shell_quote(&daemon_bin.to_string_lossy()),
            cfg = shell_quote(&config_path.to_string_lossy()),
            pid = shell_quote(&pid_file.to_string_lossy()),
            log = shell_quote(&log_file.to_string_lossy()),
        );
        log::debug!(target: "pim-daemon", "privileged shell: {shell_cmd}");

        let osa_script = format!(
            r#"do shell script "{cmd}" with administrator privileges with prompt "pim needs administrator access to create the mesh network interface (utun) on macOS.""#,
            cmd = osascript_quote(&shell_cmd),
        );

        let cmd = app.shell().command("osascript").args(["-e", &osa_script]);
        let (mut rx, child) = cmd
            .spawn()
            .map_err(|e| anyhow!("spawn osascript wrapper for pim-daemon: {e}"))?;

        let spawned_at = Instant::now();
        log::info!(
            target: "pim-daemon",
            "spawned via osascript (privileged); daemon log: {}",
            log_file.display()
        );

        // Tail the daemon log file → forward each line to the `pim-daemon`
        // log target so users see daemon output in tauri-plugin-log just
        // like they do on Linux. Stops when the log file disappears
        // (rotated) or shrinks below our seek offset (truncated by a
        // re-spawn). Started in parallel with the wrapper because the
        // file is created the moment auth completes — we want to be
        // ready.
        let log_file_for_tail = log_file.clone();
        tokio::spawn(async move {
            tail_log_file(log_file_for_tail).await;
        });

        // Pump osascript wrapper output, then route the wrapper's exit
        // code into the right post-auth path:
        //
        //   - non-zero exit → user cancelled auth (or osascript itself
        //     errored). Fire crash-on-boot so the UI banner shows
        //     immediately instead of waiting for the 10 s handshake
        //     watchdog.
        //   - zero exit → auth succeeded and the privileged shell
        //     finished launching the daemon subshell. Now-and-only-now
        //     anchor the PID-liveness deadline. Anchoring ANY earlier
        //     would race the auth dialog, which can take tens of seconds
        //     of human time.
        let on_crash_after_wrapper = on_crash_on_boot.clone();
        let pid_file_after_wrapper = pid_file.clone();
        let log_file_after_wrapper = log_file.clone();
        let config_path_after_wrapper = config_path.clone();
        // FnOnce captured by the spawned task. Kept inside an Option so
        // it can be `take()`-and-called from the success branch without
        // moving out of the closure (FnOnce can't be cloned). The cancel
        // branch leaves it as None and the callback is dropped — desired,
        // because we don't want to arm the watchdog when there's no
        // daemon to wait on.
        let mut on_post_auth_slot: Option<G> = Some(on_post_auth);
        tokio::spawn(async move {
            let mut wrapper_stderr_tail: Vec<u8> = Vec::with_capacity(STDERR_TAIL_BYTES);
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => log::debug!(
                        target: "pim-daemon",
                        "osascript stdout: {}",
                        String::from_utf8_lossy(&bytes).trim_end()
                    ),
                    CommandEvent::Stderr(bytes) => {
                        log::warn!(
                            target: "pim-daemon",
                            "osascript stderr: {}",
                            String::from_utf8_lossy(&bytes).trim_end()
                        );
                        wrapper_stderr_tail.extend_from_slice(&bytes);
                        if wrapper_stderr_tail.len() > STDERR_TAIL_BYTES {
                            let drop = wrapper_stderr_tail.len() - STDERR_TAIL_BYTES;
                            wrapper_stderr_tail.drain(0..drop);
                        }
                    }
                    CommandEvent::Error(e) => log::error!(target: "pim-daemon", "osascript: {e}"),
                    CommandEvent::Terminated(payload) => {
                        log::info!(
                            target: "pim-daemon",
                            "osascript wrapper exited code={:?} signal={:?} (daemon detached)",
                            payload.code,
                            payload.signal,
                        );
                        if matches!(payload.code, Some(0)) {
                            // Auth succeeded — anchor the liveness probe NOW
                            // (post-auth) so its window is meaningful.
                            let probe_at = Instant::now();
                            tokio::spawn(liveness_probe(
                                pid_file_after_wrapper,
                                log_file_after_wrapper,
                                config_path_after_wrapper.to_string_lossy().to_string(),
                                probe_at,
                                on_crash_after_wrapper,
                            ));
                            // Auth done — daemon is starting. Now (and only
                            // now) is when the rpc.hello watchdog's 10s
                            // budget should begin counting.
                            if let Some(cb) = on_post_auth_slot.take() {
                                cb();
                            }
                        } else {
                            // Cancel / auth-fail / osascript error.
                            let stderr_tail =
                                String::from_utf8_lossy(&wrapper_stderr_tail).to_string();
                            (on_crash_after_wrapper)(CrashOnBootInfo {
                                exit_code: payload.code,
                                signal: payload.signal,
                                stderr_tail,
                                elapsed_ms: spawned_at.elapsed().as_millis() as u64,
                                config_path: config_path_after_wrapper
                                    .to_string_lossy()
                                    .to_string(),
                            });
                        }
                        break;
                    }
                    _ => {}
                }
            }
        });

        *self.child.lock().await = Some(child);
        Ok(())
    }

    // ────────────────────────────────────────────────────────────────────
    // Linux privileged path — pkexec + log tail + PID liveness probe.
    // ────────────────────────────────────────────────────────────────────

    /// Linux mirror of `spawn_macos_privileged`. The daemon needs
    /// `CAP_NET_ADMIN` to create the TUN interface; rather than make the
    /// user pre-grant `setcap` or run the UI under sudo, we route the
    /// spawn through `pkexec`, which triggers the polkit authentication
    /// agent (polkit-gnome / polkit-kde / lxqt-policykit) and shows a
    /// graphical password prompt — the Linux analog of the macOS
    /// Authorization Services dialog.
    ///
    /// Wire-level details:
    ///   * `pkexec /bin/sh -c '...'` — pkexec requires an absolute
    ///     program path and sanitizes the environment, so we hand it
    ///     `/bin/sh` and rebuild the env we need (XDG_RUNTIME_DIR for
    ///     the socket location) inside the shell command.
    ///   * Daemonization uses the same `( cmd & )` subshell pattern as
    ///     the macOS path so pkexec's wrapper exits the moment the
    ///     daemon is reparented to PID 1.
    ///   * `umask 000` so the root-owned socket / pid / log files are
    ///     world-rw and the user-uid UI can read+write them.
    ///   * Log file at `$XDG_RUNTIME_DIR/pim-daemon.log` is tailed by
    ///     `tail_log_file` and forwarded to the `pim-daemon` log target,
    ///     mirroring the macOS observability story.
    ///   * pkexec exit code 127 = "not authorized" / auth dismissed; any
    ///     non-zero exit fires `on_crash_on_boot` so the UI surfaces a
    ///     banner immediately instead of waiting for the 10s rpc.hello
    ///     watchdog.
    #[cfg(target_os = "linux")]
    async fn spawn_linux_privileged<F, G>(
        &self,
        app: &AppHandle,
        on_crash_on_boot: F,
        on_post_auth: G,
    ) -> Result<()>
    where
        F: Fn(CrashOnBootInfo) + Send + Sync + Clone + 'static,
        G: FnOnce() + Send + 'static,
    {
        let socket_path = crate::daemon::socket_path::resolve_socket_path();
        let pid_file = pid_file_path();
        let log_file = log_file_path();
        let config_path = resolve_config_path();

        // Fast-path: if a daemon is ALREADY serving the socket (systemd
        // unit, manual `sudo pim-daemon`, or a previous spawn within this
        // session), skip the privileged spawn entirely. File existence
        // alone is NOT sufficient — a crashed daemon leaves an orphan
        // socket file behind that returns ECONNREFUSED. We use connect()
        // as the liveness probe.
        if socket_path.exists() {
            match std::os::unix::net::UnixStream::connect(&socket_path) {
                Ok(_) => {
                    log::info!(
                        target: "pim-daemon",
                        "socket {} alive — skipping privileged spawn (pre-existing daemon answering)",
                        socket_path.display()
                    );
                    on_post_auth();
                    return Ok(());
                }
                Err(e) => {
                    log::info!(
                        target: "pim-daemon",
                        "socket {} stale ({e}); leaving cleanup to the daemon (root-owned file) and proceeding to spawn",
                        socket_path.display()
                    );
                    // Don't try to remove the stale socket here — when
                    // the previous daemon ran as root the file is owned
                    // by root and a user-uid `unlink()` returns EPERM.
                    // The privileged shell below will overwrite/bind.
                }
            }
        }

        let daemon_bin = resolve_sidecar_binary_path(app)?;
        log::debug!(
            target: "pim-daemon",
            "spawn_linux_privileged: daemon={} cfg={} pid={} log={}",
            daemon_bin.display(),
            config_path.display(),
            pid_file.display(),
            log_file.display(),
        );

        // Build the privileged shell command. pkexec strips most of the
        // environment, so we re-export the bits the daemon and its
        // socket-path resolver depend on:
        //   XDG_RUNTIME_DIR  honored by the daemon's resolve_socket_path
        //                    (mirrors the UI's resolution in socket_path.rs)
        //   umask 000        baseline so any file the daemon creates
        //                    without an explicit chmod is world-rw
        //   rm -f {pid}      drop the previous run's PID file BEFORE
        //                    spawning. Otherwise liveness_probe reads
        //                    the dead PID, polls `ps -p` against it,
        //                    sees nothing, and fires a false
        //                    crash-on-boot — even though the new daemon
        //                    is starting up fine.
        //   ( cmd & )        daemonize subshell so pkexec's wrapper
        //                    exits as soon as the daemon is backgrounded
        //   >{log}           truncate-on-open by the privileged shell
        //                    (root rewriting a root-owned file from a
        //                    previous run)
        //   wait + chmod 666 the daemon may set its own umask (we observed
        //                    socket born as 0660 root:root, pid as 0644)
        //                    which locks out the user-uid UI with EACCES
        //                    on connect. After the socket appears we
        //                    chmod 666 it (plus pid + log) so the UI can
        //                    read / write. Defense in depth: XDG_RUNTIME_DIR
        //                    is itself 0700-owned by the user, so 0666
        //                    inside it is still effectively user-only.
        let xdg_runtime_dir = dirs::runtime_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/tmp".to_string());
        let shell_cmd = format!(
            "cd /; umask 000; rm -f {pid}; \
             ( XDG_RUNTIME_DIR={xdg} {daemon} {cfg} {pid} </dev/null >{log} 2>&1 & ); \
             i=0; while [ $i -lt 30 ]; do \
               if [ -S {sock} ] && [ -e {pid} ]; then break; fi; \
               sleep 0.1; i=$((i+1)); \
             done; \
             chmod 666 {sock} {pid} {log} 2>/dev/null; true",
            xdg = shell_quote(&xdg_runtime_dir),
            daemon = shell_quote(&daemon_bin.to_string_lossy()),
            cfg = shell_quote(&config_path.to_string_lossy()),
            pid = shell_quote(&pid_file.to_string_lossy()),
            log = shell_quote(&log_file.to_string_lossy()),
            sock = shell_quote(&socket_path.to_string_lossy()),
        );
        log::debug!(target: "pim-daemon", "privileged shell: {shell_cmd}");

        let cmd = app
            .shell()
            .command("pkexec")
            .args(["/bin/sh", "-c", &shell_cmd]);
        let (mut rx, child) = cmd
            .spawn()
            .map_err(|e| anyhow!("spawn pkexec wrapper for pim-daemon: {e}"))?;

        let spawned_at = Instant::now();
        log::info!(
            target: "pim-daemon",
            "spawned via pkexec (privileged); daemon log: {}",
            log_file.display()
        );

        // Tail the daemon log file → forward each line to the `pim-daemon`
        // log target so users see daemon output in tauri-plugin-log just
        // like the macOS path does.
        let log_file_for_tail = log_file.clone();
        tokio::spawn(async move {
            tail_log_file(log_file_for_tail).await;
        });

        // Pump pkexec wrapper output, route exit code into the right
        // post-auth path:
        //   - non-zero exit → user dismissed auth (pkexec exit 127) or
        //     pkexec itself errored. Fire crash-on-boot so the UI banner
        //     shows immediately.
        //   - zero exit → auth succeeded and the privileged shell
        //     finished launching the daemon subshell. Anchor the
        //     PID-liveness deadline NOW (post-auth).
        let on_crash_after_wrapper = on_crash_on_boot.clone();
        let pid_file_after_wrapper = pid_file.clone();
        let log_file_after_wrapper = log_file.clone();
        let config_path_after_wrapper = config_path.clone();
        let mut on_post_auth_slot: Option<G> = Some(on_post_auth);
        tokio::spawn(async move {
            let mut wrapper_stderr_tail: Vec<u8> = Vec::with_capacity(STDERR_TAIL_BYTES);
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => log::debug!(
                        target: "pim-daemon",
                        "pkexec stdout: {}",
                        String::from_utf8_lossy(&bytes).trim_end()
                    ),
                    CommandEvent::Stderr(bytes) => {
                        log::warn!(
                            target: "pim-daemon",
                            "pkexec stderr: {}",
                            String::from_utf8_lossy(&bytes).trim_end()
                        );
                        wrapper_stderr_tail.extend_from_slice(&bytes);
                        if wrapper_stderr_tail.len() > STDERR_TAIL_BYTES {
                            let drop = wrapper_stderr_tail.len() - STDERR_TAIL_BYTES;
                            wrapper_stderr_tail.drain(0..drop);
                        }
                    }
                    CommandEvent::Error(e) => log::error!(target: "pim-daemon", "pkexec: {e}"),
                    CommandEvent::Terminated(payload) => {
                        log::info!(
                            target: "pim-daemon",
                            "pkexec wrapper exited code={:?} signal={:?} (daemon detached)",
                            payload.code,
                            payload.signal,
                        );
                        if matches!(payload.code, Some(0)) {
                            let probe_at = Instant::now();
                            tokio::spawn(liveness_probe(
                                pid_file_after_wrapper,
                                log_file_after_wrapper,
                                config_path_after_wrapper.to_string_lossy().to_string(),
                                probe_at,
                                on_crash_after_wrapper,
                            ));
                            if let Some(cb) = on_post_auth_slot.take() {
                                cb();
                            }
                        } else {
                            let stderr_tail =
                                String::from_utf8_lossy(&wrapper_stderr_tail).to_string();
                            (on_crash_after_wrapper)(CrashOnBootInfo {
                                exit_code: payload.code,
                                signal: payload.signal,
                                stderr_tail,
                                elapsed_ms: spawned_at.elapsed().as_millis() as u64,
                                config_path: config_path_after_wrapper
                                    .to_string_lossy()
                                    .to_string(),
                            });
                        }
                        break;
                    }
                    _ => {}
                }
            }
        });

        *self.child.lock().await = Some(child);
        Ok(())
    }
}

impl Default for Sidecar {
    fn default() -> Self {
        Self::new()
    }
}

// ────────────────────────────────────────────────────────────────────────
// Cross-platform helpers (binary path resolution).
// ────────────────────────────────────────────────────────────────────────

/// Resolve the absolute path to the bundled `pim-daemon` binary.
///
/// In dev mode (`cargo tauri dev`) Tauri places the sidecar alongside
/// the main binary at `target/<profile>/pim-daemon` (no `-<triple>`
/// suffix because the dev copy strips it). In bundled production it
/// lives next to the resource_dir layout produced for the host:
///   * macOS: `Contents/Resources/binaries/pim-daemon-<triple>` inside the .app
///   * Linux: `<resource_dir>/binaries/pim-daemon-<triple>` (e.g. inside the
///     AppImage / .deb usr/lib/<bundle> tree).
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn resolve_sidecar_binary_path(app: &AppHandle) -> Result<PathBuf> {
    use tauri::Manager;

    // Dev layout — same dir as the main exe, no triple suffix.
    let exe = std::env::current_exe().map_err(|e| anyhow!("current_exe: {e}"))?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| anyhow!("current_exe has no parent dir"))?;
    let dev_path = exe_dir.join("pim-daemon");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // Production layout — `<resource_dir>/binaries/pim-daemon-<triple>`.
    #[cfg(all(target_arch = "aarch64", target_os = "macos"))]
    let triple = "aarch64-apple-darwin";
    #[cfg(all(target_arch = "x86_64", target_os = "macos"))]
    let triple = "x86_64-apple-darwin";
    #[cfg(all(target_arch = "x86_64", target_os = "linux"))]
    let triple = "x86_64-unknown-linux-gnu";
    #[cfg(all(target_arch = "aarch64", target_os = "linux"))]
    let triple = "aarch64-unknown-linux-gnu";

    if let Ok(resource_dir) = app.path().resource_dir() {
        let prod_path = resource_dir.join(format!("binaries/pim-daemon-{triple}"));
        if prod_path.exists() {
            return Ok(prod_path);
        }
    }

    // Final dev fallback: `target/<profile>/binaries/pim-daemon-<triple>` —
    // the layout `cargo tauri dev` produces when the bundle is not yet
    // assembled.
    let dev_with_triple = exe_dir.join(format!("binaries/pim-daemon-{triple}"));
    if dev_with_triple.exists() {
        return Ok(dev_with_triple);
    }

    Err(anyhow!(
        "pim-daemon binary not found near {} or in resource_dir — \
         expected dev (target/<profile>/pim-daemon) or bundled \
         (binaries/pim-daemon-{triple}) layout",
        exe_dir.display()
    ))
}

// ────────────────────────────────────────────────────────────────────────
// Privileged-path helpers (macOS osascript + Linux pkexec).
// ────────────────────────────────────────────────────────────────────────

/// Privileged-path PID file location.
///
/// macOS: `$TMPDIR/pim.pid` (per docs/RPC.md §1.2 — $TMPDIR is set by
/// launchd and survives only across the user session).
///
/// Linux: `$XDG_RUNTIME_DIR/pim.pid` (alongside `pim.sock` resolved by
/// `daemon::socket_path::resolve_socket_path`). XDG_RUNTIME_DIR is the
/// canonical user-scope tmpfs that systemd-logind manages and tears down
/// on logout. `dirs::runtime_dir` reads it; we fall back to `/tmp` only
/// when it's unset (headless / pre-systemd dev shells).
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn pid_file_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let tmp = std::env::var_os("TMPDIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/tmp"));
        tmp.join("pim.pid")
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(xdg) = dirs::runtime_dir() {
            return xdg.join("pim.pid");
        }
        PathBuf::from("/tmp/pim.pid")
    }
}

/// Privileged-path daemon log file. Co-located with the PID file so a
/// `tail -F` debug session can find both side-by-side.
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn log_file_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let tmp = std::env::var_os("TMPDIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/tmp"));
        tmp.join("pim-daemon.log")
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(xdg) = dirs::runtime_dir() {
            return xdg.join("pim-daemon.log");
        }
        PathBuf::from("/tmp/pim-daemon.log")
    }
}

/// POSIX-shell single-quote a string. Single quotes don't interpret
/// escapes, so the only thing we need to handle is literal `'`, which
/// becomes `'\''` (close-quote, escaped-quote, reopen-quote).
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Escape a string for embedding inside an AppleScript double-quoted
/// string literal. AppleScript honors `\\` (backslash), `\"`
/// (double-quote), `\n`, `\r`, `\t` inside `"..."`. We escape all five
/// defensively even though our shell command never contains the
/// control chars in practice — it's a tiny extra cost for a much
/// smaller blast radius if upstream code ever feeds us an exotic
/// path or message.
#[cfg(target_os = "macos")]
fn osascript_quote(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

// ────────────────────────────────────────────────────────────────────────
// macOS utun pre-spawn auto-pick.
// ────────────────────────────────────────────────────────────────────────

/// Detect a free `utunN` (N ≥ 7) and rewrite the on-disk `pim.toml`'s
/// `[interface] name` field to point at it.
///
/// Why N ≥ 7: macOS reserves `utun0..utun3` for system services
/// (iCloud Relay, AirDrop, system VPN, etc); `utun4..utun6` may also
/// be in use by user-mode VPN clients. Starting at 7 avoids stomping
/// on those. We scan up to `utun31`; if every index is taken we error
/// out with a `reboot may help` hint (utun cleanup needs the kctl fd
/// to close, and a stuck VPN client can hold one indefinitely).
///
/// Why rewrite the file: the daemon binary takes the interface name
/// from the config (no CLI override). We touch ONLY the `name = "..."`
/// line inside the `[interface]` section — every other field, comment,
/// and indent is preserved verbatim.
#[cfg(target_os = "macos")]
fn pick_and_apply_free_utun(config_path: &Path) -> Result<()> {
    use std::process::Command;

    let output = Command::new("ifconfig")
        .arg("-l")
        .output()
        .map_err(|e| anyhow!("ifconfig -l: {e}"))?;
    if !output.status.success() {
        return Err(anyhow!(
            "ifconfig -l exited non-zero: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let active: std::collections::HashSet<&str> = stdout.split_whitespace().collect();

    let chosen = (7..32u32)
        .map(|n| format!("utun{n}"))
        .find(|name| !active.contains(name.as_str()))
        .ok_or_else(|| {
            anyhow!("no free utun in range 7..32 — reboot may be needed to clear leaked utuns")
        })?;

    let cfg_text = std::fs::read_to_string(config_path)
        .map_err(|e| anyhow!("read {}: {e}", config_path.display()))?;

    let mut new_lines: Vec<String> = Vec::with_capacity(cfg_text.lines().count() + 1);
    let mut in_interface_section = false;
    let mut rewrote = false;
    for line in cfg_text.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with('[') {
            in_interface_section = trimmed.starts_with("[interface]");
        }
        if in_interface_section && !rewrote && trimmed.starts_with("name = \"") {
            let leading_ws = &line[..line.len() - trimmed.len()];
            let after_first_quote = &trimmed[8..]; // skip `name = "`
            let close_quote = after_first_quote
                .find('"')
                .ok_or_else(|| anyhow!("malformed [interface] name line: missing closing quote"))?;
            let tail = &after_first_quote[close_quote + 1..];
            new_lines.push(format!("{leading_ws}name = \"{chosen}\"{tail}"));
            rewrote = true;
            continue;
        }
        new_lines.push(line.to_string());
    }
    if !rewrote {
        return Err(anyhow!(
            "did not find a `[interface]` section with a `name = \"...\"` line in {}",
            config_path.display()
        ));
    }

    // Atomic write — temp file in same dir, then rename.
    let parent = config_path
        .parent()
        .ok_or_else(|| anyhow!("config has no parent dir"))?;
    let tmp = parent.join(".pim.toml.utun-rewrite");
    std::fs::write(&tmp, new_lines.join("\n") + "\n")
        .map_err(|e| anyhow!("write tmp {}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, config_path)
        .map_err(|e| anyhow!("rename {} -> {}: {e}", tmp.display(), config_path.display()))?;

    log::info!(
        target: "pim-daemon",
        "auto-picked free interface: {chosen} (rewrote [interface] name in pim.toml)"
    );
    Ok(())
}

// ────────────────────────────────────────────────────────────────────────
// macOS log tailer.
// ────────────────────────────────────────────────────────────────────────

/// Tail the daemon log file (`$TMPDIR/pim-daemon.log`) and forward each
/// new line to `log::info!(target = "pim-daemon", ...)` so users get the
/// same observability they have on Linux's pipe path.
///
/// This is a poll-based tail — Darwin doesn't expose inotify, and
/// `kqueue`/`fsevents` would add a non-trivial dep we don't need for a
/// dev tool. We just open at offset 0 (the file is pre-truncated by the
/// caller before spawn) and read-to-EOF every `LOG_TAIL_POLL_MS`.
///
/// Stops if the file disappears (rotation) or grows abnormally large
/// — we cap at 16 MiB to avoid runaway disk reads when a daemon spins
/// in an error loop. The user can `tail -F` the file directly for raw
/// access.
#[cfg(any(target_os = "macos", target_os = "linux"))]
async fn tail_log_file(log_path: PathBuf) {
    use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};

    const MAX_FILE_BYTES: u64 = 16 * 1024 * 1024;

    // Wait briefly for the file to exist (UI may call this before the
    // privileged shell has had time to redirect into it).
    let mut waited_ms = 0u64;
    while !log_path.exists() && waited_ms < 5_000 {
        tokio::time::sleep(Duration::from_millis(LOG_TAIL_POLL_MS)).await;
        waited_ms = waited_ms.saturating_add(LOG_TAIL_POLL_MS);
    }
    if !log_path.exists() {
        log::debug!(
            target: "pim-daemon",
            "log file {} did not appear within 5s; tailer exiting",
            log_path.display()
        );
        return;
    }

    let mut file = match tokio::fs::File::open(&log_path).await {
        Ok(f) => f,
        Err(e) => {
            log::warn!(target: "pim-daemon", "open {}: {e}", log_path.display());
            return;
        }
    };
    if let Err(e) = file.seek(SeekFrom::Start(0)).await {
        log::warn!(target: "pim-daemon", "seek {}: {e}", log_path.display());
        return;
    }

    let mut leftover: Vec<u8> = Vec::new();
    let mut chunk = vec![0u8; 4096];
    let mut offset: u64 = 0;
    loop {
        // Bail if the file vanished (rotation), grew past our cap, OR
        // shrunk below our seek offset (truncate-on-respawn). The third
        // case is the one that matters for "daemon stopped + restarted
        // within the same UI session" — the new tail task takes over,
        // we exit cleanly instead of reading garbage.
        match tokio::fs::metadata(&log_path).await {
            Ok(meta) if meta.len() > MAX_FILE_BYTES => {
                log::warn!(
                    target: "pim-daemon",
                    "log file {} exceeded {} bytes; stopping tail",
                    log_path.display(),
                    MAX_FILE_BYTES
                );
                return;
            }
            Ok(meta) if meta.len() < offset => {
                log::debug!(
                    target: "pim-daemon",
                    "log file {} truncated (size {} < offset {}); tailer exiting",
                    log_path.display(),
                    meta.len(),
                    offset
                );
                return;
            }
            Err(_) => return, // file gone — daemon stopped
            _ => {}
        }

        let n = match file.read(&mut chunk).await {
            Ok(n) => n,
            Err(_) => return,
        };
        if n == 0 {
            tokio::time::sleep(Duration::from_millis(LOG_TAIL_POLL_MS)).await;
            continue;
        }
        offset = offset.saturating_add(n as u64);
        leftover.extend_from_slice(&chunk[..n]);
        while let Some(nl) = leftover.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = leftover.drain(..=nl).collect();
            // Strip the trailing newline; emit empty lines as nothing.
            let text = String::from_utf8_lossy(&line[..line.len().saturating_sub(1)]);
            if !text.is_empty() {
                log::info!(target: "pim-daemon", "{text}");
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────────────
// macOS PID-file liveness probe — wires crash-on-boot.
// ────────────────────────────────────────────────────────────────────────

/// Wait for the PID file to appear, then poll `kill -0 <pid>` over the
/// liveness window. If the file never appears OR the process disappears
/// inside the window, fire `on_crash_on_boot` so the UI surfaces a
/// crash-on-boot banner (Phase 01.1 D-18) instead of waiting for the
/// 10 s rpc.hello handshake watchdog.
///
/// `kill -0` works across the user/root boundary: the kernel checks
/// existence ONLY (no signal-delivery permission check) when sig=0,
/// so a user-uid UI can probe a root-uid daemon's liveness.
#[cfg(any(target_os = "macos", target_os = "linux"))]
async fn liveness_probe<F>(
    pid_file: PathBuf,
    log_file: PathBuf,
    config_path: String,
    spawned_at: Instant,
    on_crash_on_boot: F,
) where
    F: Fn(CrashOnBootInfo) + Send + Sync + 'static,
{
    // Caller anchors `spawned_at` at POST-AUTH (osascript wrapper exit
    // code 0). Reaching here means auth has already succeeded and the
    // privileged shell ran the daemon backgrounding incantation. From
    // this point on, ANY failure to materialize a live PID is a real
    // crash-on-boot — fire the diagnostic so the UI banner shows
    // immediately instead of waiting for the 10 s rpc.hello watchdog.
    let deadline = spawned_at + Duration::from_millis(PID_LIVENESS_WINDOW_MS);

    // Phase 1: wait for PID file.
    while Instant::now() < deadline {
        if pid_file.exists() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(PID_POLL_INTERVAL_MS)).await;
    }
    if !pid_file.exists() {
        let stderr_tail = read_log_tail(&log_file).await;
        log::warn!(
            target: "pim-daemon",
            "liveness_probe: PID file {} never appeared within {} ms post-auth — daemon crashed during startup",
            pid_file.display(),
            PID_LIVENESS_WINDOW_MS
        );
        on_crash_on_boot(CrashOnBootInfo {
            exit_code: None,
            signal: None,
            stderr_tail,
            elapsed_ms: spawned_at.elapsed().as_millis() as u64,
            config_path,
        });
        return;
    }

    let pid: i32 = match std::fs::read_to_string(&pid_file)
        .ok()
        .and_then(|s| s.trim().parse().ok())
    {
        Some(p) => p,
        None => {
            log::warn!(
                target: "pim-daemon",
                "liveness_probe: PID file {} present but unparseable — abandoning probe",
                pid_file.display()
            );
            return;
        }
    };

    // Phase 2: poll alive while still inside the liveness window. If
    // the process dies, harvest the log tail and fire crash-on-boot.
    while Instant::now() < deadline {
        if !is_process_alive(pid) {
            let stderr_tail = read_log_tail(&log_file).await;
            log::warn!(
                target: "pim-daemon",
                "liveness_probe: pid {pid} disappeared inside the {PID_LIVENESS_WINDOW_MS} ms window — daemon crashed"
            );
            on_crash_on_boot(CrashOnBootInfo {
                exit_code: None,
                signal: None,
                stderr_tail,
                elapsed_ms: spawned_at.elapsed().as_millis() as u64,
                config_path,
            });
            return;
        }
        tokio::time::sleep(Duration::from_millis(PID_POLL_INTERVAL_MS)).await;
    }
    log::debug!(
        target: "pim-daemon",
        "liveness_probe: pid {pid} survived the {PID_LIVENESS_WINDOW_MS} ms window — handing off to handshake watchdog"
    );
}

/// Cross-uid process liveness check via `ps -p`. We can't use
/// `kill -0` here: on macOS the kernel returns `EPERM` (not `ESRCH`)
/// when a non-root caller probes a root-owned process, so `kill -0`
/// from the user UI against a root daemon reports "dead" even when
/// the process is very much alive — false-positive crash-on-boot.
/// Linux `kill -0` is permissive across uids, but `ps -p` is the
/// portable answer so we use it on both Unixes.
///
/// `ps -p <pid>` reads the kernel proc table directly, no signal
/// involved, no permission check. Exit 0 if the pid is alive, exit 1
/// if not. We pipe stdout/stderr to /dev/null so the header line
/// `ps` always prints doesn't pollute our terminal.
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn is_process_alive(pid: i32) -> bool {
    use std::process::Stdio;
    std::process::Command::new("ps")
        .args(["-p", &pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Read the last `STDERR_TAIL_BYTES` bytes from `log_path`. Used by the
/// liveness probe to give the UI a diagnostic blurb when crash-on-boot
/// fires. Returns "" if the file can't be read.
#[cfg(any(target_os = "macos", target_os = "linux"))]
async fn read_log_tail(log_path: &Path) -> String {
    use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};

    let Ok(mut file) = tokio::fs::File::open(log_path).await else {
        return String::new();
    };
    let Ok(meta) = file.metadata().await else {
        return String::new();
    };
    let len = meta.len();
    let start = len.saturating_sub(STDERR_TAIL_BYTES as u64);
    if file.seek(SeekFrom::Start(start)).await.is_err() {
        return String::new();
    }
    let mut buf = Vec::with_capacity(STDERR_TAIL_BYTES);
    if file.read_to_end(&mut buf).await.is_err() {
        return String::new();
    }
    String::from_utf8_lossy(&buf).to_string()
}

// ────────────────────────────────────────────────────────────────────────
// macOS privileged kill — fire-and-forget.
// ────────────────────────────────────────────────────────────────────────

/// Kill the daemon via a SECOND privileged osascript invocation, FIRE-AND-FORGET.
///
/// Why detached: `Sidecar::kill()` is called from two contexts —
///   (a) explicit Stop button via `daemon_stop` Tauri command, and
///   (b) the run-loop close handler when the user closes the window.
///
/// In context (b), blocking on `osascript .status()` waits for an auth
/// dialog that, on macOS, can become visually orphaned the moment the
/// owning window is destroyed — the dialog still exists in the system
/// dialog stack but the user can't see it, so they `force-quit` instead
/// of authenticating. Net effect: the entire app hangs forever waiting
/// for an auth that will never complete.
///
/// The fix is to detach the osascript child entirely. `std::process::Child`
/// has a no-op `Drop`, so dropping the handle does NOT kill the child —
/// the osascript process is reparented to launchd when our app exits and
/// continues showing the auth dialog independently. The user authenticates
/// (daemon dies cleanly, releases utun) or cancels (daemon stays — fast-path
/// on next Start picks it up). Either way our app exits in milliseconds.
///
/// Trade-off: we can't tell the caller whether the kill succeeded. For
/// Stop button this means the UI optimistically shows `Stopped` while the
/// auth dialog is still pending. We accept this for dev-mode parity with
/// the launchd-managed production path (which has no per-stop auth at all).
#[cfg(target_os = "macos")]
async fn kill_privileged_macos() -> Result<()> {
    let pid_file = pid_file_path();
    let pid_text = match std::fs::read_to_string(&pid_file) {
        Ok(s) => s.trim().to_string(),
        Err(_) => {
            log::info!(
                target: "pim-daemon",
                "no PID file at {} — assuming daemon already stopped",
                pid_file.display()
            );
            return Ok(());
        }
    };
    if pid_text.is_empty() || pid_text.parse::<u32>().is_err() {
        return Err(anyhow!(
            "PID file {} is empty or non-numeric: {pid_text:?}",
            pid_file.display()
        ));
    }

    // TERM, then poll alive 5×200ms, then KILL, then remove PID file —
    // single privileged invocation = one auth prompt total.
    let shell_cmd = format!(
        "kill -TERM {pid} 2>/dev/null; for i in 1 2 3 4 5; do kill -0 {pid} 2>/dev/null || break; sleep 0.2; done; kill -KILL {pid} 2>/dev/null; rm -f {pid_path}; true",
        pid = pid_text,
        pid_path = shell_quote(&pid_file.to_string_lossy()),
    );

    let osa_script = format!(
        r#"do shell script "{cmd}" with administrator privileges with prompt "pim is shutting down the mesh daemon.""#,
        cmd = osascript_quote(&shell_cmd),
    );

    // Spawn detached. `_child` going out of scope is a no-op on
    // `std::process::Child` — the osascript process keeps running.
    use std::process::Stdio;
    let _child = std::process::Command::new("osascript")
        .args(["-e", &osa_script])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| anyhow!("spawn osascript kill: {e}"))?;

    log::info!(
        target: "pim-daemon",
        "privileged kill dispatched (detached) for pid {pid_text}; auth dialog will appear independently of UI shutdown"
    );
    Ok(())
}

// ────────────────────────────────────────────────────────────────────────
// Linux privileged kill — pkexec, fire-and-forget.
// ────────────────────────────────────────────────────────────────────────

/// Kill the daemon via a SECOND `pkexec` invocation, FIRE-AND-FORGET.
///
/// Mirrors `kill_privileged_macos` (see its docs for the rationale on
/// detaching). The Linux analog: pkexec spawns the polkit auth agent
/// dialog independently of the UI process, so we drop the child handle
/// and let the auth + kill complete (or get cancelled) on its own
/// timeline. UI exits in milliseconds either way.
#[cfg(target_os = "linux")]
async fn kill_privileged_linux() -> Result<()> {
    let pid_file = pid_file_path();
    let pid_text = match std::fs::read_to_string(&pid_file) {
        Ok(s) => s.trim().to_string(),
        Err(_) => {
            log::info!(
                target: "pim-daemon",
                "no PID file at {} — assuming daemon already stopped",
                pid_file.display()
            );
            return Ok(());
        }
    };
    if pid_text.is_empty() || pid_text.parse::<u32>().is_err() {
        return Err(anyhow!(
            "PID file {} is empty or non-numeric: {pid_text:?}",
            pid_file.display()
        ));
    }

    // TERM, then poll alive 5×200ms, then KILL, then remove PID file —
    // single privileged invocation = one auth prompt total.
    let shell_cmd = format!(
        "kill -TERM {pid} 2>/dev/null; for i in 1 2 3 4 5; do kill -0 {pid} 2>/dev/null || break; sleep 0.2; done; kill -KILL {pid} 2>/dev/null; rm -f {pid_path}; true",
        pid = pid_text,
        pid_path = shell_quote(&pid_file.to_string_lossy()),
    );

    // Spawn detached. `_child` going out of scope is a no-op on
    // `std::process::Child` — the pkexec process keeps running and
    // shows its auth dialog independently of UI shutdown.
    use std::process::Stdio;
    let _child = std::process::Command::new("pkexec")
        .args(["/bin/sh", "-c", &shell_cmd])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| anyhow!("spawn pkexec kill: {e}"))?;

    log::info!(
        target: "pim-daemon",
        "privileged kill dispatched (detached) for pid {pid_text}; auth dialog will appear independently of UI shutdown"
    );
    Ok(())
}

// ────────────────────────────────────────────────────────────────────────
// Unit tests (host-only — not gated on macOS so CI on Linux still runs
// the cross-platform helpers).
// ────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    #[cfg(target_os = "macos")]
    use super::*;

    #[cfg(target_os = "macos")]
    #[test]
    fn shell_quote_handles_simple_paths() {
        assert_eq!(shell_quote("/tmp/foo"), "'/tmp/foo'");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn shell_quote_escapes_embedded_single_quote() {
        assert_eq!(shell_quote("a'b"), r#"'a'\''b'"#);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn osascript_quote_escapes_backslash_quote_and_controls() {
        assert_eq!(osascript_quote("a\"b"), "a\\\"b");
        assert_eq!(osascript_quote("a\\b"), "a\\\\b");
        assert_eq!(osascript_quote("a\nb"), "a\\nb");
        assert_eq!(osascript_quote("a\tb"), "a\\tb");
        assert_eq!(osascript_quote("a\rb"), "a\\rb");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn pid_and_log_paths_inside_tmpdir() {
        // We don't assert exact dir (depends on env), only suffixes.
        assert!(pid_file_path().to_string_lossy().ends_with("/pim.pid"));
        assert!(log_file_path()
            .to_string_lossy()
            .ends_with("/pim-daemon.log"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn pick_and_apply_free_utun_rewrites_only_interface_name() {
        let dir = tempfile::tempdir().expect("tempdir");
        let cfg = dir.path().join("pim.toml");
        let original = r#"[node]
name = "ignore-me"

[interface]
name = "pim0"         # comment-tail is preserved
mtu = 1400

[transport]
listen_port = 0
"#;
        std::fs::write(&cfg, original).expect("write");
        pick_and_apply_free_utun(&cfg).expect("rewrite");
        let after = std::fs::read_to_string(&cfg).expect("read");
        // [node] name untouched.
        assert!(after.contains(
            r#"[node]
name = "ignore-me""#
        ));
        // [interface] name rewritten to a utunN with N >= 7.
        assert!(after.contains("[interface]\nname = \"utun"));
        // Tail comment + neighbour fields preserved.
        assert!(after.contains("# comment-tail is preserved"));
        assert!(after.contains("mtu = 1400"));
        assert!(after.contains("[transport]\nlisten_port = 0"));
    }
}
