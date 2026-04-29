/**
 * <ConfigFilePanel /> — sits at the top of the Advanced section.
 *
 * Surfaces the on-disk pim.toml path and four operations the user can
 * actually perform from the webview today:
 *
 *   - [ Copy path ]   — write source_path to clipboard
 *   - [ Reveal ]      — open the file's parent directory in the OS
 *                       file explorer (Tauri shell.open)
 *   - [ Import… ]     — pick a local .toml file, validate it via
 *                       config.save(dry_run=true), then commit as the
 *                       new pim.toml (replaces the existing content)
 *   - [ Export… ]     — download the current raw TOML as a .toml file
 *                       via a browser blob URL
 *
 * "Change the daemon's config location" is intentionally NOT a button.
 * The daemon is launched with a config path argument set at app boot;
 * relocating the file requires a daemon restart with a new --config
 * argument, which the UI doesn't drive today. The path field is
 * presented as read-only with the Import / Export pair covering the
 * common "I want to use this other file" use case.
 *
 * W1 invariant preserved — uses callDaemon (request/response RPC) +
 * shell.open / browser file APIs only. No new Tauri listeners.
 */

import { useRef, useState } from "react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSettingsConfig } from "@/hooks/use-settings-config";
import { callDaemon } from "@/lib/rpc";
import type { RpcError } from "@/lib/rpc-types";
import { cn } from "@/lib/utils";

/** Best-effort parent-dir derivation that works across unix / windows. */
function parentDir(path: string): string {
  if (path === "") return "";
  const sepIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (sepIndex <= 0) return path;
  return path.slice(0, sepIndex);
}

export function ConfigFilePanel() {
  const { raw, sourcePath, refetch } = useSettingsConfig();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const onCopyPath = async (): Promise<void> => {
    if (sourcePath === "") {
      toast.error("Couldn't copy — no path resolved yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(sourcePath);
      toast.success("Path copied.", { duration: 1500 });
    } catch {
      toast.error("Couldn't copy path.");
    }
  };

  const onReveal = async (): Promise<void> => {
    if (sourcePath === "") return;
    const dir = parentDir(sourcePath);
    if (dir === "") {
      toast.error("Couldn't resolve parent directory.");
      return;
    }
    try {
      await shellOpen(dir);
    } catch {
      toast.error("Couldn't open the folder.");
    }
  };

  const onPickFile = (): void => {
    if (fileRef.current === null) return;
    fileRef.current.value = "";
    fileRef.current.click();
  };

  const onFileChosen = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (file === undefined) return;
    setImporting(true);
    try {
      const content = await file.text();
      // Validate first via dry_run so a malformed import never lands.
      await callDaemon("config.save", {
        format: "toml",
        config: content,
        dry_run: true,
      });
      // Validation passed — commit.
      await callDaemon("config.save", {
        format: "toml",
        config: content,
      });
      await refetch();
      toast.success(`Imported ${file.name}.`, { duration: 2000 });
    } catch (err) {
      const msg = (err as RpcError).message ?? "Couldn't import config.";
      toast.error(`Import failed: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  const onExport = (): void => {
    if (raw === "") {
      toast.error("Nothing to export — config not loaded yet.");
      return;
    }
    try {
      const blob = new Blob([raw], { type: "application/toml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Default filename is `pim.toml`; the user picks their own
      // location through the browser's save dialog.
      a.download = "pim.toml";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke to the next macrotask so the click handler can
      // pick up the URL before it's released.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      toast.error("Couldn't export config.");
    }
  };

  return (
    <section
      aria-label="config file"
      className={cn(
        "border border-border bg-card p-4 sm:p-5 flex flex-col gap-3",
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <h4 className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">
          config file
        </h4>
      </header>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          source path
        </span>
        <code
          className={cn(
            "font-code text-sm break-all leading-tight",
            "border border-border bg-popover px-3 py-2",
            "text-foreground",
            sourcePath === "" && "text-muted-foreground",
          )}
        >
          {sourcePath === "" ? "(resolving…)" : sourcePath}
        </code>
      </div>

      {/* Actions row — wraps on narrow viewports so all four affordances
          stay reachable on phone-portrait. */}
      <div className="flex flex-wrap gap-2 mt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void onCopyPath();
          }}
          disabled={sourcePath === ""}
        >
          [ Copy path ]
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void onReveal();
          }}
          disabled={sourcePath === ""}
        >
          [ Reveal in folder ]
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onPickFile}
          disabled={importing === true}
          aria-busy={importing === true ? true : undefined}
        >
          {importing === true ? "[ Importing… ]" : "[ Import… ]"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onExport}
          disabled={raw === ""}
        >
          [ Export… ]
        </Button>
      </div>

      <p className="font-code text-xs text-text-secondary leading-[1.55]">
        Import replaces the current pim.toml with the chosen file's
        content (validated first). Export saves the live config to disk
        as a backup.
        <br />
        <span className="text-muted-foreground">
          To run the daemon against a different path, restart it with a
          new --config argument — the in-app path is read-only.
        </span>
      </p>

      {/* Hidden file picker — programmatically clicked by [ Import… ]. */}
      <input
        ref={fileRef}
        type="file"
        accept=".toml,application/toml,text/plain"
        className="hidden"
        onChange={(e) => {
          void onFileChosen(e);
        }}
      />
    </section>
  );
}
