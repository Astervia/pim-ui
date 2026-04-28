/**
 * <WifiDirectSection /> — WI-FI DIRECT (IEEE 802.11 P2P) settings panel.
 *
 * Owns the `[wifi_direct]` block of the daemon config. Wi-Fi Direct
 * is a peer-finding layer: once a P2P group is formed, the resulting
 * IP becomes the target of a normal TCP transport connection.
 *
 * Backends:
 *   - Linux: `wpa_supplicant` with CONFIG_P2P=y, controlled via `wpa_cli`.
 *   - macOS: Bonjour DNS-SD over the host's peer-to-peer Wi-Fi
 *     interface; the Linux-specific tuning fields are accepted but
 *     ignored.
 *
 * OFF by default — many Linux desktop installs lack CONFIG_P2P. Verify
 * with `wpa_cli p2p_find` before enabling.
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

interface WifiDirectValues {
  enabled: boolean;
  interface: string;
  go_intent: string;
  listen_channel: string;
  op_channel: string;
  connect_method: string;
}

export interface WifiDirectSectionProps {
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
  enabled: "wifi_direct.enabled",
  interface: "wifi_direct.interface",
  go_intent: "wifi_direct.go_intent",
  listen_channel: "wifi_direct.listen_channel",
  op_channel: "wifi_direct.op_channel",
  connect_method: "wifi_direct.connect_method",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function WifiDirectSection({
  open,
  onOpenChange,
}: WifiDirectSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("wifi_direct");

  const defaults = useMemo<WifiDirectValues>(() => {
    const b = base ?? {};
    return {
      enabled: asBool(getPath(b, "wifi_direct.enabled")),
      interface: asString(getPath(b, "wifi_direct.interface")),
      go_intent: asString(getPath(b, "wifi_direct.go_intent")),
      listen_channel: asString(getPath(b, "wifi_direct.listen_channel")),
      op_channel: asString(getPath(b, "wifi_direct.op_channel")),
      connect_method: asString(getPath(b, "wifi_direct.connect_method")),
    };
  }, [base]);

  const form = useForm<WifiDirectValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "wifi_direct",
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
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      {watched.enabled ? "on" : "off"} · iface{" "}
      {watched.interface === "" ? "—" : watched.interface} ·{" "}
      {watched.connect_method}
    </span>
  );

  const numOrString = (s: string): number | string => {
    const n = Number(s);
    return Number.isFinite(n) && s.trim() !== "" ? n : s;
  };

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      return save({
        "wifi_direct.enabled": values.enabled,
        "wifi_direct.interface": values.interface,
        "wifi_direct.go_intent": numOrString(values.go_intent),
        "wifi_direct.listen_channel": numOrString(values.listen_channel),
        "wifi_direct.op_channel": numOrString(values.op_channel),
        "wifi_direct.connect_method": values.connect_method,
      });
    })();
  };

  const off = watched.enabled === false;

  return (
    <CollapsibleCliPanel
      id="wifi_direct"
      title="WI-FI DIRECT"
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
                  <span>Wi-Fi Direct discovery</span>
                  <WireNameTooltip wireName="wifi_direct.enabled" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Wi-Fi Direct enabled"
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  Off by default. Linux requires{" "}
                  <code>wpa_supplicant</code> built with{" "}
                  <code>CONFIG_P2P=y</code>; verify with{" "}
                  <code>wpa_cli p2p_find</code> before enabling.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <fieldset disabled={off} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="interface"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Wi-Fi interface</span>
                    <WireNameTooltip wireName="wifi_direct.interface" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="wlan0 (Linux) · ignored on macOS"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="go_intent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Group Owner intent (0–15)</span>
                    <WireNameTooltip wireName="wifi_direct.go_intent" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={15}
                      step={1}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Higher = more likely to become Group Owner during
                    P2P negotiation. 7 is neutral.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="listen_channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Listen channel</span>
                    <WireNameTooltip wireName="wifi_direct.listen_channel" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={165}
                      step={1}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="op_channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Operating channel</span>
                    <WireNameTooltip wireName="wifi_direct.op_channel" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={165}
                      step={1}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="connect_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Connection method</span>
                    <WireNameTooltip wireName="wifi_direct.connect_method" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder='"pbc" or "pin:12345678"'
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    <code>pbc</code> = push-button. For PIN-based pairing,
                    use <code>pin:&lt;8-digit-pin&gt;</code>.
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
        />
      </Form>
    </CollapsibleCliPanel>
  );
}
