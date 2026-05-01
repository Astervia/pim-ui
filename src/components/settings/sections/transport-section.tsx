/**
 * <TransportSection /> — TRANSPORT (TCP) settings panel.
 *
 * Owns the `[transport]` block of the daemon config. After Phase 01.1
 * the schema follows pim-core/src/config/model.rs verbatim:
 *
 *   - transport.type                   (string — "tcp" today; read-only)
 *   - transport.listen_port            (u16)
 *   - transport.max_reconnect_attempts (u32)
 *   - transport.connect_timeout_ms     (u64)
 *
 * Interface fields (name, mtu, mesh_ip) live in the new INTERFACE
 * section. Bluetooth / Wi-Fi Direct have their own top-level sections.
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
import { usePendingRestart } from "@/hooks/use-pending-restart";
import { useSectionRawWins } from "@/hooks/use-section-raw-wins";
import { useSectionSave } from "@/hooks/use-section-save";
import { useSettingsConfig } from "@/hooks/use-settings-config";

interface TransportValues {
  listen_port: string;
  max_reconnect_attempts: string;
  connect_timeout_ms: string;
}

export interface TransportSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return fallback;
}

const FIELD_KEY_MAP = {
  listen_port: "transport.listen_port",
  max_reconnect_attempts: "transport.max_reconnect_attempts",
  connect_timeout_ms: "transport.connect_timeout_ms",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function TransportSection({ open, onOpenChange }: TransportSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("transport");
  const { fields: pendingFields } = usePendingRestart("transport");

  const transportType = asString(getPath(base ?? {}, "transport.type"), "tcp");

  const defaults = useMemo<TransportValues>(() => {
    const b = base ?? {};
    return {
      listen_port: asString(getPath(b, "transport.listen_port")),
      max_reconnect_attempts: asString(
        getPath(b, "transport.max_reconnect_attempts"),
      ),
      connect_timeout_ms: asString(getPath(b, "transport.connect_timeout_ms")),
    };
  }, [base]);

  const form = useForm<TransportValues>({
    defaultValues: defaults,
    values: defaults,
  });

  const numOrString = (s: string): number | string => {
    const n = Number(s);
    return Number.isFinite(n) && s.trim() !== "" ? n : s;
  };

  const composePayload = (values: TransportValues): Record<string, unknown> => ({
    "transport.listen_port": numOrString(values.listen_port),
    "transport.max_reconnect_attempts": numOrString(
      values.max_reconnect_attempts,
    ),
    "transport.connect_timeout_ms": numOrString(values.connect_timeout_ms),
  });

  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "transport",
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
      {transportType} · port{" "}
      {watched.listen_port === "" ? "—" : watched.listen_port}
    </span>
  );

  const pendingRestartToken =
    pendingFields.length > 0 ? (
      <span className="font-mono text-xs text-accent">
        · ⚠ pending restart: {pendingFields.join(", ")}
      </span>
    ) : undefined;

  const onSave = (): void => {
    void form.handleSubmit((values) => save(composePayload(values)))();
  };

  return (
    <CollapsibleCliPanel
      id="transport"
      title="TRANSPORT"
      summary={summary}
      open={open}
      onOpenChange={onOpenChange}
      pendingRestartToken={pendingRestartToken}
    >
      {rawWins === true && <RawWinsBanner />}
      {sectionBannerError !== null && (
        <p className="mb-4 font-mono text-sm text-destructive">
          {sectionBannerError}
        </p>
      )}
      <Form {...form}>
        <div className="flex flex-col gap-4">
          {/* Read-only: transport.type */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Backend
              </span>
              <WireNameTooltip wireName="transport.type" />
            </div>
            <code className="font-code text-sm text-foreground">
              {transportType}
            </code>
            <p className="font-mono text-xs text-muted-foreground">
              Wire transport. Currently <code>tcp</code> is the only
              supported value.
            </p>
          </div>

          <FormField
            control={form.control}
            name="listen_port"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Listen port</span>
                  <WireNameTooltip wireName="transport.listen_port" />
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
                  TCP port this node listens on for direct peer
                  sessions. Default 9100.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="max_reconnect_attempts"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Max reconnect attempts</span>
                  <WireNameTooltip wireName="transport.max_reconnect_attempts" />
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
                <p className="font-mono text-xs text-muted-foreground">
                  Per-peer cap before the daemon stops retrying.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="connect_timeout_ms"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Connect timeout (ms)</span>
                  <WireNameTooltip wireName="transport.connect_timeout_ms" />
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
                <p className="font-mono text-xs text-muted-foreground">
                  Timeout for outbound TCP connect attempts.
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
          onDiscard={() => form.reset()}
          dirtyFieldCount={Object.keys(form.formState.dirtyFields).length}
          />
      </Form>
    </CollapsibleCliPanel>
  );
}
