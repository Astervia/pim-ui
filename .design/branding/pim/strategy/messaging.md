# Messaging
> Phase: strategy | Brand: pim | Generated: 2026-04-15

---

## Core Message

**Infrastructure you can read is infrastructure you can trust.**

This is the one thing PIM always communicates, in every context. It encompasses the protocol legibility, the honest scope statement, the designed CLI output, and the Outlaw-edge positioning against the opacity-by-default category. It is specific enough to be wrong — only a tool with a published protocol spec and named crypto choices can credibly make this claim.

---

## Supporting Messages

### 1. The protocol is the product.

**The claim:** PIM routes IP packets across proximity peers to a gateway. The entire mechanism — framing, crypto, routing, fragmentation — is described in `docs/PROTOCOL.md` before you run a single node.

**Why it matters to Mira:** She has been burned by tools that call themselves secure without showing the work. A published protocol spec is not documentation overhead — it is the minimum viable trust artifact for infrastructure she's going to depend on.

**Proof points:**
- PIM workspace has separate crates for `pim-crypto`, `pim-protocol`, `pim-routing` — the separation of concerns is structural, not cosmetic.
- Crypto choices (X25519, ChaCha20-Poly1305, HKDF-SHA256) are stated in the README, not implied.
- `docs/PROTOCOL.md` exists and is updated with the codebase.

**Do say:** "The protocol is documented. The crypto choices are named. Read `docs/PROTOCOL.md` before deploying."
**Don't say:** "PIM uses advanced cryptography to secure your connections."

---

### 2. It keeps transmitting when the backbone goes quiet.

**The claim:** PIM is designed for adversarial-condition operation. When centralized infrastructure fails — ISP outage, cell tower loss, DNS poisoning, shutdown — PIM routes through whatever peers are reachable within proximity.

**Why it matters to Mira:** This is not a resilience marketing claim. It is an architectural commitment: no central server, no relay dependency, no single point of failure that isn't in the mesh itself. She has read enough protocols to know the difference.

**Proof points:**
- No control plane. No cloud dependency. No tunnel server.
- Docker Compose labs include resilience and multi-gateway scenarios — the failure modes are tested, not described.
- Gateway loss scenarios are documented in test infrastructure, not promised in marketing copy.

**Do say:** "No central server. No control plane. If a gateway goes down, the mesh routes around it."
**Don't say:** "PIM works even when the internet is down!" (exclamation removed; claim made more precise)

---

### 3. The CLI output is designed.

**The claim:** `pim status --verbose` is not an afterthought. The output format — box-drawing borders, Unicode status indicators, aligned key-value pairs — is a deliberate design choice that treats the CLI surface as a first-class brand artifact.

**Why it matters to Mira:** She lives in the terminal. How a tool presents information in its output is a signal about how carefully the engineers thought about the human using it. Thoughtless CLI output is a tell. Thoughtful CLI output is a trust signal — and it's rare in the infrastructure-tool space.

**Proof points:**
- `pim status --verbose` exposes: peer count, route count, forwarded packets/bytes, dropped packets, congestion drops, conntrack size, uptime — all in a structured, readable format.
- Status indicators use Unicode (◆ active, ◈ relayed, ✗ down) — consistent, scannable, not verbose.
- Error messages name the specific failure and point to the relevant documentation section.

**Do say:** "The status output is structured. The error messages tell you what failed and where to look."
**Don't say:** "PIM has a beautiful CLI." (subjective claim without substance)

---

## Elevator Pitch

PIM is a Rust overlay daemon that forwards IPv4 and IPv6 packets across nearby peers until one reaches an egress gateway. No cloud dependency. No control plane. TCP today, Wi-Fi Direct as the target transport.

The protocol is documented in `docs/PROTOCOL.md`. The crypto choices — X25519 for key agreement, ChaCha20-Poly1305 for authenticated encryption — are in the README. The failure modes are listed before you deploy.

It runs on Linux and macOS as a client or relay. Gateway NAT is Linux-only. You can test the full stack with the Docker Compose labs before touching real hardware.

Read the spec. Run the tests. Route your packets.

---

## Tagline Directions

### Option A: "Read before you route."
**Rationale:** Command form. Implies that reading the protocol is not just possible but expected. "Route" signals what PIM actually does. Mira will appreciate the implied critique of tools you can't read before you run. Shorter and more pointed than any description.

**Risk:** Could read as a warning rather than a value proposition. Mitigated by deployment context — it reads correctly when Mira knows what she's looking at.

### Option B: "Infrastructure you can read."
**Rationale:** Directly from the core message. States the positioning claim in five words. Every word is earning its place. Works as a header, a README subhead, or a project descriptor on GitHub.

**Risk:** More descriptive than provocative. Less edge than Option A. But more immediately clear to someone who hasn't read the brief.

### Option C: "Still transmitting."
**Rationale:** The most evocative. Implies resilience without declaring it. "Still" does the adversarial-condition work — it implies there was a reason to stop transmitting, and PIM didn't. References the emotional compass. Works visually in a terminal aesthetic.

**Risk:** Least literal — requires context to land. Could read as aspirational rather than functional without surrounding documentation. Better as a brand-internal compass than a public-facing tagline without support copy.

**Recommended:** Option B for primary external use. Option A for documentation contexts. Option C as the brand-internal emotional compass.

---

## Audience Mapping

### Mira (primary — mesh-networking researcher / infrastructure hacker)

**Key message:** The protocol is documented, the crypto choices are named, the failure modes are listed. Here is everything you need to evaluate PIM before you run it.

**Tone shift:** Stays at the default — technical, declarative, no hand-holding. Mira doesn't need the concept of a TUN interface explained. She needs PIM's specific choices explained.

**Proof points for Mira:** `docs/PROTOCOL.md` existence and quality, named crypto primitives in README, `pim status --verbose` output design, Docker Compose test labs she can run, honest scope statement (TCP today / Wi-Fi Direct target / gateway NAT Linux-only).

**Discovery channel:** GitHub stars and contributions, HN posts and comments, Lobsters, Matrix/IRC networking channels, CCC talk references, academic citations.

**Message trigger:** Mira's entry point is "can I trust this tool to do what it says?" The message leads with the protocol spec, not the use cases.

---

### Contributor (secondary — protocol researcher / systems developer)

**Key message:** The codebase is structured for reasoning about. Each crate has a defined scope. The protocol layer is separate from transport. You can read it, test it, and extend it.

**Tone shift:** Even more technical. The contributor message can assume deep familiarity with Rust, async runtimes, and networking concepts. The "Alive" quality here shows up as intellectual honesty about trade-offs and open design questions.

**Proof points:** Workspace structure (`pim-core`, `pim-crypto`, `pim-protocol`, `pim-routing` as separate crates), test coverage, Docker Compose integration labs, CONTRIBUTING.md (if exists), issues tagged "design discussion."

**Discovery channel:** GitHub Issues and Discussions, Rust networking ecosystem (Tokio community), protocol research mailing lists.

**Message trigger:** "Is this worth contributing to?" — the message leads with architectural legibility and the signal that the maintainer will engage seriously with protocol design discussions.
