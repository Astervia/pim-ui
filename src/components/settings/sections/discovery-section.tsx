/**
 * <DiscoverySection /> — DISCOVERY (UDP broadcast) settings panel.
 *
 * Owns the `[discovery]` block of the daemon config. This is the LAN
 * UDP-broadcast peer-finding mechanism (`PIMD` advertisements on
 * :9101). Bluetooth and Wi-Fi Direct discovery have their own
 * top-level sections.
 *
 * Fields (verbatim daemon wire names from pim-core/config/model.rs):
 *   - discovery.enabled               (Switch)
 *   - discovery.port                  (number)
 *   - discovery.broadcast_interval_ms (number)
 *   - discovery.peer_timeout_ms       (number)
 *   - discovery.connect_relays        (Switch)
 *   - discovery.connect_gateways      (Switch)
 *   - discovery.shared_key            (text — optional 64-hex-char group key)
 *
 * Limitations: UDP broadcast is confined to a single broadcast domain
 * — cross-subnet topologies need static [[peers]] entries.
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

interface DiscoveryValues {
  enabled: boolean;
  port: string;
  broadcast_interval_ms: string;
  peer_timeout_ms: string;
  connect_relays: boolean;
  connect_gateways: boolean;
  shared_key: string;
}

export interface DiscoverySectionProps {
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
  enabled: "discovery.enabled",
  port: "discovery.port",
  broadcast_interval_ms: "discovery.broadcast_interval_ms",
  peer_timeout_ms: "discovery.peer_timeout_ms",
  connect_relays: "discovery.connect_relays",
  connect_gateways: "discovery.connect_gateways",
  shared_key: "discovery.shared_key",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function DiscoverySection({ open, onOpenChange }: DiscoverySectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("discovery");

  const defaults = useMemo<DiscoveryValues>(() => {
    const b = base ?? {};
    return {
      enabled: asBool(getPath(b, "discovery.enabled"), true),
      port: asString(getPath(b, "discovery.port")),
      broadcast_interval_ms: asString(
        getPath(b, "discovery.broadcast_interval_ms"),
      ),
      peer_timeout_ms: asString(getPath(b, "discovery.peer_timeout_ms")),
      connect_relays: asBool(getPath(b, "discovery.connect_relays"), true),
      connect_gateways: asBool(getPath(b, "discovery.connect_gateways"), true),
      shared_key: asString(getPath(b, "discovery.shared_key")),
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
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      {watched.enabled ? "on" : "off"} · port{" "}
      {watched.port === "" ? "—" : watched.port} · ad{" "}
      {watched.broadcast_interval_ms === "" ? "—" : watched.broadcast_interval_ms}
      ms
    </span>
  );

  const numOrString = (s: string): number | string => {
    const n = Number(s);
    return Number.isFinite(n) && s.trim() !== "" ? n : s;
  };

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      const payload: Record<string, unknown> = {
        "discovery.enabled": values.enabled,
        "discovery.port": numOrString(values.port),
        "discovery.broadcast_interval_ms": numOrString(
          values.broadcast_interval_ms,
        ),
        "discovery.peer_timeout_ms": numOrString(values.peer_timeout_ms),
        "discovery.connect_relays": values.connect_relays,
        "discovery.connect_gateways": values.connect_gateways,
      };
      if (values.shared_key.trim() !== "") {
        payload["discovery.shared_key"] = values.shared_key;
      }
      return save(payload);
    })();
  };

  const off = watched.enabled === false;

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
            name="enabled"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>UDP broadcast discovery</span>
                  <WireNameTooltip wireName="discovery.enabled" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Discovery enabled"
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  Find peers on the local network via{" "}
                  <code>PIMD</code> UDP broadcasts. Limited to one
                  broadcast domain — cross-subnet needs static peers.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <fieldset disabled={off} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Discovery port</span>
                    <WireNameTooltip wireName="discovery.port" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      step={1}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    UDP port for sending and receiving advertisements.
                    Default 9101.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="broadcast_interval_ms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Broadcast interval (ms)</span>
                    <WireNameTooltip wireName="discovery.broadcast_interval_ms" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={500}
                      step={500}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    How often this node broadcasts its presence.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="peer_timeout_ms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Peer expiry (ms)</span>
                    <WireNameTooltip wireName="discovery.peer_timeout_ms" />
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
                    How long an unseen peer remains in the table before
                    expiry.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="connect_relays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Auto-connect to discovered relays</span>
                    <WireNameTooltip wireName="discovery.connect_relays" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Connect relays"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="connect_gateways"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Auto-connect to discovered gateways</span>
                    <WireNameTooltip wireName="discovery.connect_gateways" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Connect gateways"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shared_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Discovery group key (optional)</span>
                    <WireNameTooltip wireName="discovery.shared_key" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="64 hex characters — empty to leave unset"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    When set, only nodes with the same key can decode
                    discovery broadcasts. Gates discovery, NOT transport
                    security (handshake is always Ed25519).
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
