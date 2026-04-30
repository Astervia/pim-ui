/**
 * config.get lifecycle atom + module-level refetch accessor.
 *
 * Lives in 03-01 (not 03-04) because Plan 03-02's use-add-peer / use-remove-peer
 * hooks need to trigger a config.get refetch on success (D-30 — post-peer
 * refetch to pick up the updated [[peers]] array and trigger the
 * raw-is-source-of-truth scan). Exposing a non-hook refetchSettingsConfig()
 * keeps the call out of Plan 03-02's component tree.
 *
 * Two read modes:
 *
 *   - **rpc**  — daemon is `running`; the canonical source is
 *                `config.get` over JSON-RPC. The daemon round-trips its
 *                in-memory parsed view (which may incorporate live
 *                discovery state, etc.) and returns the TOML.
 *   - **disk** — daemon is NOT running; we fall back to the
 *                `read_pim_config_text` Tauri command which does a
 *                straight `std::fs::read_to_string` on the resolved
 *                pim.toml path. Lets the Settings tab populate so the
 *                user can inspect AND edit while the daemon is stopped.
 *                In disk mode, save flows route through the
 *                `write_pim_config_text` Tauri command (atomic write +
 *                schema validation) instead of the live `config.save`
 *                RPC; the daemon picks up the new file on next start.
 *
 * The mode is selected per-fetch by the caller; the hook orchestrates
 * which one to invoke based on the live useDaemonState snapshot. When
 * the daemon transitions stopped → running we refetch from RPC so the
 * UI reflects whatever the daemon has now (it may have re-parsed and
 * filled in defaults; without this, the user sees a stale disk view).
 *
 * Pattern: module-level atom + useSyncExternalStore, mirroring
 * use-active-screen.ts and use-daemon-state.ts. Multiple consumers
 * (Settings sections in Plan 03-04/05/06, peer hooks in 03-02) share
 * one snapshot through this hook.
 *
 * W1 contract: this hook does NOT call `listen(...)` — it only invokes
 * `callDaemon("config.get", ...)` (RPC mode) or
 * `invoke("read_pim_config_text")` (disk mode). No new Tauri event
 * subscription is introduced.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { callDaemon } from "@/lib/rpc";
import type { RpcError } from "@/lib/rpc-types";
import { parseToml, type ParsedConfig } from "@/lib/config/parse-toml";
import { useDaemonState } from "./use-daemon-state";

export type ConfigSource = "rpc" | "disk" | null;

interface ConfigAtom {
  base: ParsedConfig | null;
  raw: string;
  sourcePath: string;
  lastModified: string;
  loading: boolean;
  loadError: RpcError | null;
  /**
   * Where the current `base/raw` came from. `disk` is shown to the
   * user via a small banner so they understand why saves are blocked.
   * `null` while the first fetch is still in-flight.
   */
  source: ConfigSource;
}

let atom: ConfigAtom = {
  base: null,
  raw: "",
  sourcePath: "",
  lastModified: "",
  loading: false,
  loadError: null,
  source: null,
};
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getAtom() {
  return atom;
}

interface DiskReadResult {
  raw: string;
  path: string;
  last_modified: string;
}

async function fetchFromRpc(): Promise<void> {
  try {
    const res = await callDaemon("config.get", { format: "toml" });
    const parsed = parseToml(res.config);
    atom = {
      base: parsed.ok ? parsed.value : null,
      raw: res.config,
      sourcePath: res.source_path,
      lastModified: res.last_modified,
      loading: false,
      loadError: null,
      source: "rpc",
    };
  } catch (e) {
    // RPC failed — keep last-known data if any (D-30 honest last-state),
    // but record the error so the UI can surface it. We do NOT auto-
    // fall back to disk here: the caller (the hook's useEffect) decides
    // the mode per daemon-state, and that's where the fallback lives.
    atom = { ...atom, loading: false, loadError: e as RpcError };
  }
  notify();
}

async function fetchFromDisk(): Promise<void> {
  try {
    const res = await invoke<DiskReadResult>("read_pim_config_text");
    if (res.raw.length === 0) {
      // Config file doesn't exist yet (first-run not bootstrapped). We
      // can't show fields against nothing; surface a synthetic
      // load-error so the existing "couldn't load config" branch in
      // settings.tsx renders.
      atom = {
        base: null,
        raw: "",
        sourcePath: res.path,
        lastModified: "",
        loading: false,
        loadError: {
          code: -32000,
          message: `pim.toml not found at ${res.path}`,
          data: null,
        },
        source: "disk",
      };
      notify();
      return;
    }
    const parsed = parseToml(res.raw);
    atom = {
      base: parsed.ok ? parsed.value : null,
      raw: res.raw,
      sourcePath: res.path,
      lastModified: res.last_modified,
      loading: false,
      loadError: null,
      source: "disk",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    atom = {
      ...atom,
      loading: false,
      loadError: { code: -32001, message, data: null },
      source: "disk",
    };
  }
  notify();
}

async function fetchConfig(mode: "rpc" | "disk"): Promise<void> {
  atom = { ...atom, loading: true, loadError: null };
  notify();
  if (mode === "rpc") {
    await fetchFromRpc();
  } else {
    await fetchFromDisk();
  }
}

/**
 * Module-level refetch — callable from anywhere (no hook context required).
 * Used by use-add-peer / use-remove-peer (Plan 03-02) per D-30 and by
 * use-section-save / use-raw-toml-save (Plan 03-04 / 03-06) post-save.
 *
 * Always uses RPC mode since these callers run only after a daemon-side
 * mutation succeeded — at which point daemon is by definition running.
 */
export async function refetchSettingsConfig(): Promise<void> {
  return fetchConfig("rpc");
}

export interface UseSettingsConfigReturn {
  base: ParsedConfig | null;
  raw: string;
  sourcePath: string;
  lastModified: string;
  loading: boolean;
  loadError: RpcError | null;
  source: ConfigSource;
  refetch: () => Promise<void>;
}

export function useSettingsConfig(): UseSettingsConfigReturn {
  const snap = useSyncExternalStore(subscribe, getAtom, getAtom);
  const { snapshot: daemon } = useDaemonState();
  const daemonRunning = daemon.state === "running";
  const desiredSource: "rpc" | "disk" = daemonRunning === true ? "rpc" : "disk";

  useEffect(() => {
    // First fetch — kick off based on the current daemon state.
    if (snap.base === null && snap.loading === false && snap.loadError === null) {
      void fetchConfig(desiredSource);
    }
    // Daemon transitioned: refetch from the now-correct source so the
    // user sees the freshest authoritative copy. We only do this when
    // the source actually disagrees with desired — guards against an
    // infinite loop if a fetch fails silently.
    else if (snap.loading === false && snap.source !== null && snap.source !== desiredSource) {
      void fetchConfig(desiredSource);
    }
  }, [snap.base, snap.loading, snap.loadError, snap.source, desiredSource]);

  const refetch = useCallback(() => fetchConfig(desiredSource), [desiredSource]);
  return { ...snap, refetch };
}

// Exposed for tests to reset module state between cases (matches the
// __test_resetActiveScreenAtom pattern).
export const __test_resetSettingsConfigAtom = (): void => {
  atom = {
    base: null,
    raw: "",
    sourcePath: "",
    lastModified: "",
    loading: false,
    loadError: null,
    source: null,
  };
  listeners.clear();
};
