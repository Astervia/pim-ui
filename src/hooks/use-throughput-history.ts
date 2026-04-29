/**
 * useThroughputHistory — derives a per-second bytes/sec ring buffer
 * from the cumulative `status.stats.forwarded_bytes` counter.
 *
 * The daemon reports cumulative totals, so trend visualisation requires
 * client-side delta computation. We sample on every snapshot tick (the
 * daemon sends `status.event` per kind) and store the per-second rate
 * in a fixed-size ring buffer. The Sparkline component reads the
 * buffer directly.
 *
 * Buffer size defaults to 60 (≈60s of history at 1Hz daemon updates).
 * If the daemon temporarily stops emitting events the buffer simply
 * stops advancing — no fabricated zero samples.
 *
 * W1 invariant preserved: this hook reads `useStatus()` (a snapshot
 * selector) and never opens its own listen() call.
 */

import { useEffect, useRef, useState } from "react";
import { useStatus } from "./use-status";

const DEFAULT_BUFFER_SIZE = 60;

export interface ThroughputSample {
  /** Bytes per second computed since the previous sample. */
  bytesPerSec: number;
  /** Wall-clock timestamp (ms since epoch) when this sample landed. */
  at: number;
}

export interface ThroughputHistory {
  /** Bytes/sec history, oldest first, newest last. */
  rates: readonly number[];
  /** Most recent rate (0 when no samples yet). */
  latestBytesPerSec: number;
}

export function useThroughputHistory(
  size: number = DEFAULT_BUFFER_SIZE,
): ThroughputHistory {
  const status = useStatus();
  const lastBytesRef = useRef<number | null>(null);
  const lastAtRef = useRef<number | null>(null);
  const [rates, setRates] = useState<number[]>([]);

  useEffect(() => {
    if (status === null) return;
    const totalBytes = status.stats.forwarded_bytes;
    const now = Date.now();
    const lastBytes = lastBytesRef.current;
    const lastAt = lastAtRef.current;
    lastBytesRef.current = totalBytes;
    lastAtRef.current = now;

    // First sample — seed only, no rate to compute yet.
    if (lastBytes === null || lastAt === null) return;

    const elapsedMs = now - lastAt;
    if (elapsedMs <= 0) return;

    const delta = totalBytes - lastBytes;
    // Clamp negative deltas (daemon restart / counter reset) to zero so
    // the sparkline doesn't dip below baseline on snapshot resync.
    const safeDelta = delta < 0 ? 0 : delta;
    const bytesPerSec = (safeDelta / elapsedMs) * 1000;

    setRates((prev) => {
      const next = [...prev, bytesPerSec];
      if (next.length > size) next.shift();
      return next;
    });
  }, [status, size]);

  const latestBytesPerSec =
    rates.length === 0 ? 0 : rates[rates.length - 1] ?? 0;

  return { rates, latestBytesPerSec };
}
