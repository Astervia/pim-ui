/// <reference types="vitest" />
/**
 * Vitest configuration — Phase 6 Plan 06-05.
 *
 * Inherits the project's Vite plugin chain so React 19 + path aliases
 * + Tailwind tokens line up with what the dev/build pipeline already
 * understands. Runs in jsdom because every test target either renders
 * React or imports a hook that touches the React renderer.
 *
 * Glob: only `*.test.ts` / `*.test.tsx` under `src/`. The Tauri side
 * has its own `cargo test` suite under `src-tauri/`.
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // The repo's pre-existing `*.test.ts` files are compile-only —
    // verified by `pnpm typecheck`, never imported at runtime. Phase 6
    // introduces `*.spec.{ts,tsx}` as the convention for Vitest-runnable
    // tests so the two patterns can coexist.
    include: ["src/**/*.spec.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
