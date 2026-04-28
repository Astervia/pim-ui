/**
 * <SettingsScreen /> — orchestrator screen for ⌘6.
 *
 * After the Phase 01.1 wire-contract correction (April 2026), the
 * Settings page now mirrors the daemon's `pim-core/src/config/model.rs`
 * schema 1:1 — every top-level config table has its own section.
 *
 * Section order (UX grouping):
 *
 *   1.  IDENTITY        ([node])
 *   2.  INTERFACE       ([interface])
 *   3.  DISCOVERY       ([discovery] — UDP broadcast)
 *   4.  BLUETOOTH       ([bluetooth] — PAN discovery)
 *   5.  WI-FI DIRECT    ([wifi_direct] — IEEE 802.11 P2P)
 *   6.  TRANSPORT       ([transport] — TCP)
 *   7.  ROUTING         ([routing])
 *   8.  RELAY           ([relay])
 *   9.  GATEWAY         ([gateway])
 *  10.  TRUST           ([security])
 *  11.  NOTIFICATIONS   (UI-side preferences — Phase 5 will wire daemon side)
 *  12.  ADVANCED        (raw TOML editor)
 *  13.  ABOUT
 *
 * Keyboard shortcuts (CustomEvent dispatched by app-shell.tsx):
 *   - `pim:settings-collapse-all` → collapse every section
 *   - `pim:settings-expand-all`   → expand every section
 *
 * Discard flow lives at shell level (active-screen.tsx) so it can
 * intercept tab-away navigation AND the Stop daemon path.
 *
 * W1 contract: NO listen(...) calls — only window.addEventListener.
 */

import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SECTION_IDS, type SectionId } from "@/lib/config/section-schemas";
import { useSettingsConfig } from "@/hooks/use-settings-config";
import { IdentitySection } from "@/components/settings/sections/identity-section";
import { InterfaceSection } from "@/components/settings/sections/interface-section";
import { DiscoverySection } from "@/components/settings/sections/discovery-section";
import { BluetoothSection } from "@/components/settings/sections/bluetooth-section";
import { WifiDirectSection } from "@/components/settings/sections/wifi-direct-section";
import { TransportSection } from "@/components/settings/sections/transport-section";
import { RoutingSection } from "@/components/settings/sections/routing-section";
import { RelaySection } from "@/components/settings/sections/relay-section";
import { GatewaySection } from "@/components/settings/sections/gateway-section";
import { TrustSection } from "@/components/settings/sections/trust-section";
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

          <InterfaceSection
            open={open.interface}
            onOpenChange={setOpenFor("interface")}
          />

          <DiscoverySection
            open={open.discovery}
            onOpenChange={setOpenFor("discovery")}
          />

          <BluetoothSection
            open={open.bluetooth}
            onOpenChange={setOpenFor("bluetooth")}
          />

          <WifiDirectSection
            open={open.wifi_direct}
            onOpenChange={setOpenFor("wifi_direct")}
          />

          <TransportSection
            open={open.transport}
            onOpenChange={setOpenFor("transport")}
          />

          <RoutingSection
            open={open.routing}
            onOpenChange={setOpenFor("routing")}
          />

          <RelaySection
            open={open.relay}
            onOpenChange={setOpenFor("relay")}
          />

          <GatewaySection
            open={open.gateway}
            onOpenChange={setOpenFor("gateway")}
          />

          <TrustSection
            open={open.trust}
            onOpenChange={setOpenFor("trust")}
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
