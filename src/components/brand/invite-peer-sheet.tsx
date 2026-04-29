/**
 * <InvitePeerSheet /> — right-edge slide-over for the [ Invite peer ]
 * affordance on PeerListPanel (Phase 4 D-08, 04-CONTEXT.md §Solo mode).
 *
 * Width: 480px (matches PeerDetailSheet — Phase 2 brand convention for
 * right-edge slide-overs).
 *
 * Honest-stub contract:
 *   - The v1 daemon ships no `invite.*` RPC (see docs/RPC.md §8 method
 *     registry). UX-PLAN §Flow 3's `pim://invite/abc123…` deep-link is
 *     therefore a lie until v0.6+.
 *   - Per UX-PLAN §1 P1 ("never abstract a packet into a happy green
 *     dot"), this Sheet refuses to invent a fake URL. It surfaces what
 *     the system can actually do today: install link to the kernel
 *     repo + same-Wi-Fi pairing pointer + roadmap line.
 *   - Every user-visible string comes from `@/lib/copy` (D-26 §6); the
 *     audit script (`pnpm audit:copy`, Plan 04-01) verifies the strings
 *     have not drifted from `docs/COPY.md`.
 *
 * [ COPY LINK ] action:
 *   - Writes INVITE_FULL_URL to navigator.clipboard. Tauri's webview
 *     allows clipboard writes from a user gesture without a plugin.
 *   - On success, the button label flips to [ COPIED ] for 2 seconds
 *     via setTimeout, then reverts. No toast — the button label IS the
 *     feedback so the affordance and its result share one location.
 *   - On clipboard rejection (e.g. permission denied in a future
 *     locked-down webview): silently no-op — the URL is visible verbatim
 *     in the body so the user can select-and-copy by hand.
 *
 * Open state: comes from `useInvitePeer` (module-level atom mirroring
 * usePeerDetail). Closed via Esc / click-outside / × glyph (Sheet
 * primitive defaults — Phase 2 brand-overridden).
 *
 * Brand absolutes (D-36): no exclamation marks anywhere, no fillet-*
 * Tailwind classes, no fade-blends, no literal palette colors — brand
 * tokens only.
 */

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useInvitePeer } from "@/hooks/use-invite-peer";
import {
  INVITE_TITLE,
  INVITE_BODY_INTRO,
  INVITE_INSTALL_LINE,
  INVITE_URL,
  INVITE_FULL_URL,
  INVITE_PAIRING_LINE,
  INVITE_ROADMAP_LINE,
  INVITE_COPY_LINK,
  INVITE_COPIED,
} from "@/lib/copy";

export function InvitePeerSheet() {
  const { isOpen, close } = useInvitePeer();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INVITE_FULL_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write rejected — INVITE_URL is visible verbatim in
      // the body so the user can still select-and-copy by hand. No
      // toast: silent no-op keeps the surface honest.
    }
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (open === false) close();
      }}
    >
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px]"
      >
        <SheetHeader className="pb-5 border-b border-border">
          <SheetTitle>{INVITE_TITLE}</SheetTitle>
        </SheetHeader>

        <section
          aria-label="invite stub"
          className="flex flex-col gap-4 font-code text-sm leading-[1.6]"
        >
          <p className="text-foreground">{INVITE_BODY_INTRO}</p>
          <p className="text-foreground">{INVITE_INSTALL_LINE}</p>
          <p className="text-primary break-all font-code">{INVITE_URL}</p>
          <div>
            <Button
              variant="default"
              aria-label="copy invite link"
              onClick={() => {
                void handleCopy();
              }}
            >
              {copied === true ? INVITE_COPIED : INVITE_COPY_LINK}
            </Button>
          </div>
          <p className="text-foreground">{INVITE_PAIRING_LINE}</p>
          <p className="text-text-secondary">{INVITE_ROADMAP_LINE}</p>
        </section>
      </SheetContent>
    </Sheet>
  );
}
