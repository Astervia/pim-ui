# Brand Platform
> Phase: strategy | Brand: pim | Generated: 2026-04-15

---

## Purpose (Why)

**Infrastructure should be legible.**

Not because it is easier to build — it isn't. But because infrastructure you can read is infrastructure you can trust, extend, and run when you're the only one left with a working node. The alternative — tools that hide their architecture behind a control plane you don't own — works until it doesn't.

---

## Vision

A proximity networking stack that ships with its protocol documented, its crypto choices named, and its failure modes listed — such that anyone who can read Rust and a protocol spec can understand what PIM does before they depend on it.

More concretely: a tool that Mira runs at DEF CON, deploys on a relay node after a hurricane, and cites in a research paper — and in each of those contexts, the documentation holds up.

---

## Mission

Build and maintain a Rust IP-level mesh overlay that treats documentation, protocol legibility, and CLI surface design as first-class engineering concerns — not afterthoughts. Ship software that shows its work.

---

## Values

**1. Legibility is load-bearing.**
The protocol spec, the named crypto primitives, and the documented failure modes are not supplementary materials — they are structural. A PIM release without complete protocol documentation is not ready to release.
> In practice: Changes to the protocol layer require documentation updates before merge. Crypto choices are stated explicitly in the README, not buried in source comments.

**2. Precision over approximation.**
"X25519 for key agreement, ChaCha20-Poly1305 for authenticated encryption" — not "end-to-end encrypted." The right word, every time. If the right word is technical, use it — Mira knows it.
> In practice: Error messages name the specific failure (key exchange, route expiry, fragment timeout), not a generic category. Docs name the algorithm, not the property.

**3. Honest scope beats optimistic scope.**
"TCP today, Wi-Fi Direct as the target transport." "Gateway NAT is Linux-only." These statements build more trust than silence or vague future-roadmap language. Saying what PIM does not do is as important as saying what it does.
> In practice: README contains a "Current Limitations" section that is updated with each release and is not aspirational — it reflects current reality.

**4. The CLI output is a surface.**
`pim status`, `pim route status`, error messages — these are not implementation details, they are brand touchpoints. Mira reads CLI output the way a surgeon reads instrument readouts: information density and clarity matter.
> In practice: CLI output is reviewed alongside code in PRs. Box-drawing, color, and Unicode indicators are designed, not accidental.

**5. Resilience through design, not aesthetics.**
PIM is not a doom-prepper tool. It is a well-engineered overlay that functions under adverse conditions because it is built correctly — not because it performs toughness. The same discipline that makes the code reviewable makes it robust.
> In practice: Adverse-condition scenarios (high latency, partial peer failure, gateway loss) are first-class in the test suite, not edge cases.

---

## Promise

When you run PIM, you can read what it does before it does it.

The protocol is in `docs/PROTOCOL.md`. The crypto choices are in the README. The failure modes are listed, not hidden. If something goes wrong, the error message tells you what and where.

You don't have to trust PIM. You can check.
