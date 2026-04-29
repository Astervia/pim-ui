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
 *   - `pim:settings-collapse-all`     → collapse every section
 *   - `pim:settings-expand-all`       → expand every section
 *   - `pim:settings-focus-search`     → focus the section search input (⌘F)
 *
 * Phase 7 (UI/UX overhaul plan): a top-of-screen <SettingsSearch />
 * filters the visible section list by title or by tomlKey synonyms
 * declared in src/lib/config/section-schemas.ts. While a query is
 * active, every matching section is force-opened so the user can
 * scan its content without expanding it manually; clearing the query
 * restores the user's open/closed state because the force-open layer
 * is a derived view, not a write to `open`.
 *
 * Discard flow lives at shell level (active-screen.tsx) so it can
 * intercept tab-away navigation AND the Stop daemon path.
 *
 * W1 contract: NO listen(...) calls — only window.addEventListener.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SECTION_IDS,
  SECTION_SCHEMAS,
  type SectionId,
} from "@/lib/config/section-schemas";
import { useSettingsConfig } from "@/hooks/use-settings-config";
import { ScreenRefresh } from "@/components/brand/screen-refresh";
import { ScreenContainer } from "@/components/shell/screen-container";
import { SettingsSearch } from "@/components/settings/settings-search";
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

/**
 * Filter predicate — true if the section should be visible for the
 * given query. Empty query is treated as "show everything".
 *
 * Match policy:
 *   - case-insensitive
 *   - substring match on the section's title
 *   - substring match on any of the section's wire tomlKeys
 */
function matchesQuery(id: SectionId, query: string): boolean {
  if (query === "") return true;
  const q = query.toLowerCase().trim();
  if (q === "") return true;
  const schema = SECTION_SCHEMAS[id];
  if (schema.title.toLowerCase().includes(q) === true) return true;
  for (const key of schema.tomlKeys) {
    if (key.toLowerCase().includes(q) === true) return true;
  }
  return false;
}

export function SettingsScreen() {
  const { base, loading, loadError, refetch } = useSettingsConfig();
  const [open, setOpen] = useState<OpenMap>(() => buildClosedMap());
  const [query, setQuery] = useState<string>("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const collapseAll = () => setOpen(buildClosedMap());
    const expandAll = () => setOpen(buildOpenMap());
    const focusSearch = () => {
      if (searchRef.current === null) return;
      searchRef.current.focus();
      searchRef.current.select();
    };
    window.addEventListener("pim:settings-collapse-all", collapseAll);
    window.addEventListener("pim:settings-expand-all", expandAll);
    window.addEventListener("pim:settings-focus-search", focusSearch);
    return () => {
      window.removeEventListener("pim:settings-collapse-all", collapseAll);
      window.removeEventListener("pim:settings-expand-all", expandAll);
      window.removeEventListener("pim:settings-focus-search", focusSearch);
    };
  }, []);

  const setOpenFor = (id: SectionId) => (v: boolean) =>
    setOpen((prev) => ({ ...prev, [id]: v }));

  // While a query is active, force-open every section the parent
  // chooses to render so the user can scan content without expanding
  // each one. When the query is cleared this layer becomes the
  // identity transform and the user's previous open/closed state is
  // visible again.
  const queryActive = query.trim() !== "";
  const effectiveOpen = useMemo<OpenMap>(() => {
    if (queryActive === false) return open;
    const next = { ...open };
    for (const id of SECTION_IDS) {
      if (matchesQuery(id, query) === true) next[id] = true;
    }
    return next;
  }, [open, query, queryActive]);

  const visible = useMemo(() => {
    const set = {} as Record<SectionId, boolean>;
    for (const id of SECTION_IDS) {
      set[id] = matchesQuery(id, query);
    }
    return set;
  }, [query]);

  const visibleCount = SECTION_IDS.reduce(
    (acc, id) => (visible[id] === true ? acc + 1 : acc),
    0,
  );

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
        <ScreenContainer>
          <ScreenRefresh
            onRefresh={refetch}
            ariaLabel="refresh settings (re-fetch config from daemon)"
          />
          <SettingsSearch
            ref={searchRef}
            value={query}
            onChange={setQuery}
          />

          {queryActive === true && visibleCount === 0 ? (
            <p className="font-mono text-sm text-muted-foreground px-2 py-4">
              no sections match &quot;{query}&quot;
            </p>
          ) : null}

          {visible.identity === true ? (
            <IdentitySection
              open={effectiveOpen.identity}
              onOpenChange={setOpenFor("identity")}
            />
          ) : null}

          {visible.interface === true ? (
            <InterfaceSection
              open={effectiveOpen.interface}
              onOpenChange={setOpenFor("interface")}
            />
          ) : null}

          {visible.discovery === true ? (
            <DiscoverySection
              open={effectiveOpen.discovery}
              onOpenChange={setOpenFor("discovery")}
            />
          ) : null}

          {visible.bluetooth === true ? (
            <BluetoothSection
              open={effectiveOpen.bluetooth}
              onOpenChange={setOpenFor("bluetooth")}
            />
          ) : null}

          {visible.wifi_direct === true ? (
            <WifiDirectSection
              open={effectiveOpen.wifi_direct}
              onOpenChange={setOpenFor("wifi_direct")}
            />
          ) : null}

          {visible.transport === true ? (
            <TransportSection
              open={effectiveOpen.transport}
              onOpenChange={setOpenFor("transport")}
            />
          ) : null}

          {visible.routing === true ? (
            <RoutingSection
              open={effectiveOpen.routing}
              onOpenChange={setOpenFor("routing")}
            />
          ) : null}

          {visible.relay === true ? (
            <RelaySection
              open={effectiveOpen.relay}
              onOpenChange={setOpenFor("relay")}
            />
          ) : null}

          {visible.gateway === true ? (
            <GatewaySection
              open={effectiveOpen.gateway}
              onOpenChange={setOpenFor("gateway")}
            />
          ) : null}

          {visible.trust === true ? (
            <TrustSection
              open={effectiveOpen.trust}
              onOpenChange={setOpenFor("trust")}
            />
          ) : null}

          {visible.notifications === true ? (
            <NotificationsSection
              open={effectiveOpen.notifications}
              onOpenChange={setOpenFor("notifications")}
            />
          ) : null}

          {visible.advanced === true ? (
            <AdvancedSection
              open={effectiveOpen.advanced}
              onOpenChange={setOpenFor("advanced")}
            />
          ) : null}

          {visible.about === true ? (
            <AboutSection
              open={effectiveOpen.about}
              onOpenChange={setOpenFor("about")}
            />
          ) : null}
        </ScreenContainer>
      </main>
    </TooltipProvider>
  );
}
