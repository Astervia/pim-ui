/**
 * <TransportSection /> — TRANSPORT settings panel (CONF-03). Phase 3 Plan 03-05.
 *
 * Spec:
 *   - 03-UI-SPEC §S1 (collapsed summary `interface {iface} · mtu {mtu} ·
 *     mesh_ip {mode} · port {listen_port}` + pending-restart token)
 *   - 03-UI-SPEC §Form field labels (Interface name, MTU, Mesh address
 *     mode, Your address on the mesh, Listen port)
 *   - 03-UI-SPEC §Radio option labels (`Static — I set the address`,
 *     `Automatic — pim picks an address`)
 *   - 03-CONTEXT D-09 (number input via type="number"), D-11 (save),
 *     D-25/D-26 (pending-restart marker)
 *
 * Fields (verbatim daemon wire names):
 *   - transport.interface       (text)
 *   - transport.mtu             (number, min 576 max 9216)
 *   - transport.mesh_ip.mode    (radio: static / auto)
 *   - transport.mesh_ip.value   (text — rendered ONLY when mode === "static")
 *   - transport.listen_port     (number, min 1 max 65535)
 *
 * Pending-restart token: when usePendingRestart("transport").fields is
 * non-empty, the CollapsibleCliPanel header receives a token rendered
 * in `text-accent` per 03-UI-SPEC §Pending-restart.
 *
 * Hooks consumed (Wave 2 / 03-04 contract):
 *   - useSectionSave("transport", form) — orchestrates dry_run -> real
 *     save -> refetch -> rawWins rescan; mirrors form.formState.isDirty
 *     into use-dirty-sections via useEffect (checker Blocker 1).
 *   - useSectionRawWins("transport") — read-only `{ rawWins }` (Blocker 3).
 *   - usePendingRestart("transport") — fields awaiting daemon restart.
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getPath } from "@/lib/config/assemble-toml";
import { usePendingRestart } from "@/hooks/use-pending-restart";
import { useSectionRawWins } from "@/hooks/use-section-raw-wins";
import { useSectionSave } from "@/hooks/use-section-save";
import { useSettingsConfig } from "@/hooks/use-settings-config";

type MeshIpMode = "static" | "auto";

interface TransportValues {
  interface: string;
  mtu: string;
  mesh_ip_mode: MeshIpMode;
  mesh_ip_value: string;
  listen_port: string;
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

function asMode(v: unknown): MeshIpMode {
  return v === "static" ? "static" : "auto";
}

const FIELD_KEY_MAP = {
  interface: "transport.interface",
  mtu: "transport.mtu",
  mesh_ip_mode: "transport.mesh_ip.mode",
  mesh_ip_value: "transport.mesh_ip.value",
  listen_port: "transport.listen_port",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function TransportSection({ open, onOpenChange }: TransportSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("transport");
  const { fields: pendingFields } = usePendingRestart("transport");

  const defaults = useMemo<TransportValues>(() => {
    const b = base ?? {};
    return {
      interface: asString(getPath(b, "transport.interface")),
      mtu: asString(getPath(b, "transport.mtu")),
      mesh_ip_mode: asMode(getPath(b, "transport.mesh_ip.mode")),
      mesh_ip_value: asString(getPath(b, "transport.mesh_ip.value")),
      listen_port: asString(getPath(b, "transport.listen_port")),
    };
  }, [base]);

  const form = useForm<TransportValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "transport",
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
      interface {watched.interface === "" ? "—" : watched.interface} · mtu{" "}
      {watched.mtu === "" ? "—" : watched.mtu} · mesh_ip {watched.mesh_ip_mode}{" "}
      · port {watched.listen_port === "" ? "—" : watched.listen_port}
    </span>
  );

  const pendingRestartToken =
    pendingFields.length > 0 ? (
      <span className="font-mono text-xs text-accent">
        · ⚠ pending restart: {pendingFields.join(", ")}
      </span>
    ) : undefined;

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      const mtuNum = Number(values.mtu);
      const portNum = Number(values.listen_port);
      const payload: Record<string, unknown> = {
        "transport.interface": values.interface,
        "transport.mtu": Number.isFinite(mtuNum) ? mtuNum : values.mtu,
        "transport.mesh_ip.mode": values.mesh_ip_mode,
        "transport.listen_port": Number.isFinite(portNum)
          ? portNum
          : values.listen_port,
      };
      // Only include the static address when mode === "static" — the
      // daemon may reject an unused value for mode=auto.
      if (values.mesh_ip_mode === "static") {
        payload["transport.mesh_ip.value"] = values.mesh_ip_value;
      }
      return save(payload);
    })();
  };

  const meshMode = form.watch("mesh_ip_mode");

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
          <FormField
            control={form.control}
            name="interface"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Interface name</span>
                  <WireNameTooltip wireName="transport.interface" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mtu"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>MTU</span>
                  <WireNameTooltip wireName="transport.mtu" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={576}
                    max={9216}
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
            name="mesh_ip_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Mesh address mode</span>
                  <WireNameTooltip wireName="transport.mesh_ip.mode" />
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-label="Mesh address mode"
                  >
                    <label className="flex items-center gap-2 font-mono text-sm text-foreground">
                      <RadioGroupItem value="static" />
                      <span>Static — I set the address</span>
                    </label>
                    <label className="flex items-center gap-2 font-mono text-sm text-foreground">
                      <RadioGroupItem value="auto" />
                      <span>Automatic — pim picks an address</span>
                    </label>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Conditional: only when mode === "static" (per UI-SPEC). */}
          {meshMode === "static" && (
            <FormField
              control={form.control}
              name="mesh_ip_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <span>Your address on the mesh</span>
                    <WireNameTooltip wireName="transport.mesh_ip.value" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="10.77.0.100/24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

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
