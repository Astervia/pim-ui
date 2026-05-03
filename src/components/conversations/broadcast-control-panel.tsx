/**
 * <BroadcastControlPanel /> — Messages-screen control row for the
 * mesh-wide identity broadcast feature.
 *
 * Layout: a small bordered box with three labeled rows, each on its
 * own line. Labels share a fixed-width column so the controls line
 * up vertically and read like a config table:
 *
 *   ── broadcast ──────────────────────────────────────────
 *      outbound    [ off | 5m | 15m | 1h ]   [ broadcast now ]
 *                  last 03:42 · 7 peers
 *      inbound     [x] watch incoming     min peer rate [ 30s | 60s | 5m ]
 *      identity    [ show my card ]
 *
 * The panel is collapsible. Collapsed (default): a single dense
 * status line summarizing the current state. Expanded: the full
 * three-row form. Local-only state — open status doesn't persist
 * across page reloads.
 */

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useBroadcast } from "@/hooks/use-broadcast";
import { formatTimeOfDay } from "@/lib/conversations/format";
import { callDaemon } from "@/lib/rpc";
import { refreshConversations } from "@/hooks/use-conversations";
import { MyIdentityCard } from "./my-identity-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface IntervalOption {
  /** Daemon-side seconds; null = disabled. */
  value: number | null;
  /** Short label for the button ("off", "5m", "15m", "1h"). */
  label: string;
}

const OUTGOING_OPTIONS: IntervalOption[] = [
  { value: null, label: "off" },
  { value: 5 * 60, label: "5m" },
  { value: 15 * 60, label: "15m" },
  { value: 60 * 60, label: "1h" },
];

const MIN_PEER_OPTIONS: IntervalOption[] = [
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 5 * 60, label: "5m" },
];

