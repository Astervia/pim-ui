/**
 * <SettingsScreen /> — orchestrator screen for ⌘6. Phase 3 Plan 03-04 §Part J.
 *
 * Spec: 03-UI-SPEC §S1 Settings page + 03-CONTEXT D-03/D-04/D-05/D-06 +
 *        ROADMAP §Phase 3 success criterion 1.
 *
 * Composition: a single scrollable column hosting nine `CollapsibleCliPanel`
 * sections in a fixed order (per UX-PLAN §6f / SECTION_IDS):
 *
 *   1. IDENTITY      ─┐
 *   2. TRANSPORT      │  Plan 03-05 replaces these four form-heavy
 *   3. DISCOVERY      │  stubs (IdentitySection / TransportSection /
 *   4. TRUST         ─┘  DiscoverySection / TrustSection).
 *   5. ROUTING       ─┐
 *   6. GATEWAY        │
 *   7. NOTIFICATIONS  │  Plan 03-06 replaces these five stubs (Routing,
 *   8. ADVANCED       │  Gateway placeholder, Notifications, Advanced
 *   9. ABOUT         ─┘  raw-TOML editor, About).
 *
 * Until Plans 03-05 / 03-06 land, every section is a stub that prints a
 * single muted-foreground paragraph identifying which downstream plan
 * owns the body. The chrome (header + summary + collapse glyph) is real
 * — clicks toggle, ⌘↑/⌘↓ collapse/expand all, anchor ids resolve.
 *
 * Keyboard shortcuts (consumed via window CustomEvent dispatched by
 * src/components/shell/app-shell.tsx — see 03-01 D-06):
 *   - `pim:settings-collapse-all` → collapse every section
 *   - `pim:settings-expand-all`   → expand every section
 *
 * D-13 discard flow: this screen does NOT mount the discard dialog
 * itself — that lives at shell level (active-screen.tsx) so it can
 * intercept BOTH tab-away navigation (Sidebar click / ⌘1/2/5/6) AND the
 * Stop daemon path (stop-confirm-dialog.tsx). Each section's
 * useSectionSave hook listens for `pim:settings-discard-reset` and
 * resets its react-hook-form on demand.
 *
 * Data: useSettingsConfig() (from Plan 03-01) — a single config.get on
 * mount; subsequent saves call refetchSettingsConfig() module-side.
 *
 * Brand rules:
 *   - Zero radius. font-mono / font-code typography only.
 *   - max-w-3xl column with gap-6 between panels — matches the Dashboard
 *     column width grammar (Phase 2 locked).
 *
 * W1 contract: NO listen(...) calls — only window.addEventListener which
 * is browser-native, not Tauri. The `pim:settings-*` channel is a
 * CustomEvent on `window`, not a daemon RPC stream.
 */

import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SECTION_IDS, type SectionId } from "@/lib/config/section-schemas";
import { useSettingsConfig } from "@/hooks/use-settings-config";
import { CollapsibleCliPanel } from "@/components/settings/collapsible-cli-panel";

type OpenMap = Record<SectionId, boolean>;

function buildClosedMap(): OpenMap {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, false])) as OpenMap;
}

function buildOpenMap(): OpenMap {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, true])) as OpenMap;
}

