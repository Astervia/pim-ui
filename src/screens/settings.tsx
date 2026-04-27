/**
 * <SettingsScreen /> — orchestrator screen for ⌘6. Phase 3 Plan 03-04 §Part J,
 * completed by Plan 03-06.
 *
 * Spec: 03-UI-SPEC §S1 Settings page + 03-CONTEXT D-03/D-04/D-05/D-06 +
 *        ROADMAP §Phase 3 success criterion 1.
 *
 * Composition: a single scrollable column hosting nine `CollapsibleCliPanel`
 * sections in a fixed order (per UX-PLAN §6f / SECTION_IDS):
 *
 *   1. IDENTITY              (CONF-02 — Plan 03-05)
 *   2. TRANSPORT             (CONF-03 — Plan 03-05)
 *   3. DISCOVERY             (CONF-04 — Plan 03-05)
 *   4. TRUST                 (CONF-05 — Plan 03-05)
 *   5. ROUTING               (CONF-01 — Plan 03-06)
 *   6. GATEWAY (placeholder) (CONF-01 — Plan 03-06; full GATE-* in Phase 5)
 *   7. NOTIFICATIONS         (CONF-01 — Plan 03-06; firing in Phase 5)
 *   8. ADVANCED — RAW CONFIG (CONF-06 — Plan 03-06)
 *   9. ABOUT                 (CONF-01 — Plan 03-06)
 *
 * Every section is a real component as of Plan 03-06; there are no stubs.
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
import { IdentitySection } from "@/components/settings/sections/identity-section";
import { TransportSection } from "@/components/settings/sections/transport-section";
import { DiscoverySection } from "@/components/settings/sections/discovery-section";
import { TrustSection } from "@/components/settings/sections/trust-section";
import { RoutingSection } from "@/components/settings/sections/routing-section";
import { GatewaySection } from "@/components/settings/sections/gateway-section";
import { NotificationsSection } from "@/components/settings/sections/notifications-section";
import { AdvancedSection } from "@/components/settings/sections/advanced-section";
import { AboutSection } from "@/components/settings/sections/about-section";

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

  return (
    <TooltipProvider>
      <main aria-label="settings" className="flex flex-col">
        <div className="max-w-3xl flex flex-col gap-6">
          <IdentitySection
            open={open.identity}
            onOpenChange={setOpenFor("identity")}
          />

          <TransportSection
            open={open.transport}
            onOpenChange={setOpenFor("transport")}
          />

          <DiscoverySection
            open={open.discovery}
            onOpenChange={setOpenFor("discovery")}
          />

          <TrustSection
            open={open.trust}
            onOpenChange={setOpenFor("trust")}
          />

          <RoutingSection
            open={open.routing}
            onOpenChange={setOpenFor("routing")}
          />

          <GatewaySection
            open={open.gateway}
            onOpenChange={setOpenFor("gateway")}
          />

          <NotificationsSection
            open={open.notifications}
            onOpenChange={setOpenFor("notifications")}
          />

          <AdvancedSection
            open={open.advanced}
            onOpenChange={setOpenFor("advanced")}
          />

          <AboutSection
            open={open.about}
            onOpenChange={setOpenFor("about")}
          />
        </div>
      </main>
    </TooltipProvider>
  );
}
