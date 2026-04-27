/**
 * <RoutingSection /> — ROUTING settings panel (CONF-01). Phase 3 Plan 03-06.
 *
 * Spec:
 *   - 03-UI-SPEC §S1 (collapsed summary `max_hops {n}`)
 *   - 03-UI-SPEC §Form field labels (Maximum hops)
 *   - 03-CONTEXT D-19 (Phase 3 routing knobs — only `routing.max_hops`)
 *
 * Field (verbatim daemon wire name):
 *   - routing.max_hops → number Input
 *
 * Hooks consumed (Wave 2 / 03-04 contract):
 *   - useSectionSave("routing", form) — orchestrates dry_run -> real save.
 *   - useSectionRawWins("routing") — read-only `{ rawWins }`.
 *   - useSettingsConfig() — base config for defaultValues seeding.
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
import { Input } from "@/components/ui/input";
import { getPath } from "@/lib/config/assemble-toml";
import { useSectionRawWins } from "@/hooks/use-section-raw-wins";
import { useSectionSave } from "@/hooks/use-section-save";
import { useSettingsConfig } from "@/hooks/use-settings-config";

interface RoutingValues {
  max_hops: string;
}

export interface RoutingSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return fallback;
}

const FIELD_KEY_MAP = {
  max_hops: "routing.max_hops",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function RoutingSection({ open, onOpenChange }: RoutingSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("routing");

  const defaults = useMemo<RoutingValues>(() => {
    const b = base ?? {};
    return {
      max_hops: asString(getPath(b, "routing.max_hops")),
    };
  }, [base]);

  const form = useForm<RoutingValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "routing",
    form,
  );

  // Surface daemon-mapped field errors as react-hook-form errors.
  useEffect(() => {
    (Object.keys(FIELD_KEY_MAP) as LocalKey[]).forEach((local) => {
      const wire = FIELD_KEY_MAP[local];
      const msg = fieldErrors[wire];
      if (msg !== undefined) {
        form.setError(local, { type: "daemon", message: msg });
      } else {
        form.clearErrors(local);
      }
    });
  }, [fieldErrors, form]);

  const watched = form.watch();
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      max_hops {watched.max_hops === "" ? "—" : watched.max_hops}
    </span>
  );

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      const hopsNum = Number(values.max_hops);
      const payload: Record<string, unknown> = {
        "routing.max_hops": Number.isFinite(hopsNum) ? hopsNum : values.max_hops,
      };
      return save(payload);
    })();
  };

  return (
    <CollapsibleCliPanel
      id="routing"
      title="ROUTING"
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
            name="max_hops"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Maximum hops</span>
                  <WireNameTooltip wireName="routing.max_hops" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={64}
                    step={1}
                    inputMode="numeric"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
