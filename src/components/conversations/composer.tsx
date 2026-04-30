/**
 * <Composer /> — outbound message input.
 *
 * Sends on ⌘↵ / Ctrl+↵ (regular Enter inserts a newline so multi-line
 * messages stay possible). Disables itself when the body is empty or
 * when the recipient peer has no cached X25519 yet.
 */

import { useCallback, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const MAX_BODY_BYTES = 8 * 1024;

export interface ComposerProps {
  disabled: boolean;
  /** Optional banner shown above the textarea (e.g. peer-not-ready). */
  notice?: string | null;
  onSend: (body: string) => Promise<void>;
}

export function Composer({ disabled, notice, onSend }: ComposerProps) {
  const [body, setBody] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const canSend =
    disabled === false &&
    submitting === false &&
    body.trim().length > 0 &&
    new TextEncoder().encode(body).length <= MAX_BODY_BYTES;

  const handleSend = useCallback(async () => {
    if (canSend === false) return;
    const value = body;
    setBody("");
    setSubmitting(true);
    try {
      await onSend(value);
    } catch (e) {
      // Re-fill so the user doesn't lose their input. The send_user_message
      // path persists a `failed` row on the daemon side regardless — see
      // pim-daemon/src/messaging/dispatch.rs::send_user_message.
      console.warn("composer send failed:", e);
      setBody(value);
    } finally {
      setSubmitting(false);
    }
  }, [body, canSend, onSend]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const isModEnter =
        e.key === "Enter" && (e.metaKey === true || e.ctrlKey === true);
      if (isModEnter === true) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex flex-col border-t border-border">
      {notice !== null && notice !== undefined && notice !== "" ? (
        <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground bg-popover/40">
          {notice}
        </div>
      ) : null}
      <div className="flex items-end gap-2 px-2 py-2 bg-popover/20">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            disabled === true
              ? "select a peer to start"
              : "type a message · ⌘↵ to send"
          }
          disabled={disabled}
          rows={2}
          className={cn(
            "flex-1 min-h-[48px] resize-none",
            "font-code text-sm leading-[1.6]",
            "px-3 py-2",
            "border border-border bg-background text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:border-primary",
          )}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={canSend === false}
          className={cn(
            "shrink-0 px-3 py-2 font-code text-xs uppercase tracking-[0.2em]",
            "border border-border",
            canSend === true
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          [ send ]
        </button>
      </div>
    </div>
  );
}
