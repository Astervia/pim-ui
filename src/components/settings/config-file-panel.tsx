/**
 * <ConfigFilePanel /> — sits at the top of the Advanced section.
 *
 * Surfaces the on-disk pim.toml path and lets the user point pim at a
 * different file. The path is editable: users can type an absolute
 * path or pick one through a native file dialog, then click Apply to
 * persist the override (kept under `<data_dir>/config-path-override`)
 * and refetch the config from the new location.
 *
 * Operations:
 *
 *   - Path input    — edit the active config path. Apply persists the
 *                     override + refetches; daemon restart needed for
 *                     the running daemon to pick it up.
 *   - [ Browse… ]   — open native file picker, prefilled in the parent
 *                     directory of the current path.
 *   - [ Reset ]     — clear the override, fall back to the OS default.
 *   - [ Copy path ] — write the live path to the clipboard.
 *   - [ Reveal ]    — open the file's parent directory in the OS file
 *                     explorer (Tauri shell.open).
 *   - [ Import… ]   — pick a .toml file, validate via dry_run, then
 *                     commit its content as the current pim.toml.
 *   - [ Export… ]   — download the live raw TOML as a .toml file.
 *
 * W1 invariant preserved — uses callDaemon (request/response RPC),
 * dialog/shell plugins, and dedicated #[tauri::command] handlers only.
 * No new Tauri listeners.
 */

import { useEffect, useRef, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useSettingsConfig } from "@/hooks/use-settings-config";
import { restartDaemon } from "@/lib/daemon-restart";
import {
  clearConfigPathOverride,
  getConfigPath,
  setConfigPathOverride,
} from "@/lib/config/disk-save";
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
  const { snapshot, actions } = useDaemonState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [draftPath, setDraftPath] = useState<string>("");
  const [overridePath, setOverridePath] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Seed the editable input from the live source path on first render
  // and whenever the resolved path changes (e.g. after refetch). The
  // override is independent — surfaced separately so the user can see
  // whether the live path is OS-default or something they set.
  useEffect(() => {
    if (sourcePath !== "") {
      setDraftPath((prev) => (prev === "" ? sourcePath : prev));
    }
  }, [sourcePath]);

  useEffect(() => {
    let cancelled = false;
    getConfigPath()
      .then((info) => {
        if (cancelled === true) return;
        setOverridePath(info.override_path);
        if (info.override_path !== null) {
          setDraftPath(info.override_path);
        } else if (info.effective !== "") {
          setDraftPath(info.effective);
        }
      })
      .catch(() => {
        // Non-fatal — falls back to sourcePath-driven seed above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = draftPath.trim() !== "" && draftPath.trim() !== sourcePath;
  const daemonRunning = snapshot.state === "running";

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

  const onBrowse = async (): Promise<void> => {
    try {
      const seedDir = parentDir(draftPath || sourcePath);
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        defaultPath: seedDir === "" ? undefined : seedDir,
        filters: [{ name: "TOML", extensions: ["toml"] }],
      });
      if (picked === null) return;
      setDraftPath(picked);
    } catch {
      toast.error("Couldn't open file picker.");
    }
  };

  const offerRestart = (): void => {
    if (daemonRunning === false) return;
    toast("Daemon needs a restart to read the new path.", {
      duration: 8000,
      action: {
        label: "[ Restart ]",
        onClick: () => {
          void restartDaemon(actions);
        },
      },
    });
  };

  const onApplyPath = async (): Promise<void> => {
    const next = draftPath.trim();
    if (next === "") {
      toast.error("Path can't be empty.");
      return;
    }
    setApplying(true);
    try {
      await setConfigPathOverride(next);
      setOverridePath(next);
      await refetch();
      toast.success("Path updated.", { duration: 2000 });
      offerRestart();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't save path: ${msg}`);
    } finally {
      setApplying(false);
    }
  };

  const onResetPath = async (): Promise<void> => {
    setApplying(true);
    try {
      await clearConfigPathOverride();
      setOverridePath(null);
      await refetch();
      toast.success("Reverted to default path.", { duration: 2000 });
      offerRestart();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't reset path: ${msg}`);
    } finally {
      setApplying(false);
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
          {overridePath !== null ? (
            <span className="ml-2 text-accent">· user override</span>
          ) : null}
        </span>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder={sourcePath === "" ? "(resolving…)" : sourcePath}
            value={draftPath}
            onChange={(e) => setDraftPath(e.target.value)}
            disabled={applying === true}
            className="font-code text-sm flex-1"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void onBrowse();
              }}
              disabled={applying === true}
            >
              [ Browse… ]
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                void onApplyPath();
              }}
              disabled={applying === true || dirty === false}
              aria-busy={applying === true ? true : undefined}
            >
              {applying === true ? "[ Applying… ]" : "[ Apply ]"}
            </Button>
          </div>
        </div>
      </div>

      {/* Actions row — wraps on narrow viewports so all affordances
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
          onClick={() => {
            void onResetPath();
          }}
          disabled={applying === true || overridePath === null}
        >
          [ Reset to default ]
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
        Apply persists the path so future launches use it. The running
        daemon needs a restart to pick up a changed path; the Settings
        UI reads/writes the new file immediately.
        <br />
        <span className="text-muted-foreground">
          Import replaces the current pim.toml with the chosen file&apos;s
          content (validated first). Export saves the live config to disk
          as a backup.
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
