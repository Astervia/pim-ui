/**
 * SettingsNav — sticky left navigation rail for the Settings page.
 *
 * Renders the cluster-grouped section list as anchor links. Clicking a
 * link smooth-scrolls the corresponding CollapsibleCliPanel into view
 * inside the main content pane.
 *
 * Hidden on viewports below `lg` (1024 px) where horizontal real estate
 * is too tight for a fixed sidebar — at that width the cluster
 * dividers in the content column do all the navigational work.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import {
  SECTION_SCHEMAS,
  type SectionId,
} from "@/lib/config/section-schemas";
import { cn } from "@/lib/utils";
import type { SettingsCluster } from "./settings-clusters";

export interface SettingsNavProps {
  clusters: readonly SettingsCluster[];
  /** Map of section id → whether it currently passes the search filter. */
  visible: Record<SectionId, boolean>;
  /** Currently in-view cluster (optional — purely visual emphasis). */
  activeClusterId?: string;
  className?: string;
}

function onAnchorClick(
  e: React.MouseEvent<HTMLAnchorElement>,
  hash: string,
): void {
  // Manual smooth scroll because the page sits inside a scroll-area
  // (AppShell's <main>) and the default anchor jump misses on Safari.
  const el = document.getElementById(hash);
  if (el === null) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SettingsNav({
  clusters,
  visible,
  activeClusterId,
  className,
}: SettingsNavProps) {
  return (
    <nav
      aria-label="settings sections"
      className={cn("font-mono text-xs", className)}
    >
      <ol className="space-y-5">
        {clusters.map((cluster) => {
          const items = cluster.sections.filter((id) => visible[id] === true);
          if (items.length === 0) return null;
          const active = cluster.id === activeClusterId;
          return (
            <li key={cluster.id}>
              <a
                href={`#cluster-${cluster.id}`}
                onClick={(e) => onAnchorClick(e, `cluster-${cluster.id}`)}
                className={cn(
                  "block uppercase tracking-[0.22em] text-[10px] mb-1.5",
                  "transition-colors duration-100 ease-linear",
                  active === true
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary",
                )}
              >
                {cluster.title}
              </a>
              <ol className="space-y-0 border-l border-border pl-3">
                {items.map((id) => {
                  const sectionAnchor = `settings-section-${id}`;
                  return (
                    <li key={id}>
                      <a
                        href={`#${sectionAnchor}`}
                        onClick={(e) => onAnchorClick(e, sectionAnchor)}
                        className={cn(
                          "block py-1 normal-case tracking-normal",
                          "text-text-secondary hover:text-primary",
                          "transition-colors duration-100 ease-linear",
                        )}
                      >
                        {sectionLabel(id)}
                      </a>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function sectionLabel(id: SectionId): string {
  // Lowercase the SECTION_SCHEMAS title and turn the rare "ADVANCED —
  // RAW CONFIG" header into a tighter "raw config" for the nav.
  if (id === "advanced") return "raw config";
  if (id === "wifi_direct") return "wi-fi direct";
  return SECTION_SCHEMAS[id].title.toLowerCase();
}
