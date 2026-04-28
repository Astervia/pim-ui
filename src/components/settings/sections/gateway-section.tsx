/**
 * <GatewaySection /> — GATEWAY (NAT egress) settings panel.
 *
 * Owns the `[gateway]` block of the daemon config. Gateway nodes
 * provide internet egress via NAT to mesh peers. A gateway is
 * implicitly also a relay and a client (capability bits 0x07).
 *
 * Fields (verbatim daemon wire names):
 *   - gateway.enabled         (Switch)
 *   - gateway.nat_interface   (text)
 *   - gateway.max_connections (number)
 *
 * Deeper controls (NAT preflight, kill-switch, route advertisement)
 * land in Phase 5 GATE-*; this section covers the static config that
 * the daemon reads at startup.
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

interface GatewayValues {
  enabled: boolean;
  nat_interface: string;
  max_connections: string;
}

export interface GatewaySectionProps {
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
  enabled: "gateway.enabled",
  nat_interface: "gateway.nat_interface",
  max_connections: "gateway.max_connections",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function GatewaySection({ open, onOpenChange }: GatewaySectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("gateway");

  const defaults = useMemo<GatewayValues>(() => {
    const b = base ?? {};
    return {
      enabled: asBool(getPath(b, "gateway.enabled")),
      nat_interface: asString(getPath(b, "gateway.nat_interface")),
      max_connections: asString(getPath(b, "gateway.max_connections")),
    };
  }, [base]);

  const form = useForm<GatewayValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "gateway",
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
      {watched.enabled ? "enabled" : "disabled"}
      {watched.enabled && watched.nat_interface !== ""
        ? ` · via ${watched.nat_interface}`
        : ""}
    </span>
  );

  const numOrString = (s: string): number | string => {
    const n = Number(s);
    return Number.isFinite(n) && s.trim() !== "" ? n : s;
  };

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      return save({
        "gateway.enabled": values.enabled,
        "gateway.nat_interface": values.nat_interface,
        "gateway.max_connections": numOrString(values.max_connections),
      });
    })();
  };

  const off = watched.enabled === false;

  return (
    <CollapsibleCliPanel
      id="gateway"
      title="GATEWAY"
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
                  <span>Provide internet egress</span>
                  <WireNameTooltip wireName="gateway.enabled" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Gateway enabled"
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  When on, this node performs NAT to the internet for
                  mesh peers. Capability bitfield jumps to 0x07
                  (gateway + relay + client).
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <fieldset disabled={off} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="nat_interface"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>NAT interface</span>
                    <WireNameTooltip wireName="gateway.nat_interface" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="eth0 (Linux) · en0 (macOS)"
                      {...field}
                    />
                  </FormControl>
                  <p className="font-mono text-xs text-muted-foreground">
                    Internet-facing interface used for masquerading.
                    Replace the placeholder with the real one before
                    enabling.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_connections"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Max concurrent connections</span>
                    <WireNameTooltip wireName="gateway.max_connections" />
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
                  <p className="font-mono text-xs text-muted-foreground">
                    Maximum tracked gateway connection-tracking entries.
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
