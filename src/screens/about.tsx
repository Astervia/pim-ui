/**
 * <AboutScreen /> — dedicated ⌘7 surface for app metadata, credits,
 * repo link, keyboard shortcuts, and debug access.
 *
 * Split out of the previous Settings → About collapsible section so
 * the page has room to breathe and the credits read as a real "about
 * the project" surface rather than a buried config row.
 *
 * Brand absolutes preserved — zero radius, tokens only, monospace,
 * box-drawing chrome via CliPanel.
 */

import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { toast } from "sonner";
import { CliPanel } from "@/components/brand/cli-panel";
import { ScreenContainer } from "@/components/shell/screen-container";
import { Button } from "@/components/ui/button";
import { useActiveScreen } from "@/hooks/use-active-screen";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useStatus } from "@/hooks/use-status";
import { useSettingsConfig } from "@/hooks/use-settings-config";
import { formatDuration } from "@/lib/format";
import { KEYBOARD_SHORTCUTS } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface RepoEntry {
  label: string;
  url: string;
  caption: string;
}

const REPOS: readonly RepoEntry[] = [
  {
    label: "github.com/Astervia/proximity-internet-mesh",
    url: "https://github.com/Astervia/proximity-internet-mesh",
    caption: "kernel · pim-daemon",
  },
  {
    label: "github.com/Astervia/pim-ui",
    url: "https://github.com/Astervia/pim-ui",
    caption: "ui · this app",
  },
];

interface CreditEntry {
  name: string;
  title: string;
  blurb: string;
}

const CREDITS: readonly CreditEntry[] = [
  {
    name: "Ruy Vieira",
    title: "Protocol Architect · Kernel Maintainer",
    blurb:
      "Creator and idealizer. Owns the pim-daemon kernel, the wire protocol, and the long-term architecture.",
  },
  {
    name: "Pedro Gimenez",
    title: "Interface & Platform Engineer",
    blurb:
      "macOS + iOS integration. Designed and built the UI you're looking at.",
  },
];

function stripDaemonPrefix(s: string): string {
  const idx = s.indexOf("/");
  if (idx < 0) return s;
  return s.slice(idx + 1);
}

interface KvProps {
  label: string;
  value: React.ReactNode;
  emphasis?: "primary" | "default";
}
function Kv({ label, value, emphasis }: KvProps) {
  return (
    <div className="grid grid-cols-[14ch_1fr] gap-x-4 gap-y-0 font-code text-sm leading-[1.7]">
      <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground self-center">
        {label}
      </dt>
      <dd
        className={cn(
          "font-code break-words",
          emphasis === "primary" ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function AboutScreen() {
  const { snapshot } = useDaemonState();
  const status = useStatus();
  const { sourcePath } = useSettingsConfig();
  const { setActive } = useActiveScreen();

  const uiVersion = import.meta.env.VITE_APP_VERSION ?? "0.0.1";
  const buildHash = import.meta.env.VITE_APP_COMMIT;
  const daemonRaw = snapshot.hello?.daemon;
  const daemonVersion =
    typeof daemonRaw === "string" && daemonRaw.length > 0
      ? stripDaemonPrefix(daemonRaw)
      : "—";
  const uptime =
    status === null ? "—" : formatDuration(status.uptime_s);

  const onCopyPath = async (): Promise<void> => {
    if (sourcePath === "") return;
    try {
      await navigator.clipboard.writeText(sourcePath);
      toast.success("Path copied.", { duration: 1500 });
    } catch {
      toast.error("Couldn't copy path.");
    }
  };

  const onOpenRepo = async (url: string): Promise<void> => {
    try {
      await shellOpen(url);
    } catch {
      toast.error("Couldn't open the repo.");
    }
  };

  return (
    <ScreenContainer className="gap-4">
      {/* Hero — wordmark + brief */}
      <CliPanel title="pim" density="spacious" revealDelay={0}>
        <div className="flex flex-col gap-4">
          <h1 className="font-mono text-3xl sm:text-4xl tracking-tight leading-[1.1]">
            <span className="phosphor">█ pim</span>
          </h1>
          <p className="font-code text-sm sm:text-base text-foreground leading-[1.55] max-w-[60ch]">
            A Rust IP-level proximity mesh overlay. Auditable protocol,
            legible crypto, real routing — built to keep transmitting when
            the backbone goes quiet.
          </p>
        </div>
      </CliPanel>

      {/* System — versions + uptime + config path */}
      <CliPanel title="system" density="default" revealDelay={80}>
        <dl className="flex flex-col gap-2">
          <Kv label="ui" value={`pim-ui ${uiVersion}`} emphasis="primary" />
          <Kv label="daemon" value={`pim-daemon ${daemonVersion}`} />
          <Kv label="uptime" value={uptime} />
          {typeof buildHash === "string" && buildHash.length > 0 ? (
            <Kv label="build" value={buildHash} />
          ) : null}
          <Kv
            label="config"
            value={
              sourcePath === "" ? (
                <span className="text-text-secondary">(resolving…)</span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-code text-xs text-foreground break-all">
                    {sourcePath}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void onCopyPath();
                    }}
                  >
                    [ Copy ]
                  </Button>
                </div>
              )
            }
          />
        </dl>
      </CliPanel>

      {/* Credits — Ruy + Pedro */}
      <CliPanel title="credits" density="default" revealDelay={160}>
        <ul className="flex flex-col divide-y divide-border/40">
          {CREDITS.map((c) => (
            <li
              key={c.name}
              className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-base font-semibold text-foreground tracking-tight">
                  {c.name}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                  {c.title}
                </span>
              </div>
              <p className="font-code text-sm text-text-secondary leading-[1.55] max-w-[60ch]">
                {c.blurb}
              </p>
            </li>
          ))}
        </ul>
      </CliPanel>

      {/* Repo links — kernel + ui */}
      <CliPanel title="source" density="default" revealDelay={220}>
        <ul className="flex flex-col divide-y divide-border/40">
          {REPOS.map((r) => (
            <li
              key={r.url}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <code className="font-code text-sm text-foreground break-all">
                  {r.label}
                </code>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary">
                  {r.caption}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void onOpenRepo(r.url);
                }}
                aria-label={`open ${r.label}`}
              >
                [ Open ↗ ]
              </Button>
            </li>
          ))}
        </ul>
      </CliPanel>

      {/* Keyboard shortcuts */}
      <CliPanel title="keyboard shortcuts" density="default" revealDelay={260}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 font-code text-sm">
          {KEYBOARD_SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-baseline gap-3">
              <dt className="font-mono text-primary w-[6ch] shrink-0">
                {s.key}
              </dt>
              <dd className="text-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
      </CliPanel>

      {/* Debug */}
      <CliPanel title="debug" density="compact" revealDelay={300}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActive("logs")}
          >
            [ Open logs ]
          </Button>
        </div>
      </CliPanel>
    </ScreenContainer>
  );
}
