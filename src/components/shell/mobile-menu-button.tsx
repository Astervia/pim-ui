/**
 * <MobileMenuButton /> — terminal-native hamburger that toggles the
 * sidebar drawer on viewports below md (768px).
 *
 * Hidden on md+ (the sidebar is statically visible there). Renders as
 * a bracketed monospace `[ ≡ ]` glyph so the brand grammar carries
 * over from the rest of the chrome.
 */

import { useSidebarOpen } from "@/hooks/use-sidebar-open";
import { cn } from "@/lib/utils";

export function MobileMenuButton() {
  const { open, toggle } = useSidebarOpen();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-label={open === true ? "close navigation" : "open navigation"}
      className={cn(
        "md:hidden inline-flex items-center justify-center",
        "h-10 px-3 font-mono text-sm uppercase tracking-wider",
        "border border-border text-foreground",
        "hover:border-primary hover:text-primary",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        "transition-colors duration-100 ease-linear",
      )}
    >
      <span aria-hidden className="text-base leading-none">
        {open === true ? "×" : "≡"}
      </span>
      <span className="sr-only">{open === true ? "close menu" : "open menu"}</span>
    </button>
  );
}
