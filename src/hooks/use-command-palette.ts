/**
 * Convenience re-export — hook lives in src/lib/command-palette/state.ts
 * to keep the atom + helper functions colocated. The hooks/-folder file
 * mirrors the project convention (use-daemon-state / use-active-screen)
 * so future imports can use either path interchangeably.
 *
 * Plan 05-01 imported the stub from @/lib/command-palette/state directly;
 * Plan 05-05 leaves that import path intact (the stub became the real
 * atom in the same file) and adds this shim for the canonical hooks-folder
 * convention.
 */
export { useCommandPalette } from "@/lib/command-palette/state";
export type { UseCommandPaletteResult } from "@/lib/command-palette/state";
