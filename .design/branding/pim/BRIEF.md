# Brand Brief

## Brand
- **Name:** pim
- **Date:** 2026-04-15

## Company
- **Company name:** Proximity Internet Mesh (PIM)
- **Industry:** Networking / mesh overlay / open-source infrastructure
- **Founded:** 2025
- **Size:** Small open-source project (solo/core maintainer + contributors)
- **Stage:** mvp
- **Existing brand?** no

## Brand Mode
- **Mode:** new
- **Reason:** Project has working daemon + CLI + Docker labs and needs a coherent identity before broader release. No prior brand work exists.

### Existing Brand State (evolve only)
N/A — new brand.

### Evolution Scope (evolve only)
N/A — new brand.

## Business
- **Problem:** Conventional internet access depends on centralized infrastructure — cell towers, ISPs, DNS, corporate VPN overlays — that fails, censors, or disappears under the exact conditions people most need connectivity. Existing "mesh" projects are either fragile demos or commercial VPNs that borrow the word "mesh" while still routing everything through their own backbone.
- **Solution:** A Rust overlay daemon that forwards IP traffic peer-to-peer across nearby nodes until someone reaches an egress gateway. Auditable protocol, legible crypto, real routing — designed to be read from first principles and to keep transmitting when the backbone goes quiet.
- **Business model:** Open source, no monetization target. Sustainability is attention and contributors, not revenue.
- **Defensibility:** Technical rigor + documentation quality + protocol transparency. The moat is *legibility* — few competitors treat their protocol as something a researcher should be able to read and reproduce.

## Personas

### Primary: Mira
- **Role:** Mesh-networking researcher / infrastructure hacker
- **Age range:** 27–34
- **Day-in-the-life:** Spends her days reading IETF drafts and protocol source, runs Reticulum on LoRa in her apartment, follows the Scuttlebutt community, and has cjdns writeups bookmarked. Works in a small security/research group or independently. Tools: tmux, Wireshark, tcpdump, `cargo`, `bpftrace`, lots of tabs.
- **Frustration:** Most projects calling themselves "mesh" are either toy demos that fall apart past three nodes, or rebranded VPNs wearing mesh cosplay — centralized infrastructure with a friendlier logo. Marketing opacity masquerading as simplicity.
- **Aspiration:** Tools she can actually reason about — real protocol docs, real crypto choices explained, real packet paths she can trace — that also survive when the cell tower dies. Wants to respect the people who build it and be respected back as a reader.
- **Discovery:** GitHub stars, Hacker News, Lobsters, `#networking` / `#p2p` IRC/Matrix, academic-adjacent blog posts, RFC mailing lists, talks at CCC / Real World Crypto.
- **Trust signals:** Written protocol spec, test suite she can run, crypto primitives named explicitly, honest failure-mode documentation, quiet voice (no hype). Distrust: marketing pages with zero technical depth, decentralization as a buzzword, proprietary "open-source" licenses.

### Secondary: (none declared)

## Brand Essence

### Emotional Compass
- **brand_heartbeat:** The quiet confidence of an instrument you can read from first principles — one that keeps transmitting when the backbone goes quiet.

### Promise
- **Core promise:** Whenever someone interacts with PIM, they should feel that the project is treating them as a technically literate peer — not selling, not performing, just showing the work.
- **Functional promise:** A working proximity mesh overlay, documented end-to-end, that you can inspect, run, and extend.
- **Emotional promise:** Competence without condescension. The relief of a tool that refuses to lie to you.

### Point of View
- **Category disagreement:** "Mesh" has been hollowed out by VPN vendors. A mesh is not a marketing word for a star topology with a friendly router — it is a protocol commitment to peer-to-peer forwarding under adversarial and infrastructure-failure conditions.
- **Underestimated truth:** Users can read protocols. The reason networking tools feel opaque is not that their audience is underinformed — it is that most vendors have something to hide (a dependency, a central server, a business model).
- **Manifesto line:** Infrastructure you can read is infrastructure you can trust. Everything else is a brochure.

### Personality
- **Personality:** precise, rigorous, unsentimental
- **Personality reference:** like Wireshark crossed with an OpenBSD release note, told in a quieter voice than cjdns
- **Not us:** corporate, cute
- **Never be:** consumer-VPN polish (Tailscale / NordVPN aesthetic), web3 / crypto-bro, doom-prepper / militant (camo, tactical black, apocalypse cosplay), academic-dry / lifeless (IETF greyscale with no voice)
- **Tone:** Declarative, specific, lightly dry. Reads like protocol prose that occasionally remembers it has a pulse.

## Competitive Landscape
- **Direct competitors / reference set:** Briar, Meshtastic, Reticulum, Serval, Scuttlebutt, Bitchat (resist-the-backbone / proximity-first / research lineage). Adjacent but *not* the reference set: Tailscale, Nebula, ZeroTier (commercial mesh-VPNs — explicitly not where PIM sits).
- **What sets you apart?** IP-level proximity forwarding at the L3 overlay rather than app-layer gossip, Rust implementation with published crates, honest scope statement (Linux-first, TCP transport today, Wi-Fi Direct as target), and protocol-first documentation.
- **Brands admired:** (not declared — trust inferred instincts)

## Visual Direction
- **Mood / aesthetic:** Terminal-native. Monospace-forward, grid-aligned, diagrammatic. Calm, low-chroma palette with room for a single signal color. High information density, no decorative imagery, generous use of rules, tables, and ASCII-style topology.
- **Reference links:** (none supplied — synthesize from mood words in research phase)
- **Texture / atmosphere:** Matte, flat, typographic. No gradients, no glass, no illustration. Diagrams behave like engineering schematics. Screenshots of real CLI output are first-class brand assets.
- **Anti-patterns:** No pastel gradients, no rounded SaaS illustrations, no friendly mascots, no neon/glitch Web3 vibes, no camo or tactical black, no pure IETF greyscale monotony. Also: no photography of servers, hoodies, or "hacker" clichés.

## Inspiration
- **Styles liked:** Terminal-native, instrument-grade (implicit from personality choice)
- **Styles to avoid:** Consumer-VPN polish, Web3 / crypto-bro aesthetics, doom-prepper / militant, lifeless academic dryness
- **Existing assets:** None (no logo, fonts, or color tokens in the repo today)

## Constraints
- **Timeline:** None specified — green field
- **Budget:** OSS, no budget
- **Must-haves:** None declared beyond staying consistent with the instrument-grade, terminal-native direction
- **Non-negotiables:** Brand must not drift into any of the declared anti-directions (consumer-VPN polish, Web3, doom-prepper, lifeless academic)

## Goals
- **Business goal:** Attract protocol-literate contributors and first serious users (researchers, homelabbers who overlap with the mesh research community)
- **Brand goal:** Establish PIM as the readable, rigorous proximity-mesh project — the one whose docs and protocol you can actually trust
- **Success metrics:** Contributor quality (not quantity), citations in protocol/research contexts, adoption in mesh-research communities

## Deliverables
- [ ] Discovery & research
- [ ] Brand strategy & voice
- [ ] Visual identity
- [ ] Design system

## Notes
- Primary surface assumption: documentation site + GitHub README + CLI output. No consumer mobile app in scope.
- CLI visual language (banner art, status output styling) is a secondary but real brand surface — worth designing intentionally rather than accidentally.
- The persona (Mira) prefers tools that respect her literacy; voice should never over-explain networking basics.
