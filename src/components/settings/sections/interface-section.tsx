/**
 * <InterfaceSection /> — INTERFACE (TUN device) settings panel.
 *
 * Owns the `[interface]` block of the daemon config. This is the
 * Linux/macOS TUN device that carries mesh IP traffic.
 *
 * Fields (verbatim daemon wire names):
 *   - interface.name       (text)
 *   - interface.mtu        (number, min 576 max 9216)
 *   - interface.mesh_ip    (text — "auto" or IPv4 CIDR)
 *   - interface.mesh_ipv6  (text, optional IPv6 ULA — empty disables)
 *
 * On macOS the daemon rejects non-`utun*` names; on Linux the kernel
 * creates the device verbatim. We surface the wire path verbatim and
 * let the daemon's dry-run validation reject invalid inputs.
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

interface InterfaceValues {
  name: string;
  mtu: string;
  mesh_ip: string;
  mesh_ipv6: string;
}

export interface InterfaceSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return fallback;
}

const FIELD_KEY_MAP = {
  name: "interface.name",
  mtu: "interface.mtu",
  mesh_ip: "interface.mesh_ip",
  mesh_ipv6: "interface.mesh_ipv6",
} as const;

type LocalKey = keyof typeof FIELD_KEY_MAP;

export function InterfaceSection({ open, onOpenChange }: InterfaceSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("interface");
  const { fields: pendingFields } = usePendingRestart("interface");

  const defaults = useMemo<InterfaceValues>(() => {
    const b = base ?? {};
    return {
      name: asString(getPath(b, "interface.name")),
      mtu: asString(getPath(b, "interface.mtu")),
      mesh_ip: asString(getPath(b, "interface.mesh_ip")),
      mesh_ipv6: asString(getPath(b, "interface.mesh_ipv6")),
    };
  }, [base]);

  const form = useForm<InterfaceValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "interface",
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
      {watched.name === "" ? "—" : watched.name} · mtu{" "}
      {watched.mtu === "" ? "—" : watched.mtu} · mesh{" "}
      {watched.mesh_ip === "" ? "—" : watched.mesh_ip}
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
      const payload: Record<string, unknown> = {
        "interface.name": values.name,
        "interface.mtu": Number.isFinite(mtuNum) ? mtuNum : values.mtu,
        "interface.mesh_ip": values.mesh_ip,
      };
      // Only emit mesh_ipv6 when non-empty; otherwise the daemon should
      // delete the field (handled save-side).
      if (values.mesh_ipv6.trim() !== "") {
        payload["interface.mesh_ipv6"] = values.mesh_ipv6;
      }
      return save(payload);
    })();
  };

  return (
    <CollapsibleCliPanel
      id="interface"
      title="INTERFACE"
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>TUN interface name</span>
                  <WireNameTooltip wireName="interface.name" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="pim0 (Linux) · utun8 (macOS)"
                    {...field}
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  Linux daemon creates this device verbatim. macOS
                  requires a `utun*` prefix; the kernel maps to the next
                  free `utunN` if the chosen index is taken.
                </p>
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
                  <WireNameTooltip wireName="interface.mtu" />
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
                <p className="font-mono text-xs text-muted-foreground">
                  Keep aligned with the value other peers use. 1400 is
                  the canonical mesh-MTU default.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mesh_ip"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Mesh IPv4 address</span>
                  <WireNameTooltip wireName="interface.mesh_ip" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    placeholder='"auto" or 10.77.0.100/24'
                    {...field}
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  Use a CIDR like <code>10.77.0.100/24</code> for
                  predictable labs, or <code>auto</code> to request an
                  address from a reachable gateway.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mesh_ipv6"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Mesh IPv6 ULA (optional)</span>
                  <WireNameTooltip wireName="interface.mesh_ipv6" />
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="fd77::10/64 — leave empty for IPv4-only"
                    {...field}
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  Optional static IPv6 ULA on the mesh TUN. Empty
                  disables IPv6 on the interface.
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
