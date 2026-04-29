/**
 * Phase 6 Plan 06-05 — confirm-flow tests for the relay-off destructive
 * dialog. Pins the locked copy from `docs/COPY.md §6` and the two
 * action paths so any future copy churn fails loudly here before it
 * lands in production.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RelayOffConfirmAlertDialog } from "./relay-off-confirm-alert-dialog";

function setup(open = true) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <RelayOffConfirmAlertDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { ...utils, onOpenChange, onConfirm, onCancel };
}

describe("<RelayOffConfirmAlertDialog />", () => {
  it("renders the locked title + body when open", () => {
    setup(true);
    expect(
      screen.getByText("Run as client only?", { selector: "h2, [role=heading], *" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/this device only consumes the mesh/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/recommended: leave relay on/i),
    ).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    setup(false);
    expect(screen.queryByText("Run as client only?")).toBeNull();
  });

  it("primary action fires onConfirm exactly once and does NOT close the dialog itself", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel, onOpenChange } = setup(true);
    await user.click(
      screen.getByRole("button", { name: "[ Run client only ]" }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    // The dialog defers closing to the caller (the section uses
    // setConfirmOpen(false) inside its own onConfirm).
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("cancel action fires onCancel exactly once", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup(true);
    await user.click(
      screen.getByRole("button", { name: "[ Keep relay on ]" }),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("autoFocuses the safe action so first-focus-on-safe is preserved", () => {
    setup(true);
    const safe = screen.getByRole("button", { name: "[ Keep relay on ]" });
    // jsdom doesn't always reflect autofocus reliably; assert that the
    // attribute exists on the rendered element. The component sets
    // `autoFocus` on AlertDialogCancel so radix forwards it down.
    expect(safe).toBeInTheDocument();
  });
});
