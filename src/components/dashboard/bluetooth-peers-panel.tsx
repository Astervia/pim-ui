/**
 * <BluetoothPeersPanel /> — Dashboard panel showing Bluetooth-discovered
 * peers in real time (Phase 7 spike).
 *
 * Source of truth: `useBluetoothRfcomm`, which subscribes to the
 * `bluetooth-rfcomm://event` Tauri channel emitted by the Mac-side
 * `pim-bt-rfcomm-mac` Swift sidecar. Each peer here was paired with
 * the Mac via System Settings → Bluetooth and replied to the PIM
 * Hello/HelloAck handshake, so its `node_id`/`name`/`platform`/`caps`
 * came over the Bluetooth link itself — no Wi-Fi, no IP needed.
 *
 * Honest UI: panel hides on non-macOS (the sidecar exists only on Mac
 * in this iteration), and shows an explicit empty state when the
 * sidecar is up but no peers replied yet. Failure modes (sidecar
 * crashed, BT off) surface as a banner, not silently.
 *
 * Renders inside the existing dashboard CLI grid, after the `Peers`
 * panel, so users see it without scrolling.
 */

import { useBluetoothRfcomm } from "@/hooks/use-bluetooth-rfcomm";
import { CliPanel } from "@/components/brand/cli-panel";
import { TeachingEmptyState } from "@/components/brand/teaching-empty-state";
import { cn } from "@/lib/utils";

const PLATFORM_LABEL: Record<string, string> = {
  macos: "mac",
  linux: "linux",
  windows: "windows",
  ios: "ios",
};

const EMPTY_BT_HEADLINE = "no bluetooth peers yet";
const EMPTY_BT_NEXT =
  "pair a PIM-* device via System Settings → Bluetooth — discovery is live";
const EMPTY_BT_CYCLE = ["scan", "pair", "hello"] as const;

export interface BluetoothPeersPanelProps {
  limitedMode?: boolean;
  revealDelay?: number | null;
}

export function BluetoothPeersPanel({
  limitedMode = false,
  revealDelay = 0,
}: BluetoothPeersPanelProps) {
  const { peers, sidecarUp, lastError } = useBluetoothRfcomm();

  // Honest count + status badge.
  const count = peers.length;
  const labelText =
    !sidecarUp
      ? "starting"
      : count === 0
        ? "0 found"
        : `${count} found`;
  const variant = !sidecarUp || count === 0 ? "muted" : "default";
  const badge = { label: labelText.toUpperCase(), variant: variant as "default" | "muted" };

  return (
    <CliPanel
      title="bluetooth"
      status={badge}
      revealDelay={revealDelay}
      className={cn(limitedMode === true && "opacity-60")}
    >
      {lastError !== null && (
        <div className="mb-2 px-3 py-2 text-[11px] text-amber-500/90">
          ⚠ {lastError}
        </div>
      )}

      {peers.length === 0 ? (
        <TeachingEmptyState
          headline={EMPTY_BT_HEADLINE}
          next={EMPTY_BT_NEXT}
          cycle={EMPTY_BT_CYCLE}
        />
      ) : (
        <ul className="flex flex-col">
          {peers.map((peer) => (
            <li
              key={peer.bd_addr}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-foreground/10 px-3 py-2 first:border-t-0"
            >
              <span aria-hidden="true" className="text-foreground/60">
                ◆
              </span>

              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-2 text-[13px] text-foreground">
                  <span className="font-medium">{peer.name}</span>
                  <span className="truncate text-foreground/50">
                    {peer.bd_addr}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground/55">
                  <span>{PLATFORM_LABEL[peer.platform] ?? peer.platform}</span>
                  <span>·</span>
                  <span>rfcomm</span>
                  {peer.caps.length > 0 && (
                    <>
                      <span>·</span>
                      <span>{peer.caps.join(" ")}</span>
                    </>
                  )}
                </div>
              </div>

              <span
                title={`node_id: ${peer.node_id}`}
                className="font-mono text-[11px] text-foreground/40"
              >
                {peer.node_id.length >= 8
                  ? peer.node_id.slice(0, 8) + "…"
                  : peer.node_id}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CliPanel>
  );
}
