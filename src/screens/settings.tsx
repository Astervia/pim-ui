/**
 * <SettingsScreen /> — orchestrator screen for ⌘6.
 *
 * Post-redesign (April 2026): the flat panel scroll-wall is replaced
 * by a domain-clustered 2-column layout that honours UX-PLAN §1 P2
 * ("organised by what they do, not by Basic vs Advanced").
 *
 * Layout:
 *
 *   ┌─ settings · N / N sections · backed by pim-daemon ───────────┐
 *   │ [⌕ filter sections…]            [▸ collapse all] [▾ expand]  │
 *   └──────────────────────────────────────────────────────────────┘
 *   ┌──────────┬──────────────────────────────────────────────────┐
 *   │ core     │ ──── core ──── who I am · where my data lives    │
 *   │   identity│ ┌── IDENTITY ─────────────────────────────────┐ │
 *   │   interfa│ ┌── INTERFACE ────────────────────────────────┐ │
 *   │ reach    │ ──── reach ──── how nodes find each other      │
 *   │   discov │ ┌── DISCOVERY ────────────────────────────────┐ │
 *   │   bluetoo│ ┌── BLUETOOTH ────────────────────────────────┐ │
 *   │   wi-fi d│ ...                                            │
 *   └──────────┴──────────────────────────────────────────────────┘
 *
 * The cluster registry (settings-clusters.ts) drives both the sticky
 * left nav and the inline divider headers in the content column. New
 * sections need to be added there in addition to section-schemas.ts.
 *
 * Section state (open/closed, dirty tracking, save lifecycle, raw-wins
 * banner) is unchanged — the redesign is purely orchestration. Per-
 * section internals stay exactly as Phase 03-04 / 05 / 06 left them.
 *
 * Keyboard shortcuts (CustomEvent dispatched by app-shell.tsx) preserved:
 *   - `pim:settings-collapse-all`
 *   - `pim:settings-expand-all`
 *   - `pim:settings-focus-search`
 *
 * W1 contract: NO listen(...) calls — only window.addEventListener.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SECTION_IDS,
  SECTION_SCHEMAS,
  type SectionId,
} from "@/lib/config/section-schemas";
import { useSettingsConfig } from "@/hooks/use-settings-config";
import { SETTINGS_CLUSTERS } from "@/components/settings/settings-clusters";
import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsClusterDivider } from "@/components/settings/settings-cluster-divider";
import { SaveAllBar } from "@/components/settings/save-all-bar";
import { IdentitySection } from "@/components/settings/sections/identity-section";
import { InterfaceSection } from "@/components/settings/sections/interface-section";
import { DiscoverySection } from "@/components/settings/sections/discovery-section";
import { BluetoothSection } from "@/components/settings/sections/bluetooth-section";
import { BluetoothRfcommSection } from "@/components/settings/sections/bluetooth-rfcomm-section";
import { WifiDirectSection } from "@/components/settings/sections/wifi-direct-section";
import { TransportSection } from "@/components/settings/sections/transport-section";
import { RoutingSection } from "@/components/settings/sections/routing-section";
import { RelaySection } from "@/components/settings/sections/relay-section";
import { GatewaySection } from "@/components/settings/sections/gateway-section";
import { TrustSection } from "@/components/settings/sections/trust-section";
import { NotificationsSection } from "@/components/settings/sections/notifications-section";
import { AdvancedSection } from "@/components/settings/sections/advanced-section";

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

interface SectionRendererArgs {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function renderSection(id: SectionId, args: SectionRendererArgs): ReactNode {
  switch (id) {
    case "identity":
      return <IdentitySection {...args} />;
    case "interface":
      return <InterfaceSection {...args} />;
    case "discovery":
      return <DiscoverySection {...args} />;
    case "bluetooth":
      return <BluetoothSection {...args} />;
    case "bluetooth_rfcomm":
      return <BluetoothRfcommSection {...args} />;
    case "wifi_direct":
      return <WifiDirectSection {...args} />;
    case "transport":
      return <TransportSection {...args} />;
    case "routing":
      return <RoutingSection {...args} />;
    case "relay":
      return <RelaySection {...args} />;
    case "gateway":
      return <GatewaySection {...args} />;
    case "trust":
      return <TrustSection {...args} />;
    case "notifications":
      return <NotificationsSection {...args} />;
    case "advanced":
      return <AdvancedSection {...args} />;
  }
}

export function SettingsScreen() {
  const { base, loading, loadError, source } = useSettingsConfig();
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

  const anyOpen = SECTION_IDS.some((id) => effectiveOpen[id] === true);
  const allOpen = SECTION_IDS.every((id) => effectiveOpen[id] === true);

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
      <main aria-label="settings" className="flex flex-col w-full">
        <SettingsHeader
          ref={searchRef}
          query={query}
          onQueryChange={setQuery}
          visibleCount={visibleCount}
          totalCount={SECTION_IDS.length}
          onCollapseAll={() => setOpen(buildClosedMap())}
          onExpandAll={() => setOpen(buildOpenMap())}
          anyOpen={anyOpen}
          allOpen={allOpen}
          source={source}
        />

        {queryActive === true && visibleCount === 0 ? (
          <div className="flex flex-col items-start gap-2 mt-8 px-2">
            <pre
              aria-hidden
              className="font-code text-muted-foreground text-[11px] leading-tight m-0"
            >
{`     ┌──────────────────┐
     │  no match found  │
     └──────────────────┘`}
            </pre>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              no sections match &quot;{query}&quot;
            </p>
            <p className="font-code text-xs text-text-secondary">
              try a wire key like{" "}
              <span className="text-foreground">discovery.port</span> or a
              section name like{" "}
              <span className="text-foreground">routing</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)] gap-x-8 gap-y-4 mt-5">
            <SettingsNav
              clusters={SETTINGS_CLUSTERS}
              visible={visible}
              className="hidden lg:block sticky top-2 self-start"
            />

            <div className="flex flex-col gap-3 min-w-0">
              {SETTINGS_CLUSTERS.map((cluster) => {
                const visibleInCluster = cluster.sections.filter(
                  (id) => visible[id] === true,
                );
                if (visibleInCluster.length === 0) return null;
                return (
                  <section
                    key={cluster.id}
                    aria-labelledby={`cluster-${cluster.id}-title`}
                    className="flex flex-col gap-3"
                  >
                    <SettingsClusterDivider
                      title={cluster.title}
                      tagline={cluster.tagline}
                      anchor={`cluster-${cluster.id}`}
                      matchCount={
                        queryActive === true
                          ? {
                              matched: visibleInCluster.length,
                              total: cluster.sections.length,
                            }
                          : undefined
                      }
                    />
                    {visibleInCluster.map((id) => (
                      <div key={id}>
                        {renderSection(id, {
                          open: effectiveOpen[id],
                          onOpenChange: setOpenFor(id),
                        })}
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          </div>
        )}

        <SaveAllBar />
      </main>
    </TooltipProvider>
  );
}
