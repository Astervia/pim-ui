//! Spawns pim-daemon as a Tauri externalBin sidecar and forwards its
//! stdout/stderr to tracing. Kills the child on app exit to prevent orphans.
//!
//! IMPORTANT: wire WindowEvent::Destroyed -> Sidecar::kill in lib.rs.
//!
//! Phase 01.1 D-18: extended with `spawned_at` capture + a 500 ms
//! crash-on-boot threshold. When `CommandEvent::Terminated` arrives within
//! 500 ms of spawn, the supplied `on_crash_on_boot` closure is invoked with
//! a `CrashOnBootInfo` so the caller (DaemonConnection) can transition to
//! `Error` via the EXISTING `daemon://state-changed` event. NO new Tauri
//! event channel is introduced — preserves the W1 single-listener contract.
//!
//! macOS privilege-escalation path (post-Phase-5 dev patch, 2026-04-27):
//! the shipped pim-daemon binary needs root on macOS to create a `utun`
//! interface (`Operation not permitted` errno 1 from
//! `SYSPROTO_CONTROL` on `PF_SYSTEM` socket). To avoid forcing the user
//! to launch the entire app from a terminal with sudo, we spawn the
//! daemon through `osascript`'s `do shell script with administrator
//! privileges` on macOS. The user sees the standard system auth dialog
//! ("pim needs administrator access ...") with TouchID/password; on
//! authentication the daemon runs as root in the background and creates
//! the utun + binds the JSON-RPC socket. The 500 ms crash-on-boot
//! detection is BYPASSED on this path because `CommandEvent::Terminated`
//! fires for the osascript wrapper (which exits in milliseconds after
//! detaching the daemon with `&`) — the daemon's actual exit cannot be
//! observed through the wrapper. The existing `rpc.hello`
//! HANDSHAKE_TIMEOUT in state.rs catches daemon failure to come up.
//! Production-grade replacement is a Network Extension entitlement
//! (Apple Developer Program + Apple review) — out of scope for v1 dev.

use anyhow::{anyhow, Result};
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

use crate::daemon::config_path::resolve_config_path;
use crate::daemon::state::CrashOnBootInfo;

/// Phase 01.1 D-18 crash-on-boot threshold (Linux/Windows path only —
/// macOS spawn goes through osascript which we can't observe past the
/// wrapper exit; see module-doc).
#[cfg(not(target_os = "macos"))]
const CRASH_ON_BOOT_THRESHOLD_MS: u64 = 500;
/// Phase 01.1 D-19: ring-cap the captured stderr tail to keep the payload
/// small (the UI surfaces the first line; we keep the whole 2 KiB for logs).
#[cfg(not(target_os = "macos"))]
const STDERR_TAIL_BYTES: usize = 2048;

pub struct Sidecar {
    child: Arc<Mutex<Option<CommandChild>>>,
}

