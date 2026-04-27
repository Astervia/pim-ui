/**
 * config.get lifecycle atom + module-level refetch accessor.
 *
 * Lives in 03-01 (not 03-04) because Plan 03-02's use-add-peer / use-remove-peer
 * hooks need to trigger a config.get refetch on success (D-30 — post-peer
 * refetch to pick up the updated [[peers]] array and trigger the
 * raw-is-source-of-truth scan). Exposing a non-hook refetchSettingsConfig()
 * keeps the call out of Plan 03-02's component tree.
 *
 * Pattern: module-level atom + useSyncExternalStore, mirroring
 * use-active-screen.ts and use-daemon-state.ts. Multiple consumers
 * (Settings sections in Plan 03-04/05/06, peer hooks in 03-02) share
 * one snapshot through this hook.
 *
 * W1 contract: this hook does NOT call `listen(...)` — it only invokes
 * `callDaemon("config.get", ...)`, a request/response RPC. No new Tauri
 * event subscription is introduced.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { callDaemon } from "@/lib/rpc";
import type { RpcError } from "@/lib/rpc-types";
import { parseToml, type ParsedConfig } from "@/lib/config/parse-toml";

interface ConfigAtom {
  base: ParsedConfig | null;
  raw: string;
  sourcePath: string;
  lastModified: string;
  loading: boolean;
  loadError: RpcError | null;
}

let atom: ConfigAtom = {
  base: null,
  raw: "",
  sourcePath: "",
  lastModified: "",
  loading: false,
  loadError: null,
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

async function fetchConfig(): Promise<void> {
  atom = { ...atom, loading: true, loadError: null };
  notify();
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
    };
  } catch (e) {
    atom = { ...atom, loading: false, loadError: e as RpcError };
  }
  notify();
}

/**
 * Module-level refetch — callable from anywhere (no hook context required).
 * Used by use-add-peer / use-remove-peer (Plan 03-02) per D-30 and by
 * use-section-save / use-raw-toml-save (Plan 03-04 / 03-06) post-save.
 */
export async function refetchSettingsConfig(): Promise<void> {
  return fetchConfig();
}

export interface UseSettingsConfigReturn {
  base: ParsedConfig | null;
  raw: string;
  sourcePath: string;
  lastModified: string;
  loading: boolean;
  loadError: RpcError | null;
  refetch: () => Promise<void>;
}

export function useSettingsConfig(): UseSettingsConfigReturn {
  const snap = useSyncExternalStore(subscribe, getAtom, getAtom);
  useEffect(() => {
    if (snap.base === null && snap.loading === false) void fetchConfig();
  }, [snap.base, snap.loading]);
  const refetch = useCallback(() => fetchConfig(), []);
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
  };
  listeners.clear();
};
