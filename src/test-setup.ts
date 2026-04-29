/**
 * Vitest global setup — Phase 6 Plan 06-05.
 *
 * Loads `@testing-library/jest-dom` matchers and stubs out the
 * Tauri invoke / event APIs so component tests don't reach into a
 * non-existent native shell. Tests that actually want to assert on
 * invoke calls override these via `vi.mock(...)` per file.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// Default stubs — return resolved promises so anything that fires off
// a Tauri command in passing doesn't blow up. Tests that need specific
// shapes call `vi.mocked(invoke).mockResolvedValueOnce(...)`.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