impl Sidecar {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }

    /// Spawn pim-daemon. Returns Ok(()) the moment the child PROCESS is
    /// spawned (Phase 2 Plan 02-01 contract). The crash-on-boot detection
    /// runs in the inner tokio task; the outer return type is unchanged.
    ///
    /// `on_crash_on_boot` fires at most once per spawn, only when
    /// `CommandEvent::Terminated` arrives within 500 ms.
    ///
    /// On macOS the spawn routes through `osascript`'s "do shell script
    /// with administrator privileges" — see module-doc note for why.
    /// Crash-on-boot detection is bypassed there.
    pub async fn spawn<F>(&self, app: &AppHandle, on_crash_on_boot: F) -> Result<()>
    where
        F: Fn(CrashOnBootInfo) + Send + Sync + Clone + 'static,
    {
        #[cfg(target_os = "macos")]
        {
            // Suppress the unused warning for on_crash_on_boot on macOS —
            // the privileged-spawn path doesn't observe the daemon's exit.
            let _ = on_crash_on_boot;
            return self.spawn_macos_privileged(app).await;
        }

        #[cfg(not(target_os = "macos"))]
        {
            self.spawn_default(app, on_crash_on_boot).await
        }
    }

    /// Standard sidecar spawn — used on Linux/Windows/etc where the daemon
    /// runs with the same uid as the UI (Linux daemon uses CAP_NET_ADMIN
    /// or runs as root from a service unit; Windows version is TBD).
    #[cfg(not(target_os = "macos"))]
    async fn spawn_default<F>(&self, app: &AppHandle, on_crash_on_boot: F) -> Result<()>
    where
        F: Fn(CrashOnBootInfo) + Send + Sync + Clone + 'static,
    {
        let sidecar = app
            .shell()
            .sidecar("pim-daemon")
            .map_err(|e| anyhow!("externalBin 'pim-daemon' not configured: {e}"))?;
        let (mut rx, child) = sidecar
            .spawn()
            .map_err(|e| anyhow!("spawn pim-daemon: {e}"))?;

        // D-18: clock starts when the child PROCESS is alive.
        let spawned_at = std::time::Instant::now();

        // Forward child output to tracing. This also keeps the receiver alive
        // so the child doesn't SIGPIPE on write when stdout buffer fills.
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
                        // D-19: append + ring-cap to STDERR_TAIL_BYTES.
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
                        // D-18: < 500 ms — surface as crash-on-boot. >= 500 ms
                        // keeps existing trace-warn-only behavior so Phase 1
                        // success criterion 4 (graceful disconnect) holds.
                        if elapsed_ms < CRASH_ON_BOOT_THRESHOLD_MS {
                            let stderr_tail =
                                String::from_utf8_lossy(&stderr_buf).to_string();
                            let config_path =
                                resolve_config_path().to_string_lossy().to_string();
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
        Ok(())
    }

    /// macOS privileged spawn via `osascript do shell script with
    /// administrator privileges`. The user sees the standard auth dialog;
    /// after authenticating, the daemon runs as root in the background.
    ///
    /// Caveats vs the default path:
    ///  - 500 ms crash-on-boot detection is bypassed — see module-doc.
    ///  - Daemon stdout/stderr go to `/tmp/pim-daemon.log` (root-owned)
    ///    instead of being forwarded to tracing in real time. We capture
    ///    osascript's own stderr to detect user-cancel ("execution error:
    ///    User canceled.").
    ///  - Daemon kill via `Sidecar::kill()` becomes a no-op on this path
    ///    (the child handle is the osascript wrapper, which has already
    ///    exited; killing the daemon as root from a user process is
    ///    forbidden). Operator must `sudo killall pim-daemon` manually
    ///    until we ship a privileged-helper kill flow.
    #[cfg(target_os = "macos")]
    async fn spawn_macos_privileged(&self, app: &AppHandle) -> Result<()> {
        // Fast-path: if a daemon is already serving the socket (e.g. user
        // started it manually with `sudo` in another terminal), skip spawn
        // entirely. The state.rs connect loop will handshake against the
        // existing socket. Use this as the dev workaround when osascript
        // detachment misbehaves.
        let socket_path = crate::daemon::socket_path::resolve_socket_path();
        if socket_path.exists() {
            log::info!(
                target: "pim-daemon-osa",
                "socket {} already exists; skipping privileged spawn (assuming daemon is already running externally — likely a manual `sudo pim-daemon ...`)",
                socket_path.display()
            );
            eprintln!("[pim-ui] daemon socket exists at {}; skipping spawn", socket_path.display());
            return Ok(());
        }

        eprintln!("[pim-ui] spawn_macos_privileged: starting (socket {} does not exist yet)", socket_path.display());

        let daemon_bin = resolve_sidecar_binary_path()?;
        let config_path = resolve_config_path();
        let pid_file = std::path::PathBuf::from("/tmp/pim.pid");
        let log_file = std::path::PathBuf::from("/tmp/pim-daemon.log");

        eprintln!("[pim-ui] daemon_bin = {}", daemon_bin.display());
        eprintln!("[pim-ui] config_path = {}", config_path.display());

        // Pre-spawn: pick a free utunN and rewrite the on-disk pim.toml's
        // [interface] name field. macOS leaks utun interfaces when the
        // daemon doesn't shut down cleanly (the kernel only reaps utun
        // when its kctl fd closes), and the daemon binary's interface
        // creation fails with `Resource busy (errno 16)` when its
        // requested utun is taken. This scan is the dev-mode workaround
        // until either (a) the daemon learns to retry with a fallback
        // index, or (b) we ship a Network Extension entitlement that
        // routes utun creation through the OS-managed path.
        if let Err(e) = pick_and_apply_free_utun(&config_path) {
            log::warn!(
                target: "pim-daemon-osa",
                "could not auto-pick free utun (will use existing pim.toml value): {e}"
            );
        }

        // The daemon (running as root) and the UI (running as user) must
        // resolve the same socket path. macOS gives root a different
        // $TMPDIR than the user's, so we pin TMPDIR to the user's value
        // explicitly in the privileged shell. This keeps
        // `socket_path::resolve_socket_path()` (UI) and the daemon's own
        // socket binding in agreement.
        let user_tmpdir = std::env::var("TMPDIR").unwrap_or_else(|_| "/tmp/".to_string());

        // umask 000 — socket created by daemon (root) ends up world-rw
        // so the user-mode UI can connect.
        // nohup + </dev/null — detach properly so the daemon survives the
        // osascript wrapper exit. Without this, `do shell script with
        // administrator privileges` may kill backgrounded children when
        // its wrapper terminates (TN2065 doesn't document this combo;
        // community pattern is nohup + closed-stdin to be safe).
        let shell_cmd = format!(
            "umask 000; TMPDIR={tmpdir} nohup {daemon} {cfg} {pid} </dev/null >{log} 2>&1 &",
            tmpdir = shell_quote(&user_tmpdir),
            daemon = shell_quote(&daemon_bin.to_string_lossy()),
            cfg = shell_quote(&config_path.to_string_lossy()),
            pid = shell_quote(&pid_file.to_string_lossy()),
            log = shell_quote(&log_file.to_string_lossy()),
        );

        eprintln!("[pim-ui] shell_cmd: {}", shell_cmd);

        // The osascript itself — wrap the shell command in a privileged
        // context with a custom prompt message. The dialog shows
        // "osascript wants to make changes" (parent process) but the
        // body text is our custom message.
        let osa_script = format!(
            r#"do shell script "{cmd}" with administrator privileges with prompt "pim needs administrator access to create the mesh network interface (utun) on macOS.""#,
            cmd = osascript_quote(&shell_cmd),
        );

        let cmd = app.shell().command("osascript").args(["-e", &osa_script]);
        let (mut rx, child) = cmd
            .spawn()
            .map_err(|e| anyhow!("spawn osascript wrapper for pim-daemon: {e}"))?;

        log::info!(
            target: "pim-daemon-osa",
            "spawned via osascript (privileged); daemon log: {}",
            log_file.display()
        );

        // We don't apply the 500 ms crash-on-boot detection to the
        // osascript wrapper — see module-doc. We do log osascript's own
        // stdout/stderr so user-cancel ("User canceled.") is visible.
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => log::info!(
                        target: "pim-daemon-osa",
                        "{}",
                        String::from_utf8_lossy(&bytes).trim_end()
                    ),
                    CommandEvent::Stderr(bytes) => log::warn!(
                        target: "pim-daemon-osa",
                        "{}",
                        String::from_utf8_lossy(&bytes).trim_end()
                    ),
                    CommandEvent::Error(e) => log::error!(target: "pim-daemon-osa", "{e}"),
                    CommandEvent::Terminated(payload) => {
                        // Wrapper exits ~immediately after backgrounding the
                        // daemon. A non-zero code USUALLY means user canceled
                        // the auth dialog or osascript itself failed. The
                        // daemon's actual exit cannot be observed through this
                        // wrapper — rely on rpc.hello timeout in state.rs.
                        log::info!(
                            target: "pim-daemon-osa",
                            "osascript wrapper exited code={:?} signal={:?} (daemon detached)",
                            payload.code,
                            payload.signal,
                        );
                        break;
                    }
                    _ => {}
                }
            }
        });

        *self.child.lock().await = Some(child);
        Ok(())
    }

    /// SIGTERM the child and wait briefly for graceful exit.
    ///
    /// On macOS osascript path, the stored child handle is the osascript
    /// wrapper (already exited); the actual daemon runs as root and must
    /// be killed via a SECOND privileged osascript invocation. The user
    /// sees the auth dialog again on stop. This is verbose UX-wise but
    /// it's the only way to release the utun interface cleanly so the
    /// next start doesn't hit `Resource busy (errno 16)`.
    pub async fn kill(&self) -> Result<()> {
        // Drop the stored child handle first — on macOS this is the
        // osascript wrapper (already exited; child.kill() returns Err
        // which we just log). On Linux/Windows it's the real daemon
        // and the kill propagates as a clean SIGTERM.
        if let Some(child) = self.child.lock().await.take() {
            if let Err(e) = child.kill() {
                log::warn!(
                    target: "pim-daemon",
                    "kill child handle failed (osascript wrapper already exited on macOS — expected): {e}"
                );
            }
        }

        // macOS: route the actual daemon kill through a privileged
        // osascript so root-owned `pim-daemon` exits cleanly + releases
        // its utun interface.
        #[cfg(target_os = "macos")]
        {
            if let Err(e) = kill_macos_privileged().await {
                log::warn!(
                    target: "pim-daemon",
                    "privileged daemon kill failed: {e}; daemon may still be running — operator may need to sudo kill -9 {{PID in /tmp/pim.pid}}"
                );
            }
        }

        Ok(())
    }
}