export function BroadcastControlPanel() {
  const { state, loading, error, now, update } = useBroadcast();
  const [expanded, setExpanded] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"now" | "interval" | "watch" | "min" | null>(
    null,
  );

  const onDeleteAll = useCallback(async () => {
    setDeleteAllBusy(true);
    setDeleteAllError(null);
    try {
      await callDaemon("messages.delete_all", null);
      // The daemon's HistoryCleared event will flush the live caches;
      // refresh once for the (rare) missed-event case.
      void refreshConversations();
      setDeleteAllConfirm(false);
    } catch (e) {
      setDeleteAllError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteAllBusy(false);
    }
  }, []);

  const onPickOutgoing = useCallback(
    async (value: number | null) => {
      setBusy("interval");
      try {
        await update({ outgoing_interval_s: value });
      } catch {
        /* surfaced via hook.error */
      } finally {
        setBusy(null);
      }
    },
    [update],
  );

  const onPickMinPeer = useCallback(
    async (value: number | null) => {
      if (value === null) return;
      setBusy("min");
      try {
        await update({ min_peer_interval_s: value });
      } catch {
        /* ignore */
      } finally {
        setBusy(null);
      }
    },
    [update],
  );

  const onToggleWatch = useCallback(async () => {
    if (state === null) return;
    setBusy("watch");
    try {
      await update({ watch_incoming: !state.watch_incoming });
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }, [state, update]);

  const onBroadcastNow = useCallback(async () => {
    setBusy("now");
    try {
      await now();
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }, [now]);

  const lastSummary = useMemo(() => {
    if (state === null) return null;
    if (state.last_broadcast_ms === null || state.last_recipient_count === null) {
      return "no broadcasts yet";
    }
    return `last ${formatTimeOfDay(state.last_broadcast_ms)} · ${state.last_recipient_count} peer${state.last_recipient_count === 1 ? "" : "s"}`;
  }, [state]);

  const collapsedSummary = useMemo(() => {
    if (state === null) return null;
    const outbound =
      state.outgoing_interval_s === null
        ? "off"
        : `${state.outgoing_interval_s >= 60 ? `${Math.round(state.outgoing_interval_s / 60)}m` : `${state.outgoing_interval_s}s`}`;
    const watching = state.watch_incoming === true ? "watching" : "muted";
    return `${outbound} · ${watching}`;
  }, [state]);

  if (loading === true && state === null) return null;
  if (state === null) return null;

  return (
    <div className="font-code text-xs -mt-1 mb-2 border border-border bg-popover/30">
      {/* Header bar — always visible. Title + summary + collapse toggle. */}
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        aria-expanded={expanded}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-1.5 text-left",
          "uppercase tracking-[0.18em] text-muted-foreground",
          "hover:text-foreground transition-colors duration-100 ease-linear",
        )}
      >
        <span aria-hidden>{expanded ? "▼" : "▶"}</span>
        <span>broadcast</span>
        {expanded === false && collapsedSummary !== null ? (
          <>
            <span className="text-text-secondary">·</span>
            <span className="text-text-secondary normal-case tracking-normal">
              {collapsedSummary}
            </span>
            {lastSummary !== null ? (
              <>
                <span className="text-text-secondary">·</span>
                <span className="text-text-secondary normal-case tracking-normal">
                  {lastSummary}
                </span>
              </>
            ) : null}
          </>
        ) : null}
      </button>

      {expanded === true ? (
        <div className="border-t border-border px-3 py-2 flex flex-col gap-2">
          <Row label="outbound">
            <SegmentedPicker
              options={OUTGOING_OPTIONS}
              value={state.outgoing_interval_s}
              onPick={onPickOutgoing}
              disabled={busy !== null}
            />
            <ActionButton
              label={busy === "now" ? "broadcasting…" : "broadcast now"}
              onClick={onBroadcastNow}
              disabled={busy !== null}
            />
            {lastSummary !== null ? (
              <span className="ml-auto text-text-secondary">{lastSummary}</span>
            ) : null}
          </Row>

          <Row label="inbound">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={state.watch_incoming}
                onChange={onToggleWatch}
                disabled={busy !== null}
                className="accent-primary"
              />
              <span>watch incoming</span>
            </label>
            <span className="text-text-secondary ml-2">peer rate ≥</span>
            <SegmentedPicker
              options={MIN_PEER_OPTIONS}
              value={state.min_peer_interval_s}
              onPick={onPickMinPeer}
              disabled={busy !== null}
            />
          </Row>

          <Row label="identity">
            <ActionButton
              label="show my card"
              onClick={() => setIdentityOpen(true)}
            />
            <span className="text-text-secondary">
              share with peers so they can message you across the mesh
            </span>
          </Row>

          <Row label="danger">
            <button
              type="button"
              onClick={() => setDeleteAllConfirm(true)}
              className={cn(
                "uppercase tracking-wider px-2 py-px",
                "border border-destructive/60 text-destructive",
                "hover:bg-destructive/10",
                "transition-colors duration-100 ease-linear",
              )}
            >
              [ delete all chats ]
            </button>
            <span className="text-text-secondary">
              wipes every message + conversation; identities are kept
            </span>
          </Row>

          {error !== null ? (
            <p className="text-destructive break-all">✗ {error}</p>
          ) : null}
        </div>
      ) : null}

      <MyIdentityCard open={identityOpen} onOpenChange={setIdentityOpen} />

      <AlertDialog
        open={deleteAllConfirm}
        onOpenChange={(o) => {
          if (deleteAllBusy === true) return;
          if (o === false) {
            setDeleteAllConfirm(false);
            setDeleteAllError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>delete every chat?</AlertDialogTitle>
            <AlertDialogDescription>
              every message and conversation row on this device will be
              deleted. cached peer identities (x25519) are preserved so
              you can still message them. this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteAllError !== null ? (
            <p className="font-code text-xs text-destructive break-all">
              ✗ {deleteAllError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAllBusy}>
              cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onDeleteAll();
              }}
              disabled={deleteAllBusy}
            >
              {deleteAllBusy ? "deleting…" : "delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface RowProps {
  label: string;
  children: React.ReactNode;
}

function Row({ label, children }: RowProps) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
      <span className="text-text-secondary uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ label, onClick, disabled }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "uppercase tracking-wider px-2 py-px",
        "border border-border hover:border-primary hover:text-primary",
        "transition-colors duration-100 ease-linear",
        "disabled:opacity-50 disabled:hover:border-border disabled:hover:text-foreground",
      )}
    >
      [ {label} ]
    </button>
  );
}

interface SegmentedPickerProps {
  options: IntervalOption[];
  value: number | null;
  onPick: (value: number | null) => void;
  disabled?: boolean;
}

function SegmentedPicker({ options, value, onPick, disabled }: SegmentedPickerProps) {
  return (
    <span
      role="radiogroup"
      className="inline-flex items-center border border-border"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(opt.value)}
            disabled={disabled}
            className={cn(
              "px-2 py-px uppercase tracking-wider",
              "transition-colors duration-100 ease-linear",
              "border-r border-border last:border-r-0",
              selected
                ? "bg-primary text-primary-foreground"
                : "hover:bg-popover",
              disabled === true && "opacity-50 cursor-not-allowed",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </span>
  );
}
