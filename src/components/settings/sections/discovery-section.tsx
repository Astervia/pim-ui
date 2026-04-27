/**
 * <DiscoverySection /> — DISCOVERY settings panel (CONF-04). Phase 3 Plan 03-05.
 *
 * Spec:
 *   - 03-UI-SPEC §S1 (collapsed summary `broadcast {on/off} · BLE {on/off} ·
 *     wifi_direct {on/off} · {N} trusted peer{s}`)
 *   - 03-UI-SPEC §Form field labels (Broadcast discovery / Bluetooth
 *     discovery / Wi-Fi Direct discovery / Auto-connect to discovered peers)
 *   - 03-CONTEXT D-09 (Switch primitive), D-11 (save), D-15 (rawWins)
 *
 * Fields (all Switch; verbatim daemon wire names):
 *   - discovery.broadcast      → "Broadcast discovery"
 *   - discovery.bluetooth      → "Bluetooth discovery"
 *   - discovery.wifi_direct    → "Wi-Fi Direct discovery"
 *   - discovery.auto_connect   → "Auto-connect to discovered peers"
 *
 * Trusted-peer count for the summary pulls from `security.allow_list[]`
 * if present in the parsed base. A permissive cast is acceptable — the
 * schema-diff logic catches drift.
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

interface DiscoveryValues {
  broadcast: boolean;
  bluetooth: boolean;
  wifi_direct: boolean;
  auto_connect: boolean;
}

export interface DiscoverySectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

const FIELD_KEY_MAP = {
  broadcast: "discovery.broadcast",
  bluetooth: "discovery.bluetooth",
  wifi_direct: "discovery.wifi_direct",
  auto_connect: "discovery.auto_connect",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function DiscoverySection({ open, onOpenChange }: DiscoverySectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("discovery");

  const defaults = useMemo<DiscoveryValues>(() => {
    const b = base ?? {};
    return {
      broadcast: asBool(getPath(b, "discovery.broadcast")),
      bluetooth: asBool(getPath(b, "discovery.bluetooth")),
      wifi_direct: asBool(getPath(b, "discovery.wifi_direct")),
      auto_connect: asBool(getPath(b, "discovery.auto_connect")),
    };
  }, [base]);

  const form = useForm<DiscoveryValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "discovery",
    form,
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
  const allowList = (base?.security as { allow_list?: unknown[] } | undefined)
    ?.allow_list;
  const trustedCount = Array.isArray(allowList) ? allowList.length : 0;

  const onOff = (v: boolean): string => (v === true ? "on" : "off");
  const peerSuffix = trustedCount === 1 ? "trusted peer" : "trusted peers";
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      broadcast {onOff(watched.broadcast)} · BLE {onOff(watched.bluetooth)} ·
      wifi_direct {onOff(watched.wifi_direct)} · {trustedCount} {peerSuffix}
    </span>
  );

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      return save({
        "discovery.broadcast": values.broadcast,
        "discovery.bluetooth": values.bluetooth,
        "discovery.wifi_direct": values.wifi_direct,
        "discovery.auto_connect": values.auto_connect,
      });
    })();
  };

  return (
    <CollapsibleCliPanel
      id="discovery"
      title="DISCOVERY"
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
            name="broadcast"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Broadcast discovery</span>
                  <WireNameTooltip wireName="discovery.broadcast" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Broadcast discovery"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bluetooth"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Bluetooth discovery</span>
                  <WireNameTooltip wireName="discovery.bluetooth" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Bluetooth discovery"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="wifi_direct"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Wi-Fi Direct discovery</span>
                  <WireNameTooltip wireName="discovery.wifi_direct" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Wi-Fi Direct discovery"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="auto_connect"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Auto-connect to discovered peers</span>
                  <WireNameTooltip wireName="discovery.auto_connect" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Auto-connect to discovered peers"
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