impl Default for Sidecar {
    fn default() -> Self {
        Self::new()
    }
}

/// Resolve the absolute path to the bundled pim-daemon binary.
///
/// In dev mode Tauri places the sidecar alongside the main binary
/// (`target/debug/pim-daemon` — the `-<triple>` suffix is stripped during
/// the dev copy). In bundled production it lives in
/// `Contents/Resources/binaries/pim-daemon-<triple>` inside the .app.
/// We try the dev layout first (same dir as `current_exe()`), then fall
/// back to the resource_dir/binaries/pim-daemon-<triple> production layout.
#[cfg(target_os = "macos")]
fn resolve_sidecar_binary_path() -> Result<std::path::PathBuf> {
    let exe = std::env::current_exe().map_err(|e| anyhow!("current_exe: {e}"))?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| anyhow!("current_exe has no parent dir"))?;

    // Dev-mode layout: target/debug/pim-daemon (no -<triple> suffix when
    // copied to target dir by Tauri).
    let dev_path = exe_dir.join("pim-daemon");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // Production layout: <resources>/binaries/pim-daemon-<triple>.
    #[cfg(all(target_arch = "aarch64", target_os = "macos"))]
    let triple = "aarch64-apple-darwin";
    #[cfg(all(target_arch = "x86_64", target_os = "macos"))]
    let triple = "x86_64-apple-darwin";

    // Try $exe_dir/binaries/pim-daemon-<triple> (dev fallback).
    let dev_with_triple = exe_dir.join(format!("binaries/pim-daemon-{triple}"));
    if dev_with_triple.exists() {
        return Ok(dev_with_triple);
    }

    // Final fallback: production resources path. Since we don't have the
    // app handle here, try the conventional .app bundle layout relative
    // to `exe_dir`.
    let prod_path = exe_dir
        .parent()
        .map(|p| p.join("Resources").join(format!("binaries/pim-daemon-{triple}")));
    if let Some(p) = prod_path {
        if p.exists() {
            return Ok(p);
        }
    }

    Err(anyhow!(
        "pim-daemon binary not found near {} — expected dev (target/debug/pim-daemon) or bundled (Contents/Resources/binaries/pim-daemon-<triple>) layout",
        exe_dir.display()
    ))
}

