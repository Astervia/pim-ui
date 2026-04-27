/**
 * humanizeCheckName — convert daemon snake_case check names to brand-voice
 * lowercase strings for the pre-flight UI per RESEARCH §10a + 05-CONTEXT D-04.
 *
 * Daemon source-of-truth: GatewayPreflightCheck.name is verbatim from
 * pim-daemon (e.g. "iptables_present"). UI knowledge: humanize for Aria.
 *
 * Unknown names fall through to lowercased name with underscores replaced
 * by spaces (so a future check "foo_bar" renders as "foo bar" without
 * requiring a UI redeploy).
 */

const HUMAN_CHECK_NAMES: Record<string, string> = {
  running_on_linux: "running on linux",
  iptables_present: "iptables present",
  cap_net_admin: "CAP_NET_ADMIN available",
  interfaces_detected: "network interfaces detected",
};

export function humanizeCheckName(name: string): string {
  const known = HUMAN_CHECK_NAMES[name];
  if (known === undefined) return name.replace(/_/g, " ");
  return known;
}
