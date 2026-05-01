/**
 * <NotificationsSection /> — NOTIFICATIONS settings panel (CONF-01).
 * Phase 3 Plan 03-06.
 *
 * Spec:
 *   - 03-UI-SPEC §S1 (collapsed summary
 *     `all-gateways-lost {on/off} · kill-switch {on/off}`)
 *   - 03-UI-SPEC §Form field labels (All gateways lost / Kill-switch active)
 *   - 03-CONTEXT deferred (Phase 3 wires the toggle state into config; the
 *     actual notification firing — UX-04 toast + UX-05 system notification —
 *     ships in Phase 5)
 *
 * Fields (all Switch; verbatim daemon wire names):
 *   - notifications.all_gateways_lost  → "All gateways lost"
 *   - notifications.kill_switch        → "Kill-switch active"
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
import { Switch } from "@/components/ui/switch";
import { getPath } from "@/lib/config/assemble-toml";
import { useSectionRawWins } from "@/hooks/use-section-raw-wins";
import { useSectionSave } from "@/hooks/use-section-save";
import { useSettingsConfig } from "@/hooks/use-settings-config";

interface NotificationsValues {
  all_gateways_lost: boolean;
  kill_switch: boolean;
}

export interface NotificationsSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

const FIELD_KEY_MAP = {
  all_gateways_lost: "notifications.all_gateways_lost",
  kill_switch: "notifications.kill_switch",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function NotificationsSection({
  open,
  onOpenChange,
}: NotificationsSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("notifications");

  const defaults = useMemo<NotificationsValues>(() => {
    const b = base ?? {};
    return {
      all_gateways_lost: asBool(getPath(b, "notifications.all_gateways_lost")),
      kill_switch: asBool(getPath(b, "notifications.kill_switch")),
    };
  }, [base]);

  const form = useForm<NotificationsValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const composePayload = (
    values: NotificationsValues,
  ): Record<string, unknown> => ({
    "notifications.all_gateways_lost": values.all_gateways_lost,
    "notifications.kill_switch": values.kill_switch,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "notifications",
    form,
    composePayload,
  );

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
  const onOff = (v: boolean): string => (v === true ? "on" : "off");
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      all-gateways-lost {onOff(watched.all_gateways_lost)} · kill-switch{" "}
      {onOff(watched.kill_switch)}
    </span>
  );

  const onSave = (): void => {
    void form.handleSubmit((values) => save(composePayload(values)))();
  };

  return (
    <CollapsibleCliPanel
      id="notifications"
      title="NOTIFICATIONS"
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
            name="all_gateways_lost"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>All gateways lost</span>
                  <WireNameTooltip wireName="notifications.all_gateways_lost" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="All gateways lost"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="kill_switch"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Kill-switch active</span>
                  <WireNameTooltip wireName="notifications.kill_switch" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Kill-switch active"
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
          onDiscard={() => form.reset()}
          dirtyFieldCount={Object.keys(form.formState.dirtyFields).length}
          />
      </Form>
    </CollapsibleCliPanel>
  );
}
