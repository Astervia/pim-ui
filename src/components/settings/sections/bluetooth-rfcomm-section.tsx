/**
 * <BluetoothRfcommSection /> — BLUETOOTH RFCOMM settings panel.
 *
 * Owns the `[bluetooth_rfcomm]` block of the daemon config. Independent
 * from the existing `[bluetooth]` PAN/NAP section: RFCOMM scans paired
 * Bluetooth devices by name prefix, opens the configured RFCOMM channel,
 * exchanges PIM identity frames, and (optionally) bridges the resulting
 * byte stream into the local TCP transport listener so the normal PIM
 * handshake / session machinery is reused.
 *
 * Field groups:
 *   1. Master toggle (enabled)
 *   2. Channel + filtering (channel, device_name_prefix)
 *   3. Outbound dialing (outbound_enabled, poll_interval_ms)
 *   4. Bridge to local TCP (bridge_to_tcp)
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
import { Switch } from "@/components/ui/switch";
import { getPath } from "@/lib/config/assemble-toml";
import { useSectionRawWins } from "@/hooks/use-section-raw-wins";
import { useSectionSave } from "@/hooks/use-section-save";
import { useSettingsConfig } from "@/hooks/use-settings-config";

interface BluetoothRfcommValues {
  enabled: boolean;
  channel: string;
  device_name_prefix: string;
  outbound_enabled: boolean;
  poll_interval_ms: string;
  bridge_to_tcp: boolean;
}

export interface BluetoothRfcommSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return fallback;
}

const FIELD_KEY_MAP = {
  enabled: "bluetooth_rfcomm.enabled",
  channel: "bluetooth_rfcomm.channel",
  device_name_prefix: "bluetooth_rfcomm.device_name_prefix",
  outbound_enabled: "bluetooth_rfcomm.outbound_enabled",
  poll_interval_ms: "bluetooth_rfcomm.poll_interval_ms",
  bridge_to_tcp: "bluetooth_rfcomm.bridge_to_tcp",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function BluetoothRfcommSection({
  open,
  onOpenChange,
}: BluetoothRfcommSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("bluetooth_rfcomm");

  const defaults = useMemo<BluetoothRfcommValues>(() => {
    const b = base ?? {};
    return {
      enabled: asBool(getPath(b, "bluetooth_rfcomm.enabled"), false),
      channel: asString(getPath(b, "bluetooth_rfcomm.channel"), "22"),
      device_name_prefix: asString(
        getPath(b, "bluetooth_rfcomm.device_name_prefix"),
        "PIM-",
      ),
      outbound_enabled: asBool(
        getPath(b, "bluetooth_rfcomm.outbound_enabled"),
        true,
      ),
      poll_interval_ms: asString(
        getPath(b, "bluetooth_rfcomm.poll_interval_ms"),
        "30000",
      ),
      bridge_to_tcp: asBool(
        getPath(b, "bluetooth_rfcomm.bridge_to_tcp"),
        true,
      ),
    };
  }, [base]);

  const form = useForm<BluetoothRfcommValues>({
    defaultValues: defaults,
    values: defaults,
  });

  const numOrString = (s: string): number | string => {
    const n = Number(s);
    return Number.isFinite(n) && s.trim() !== "" ? n : s;
  };

  const composePayload = (
    values: BluetoothRfcommValues,
  ): Record<string, unknown> => ({
    "bluetooth_rfcomm.enabled": values.enabled,
    "bluetooth_rfcomm.channel": numOrString(values.channel),
    "bluetooth_rfcomm.device_name_prefix": values.device_name_prefix,
    "bluetooth_rfcomm.outbound_enabled": values.outbound_enabled,
    "bluetooth_rfcomm.poll_interval_ms": numOrString(values.poll_interval_ms),
    "bluetooth_rfcomm.bridge_to_tcp": values.bridge_to_tcp,
  });

  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "bluetooth_rfcomm",
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

  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      {watched.enabled ? "on" : "off"} · ch {watched.channel || "—"} ·{" "}
      outbound {watched.outbound_enabled ? "on" : "off"}
      {watched.bridge_to_tcp ? " · tcp bridge" : ""}
    </span>
  );

  const onSave = (): void => {
    void form.handleSubmit((values) => save(composePayload(values)))();
  };

  const off = watched.enabled === false;

  return (
    <CollapsibleCliPanel
      id="bluetooth_rfcomm"
      title="BLUETOOTH RFCOMM"
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
        <div className="flex flex-col gap-6">
          {/* Master toggle */}
          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Bluetooth RFCOMM</span>
                  <WireNameTooltip wireName="bluetooth_rfcomm.enabled" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Bluetooth RFCOMM enabled"
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  Linux only. Scan paired Bluetooth devices by name prefix,
                  open the configured RFCOMM channel, and exchange PIM
                  identity frames. Independent from{" "}
                  <code>[bluetooth]</code> PAN/NAP.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Channel + filtering */}
          <fieldset
            disabled={off}
            className="flex flex-col gap-4 border-l border-border/40 pl-4"
          >
            <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Channel + filter
            </legend>

            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>RFCOMM channel</span>
                    <WireNameTooltip wireName="bluetooth_rfcomm.channel" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Channel to bind and dial. Default <code>22</code>{" "}
                    avoids common SPP channel conflicts.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="device_name_prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Device-name prefix</span>
                    <WireNameTooltip wireName="bluetooth_rfcomm.device_name_prefix" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="PIM-"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Filter paired Bluetooth devices by name prefix. Only
                    devices whose name starts with this string are tried.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          {/* Outbound dialing */}
          <fieldset
            disabled={off}
            className="flex flex-col gap-4 border-l border-border/40 pl-4"
          >
            <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Outbound dialing
            </legend>

            <FormField
              control={form.control}
              name="outbound_enabled"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Periodic outbound dial</span>
                    <WireNameTooltip wireName="bluetooth_rfcomm.outbound_enabled" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Outbound RFCOMM dialing enabled"
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Periodically scan paired devices and dial out over
                    RFCOMM. Disable for inbound-only nodes.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="poll_interval_ms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Poll interval (ms)</span>
                    <WireNameTooltip wireName="bluetooth_rfcomm.poll_interval_ms" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1000}
                      step={1000}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    How often the daemon re-scans the paired-device list
                    for outbound dial attempts.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          {/* TCP bridge */}
          <fieldset
            disabled={off}
            className="flex flex-col gap-4 border-l border-border/40 pl-4"
          >
            <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Local TCP bridge
            </legend>

            <FormField
              control={form.control}
              name="bridge_to_tcp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Bridge to local TCP transport</span>
                    <WireNameTooltip wireName="bluetooth_rfcomm.bridge_to_tcp" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Bridge RFCOMM to local TCP listener"
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Forward established RFCOMM sessions to{" "}
                    <code>127.0.0.1:&lt;transport.listen_port&gt;</code> so
                    the normal PIM handshake / session pipeline is reused.
                    Turn off for discovery-only deployments.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
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
