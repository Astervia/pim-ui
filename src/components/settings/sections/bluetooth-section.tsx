/**
 * <BluetoothSection /> — BLUETOOTH PAN settings panel.
 *
 * Owns the `[bluetooth]` block of the daemon config. Bluetooth is a
 * peer-link-establishment mechanism: it finds peers, sets up a PAN
 * link, and learns their IPs. The standard TCP transport then connects
 * to those IPs for the encrypted handshake — this is NOT a separate
 * wire transport.
 *
 * Field groups:
 *   1. Master toggle + identification (enabled, interface, alias, prefix)
 *   2. Discovery + outbound (radio_discovery_enabled, connect_pan,
 *      auto_discover_peers, request_dhcp)
 *   3. NAP server (Linux only — serve_nap, nap_bridge, nap_bridge_addr,
 *      dhcp_*)
 *   4. Timing knobs (poll_interval_ms, scan_interval_ms,
 *      peer_discovery_interval_ms, bluetoothctl_timeout_s,
 *      discoverable_timeout_s, startup_timeout_ms)
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
import { useBtNapPreflight } from "@/hooks/use-bt-nap-preflight";
import { useSectionRawWins } from "@/hooks/use-section-raw-wins";
import { useSectionSave } from "@/hooks/use-section-save";
import { useSettingsConfig } from "@/hooks/use-settings-config";

interface BluetoothValues {
  enabled: boolean;
  interface: string;
  radio_discovery_enabled: boolean;
  device_name_prefix: string;
  local_alias: string;
  connect_pan: boolean;
  serve_nap: boolean;
  nap_bridge: string;
  nap_bridge_addr: string;
  dhcp_enabled: boolean;
  dhcp_range: string;
  dhcp_lease_time: string;
  dhcp_dns: string;
  request_dhcp: boolean;
  auto_discover_peers: boolean;
  poll_interval_ms: string;
  scan_interval_ms: string;
  peer_discovery_interval_ms: string;
  bluetoothctl_timeout_s: string;
  discoverable_timeout_s: string;
  startup_timeout_ms: string;
}

export interface BluetoothSectionProps {
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
  enabled: "bluetooth.enabled",
  interface: "bluetooth.interface",
  radio_discovery_enabled: "bluetooth.radio_discovery_enabled",
  device_name_prefix: "bluetooth.device_name_prefix",
  local_alias: "bluetooth.local_alias",
  connect_pan: "bluetooth.connect_pan",
  serve_nap: "bluetooth.serve_nap",
  nap_bridge: "bluetooth.nap_bridge",
  nap_bridge_addr: "bluetooth.nap_bridge_addr",
  dhcp_enabled: "bluetooth.dhcp_enabled",
  dhcp_range: "bluetooth.dhcp_range",
  dhcp_lease_time: "bluetooth.dhcp_lease_time",
  dhcp_dns: "bluetooth.dhcp_dns",
  request_dhcp: "bluetooth.request_dhcp",
  auto_discover_peers: "bluetooth.auto_discover_peers",
  poll_interval_ms: "bluetooth.poll_interval_ms",
  scan_interval_ms: "bluetooth.scan_interval_ms",
  peer_discovery_interval_ms: "bluetooth.peer_discovery_interval_ms",
  bluetoothctl_timeout_s: "bluetooth.bluetoothctl_timeout_s",
  discoverable_timeout_s: "bluetooth.discoverable_timeout_s",
  startup_timeout_ms: "bluetooth.startup_timeout_ms",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function BluetoothSection({ open, onOpenChange }: BluetoothSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("bluetooth");

  const defaults = useMemo<BluetoothValues>(() => {
    const b = base ?? {};
    return {
      enabled: asBool(getPath(b, "bluetooth.enabled"), true),
      interface: asString(getPath(b, "bluetooth.interface")),
      radio_discovery_enabled: asBool(
        getPath(b, "bluetooth.radio_discovery_enabled"),
        true,
      ),
      device_name_prefix: asString(getPath(b, "bluetooth.device_name_prefix")),
      local_alias: asString(getPath(b, "bluetooth.local_alias")),
      connect_pan: asBool(getPath(b, "bluetooth.connect_pan"), true),
      serve_nap: asBool(getPath(b, "bluetooth.serve_nap")),
      nap_bridge: asString(getPath(b, "bluetooth.nap_bridge")),
      nap_bridge_addr: asString(getPath(b, "bluetooth.nap_bridge_addr")),
      dhcp_enabled: asBool(getPath(b, "bluetooth.dhcp_enabled"), true),
      dhcp_range: asString(getPath(b, "bluetooth.dhcp_range")),
      dhcp_lease_time: asString(getPath(b, "bluetooth.dhcp_lease_time")),
      dhcp_dns: asString(getPath(b, "bluetooth.dhcp_dns")),
      request_dhcp: asBool(getPath(b, "bluetooth.request_dhcp"), true),
      auto_discover_peers: asBool(
        getPath(b, "bluetooth.auto_discover_peers"),
        true,
      ),
      poll_interval_ms: asString(getPath(b, "bluetooth.poll_interval_ms")),
      scan_interval_ms: asString(getPath(b, "bluetooth.scan_interval_ms")),
      peer_discovery_interval_ms: asString(
        getPath(b, "bluetooth.peer_discovery_interval_ms"),
      ),
      bluetoothctl_timeout_s: asString(
        getPath(b, "bluetooth.bluetoothctl_timeout_s"),
      ),
      discoverable_timeout_s: asString(
        getPath(b, "bluetooth.discoverable_timeout_s"),
      ),
      startup_timeout_ms: asString(getPath(b, "bluetooth.startup_timeout_ms")),
    };
  }, [base]);

  const form = useForm<BluetoothValues>({
    defaultValues: defaults,
    values: defaults,
  });

  const numOrString = (s: string): number | string => {
    const n = Number(s);
    return Number.isFinite(n) && s.trim() !== "" ? n : s;
  };

  const composePayload = (values: BluetoothValues): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      "bluetooth.enabled": values.enabled,
      "bluetooth.interface": values.interface,
      "bluetooth.radio_discovery_enabled": values.radio_discovery_enabled,
      "bluetooth.device_name_prefix": values.device_name_prefix,
      "bluetooth.local_alias": values.local_alias,
      "bluetooth.connect_pan": values.connect_pan,
      "bluetooth.serve_nap": values.serve_nap,
      "bluetooth.nap_bridge": values.nap_bridge,
      "bluetooth.nap_bridge_addr": values.nap_bridge_addr,
      "bluetooth.dhcp_enabled": values.dhcp_enabled,
      "bluetooth.dhcp_lease_time": values.dhcp_lease_time,
      "bluetooth.request_dhcp": values.request_dhcp,
      "bluetooth.auto_discover_peers": values.auto_discover_peers,
      "bluetooth.poll_interval_ms": numOrString(values.poll_interval_ms),
      "bluetooth.scan_interval_ms": numOrString(values.scan_interval_ms),
      "bluetooth.peer_discovery_interval_ms": numOrString(
        values.peer_discovery_interval_ms,
      ),
      "bluetooth.bluetoothctl_timeout_s": numOrString(
        values.bluetoothctl_timeout_s,
      ),
      "bluetooth.discoverable_timeout_s": numOrString(
        values.discoverable_timeout_s,
      ),
      "bluetooth.startup_timeout_ms": numOrString(values.startup_timeout_ms),
    };
    if (values.dhcp_range.trim() !== "") {
      payload["bluetooth.dhcp_range"] = values.dhcp_range;
    }
    if (values.dhcp_dns.trim() !== "") {
      payload["bluetooth.dhcp_dns"] = values.dhcp_dns;
    }
    return payload;
  };

  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "bluetooth",
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

  // Plan 06-03: NAP-server preflight runs only when bluetooth is on
  // (cheap, but no point probing PATH on every Settings open). The
  // result lights up the [ Serve a local NAP ] switch with platform
  // capability + missing-tool detail.
  const napPreflight = useBtNapPreflight(watched.enabled === true);
  const napSupported =
    napPreflight.result === null ? null : napPreflight.result.supported;

  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      {watched.enabled ? "on" : "off"} · radio{" "}
      {watched.radio_discovery_enabled ? "on" : "off"} · auto-discover{" "}
      {watched.auto_discover_peers ? "on" : "off"}
      {watched.serve_nap ? " · NAP server" : ""}
    </span>
  );

  const onSave = (): void => {
    void form.handleSubmit((values) => save(composePayload(values)))();
  };

  const off = watched.enabled === false;

  return (
    <CollapsibleCliPanel
      id="bluetooth"
      title="BLUETOOTH"
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
                  <span>Bluetooth PAN discovery</span>
                  <WireNameTooltip wireName="bluetooth.enabled" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Bluetooth enabled"
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  Find peers via Bluetooth PAN. macOS uses the host
                  Bluetooth stack; Linux uses BlueZ
                  (<code>bluetoothctl</code>, <code>bt-network</code>).
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Identification */}
          <fieldset
            disabled={off}
            className="flex flex-col gap-4 border-l border-border/40 pl-4"
          >
            <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Identification
            </legend>

            <FormField
              control={form.control}
              name="interface"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>PAN interface</span>
                    <WireNameTooltip wireName="bluetooth.interface" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder='"auto" (Linux) · bridge0 (macOS)'
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Linux: <code>auto</code> falls back to live{" "}
                    <code>bnep*</code> / <code>enx*</code>. macOS: the
                    documented value is <code>bridge0</code>.
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
                    <WireNameTooltip wireName="bluetooth.device_name_prefix" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder='Empty = consider any BT device'
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Filter inquiry results by Bluetooth device-name
                    prefix. Empty string (default) accepts every visible
                    device — the pairing/handshake fails silently for
                    non-PIM peers, so this is safe but slightly slower.
                    Set <code>PIM-</code> if you control all peers and
                    want to skip non-PIM devices entirely.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="local_alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Local controller alias</span>
                    <WireNameTooltip wireName="bluetooth.local_alias" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="PIM-myhost"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Local Bluetooth alias broadcast to nearby devices.
                    Empty derives from <code>node.name</code>.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          {/* Discovery + outbound */}
          <fieldset
            disabled={off}
            className="flex flex-col gap-4 border-l border-border/40 pl-4"
          >
            <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Discovery + outbound links
            </legend>

            <FormField
              control={form.control}
              name="radio_discovery_enabled"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Radio-level scanning</span>
                    <WireNameTooltip wireName="bluetooth.radio_discovery_enabled" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Radio discovery"
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Run <code>bluetoothctl scan on</code> /{" "}
                    <code>blueutil --inquiry</code> to find unpaired peers.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="connect_pan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Connect outbound PAN/NAP</span>
                    <WireNameTooltip wireName="bluetooth.connect_pan" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Connect PAN"
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Allow this node to initiate PAN/NAP connections to
                    discovered peers.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auto_discover_peers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Auto-discover peer IPs</span>
                    <WireNameTooltip wireName="bluetooth.auto_discover_peers" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Auto-discover peers"
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Read peer IPs from the PAN interface neighbor table
                    (<code>ip neigh</code> / <code>arp</code>).
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="request_dhcp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Request DHCP after pairing (Linux client)</span>
                    <WireNameTooltip wireName="bluetooth.request_dhcp" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Request DHCP"
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    On Linux, request a DHCP lease on the resolved PAN
                    interface once the link comes up.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          {/* NAP server (Linux only) */}
          <fieldset
            disabled={off}
            className="flex flex-col gap-4 border-l border-border/40 pl-4"
          >
            <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              NAP server (Linux)
            </legend>

            <FormField
              control={form.control}
              name="serve_nap"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Serve a local NAP</span>
                    <WireNameTooltip wireName="bluetooth.serve_nap" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(next) => {
                        // Plan 06-03: refuse to flip the switch on when
                        // preflight has decisively reported unsupported.
                        // null means "not yet known" (loading / bluetooth
                        // off) — let the user proceed and surface the
                        // failure on the next preflight refresh.
                        if (next === true && napSupported === false) {
                          return;
                        }
                        field.onChange(next);
                      }}
                      disabled={napSupported === false}
                      aria-label="Serve NAP"
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Linux only. Run <code>bt-network -s nap</code> on{" "}
                    <code>nap_bridge</code> + dnsmasq DHCP — turns this
                    node into a Bluetooth access point.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Plan 06-03: preflight checklist — visible whenever bluetooth
                is on. Shows fail/pass per check (bt-network, dnsmasq,
                bridge tools, bnep module on Linux; an honest "Linux-only"
                line on macOS / Windows / other). */}
            {watched.enabled === true && napPreflight.result !== null ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    NAP-server preflight ({napPreflight.result.platform})
                  </span>
                  <button
                    type="button"
                    onClick={() => void napPreflight.refresh()}
                    className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                    disabled={napPreflight.loading}
                  >
                    {napPreflight.loading ? "[ checking… ]" : "[ recheck ]"}
                  </button>
                </div>
                <ul className="flex flex-col gap-1 font-code text-xs">
                  {napPreflight.result.checks.map((c) => (
                    <li
                      key={c.name}
                      className="flex items-baseline gap-2"
                    >
                      <span
                        aria-hidden="true"
                        className={
                          c.ok === true
                            ? "text-primary"
                            : "text-destructive"
                        }
                      >
                        {c.ok === true ? "◆" : "✗"}
                      </span>
                      <span className="text-foreground font-mono">{c.name}</span>
                      <span className="text-muted-foreground">— {c.detail}</span>
                    </li>
                  ))}
                </ul>
                {napPreflight.result.supported === false ? (
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                    NAP-server toggle is locked until every check above
                    passes.
                  </p>
                ) : null}
              </div>
            ) : null}
            {napPreflight.error !== null ? (
              <p className="font-mono text-xs text-destructive">
                preflight failed: {napPreflight.error}
              </p>
            ) : null}

            <FormField
              control={form.control}
              name="nap_bridge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>NAP bridge interface</span>
                    <WireNameTooltip wireName="bluetooth.nap_bridge" />
                  </FormLabel>
                  <FormControl>
                    <Input type="text" spellCheck={false} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nap_bridge_addr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>NAP bridge IPv4 CIDR</span>
                    <WireNameTooltip wireName="bluetooth.nap_bridge_addr" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      placeholder="192.168.44.1/24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dhcp_enabled"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Daemon-supervised DHCP</span>
                    <WireNameTooltip wireName="bluetooth.dhcp_enabled" />
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="DHCP enabled"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dhcp_range"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>DHCP pool (optional)</span>
                    <WireNameTooltip wireName="bluetooth.dhcp_range" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      placeholder="192.168.44.10,192.168.44.200"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Empty = derived from <code>nap_bridge_addr</code>.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dhcp_lease_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>DHCP lease time</span>
                    <WireNameTooltip wireName="bluetooth.dhcp_lease_time" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      placeholder="12h"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dhcp_dns"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>DHCP DNS servers (optional)</span>
                    <WireNameTooltip wireName="bluetooth.dhcp_dns" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      placeholder="1.1.1.1,8.8.8.8"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Empty = inherits <code>/etc/resolv.conf</code> at
                    runtime.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          {/* Timing */}
          <fieldset
            disabled={off}
            className="flex flex-col gap-4 border-l border-border/40 pl-4"
          >
            <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Timing
            </legend>

            <FormField
              control={form.control}
              name="poll_interval_ms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Interface-up poll (ms)</span>
                    <WireNameTooltip wireName="bluetooth.poll_interval_ms" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={100}
                      step={100}
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
              name="scan_interval_ms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Radio scan interval (ms)</span>
                    <WireNameTooltip wireName="bluetooth.scan_interval_ms" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={500}
                      step={100}
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
              name="peer_discovery_interval_ms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Peer-IP poll (ms)</span>
                    <WireNameTooltip wireName="bluetooth.peer_discovery_interval_ms" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={500}
                      step={100}
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
              name="bluetoothctl_timeout_s"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>bluetoothctl timeout (s)</span>
                    <WireNameTooltip wireName="bluetooth.bluetoothctl_timeout_s" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
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
              name="discoverable_timeout_s"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Discoverable window (s)</span>
                    <WireNameTooltip wireName="bluetooth.discoverable_timeout_s" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
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
              name="startup_timeout_ms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>PAN startup timeout (ms)</span>
                    <WireNameTooltip wireName="bluetooth.startup_timeout_ms" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1000}
                      step={500}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
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
