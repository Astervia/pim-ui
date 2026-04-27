/**
 * <TrustSection /> — TRUST settings panel (CONF-05). Phase 3 Plan 03-05.
 *
 * Spec:
 *   - 03-UI-SPEC §S1 (collapsed summary `policy: {allow_all | allow_list |
 *     TOFU}` — daemon raw values, NO translation)
 *   - 03-UI-SPEC §Form field labels (Authorization policy / Trusted peers)
 *   - 03-UI-SPEC §Radio option labels (verbatim — three-line trust copy)
 *   - 03-UI-SPEC §Empty states (`no trusted peers yet · trust policy is
 *     {policy}` — verbatim)
 *   - 03-CONTEXT D-19 (read-only trust list in Phase 3; editing list
 *     deferred), D-09 (radio-group), D-11 (save), D-15 (rawWins)
 *
 * Fields:
 *   - security.authorization → RadioGroup (allow_all / allow_list / TOFU)
 *   - Trusted peers list — READ-ONLY in Phase 3 (D-19). Renders the
 *     parsed `security.allow_list[]` or `trust_store[]` from base. Empty
 *     state copy is verbatim per UI-SPEC §Empty states.
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { CollapsibleCliPanel } from "@/components/settings/collapsible-cli-panel";
import { RawWinsBanner } from "@/components/settings/raw-wins-banner";
import { SectionSaveFooter } from "@/components/settings/section-save-footer";
import { WireNameTooltip } from "@/components/settings/wire-name-tooltip";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getPath } from "@/lib/config/assemble-toml";
import { useSectionRawWins } from "@/hooks/use-section-raw-wins";
import { useSectionSave } from "@/hooks/use-section-save";
import { useSettingsConfig } from "@/hooks/use-settings-config";

type AuthPolicy = "allow_all" | "allow_list" | "TOFU";

interface TrustValues {
  authorization: AuthPolicy;
}

export interface TrustSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asPolicy(v: unknown): AuthPolicy {
  if (v === "allow_all" || v === "allow_list" || v === "TOFU") return v;
  return "TOFU";
}

interface TrustedPeerRow {
  short_id: string;
  label: string | null;
}

/**
 * Pull a list of trusted peers out of the parsed base config, tolerating
 * either `security.allow_list[]` or `security.trust_store[]` shapes (the
 * daemon's exact key isn't locked in v1; SECTION_SCHEMAS notes
 * `trust_store` as the read-only path). Returns rows of
 * `{ short_id, label }` for rendering — entries that don't shape-match
 * are skipped silently.
 */
function extractTrustedPeers(base: Record<string, unknown> | null): TrustedPeerRow[] {
  if (base === null) return [];
  const sec = base.security as
    | { allow_list?: unknown[]; trust_store?: unknown[] }
    | undefined;
  const list = sec?.allow_list ?? sec?.trust_store;
  if (Array.isArray(list) === false) return [];
  const rows: TrustedPeerRow[] = [];
  for (const entry of list as unknown[]) {
    if (typeof entry === "string") {
      rows.push({ short_id: entry.slice(0, 8), label: null });
      continue;
    }
    if (typeof entry === "object" && entry !== null) {
      const e = entry as { short_id?: unknown; node_id?: unknown; label?: unknown };
      const sid =
        typeof e.short_id === "string"
          ? e.short_id
          : typeof e.node_id === "string"
            ? (e.node_id as string).slice(0, 8)
            : null;
      if (sid !== null) {
        rows.push({
          short_id: sid,
          label: typeof e.label === "string" ? e.label : null,
        });
      }
    }
  }
  return rows;
}

export function TrustSection({ open, onOpenChange }: TrustSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("trust");

  const defaults = useMemo<TrustValues>(() => {
    return {
      authorization: asPolicy(getPath(base ?? {}, "security.authorization")),
    };
  }, [base]);

  const form = useForm<TrustValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "trust",
    form,
  );

  useEffect(() => {
    const msg = fieldErrors["security.authorization"];
    if (msg !== undefined) {
      form.setError("authorization", { type: "daemon", message: msg });
    } else {
      form.clearErrors("authorization");
    }
  }, [fieldErrors, form]);

  const watched = form.watch();
  const trustedPeers = extractTrustedPeers(base);
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      policy: {watched.authorization}
    </span>
  );

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      return save({ "security.authorization": values.authorization });
    })();
  };

  return (
    <CollapsibleCliPanel
      id="trust"
      title="TRUST"
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
            name="authorization"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Authorization policy</span>
                  <WireNameTooltip wireName="security.authorization" />
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-label="Authorization policy"
                  >
                    <label className="flex items-center gap-2 font-mono text-sm text-foreground">
                      <RadioGroupItem value="allow_all" />
                      <span>Allow all (trust-on-first-use disabled)</span>
                    </label>
                    <label className="flex items-center gap-2 font-mono text-sm text-foreground">
                      <RadioGroupItem value="allow_list" />
                      <span>Allow list (only peers in trusted-peers)</span>
                    </label>
                    <label className="flex items-center gap-2 font-mono text-sm text-foreground">
                      <RadioGroupItem value="TOFU" />
                      <span>Trust on first use (default for mesh discovery)</span>
                    </label>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Read-only Trusted peers list (D-19) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Trusted peers
              </span>
              <WireNameTooltip wireName="trust_store" />
            </div>
            {trustedPeers.length === 0 ? (
              <p className="font-mono text-sm text-muted-foreground">
                no trusted peers yet · trust policy is {watched.authorization}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {trustedPeers.map((row) => (
                  <li
                    key={row.short_id}
                    className="font-code text-sm text-foreground"
                  >
                    <span>{row.short_id}</span>{" "}
                    <span className="text-muted-foreground">
                      {row.label === null ? "—" : row.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
