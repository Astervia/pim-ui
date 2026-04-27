/**
 * <GatewaySection /> — GATEWAY settings panel placeholder. Phase 3 Plan 03-06.
 *
 * Spec:
 *   - 03-UI-SPEC §S1 (collapsed summary `linux-only · disabled` for non-Linux
 *     hosts; `linux · disabled` / `linux · enabled via {iface}` placeholders
 *     reserved for Phase 5 GATE-* work)
 *   - 03-CONTEXT D-19 / deferred — Phase 5 owns full gateway controls
 *     (GATE-01..04). Phase 3 only renders the section header + a one-line
 *     Linux-only message body so the IA is stable and the [ Open Advanced ]
 *     scroll target order matches every other section.
 *
 * No form fields, no save footer — read-only placeholder. Body copy is the
 * Plan 03-06 wording (Claude's discretion per the plan): the locked
 * "linux-only" verbatim string is in the summary; the body explains the
 * deferral honestly per UX-PLAN §1 P1 (no fake green dot).
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { CollapsibleCliPanel } from "@/components/settings/collapsible-cli-panel";

export interface GatewaySectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GatewaySection({ open, onOpenChange }: GatewaySectionProps) {
  // Phase 3 placeholder — Phase 5 will detect platform via Tauri's
  // @tauri-apps/plugin-os and flip between `linux-only · disabled`,
  // `linux · disabled`, and `linux · enabled via {iface}`. v1 always
  // shows the disabled state.
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      linux-only · disabled
    </span>
  );

  return (
    <CollapsibleCliPanel
      id="gateway"
      title="GATEWAY"
      summary={summary}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-2">
        <p className="font-mono text-sm text-foreground">
          Gateway mode is Linux-only today. Your device can still join a mesh
          as a client or relay.
        </p>
        <p className="font-mono text-sm text-muted-foreground">
          Full gateway controls ship in Phase 5.
        </p>
      </div>
    </CollapsibleCliPanel>
  );
}
