/**
 * useBtNapPreflight — Phase 6 Plan 06-03.
 *
 * One-shot Tauri invoke wrapper that detects whether the host supports
 * the Linux NAP-server side of `[bluetooth].serve_nap = true`. Used by
 * `<BluetoothSection />` to render an inline checklist alongside the
 * NAP-server switch and disable the toggle when the host can't run it.
 *
 * Design decisions:
 *   - Tauri side (`rpc/bt_nap.rs`) is the temporary implementation
 *     until the kernel daemon exposes its own RPC. This hook abstracts
 *     the seam — callers see `{ supported, platform, checks }`
 *     regardless of where the data came from.
 *   - Re-runs on `enabled` flip-on so users who install missing tools
 *     see updated results without restarting the app. A manual
 *     `refresh()` is also exposed.
 *   - W1 invariant: no Tauri event subscriptions; pure invoke.
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type BtNapPlatform = "linux" | "macos" | "windows" | "other";

export interface BtNapPreflightCheck {
  /** Stable identifier (e.g. "bt_network", "dnsmasq", "bnep_module"). */
  name: string;
  ok: boolean;
  detail: string;
}

export interface BtNapPreflightResult {
  supported: boolean;
  platform: BtNapPlatform;
  checks: BtNapPreflightCheck[];
}

export interface UseBtNapPreflight {
  result: BtNapPreflightResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * @param enabled  When false, the hook stays idle (no invoke). The
 *                 caller sets this to `true` once the user enables the
 *                 master Bluetooth toggle so we don't probe the host
 *                 unnecessarily on every Settings open.
 */
export function useBtNapPreflight(enabled: boolean): UseBtNapPreflight {
  const [result, setResult] = useState<BtNapPreflightResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await invoke<BtNapPreflightResult>("bt_nap_preflight");
      setResult(r);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled === false) {
      setResult(null);
      setError(null);
      return;
    }
    void run();
  }, [enabled, run]);

  const refresh = useCallback(async () => {
    if (enabled === false) return;
    await run();
  }, [enabled, run]);

  return { result, loading, error, refresh };
}
