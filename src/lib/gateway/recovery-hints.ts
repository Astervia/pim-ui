/**
 * recoveryHint — UI-side install/recovery hints for failed pre-flight
 * checks per RESEARCH §10b + 05-CONTEXT D-05.
 *
 * The hint is PLAIN TEXT — copyable, not clickable. We do NOT auto-run
 * shell commands; doing so would require sudo escalation and is out of
 * scope + brand-violating. Aria reads the hint and copies it into her
 * shell.
 *
 * Distro coverage: Debian/Ubuntu favored (apt). Arch/Fedora users translate.
 * Auto-distro-detect is OUT OF SCOPE (RESEARCH §10b — would require shell
 * + parsing /etc/os-release).
 *
 * Returns null for checks without an actionable hint (running_on_linux,
 * interfaces_detected — no command can fix those).
 */

const RECOVERY_HINTS: Record<string, string> = {
  iptables_present: "install: sudo apt install iptables",
  cap_net_admin:
    "run pim-daemon as root or grant cap_net_admin: sudo setcap cap_net_admin=ep $(which pim-daemon)",
};

export function recoveryHint(name: string): string | null {
  const hint = RECOVERY_HINTS[name];
  if (hint === undefined) return null;
  return hint;
}
