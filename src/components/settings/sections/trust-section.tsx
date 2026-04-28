/**
 * <TrustSection /> — TRUST (security policy) settings panel.
 *
 * Owns the security-related fields of the daemon config:
 *
 *   - security.authorization_policy  (radio: allow_all / allow_list /
 *                                     trust_on_first_use)
 *   - security.key_file              (read-only path)
 *   - security.trust_store_file      (read-only path)
 *   - security.require_encryption    (Switch)
 *   - security.authorized_peers      (read-only list — Phase 3 D-19)
 *
 * The wire path is `security.authorization_policy` (verbatim per
 * pim-core/src/config/model.rs); the enum values are
 * `allow_all` / `allow_list` / `trust_on_first_use`.
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { getPath } from "@/lib/config/assemble-toml";
import { useSectionRawWins } from "@/hooks/use-section-raw-wins";
import { useSectionSave } from "@/hooks/use-section-save";
import { useSettingsConfig } from "@/hooks/use-settings-config";

type AuthPolicy = "allow_all" | "allow_list" | "trust_on_first_use";

interface TrustValues {
  authorization_policy: AuthPolicy;
  require_encryption: boolean;
}

export interface TrustSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asPolicy(v: unknown): AuthPolicy {
  if (
    v === "allow_all" ||
    v === "allow_list" ||
    v === "trust_on_first_use"
  )
    return v;
  return "trust_on_first_use";
}

function asBool(v: unknown, fallback = true): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  return fallback;
}

interface TrustedPeerRow {
  short_id: string;
  label: string | null;
}

/**
 * Pull the currently-authorized peers from the parsed base config.
 * The daemon stores this list as `security.authorized_peers` (an array
 * of NodeId hex strings) per pim-core's SecurityConfig. Fall back to
 * legacy keys for older configs the UI may still encounter.
 */
function extractTrustedPeers(
  base: Record<string, unknown> | null,
): TrustedPeerRow[] {
  if (base === null) return [];
  const sec = base.security as
    | {
        authorized_peers?: unknown[];
        allow_list?: unknown[];
        trust_store?: unknown[];
      }
    | undefined;
  const list =
    sec?.authorized_peers ?? sec?.allow_list ?? sec?.trust_store;
  if (Array.isArray(list) === false) return [];
  const rows: TrustedPeerRow[] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      rows.push({ short_id: entry.slice(0, 8), label: null });
      continue;
    }
    if (typeof entry === "object" && entry !== null) {
      const e = entry as {
        short_id?: unknown;
        node_id?: unknown;
        label?: unknown;
      };
      const sid =
        typeof e.short_id === "string"
          ? e.short_id
          : typeof e.node_id === "string"
            ? e.node_id.slice(0, 8)
            : null;
      if (sid !== null) {
        rows.push({
          short_id: sid,
          label: typeof e.label === "string" ? e.label : null,
        });
      }
    }
  }
  return rows;
}

