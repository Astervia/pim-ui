/**
 * <IdentitySection /> — IDENTITY settings panel (CONF-02). Phase 3 Plan 03-05.
 *
 * Spec:
 *   - 03-UI-SPEC §S1 Settings page (collapsed summary `{node.name} · {short_id}`)
 *   - 03-UI-SPEC §Form field labels (Device name / Node ID / Short ID / Public key)
 *   - 03-UI-SPEC §S1a CollapsibleCliPanel anatomy
 *   - 03-CONTEXT D-04, D-05, D-09 (text input), D-11 (save flow), D-15 (rawWins)
 *
 * Editable: `Device name` → wire `node.name` (text Input).
 *
 * Read-only fields (rendered as monospace code rows + [ Copy ] buttons):
 *   - Node ID (full 64-char) — from snapshot.status.node_id
 *   - Short ID (8-char) — from snapshot.status.node_id_short
 *   - Public key — Status interface in rpc-types does NOT expose
 *     `public_key` in v1 (verified 2026-04-26). Render a muted
 *     fallback `pubkey not exposed yet · daemon Status v1 omits this`
 *     placeholder so the row's IA is still honest per UX-PLAN §1 P1.
 *
 * Hooks consumed (Wave 2 / 03-04 contract):
 *   - useSettingsConfig().base — parsed TOML; getPath(base, "node.name")
 *     seeds the form's defaultValues.
 *   - useSectionSave("identity", form) — orchestrates dry_run -> real
 *     save -> refetch -> rawWins rescan; mirrors form.formState.isDirty
 *     into use-dirty-sections via useEffect (checker Blocker 1).
 *   - useSectionRawWins("identity") — read-only `{ rawWins }` (Blocker 3).
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { CollapsibleCliPanel } from "@/components/settings/collapsible-cli-panel";
import { RawWinsBanner } from "@/components/settings/raw-wins-banner";
import { SectionSaveFooter } from "@/components/settings/section-save-footer";
import { WireNameTooltip } from "@/components/settings/wire-name-tooltip";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getPath } from "@/lib/config/assemble-toml";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useSectionRawWins } from "@/hooks/use-section-raw-wins";
import { useSectionSave } from "@/hooks/use-section-save";
import { useSettingsConfig } from "@/hooks/use-settings-config";

interface IdentityValues {
  /** Daemon wire name verbatim — see SECTION_SCHEMAS.identity.tomlKeys. */
  name: string;
}

export interface IdentitySectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function copyToClipboard(value: string): void {
  if (typeof navigator !== "undefined" && navigator.clipboard !== undefined) {
    void navigator.clipboard.writeText(value);
  }
}

export function IdentitySection({ open, onOpenChange }: IdentitySectionProps) {
  const { base } = useSettingsConfig();
  const { snapshot } = useDaemonState();
  const { rawWins } = useSectionRawWins("identity");

  const defaultName =
    typeof getPath(base ?? {}, "node.name") === "string"
      ? (getPath(base ?? {}, "node.name") as string)
      : "";

  const form = useForm<IdentityValues>({
    defaultValues: { name: defaultName },
    values: { name: defaultName },
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "identity",
    form,
  );

  // Surface daemon-mapped field errors as react-hook-form errors so
  // FormMessage renders them under the corresponding control.
  useEffect(() => {
    const msg = fieldErrors["node.name"];
    if (msg !== undefined) {
      form.setError("name", { type: "daemon", message: msg });
    } else {
      form.clearErrors("name");
    }
  }, [fieldErrors, form]);

  const watchedName = form.watch("name");
  const status = snapshot.status;
  const shortId = status === null ? "—" : status.node_id_short;
  const summaryName = watchedName === "" ? "—" : watchedName;
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      {summaryName} · {shortId}
    </span>
  );

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      return save({ "node.name": values.name });
    })();
  };

  return (
    <CollapsibleCliPanel
      id="identity"
      title="IDENTITY"
      summary={summary}
      open={open}
      onOpenChange={onOpenChange}
    >
      {rawWins === true && <RawWinsBanner />}
      {sectionBannerError !== null && (
        <p className="mb-4 font-mono text-sm text-destructive">
          {sectionBannerError}
        </p>
      )}
      <Form {...form}>
        <div className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Device name</span>
                  <WireNameTooltip wireName="node.name" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Read-only: Node ID (full 64-char) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Node ID
              </span>
              <WireNameTooltip wireName="node_id" />
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all font-code text-sm text-foreground">
                {status === null ? "—" : status.node_id}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={status === null}
                onClick={() => {
                  if (status !== null) copyToClipboard(status.node_id);
                }}
              >
                [ Copy ]
              </Button>
            </div>
          </div>

          {/* Read-only: Short ID (8-char) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Short ID
              </span>
              <WireNameTooltip wireName="short_id" />
            </div>
            <code className="font-code text-sm text-foreground">
              {status === null ? "—" : status.node_id_short}
            </code>
          </div>

          {/* Read-only: Public key — fallback note (Status v1 omits public_key). */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Public key
              </span>
              <WireNameTooltip wireName="public_key" />
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              pubkey not exposed yet · daemon Status v1 omits this
            </p>
          </div>
        </div>

        <SectionSaveFooter
          dirty={form.formState.isDirty}
          state={state}
          onSave={onSave}
        />
      </Form>
    </CollapsibleCliPanel>
  );
}