/// POSIX-shell single-quote a string. Single quotes don't interpret
/// escapes, so the only thing we need to handle is literal `'`, which
/// becomes `'\''` (close-quote, escaped quote, reopen-quote).
#[cfg(target_os = "macos")]
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Escape a string for embedding inside an AppleScript double-quoted
/// string literal. AppleScript honors `\\` (backslash) and `\"`
/// (double-quote) inside `"..."` — escape both.
#[cfg(target_os = "macos")]
fn osascript_quote(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Detect a free `utunN` (N ≥ 7) and rewrite the on-disk pim.toml's
/// `[interface] name` field to point at it.
///
/// Why N ≥ 7: macOS reserves utun0..utun3 for system services
/// (typically iCloud Relay, VPN exit, AirDrop, etc.); utun4..utun6 may
/// also be in use by user-mode VPN clients. Starting at 7 avoids
/// stomping on those. We scan up to utun31; if every index 7..32 is
/// taken, return Err and let the spawn fail with a useful message.
///
/// Why rewrite the file: the daemon binary takes the interface name
/// from the config, not from a CLI flag — so the only way to feed it a
/// different utun is to update pim.toml in place. We touch ONLY the
/// `name = "..."` line inside the `[interface]` section, leaving every
/// other field (including the platform-aware comment) untouched.
#[cfg(target_os = "macos")]
fn pick_and_apply_free_utun(config_path: &std::path::Path) -> Result<()> {
    use std::process::Command;

    // Snapshot active interfaces from `ifconfig -l` (space-separated names).
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

    // Find first utun N in [7, 31] not in the active set.
    let mut chosen: Option<String> = None;
    for n in 7..32u32 {
        let candidate = format!("utun{n}");
        if !active.contains(candidate.as_str()) {
            chosen = Some(candidate);
            break;
        }
    }
    let chosen = chosen.ok_or_else(|| {
        anyhow!("no free utun in range 7..32 — reboot may be needed to clear leaked utuns")
    })?;

    // Read pim.toml, replace the [interface] name line, write atomically.
    let cfg_text = std::fs::read_to_string(config_path)
        .map_err(|e| anyhow!("read {}: {e}", config_path.display()))?;

    // Locate the [interface] section + its `name = "..."` line. Match on
    // section boundary so we don't accidentally rewrite `[node] name`.
    let mut new_lines: Vec<String> = Vec::with_capacity(cfg_text.lines().count() + 1);
    let mut in_interface_section = false;
    let mut rewrote = false;
    for line in cfg_text.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with('[') {
            in_interface_section = trimmed.starts_with("[interface]");
        }
        if in_interface_section && !rewrote && trimmed.starts_with("name = \"") {
            // Preserve the indent + comment tail on the original line so
            // the file diff is minimal. Find first `"` after `name = `,
            // matching `"..."`, replace value verbatim.
            let leading_ws = &line[..line.len() - trimmed.len()];
            // Comment tail: everything after the closing `"`.
            let after_first_quote = &trimmed[8..]; // skip `name = "`
            let close_quote = after_first_quote
                .find('"')
                .ok_or_else(|| anyhow!("malformed [interface] name line: missing closing quote"))?;
            let tail = &after_first_quote[close_quote + 1..];
            new_lines.push(format!(
                "{leading_ws}name = \"{chosen}\"{tail}",
                leading_ws = leading_ws,
                chosen = chosen,
                tail = tail
            ));
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

    // Atomic write: temp file in same dir, fsync, rename.
    let parent = config_path
        .parent()
        .ok_or_else(|| anyhow!("config has no parent dir"))?;
    let tmp = parent.join(".pim.toml.utun-rewrite");
    std::fs::write(&tmp, new_lines.join("\n") + "\n")
        .map_err(|e| anyhow!("write tmp {}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, config_path)
        .map_err(|e| anyhow!("rename {} -> {}: {e}", tmp.display(), config_path.display()))?;

    log::info!(
        target: "pim-daemon-osa",
        "auto-picked free interface: {chosen} (rewrote [interface] name in pim.toml)"
    );
    Ok(())
}

/// Privileged daemon kill via `osascript do shell script with
/// administrator privileges`. Reads `/tmp/pim.pid` for the daemon PID,
/// then `kill -TERM <pid>; sleep 1; kill -KILL <pid>` so the daemon
/// gets a chance to clean up but is force-killed if it ignores SIGTERM.
/// User sees the auth dialog again on stop.
#[cfg(target_os = "macos")]
async fn kill_macos_privileged() -> Result<()> {
    let pid_file = "/tmp/pim.pid";
    let pid_text = match std::fs::read_to_string(pid_file) {
        Ok(s) => s.trim().to_string(),
        Err(_) => {
            log::info!(
                target: "pim-daemon",
                "no /tmp/pim.pid — assuming daemon already stopped"
            );
            return Ok(());
        }
    };
    if pid_text.is_empty() || pid_text.parse::<u32>().is_err() {
        return Err(anyhow!("/tmp/pim.pid is empty or non-numeric"));
    }

    // Wrap the kill in a small shell so we get TERM-then-KILL semantics
    // in a single privileged invocation (one auth prompt, not two).
    let shell_cmd = format!(
        "kill -TERM {pid} 2>/dev/null; for i in 1 2 3 4 5; do kill -0 {pid} 2>/dev/null || break; sleep 0.2; done; kill -KILL {pid} 2>/dev/null; rm -f {pid_file}; true",
        pid = pid_text,
        pid_file = pid_file
    );

    let osa_script = format!(
        r#"do shell script "{cmd}" with administrator privileges with prompt "pim is shutting down the mesh daemon.""#,
        cmd = osascript_quote(&shell_cmd),
    );

    // Spawn osascript directly via std::process (we're in async fn but
    // this is a sync wait — the auth dialog blocks anyway). Using the
    // tauri shell plugin here would require an AppHandle which we don't
    // pass into kill(). std::process::Command is fine for a one-shot.
    let status = tokio::task::spawn_blocking(move || {
        std::process::Command::new("osascript")
            .args(["-e", &osa_script])
            .status()
    })
    .await
    .map_err(|e| anyhow!("spawn_blocking osascript kill: {e}"))?
    .map_err(|e| anyhow!("osascript kill exec: {e}"))?;

    if !status.success() {
        return Err(anyhow!(
            "osascript kill exited non-zero (user canceled auth?): {status}"
        ));
    }
    Ok(())
}