export function TrustSection({ open, onOpenChange }: TrustSectionProps) {
  const { base } = useSettingsConfig();
  const { rawWins } = useSectionRawWins("trust");

  const defaults = useMemo<TrustValues>(() => {
    const b = base ?? {};
    return {
      authorization_policy: asPolicy(getPath(b, "security.authorization_policy")),
      require_encryption: asBool(
        getPath(b, "security.require_encryption"),
        true,
      ),
    };
  }, [base]);

  const form = useForm<TrustValues>({
    defaultValues: defaults,
    values: defaults,
  });
  const { state, save, fieldErrors, sectionBannerError } = useSectionSave(
    "trust",
    form,
  );

  useEffect(() => {
    const policyMsg = fieldErrors["security.authorization_policy"];
    if (policyMsg !== undefined) {
      form.setError("authorization_policy", {
        type: "daemon",
        message: policyMsg,
      });
    } else {
      form.clearErrors("authorization_policy");
    }
    const reqMsg = fieldErrors["security.require_encryption"];
    if (reqMsg !== undefined) {
      form.setError("require_encryption", {
        type: "daemon",
        message: reqMsg,
      });
    } else {
      form.clearErrors("require_encryption");
    }
  }, [fieldErrors, form]);

  const watched = form.watch();
  const trustedPeers = extractTrustedPeers(base);
  const keyFile = asString(getPath(base ?? {}, "security.key_file"));
  const trustStoreFile = asString(
    getPath(base ?? {}, "security.trust_store_file"),
  );
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      policy: {watched.authorization_policy}
      {watched.require_encryption ? "" : " · ⚠ unencrypted allowed"}
    </span>
  );

  const onSave = (): void => {
    void form.handleSubmit((values) => {
      return save({
        "security.authorization_policy": values.authorization_policy,
        "security.require_encryption": values.require_encryption,
      });
    })();
  };

  return (
    <CollapsibleCliPanel
      id="trust"
      title="TRUST"
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
            name="authorization_policy"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Authorization policy</span>
                  <WireNameTooltip wireName="security.authorization_policy" />
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-label="Authorization policy"
                  >
                    <label className="flex items-start gap-2 font-mono text-sm text-foreground">
                      <RadioGroupItem
                        value="trust_on_first_use"
                        className="mt-1"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span>Trust on first use (TOFU)</span>
                        <span className="text-xs text-muted-foreground">
                          Admit authenticated peers on first contact and
                          remember them. Recommended for typical mesh
                          discovery.
                        </span>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 font-mono text-sm text-foreground">
                      <RadioGroupItem value="allow_all" className="mt-1" />
                      <div className="flex flex-col gap-0.5">
                        <span>Allow all</span>
                        <span className="text-xs text-muted-foreground">
                          Admit any peer that completes the Ed25519
                          handshake. No memory of who connected before.
                        </span>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 font-mono text-sm text-foreground">
                      <RadioGroupItem value="allow_list" className="mt-1" />
                      <div className="flex flex-col gap-0.5">
                        <span>Allow list</span>
                        <span className="text-xs text-muted-foreground">
                          Admit only NodeIds listed in{" "}
                          <code>security.authorized_peers</code>.
                        </span>
                      </div>
                    </label>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="require_encryption"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <span>Require encrypted sessions</span>
                  <WireNameTooltip wireName="security.require_encryption" />
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Require encryption"
                  />
                </FormControl>
                <p className="font-mono text-xs text-muted-foreground">
                  Reject sessions that don&apos;t complete the
                  authenticated handshake. Should always be on for real
                  networks.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Read-only: key file path */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Key file
              </span>
              <WireNameTooltip wireName="security.key_file" />
            </div>
            <code className="break-all font-code text-sm text-foreground">
              {keyFile === "" ? "—" : keyFile}
            </code>
            <p className="font-mono text-xs text-muted-foreground">
              Daemon creates this Ed25519 private key on first startup
              if missing.
            </p>
          </div>

          {/* Read-only: trust store path */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Trust store file
              </span>
              <WireNameTooltip wireName="security.trust_store_file" />
            </div>
            <code className="break-all font-code text-sm text-foreground">
              {trustStoreFile === "" ? "—" : trustStoreFile}
            </code>
            <p className="font-mono text-xs text-muted-foreground">
              Where TOFU writes peer identities it has accepted.
            </p>
          </div>

          {/* Read-only: authorized peers list (D-19 — list edit deferred) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Authorized peers
              </span>
              <WireNameTooltip wireName="security.authorized_peers" />
            </div>
            {trustedPeers.length === 0 ? (
              <p className="font-mono text-sm text-muted-foreground">
                no authorized peers yet · policy is{" "}
                {watched.authorization_policy}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {trustedPeers.map((row) => (
                  <li
                    key={row.short_id}
                    className="font-code text-sm text-foreground"
                  >
                    <span>{row.short_id}</span>{" "}
                    <span className="text-muted-foreground">
                      {row.label === null ? "—" : row.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
