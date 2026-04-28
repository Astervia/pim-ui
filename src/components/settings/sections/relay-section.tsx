/**
 * <RelaySection /> — RELAY settings panel.
 *
 * Single toggle: `relay.enabled`.
 *
 * Capability semantics (per pim-core/src/config/discovery.md):
 *   - relay.enabled = true  → capability bitfield 0x03 (relay + client).
 *     This node forwards mesh frames for nearby peers in addition to
 *     originating its own.
 *   - relay.enabled = false → 0x01 (client only). Other nodes will NOT
 *     initiate connections to a client-only peer; you'll only reach
 *     gateways and relays that you connect to first.
 *
 * Gateway nodes are implicitly also relays (0x07) regardless of this
 * setting — when `[gateway].enabled = true`, this toggle is moot.
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

interface RelayValues {
  enabled: boolean;
}

export interface RelaySectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

export function RelaySection({ open, onOpenChange }: RelaySectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("relay");

  const defaults = useMemo<RelayValues>(() => {
    return { enabled: asBool(getPath(base ?? {}, "relay.enabled"), true) };
  }, [base]);

  const form = useForm<RelayValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "relay",
    form,
  );

  useEffect(() => {
    const msg = fieldErrors["relay.enabled"];
    if (msg !== undefined) {
      form.setError("enabled", { type: "daemon", message: msg });
    } else {
      form.clearErrors("enabled");
    }
  }, [fieldErrors, form]);

  const watched = form.watch();
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      {watched.enabled ? "relay + client (0x03)" : "client only (0x01)"}
    </span>
  );

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      return save({ "relay.enabled": values.enabled });
    })();
  };

  return (
    <CollapsibleCliPanel
      id="relay"
      title="RELAY"
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
            name="enabled"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Forward traffic for other peers</span>
                  <WireNameTooltip wireName="relay.enabled" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Relay enabled"
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  When on, this node accepts inbound connections from
                  other peers and forwards mesh frames on their behalf.
                  When off, you run as a client-only node — other peers
                  won&apos;t initiate connections to you.
                </p>
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