export function SettingsScreen() {
  const { base, loading, loadError } = useSettingsConfig();
  const [open, setOpen] = useState<OpenMap>(() => buildClosedMap());

  // ⌘↑ / ⌘↓ window CustomEvent listeners — dispatched by app-shell.tsx
  // when active === "settings". Plan 03-01 D-06.
  useEffect(() => {
    const collapseAll = () => setOpen(buildClosedMap());
    const expandAll = () => setOpen(buildOpenMap());
    window.addEventListener("pim:settings-collapse-all", collapseAll);
    window.addEventListener("pim:settings-expand-all", expandAll);
    return () => {
      window.removeEventListener("pim:settings-collapse-all", collapseAll);
      window.removeEventListener("pim:settings-expand-all", expandAll);
    };
  }, []);

  const setOpenFor = (id: SectionId) => (v: boolean) =>
    setOpen((prev) => ({ ...prev, [id]: v }));

  // Loading + error states — render minimal copy; Plans 03-05 / 03-06
  // populate the section bodies which depend on `base !== null`.
  if (loadError !== null) {
    return (
      <main aria-label="settings" className="flex flex-col px-2 py-2">
        <p className="font-mono text-destructive">
          Couldn&apos;t load config: {loadError.message}
        </p>
      </main>
    );
  }
  if (loading === true || base === null) {
    return (
      <main aria-label="settings" className="flex flex-col px-2 py-2">
        <p className="font-mono text-muted-foreground">Loading config…</p>
      </main>
    );
  }

  // Stub-summary helper — every section uses the same muted-foreground
  // line until Plans 03-05 / 03-06 replace the bodies. Plan 03-05 swaps
  // the IDENTITY/TRANSPORT/DISCOVERY/TRUST stubs for real components;
  // Plan 03-06 swaps ROUTING/GATEWAY/NOTIFICATIONS/ADVANCED/ABOUT.
  const stubSummary = (slot: string) => (
    <span className="font-mono text-xs text-muted-foreground">{slot}</span>
  );

  return (
    <TooltipProvider>
      <main aria-label="settings" className="flex flex-col">
        <div className="max-w-3xl flex flex-col gap-6">
          <CollapsibleCliPanel
            id="identity"
            title="IDENTITY"
            summary={stubSummary("plan 03-05 renders this")}
            open={open.identity}
            onOpenChange={setOpenFor("identity")}
          >
            <p className="text-muted-foreground">identity section — plan 03-05</p>
          </CollapsibleCliPanel>

          <CollapsibleCliPanel
            id="transport"
            title="TRANSPORT"
            summary={stubSummary("plan 03-05 renders this")}
            open={open.transport}
            onOpenChange={setOpenFor("transport")}
          >
            <p className="text-muted-foreground">transport section — plan 03-05</p>
          </CollapsibleCliPanel>

          <CollapsibleCliPanel
            id="discovery"
            title="DISCOVERY"
            summary={stubSummary("plan 03-05 renders this")}
            open={open.discovery}
            onOpenChange={setOpenFor("discovery")}
          >
            <p className="text-muted-foreground">discovery section — plan 03-05</p>
          </CollapsibleCliPanel>

          <CollapsibleCliPanel
            id="trust"
            title="TRUST"
            summary={stubSummary("plan 03-05 renders this")}
            open={open.trust}
            onOpenChange={setOpenFor("trust")}
          >
            <p className="text-muted-foreground">trust section — plan 03-05</p>
          </CollapsibleCliPanel>

          <CollapsibleCliPanel
            id="routing"
            title="ROUTING"
            summary={stubSummary("plan 03-06 renders this")}
            open={open.routing}
            onOpenChange={setOpenFor("routing")}
          >
            <p className="text-muted-foreground">routing section — plan 03-06</p>
          </CollapsibleCliPanel>

          <CollapsibleCliPanel
            id="gateway"
            title="GATEWAY"
            summary={stubSummary("linux-only · disabled")}
            open={open.gateway}
            onOpenChange={setOpenFor("gateway")}
          >
            <p className="text-muted-foreground">gateway section — plan 03-06</p>
          </CollapsibleCliPanel>

          <CollapsibleCliPanel
            id="notifications"
            title="NOTIFICATIONS"
            summary={stubSummary("plan 03-06 renders this")}
            open={open.notifications}
            onOpenChange={setOpenFor("notifications")}
          >
            <p className="text-muted-foreground">
              notifications section — plan 03-06
            </p>
          </CollapsibleCliPanel>

          <CollapsibleCliPanel
            id="advanced"
            title="ADVANCED — RAW CONFIG"
            summary={stubSummary("plan 03-06 renders this")}
            open={open.advanced}
            onOpenChange={setOpenFor("advanced")}
          >
            {/* Anchor target for RawWinsBanner's [ Open Advanced ] action.
                The CollapsibleCliPanel wrapper already renders
                <section id="settings-section-advanced">; this inner div
                is a redundant scroll target so smoothScroll resolves
                even if the panel is collapsed. */}
            <p
              id="settings-section-advanced-anchor"
              className="text-muted-foreground"
            >
              advanced section — plan 03-06
            </p>
          </CollapsibleCliPanel>

          <CollapsibleCliPanel
            id="about"
            title="ABOUT"
            summary={stubSummary("plan 03-06 renders this")}
            open={open.about}
            onOpenChange={setOpenFor("about")}
          >
            <p className="text-muted-foreground">about section — plan 03-06</p>
          </CollapsibleCliPanel>
        </div>
      </main>
    </TooltipProvider>
  );
}
