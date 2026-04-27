/**
 * <CommandPalette /> — ⌘K command palette per 05-CONTEXT D-24..D-30.
 *
 * Mounted ONCE at AppShell level (D-28). Reads { open, setOpen } from
 * useCommandPalette() and renders a cmdk Command.Dialog containing the
 * 17 actions from PALETTE_ACTIONS grouped into navigate / routing /
 * peers / gateway / logs.
 *
 * Brand styling lives in src/globals.css cmdk override block (Plan 05-05
 * D-25 + RESEARCH §7a) — this file adds NO Tailwind class names that
 * fight the override block. cmdk renders its components with [cmdk-root],
 * [cmdk-input], [cmdk-list], [cmdk-item], [cmdk-group-heading], and
 * [cmdk-empty] data attributes which the globals.css block targets.
 *
 * Esc closes (cmdk default through Radix Dialog). Enter activates the
 * highlighted item. Up/Down navigate. Letters filter. The action's run()
 * callback closes the palette via ctx.closePalette() when navigation
 * succeeds (D-29).
 *
 * Item value: each Command.Item value concatenates label + keywords so
 * cmdk default scoring matches both — typing "iptables" lifts gateway
 * preflight via its keywords array.
 *
 * Group ordering: groups are rendered in the locked order navigate →
 * routing → peers → gateway → logs to honor D-26 registration-order
 * tie-breaker. cmdk renders groups in DOM order (not alphabetical).
 *
 * W1 invariant: this file contains zero Tauri listen() calls. The
 * onSelect handler may call emit() (TBD-PHASE-4-G in actions.ts) which
 * is a Tauri event EMIT, not a listener registration.
 */

import { Command } from "cmdk";
import { useCommandPalette } from "@/lib/command-palette/state";
import { useActiveScreen } from "@/hooks/use-active-screen";
import {
  PALETTE_ACTIONS,
  type PaletteAction,
  type PaletteContext,
} from "@/lib/command-palette/actions";

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const { setActive } = useActiveScreen();

  const ctx: PaletteContext = {
    setActive: (id) => setActive(id),
    closePalette: () => setOpen(false),
  };

  // Group actions by group preserving registration order — cmdk renders
  // groups in the order Command.Group children appear, NOT alphabetically.
  const groups: Array<{
    name: PaletteAction["group"];
    actions: PaletteAction[];
  }> = [
    { name: "navigate", actions: [] },
    { name: "routing", actions: [] },
    { name: "peers", actions: [] },
    { name: "gateway", actions: [] },
    { name: "logs", actions: [] },
  ];
  for (const action of PALETTE_ACTIONS) {
    const bucket = groups.find((g) => g.name === action.group);
    if (bucket === undefined) continue;
    bucket.actions.push(action);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="command palette"
      loop
    >
      <Command.Input placeholder="> _" />
      <Command.List>
        <Command.Empty>no matches</Command.Empty>
        {groups.map((g) =>
          g.actions.length === 0 ? null : (
            <Command.Group key={g.name} heading={g.name}>
              {g.actions.map((action) => (
                <Command.Item
                  key={action.id}
                  value={`${action.label} ${(action.keywords ?? []).join(" ")}`}
                  onSelect={() => action.run(ctx)}
                >
                  <span>{action.label}</span>
                  {action.shortcut === undefined ? null : (
                    <span data-shortcut="true">{action.shortcut}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          ),
        )}
      </Command.List>
    </Command.Dialog>
  );
}
