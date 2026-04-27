/**
 * <AboutSection /> — ABOUT settings panel (CONF-01). Phase 3 Plan 03-06 §Part B.
 *
 * Spec:
 *   - 03-UI-SPEC §S1 (collapsed summary
 *     `pim-ui {ui_version} · daemon {daemon_version} · {build_hash?}`)
 *   - 03-UI-SPEC §About section content (D-27 row table)
 *   - 03-CONTEXT D-27 (UI version / Daemon version / Kernel repo link
 *     via Tauri shell.open / Config file row with [ Copy path ] / Build
 *     hash row when VITE_APP_COMMIT defined / [ Open crash log ] action)
 *
 * Read-only — no save footer, no react-hook-form. Every value is derived
 * from build-time defines (VITE_APP_VERSION / VITE_APP_COMMIT injected
 * via vite.config.ts) or runtime daemon state (HelloResult.daemon for
 * the daemon-version row, useSettingsConfig().sourcePath for the config
 * file row). See vite.config.ts for the define block.
 *
 * Kernel repo link uses Tauri's `@tauri-apps/plugin-shell` `open` per
 * D-27 (shell.open, NEVER window.open). Already a project dependency
 * — see PeerRow / PeerDetailSheet for prior consumers.
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { toast } from "sonner";
import { CollapsibleCliPanel } from "@/components/settings/collapsible-cli-panel";
import { Button } from "@/components/ui/button";
import { useActiveScreen } from "@/hooks/use-active-screen";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useSettingsConfig } from "@/hooks/use-settings-config";

const KERNEL_REPO_URL = "https://github.com/Astervia/proximity-internet-mesh";
const KERNEL_REPO_LABEL = "github.com/Astervia/proximity-internet-mesh ↗";

/**
 * HelloResult.daemon ships as `"pim-daemon/X.Y.Z"` per kernel
 * docs/RPC.md §2.1; strip the prefix so the row reads `pim-daemon X.Y.Z`
 * cleanly. Falls back to the input when the format doesn't match.
 */
function stripDaemonPrefix(s: string): string {
  const idx = s.indexOf("/");
  if (idx < 0) return s;
  return s.slice(idx + 1);
}

export interface AboutSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutSection({ open, onOpenChange }: AboutSectionProps) {
  const { snapshot } = useDaemonState();
  const { sourcePath } = useSettingsConfig();
  const { setActive } = useActiveScreen();

  const uiVersion = import.meta.env.VITE_APP_VERSION ?? "unknown";
  const daemonRaw = snapshot.hello?.daemon;
  const daemonVersion =
    typeof daemonRaw === "string" && daemonRaw.length > 0
      ? stripDaemonPrefix(daemonRaw)
      : "—";
  const buildHash = import.meta.env.VITE_APP_COMMIT;

  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      pim-ui {uiVersion} · daemon {daemonVersion}
      {typeof buildHash === "string" && buildHash.length > 0
        ? ` · ${buildHash}`
        : ""}
    </span>
  );

  const copyPath = async (): Promise<void> => {
    if (sourcePath === "") {
      toast.error("Couldn't copy path.");
      return;
    }
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard !== undefined
      ) {
        await navigator.clipboard.writeText(sourcePath);
        toast.success("Path copied.", { duration: 2000 });
      } else {
        toast.error("Couldn't copy path.");
      }
    } catch {
      toast.error("Couldn't copy path.");
    }
  };

  const openRepo = async (): Promise<void> => {
    try {
      await shellOpen(KERNEL_REPO_URL);
    } catch {
      toast.error("Couldn't open kernel repo.");
    }
  };

  // [ Open crash log ] — routes to the Logs tab. The Logs filter bar
  // already exposes a level dropdown; D-27's "preset level: error +
  // time_range: All session" deeper preset is out of scope for Plan
  // 03-06. The Logs tab opens with whatever filter the user last set.
  // Future plan can wire `applyLogsFilter({ level: "error" })` here
  // once that level-preset path is exercised end-to-end.
  const openCrashLog = (): void => {
    setActive("logs");
  };

  return (
    <CollapsibleCliPanel
      id="about"
      title="ABOUT"
      summary={summary}
      open={open}
      onOpenChange={onOpenChange}
    >
      <dl className="font-mono text-sm flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <dt className="text-muted-foreground w-32">UI version</dt>
          <dd>pim-ui {uiVersion}</dd>
        </div>
        <div className="flex items-center gap-4">
          <dt className="text-muted-foreground w-32">Daemon version</dt>
          <dd>pim-daemon {daemonVersion}</dd>
        </div>
        <div className="flex items-center gap-4">
          <dt className="text-muted-foreground w-32">Kernel repo</dt>
          <dd>
            <button
              type="button"
              onClick={() => {
                void openRepo();
              }}
              className="text-primary hover:text-accent underline-offset-2 hover:underline"
            >
              {KERNEL_REPO_LABEL}
            </button>
          </dd>
        </div>
        <div className="flex items-center gap-4">
          <dt className="text-muted-foreground w-32">Config file</dt>
          <dd className="flex items-center gap-4">
            <span>source: {sourcePath === "" ? "—" : sourcePath}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void copyPath();
              }}
            >
              [ Copy path ]
            </Button>
          </dd>
        </div>
        {typeof buildHash === "string" && buildHash.length > 0 && (
          <div className="flex items-center gap-4">
            <dt className="text-muted-foreground w-32">Build</dt>
            <dd>build: {buildHash}</dd>
          </div>
        )}
        <div className="mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openCrashLog}
          >
            [ Open crash log ]
          </Button>
        </div>
      </dl>
    </CollapsibleCliPanel>
  );
}
