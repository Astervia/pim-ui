/**
 * useCommandPalette — Phase 5 Plan 05-01 stub.
 *
 * Plan 05-05 replaces this with a real module-level atom + useSyncExternalStore
 * (mirroring src/hooks/use-active-screen.ts pattern). The export shape stays
 * stable: { open: boolean, setOpen: (v) => void, toggle: () => void }.
 *
 * Why a stub here: Plan 05-01's ⌘K keyboard binding in AppShell needs a hook
 * to call. Without this stub AppShell.tsx would not compile until 05-05 lands.
 * The stub renders a no-op atom — pressing ⌘K does nothing useful until 05-05
 * lands the real Dialog component.
 */

export interface UseCommandPaletteResult {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const STUB_RESULT: UseCommandPaletteResult = Object.freeze({
  open: false,
  setOpen: (_open: boolean) => {
    // Plan 05-05 wires this to the real atom.
  },
  toggle: () => {
    // Plan 05-05 wires this to the real atom.
  },
});

export function useCommandPalette(): UseCommandPaletteResult {
  return STUB_RESULT;
}
