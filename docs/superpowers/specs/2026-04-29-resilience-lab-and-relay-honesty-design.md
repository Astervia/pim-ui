# Resilience Lab & Relay Honesty — Design Spec

**Status:** Draft, awaiting Pedro's approval
**Author:** Pedro (com Claude)
**Date:** 2026-04-29
**Linked phase (proposed):** `Phase 6 — Resilience Lab & Relay Honesty`
**Trigger:** Conversa com Ruy (UFSC), 2026-04-29

---

## 1. Origem do trabalho

> **Ruy:** "agora o que tem pra fazer do pim?"
> **Ruy:** "Testar com computadores e resiliência. 1) eu uso meu desktop com bluetooth gateway. 2) meu laptop como client e relay. 3) você usa o seu PC como client."
> **Ruy:** "outra coisa: a gente tem que fazer as configurações default do pim ui serem Client + Relay."
> **Ruy:** "porque não adianta nada ter um monte de client sem relay com poucos gateways."
> **Pedro:** "monte um plano muito bom e estruturado, com código bem feito, pesquisado, embasado e com testes para garantir que funcionam."

Dois pedidos distintos que se reforçam:

1. **Validação tri-node em hardware real** (não Docker) — exercitar o caminho `client → relay → BT-gateway → internet` ponta-a-ponta, em três máquinas físicas distintas com mecanismo de transporte misto (LAN + BT-PAN).
2. **Garantir que a UI nunca permita uma rede degenerada** — onde a maioria dos nós é `client` puro (`0x01`) e a malha não tem capacidade de forwarding.

---

## 2. Estado do código hoje (research)

### 2.1 Capabilities no kernel `pim-daemon`

`crates/pim-daemon/src/runtime_config.rs:200`:

```rust
pub(crate) fn node_capabilities(config: &Config) -> NodeCapabilities {
    if config.gateway.enabled {
        NodeCapabilities::gateway()    // 0x07 = CLIENT | RELAY | GATEWAY
    } else if config.relay.enabled {
        NodeCapabilities::relay()      // 0x03 = CLIENT | RELAY
    } else {
        NodeCapabilities::client()     // 0x01 = CLIENT only
    }
}
```

A hierarquia é exclusiva e ordenada — `gateway` implica `relay` implica `client`. Não existe combinação `client+gateway` sem `relay`.

### 2.2 Default config gerado pelo `pim-ui`

`src-tauri/src/daemon/default_config.rs:280` — Phase 01.1, atual:

```rust
push_line(&mut out, "[relay]");
// ...
push_line(&mut out, "enabled = true");   // ← hardcoded, ambos os Roles
```

Os testes Rust já asseguram esse comportamento (`render_join_the_mesh_relay_plus_client`, linha 584).
Conclusão: **o default técnico de capability já é `client+relay` (0x03)** — o `Role::JoinTheMesh` do first-run nunca produz um `client-only`. Só `[gateway]` é flipped por escolha do usuário.

### 2.3 O que a UI não faz hoje

| Lacuna | Evidência |
|---|---|
| First-run não diz que o usuário vai forward para outros | `src/screens/first-run.tsx` rotula a opção como "Join the mesh" sem explicar que isso significa `relay` |
| Simple-mode esconde a contribuição do nó | `src/screens/simple-mode.tsx` mostra "you're connected", nunca "you are forwarding for N peers" |
| `RelaySection` permite virar client-only sem aviso | `src/components/settings/sections/relay-section.tsx:117` — `Switch` simples, sem confirm dialog destrutivo |
| Dashboard não tem painel de "relay contribution" | Logs e route-table são abstratos demais para Aria |
| Sem runbook tri-node, sem script harness | `scripts/` só tem `audit-copy.mjs`, `fetch-daemon.sh`, `sync-brand.sh` |
| BT-gateway (NAP server) já está expressível mas nunca foi UATado | `bluetooth-section.tsx:488` tem o toggle `serve_nap`; nunca exercitado em hardware real |

### 2.4 O que o kernel já oferece para teste multi-hop

O kernel tem 18 docker-compose files cobrindo phase1..phase8 (`docker/compose/phase2-relay.yml` é um lab `client → relay → gateway` de 3 nós com criptografia, payload de 10 KB, helpers `assert_ping`/`assert_curl`/`enable_mesh_route` em `docker/common.sh`).

**Mas:** todos os testes do kernel rodam em containers Linux, com `tcp` sintético e BT mockado. Nenhum exercita:

- A combinação real `BT-PAN (Linux NAP server) + LAN-TCP` num gateway desktop com hardware nativo.
- O fluxo end-to-end **incluindo a UI** (config edit via RPC, peer pair via simple-mode, kill-switch banner ao perder gateway).
- macOS e Windows como clients, que é o que vai acontecer no nosso lab (Pedro tem laptop macOS).

Então não dá para reutilizar 1:1 — vamos consumir o kernel via binário pré-compilado (já é o que o `pim-ui` faz em produção via `tauri bundle` sidecar) e construir um harness próprio em cima.

---

## 3. Princípios de design

1. **Não tocar no `default_config.rs`** — ele já está correto; mudar dali corre risco de quebrar Phase 01.1 (4 plans completos, batch UAT pendente). A solução é UI/copy, não regenerar config.
2. **Honestidade > escondimento** — a UX-PLAN §1 diz "no abstracts packets into a happy green dot". Não vamos criar telas falsamente otimistas; vamos mostrar quando o nó está e quando NÃO está contribuindo.
3. **Reusar o que existe** — `bluetooth-section.tsx` já tem `serve_nap`; o `gateway-section.tsx` já tem preflight; `route.table` RPC já dá `via`. Falta integrar, não construir do zero.
4. **Lab tri-node = primeiro UAT real cross-OS** — para o batch milestone-end mencionado em `README.md:38`. Esse plano fecha o batch ao invés de adicionar mais débito.
5. **Tests are non-negotiable** — Rust unit + Vitest unit + um script de UAT executável (`scripts/lab-tri-node.sh`) que produz output diff-able para o runbook.

---

## 4. Architecture (alto nível)

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 6 — Resilience Lab & Relay Honesty                     │
│                                                              │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│ │ 06-01        │  │ 06-02        │  │ 06-03        │        │
│ │ Lock-in copy │  │ Surface role │  │ BT-gateway   │        │
│ │ + confirm    │  │ contribution │  │ UAT path     │        │
│ │ dialog       │  │ panel        │  │ (NAP server) │        │
│ └─────┬────────┘  └─────┬────────┘  └─────┬────────┘        │
│       │                 │                 │                  │
│       └─────────────────┴────────┬────────┘                 │
│                                  │                          │
│                          ┌───────▼────────┐                 │
│                          │ 06-04          │                 │
│                          │ Lab harness +  │                 │
│                          │ runbook        │                 │
│                          │ (tri-node)     │                 │
│                          └───────┬────────┘                 │
│                                  │                          │
│                          ┌───────▼────────┐                 │
│                          │ 06-05          │                 │
│                          │ Tests          │                 │
│                          │ (Rust + Vitest │                 │
│                          │  + integration)│                 │
│                          └───────┬────────┘                 │
│                                  │                          │
│                          ┌───────▼────────┐                 │
│                          │ 06-06          │                 │
│                          │ UAT walkthrough│                 │
│                          │ (Ruy + Pedro + │                 │
│                          │  partner) +    │                 │
│                          │ findings sweep │                 │
│                          └────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

Plan 06-01..03 são paralelizáveis. 04 depende deles. 05 depende de 04 (precisa do harness). 06 fecha o ciclo.

---

## 5. Sub-plans

### Plan 06-01 — Lock-in copy + confirm dialog para `relay = false`

**Goal:** Tornar impossível ao usuário ficar `client-only` (0x01) sem ter visto, lido e confirmado o trade-off explicitamente.

**Touchpoints:**

| Arquivo | Mudança |
|---|---|
| `src/screens/first-run.tsx` | Substituir label "Join the mesh" por "Join + relay (recommended)". Subtítulo: "Your device forwards traffic for nearby peers. The mesh needs relays to work — without them, only direct neighbors can reach gateways." |
| `src/components/settings/sections/relay-section.tsx` | Quando `field.value === true` e usuário tenta flipar para `false`, abrir `<AlertDialog>` (já instalado em Phase 3) com copy: `"Run as client only? You won't forward traffic for other peers. The mesh gets weaker the fewer relays it has — if every peer does this, only direct neighbors reach gateways. Reason for opting out:" [text input opcional, logged em debug snapshot]` |
| `docs/COPY.md` | Adicionar entry "relay-off-confirm" na voice contract |
| `scripts/audit-copy.mjs` | Verificar que a copy do confirm não usa exclamação e nomeia "client only (0x01)" + "relay + client (0x03)" explicitamente — o brand é "honest, no exclamation, primitives explicit" |

**Não muda:** o default no `default_config.rs`, o `[relay].enabled = true` continua hardcoded e os testes existentes (`render_join_the_mesh_relay_plus_client`) seguem passando.

**Saída visível:** o usuário comum nunca vira client-only; o usuário power que precisa (laptop com bateria fraca, fone de ouvido, debugging) consegue, mas com fricção proporcional ao impacto na rede.

**Estimativa:** 2 SCs verificáveis, ~120 LoC TSX, ~60 LoC docs/COPY.md updates.

---

### Plan 06-02 — Surface "you are a relay" no Dashboard + simple-mode

**Goal:** Tornar a contribuição do nó visível em ambos os shells, com dados reais do RPC `status` (campos `stats.packets_forwarded`, `stats.bytes_forwarded`, `stats.peers_via_me` se exposto pelo daemon).

**Touchpoints:**

| Arquivo | Mudança |
|---|---|
| `src/components/dashboard/relay-contribution-panel.tsx` *(novo)* | Painel que renderiza, quando `status.role.includes("relay")`: título "RELAY · forwarding", linhas `packets_forwarded`, `bytes_forwarded`, `peers via this node` (lê `route.table` e filtra `via === local node_id`), e `last_forward_at`. |
| `src/screens/dashboard.tsx` | Adicionar `<RelayContributionPanel />` na grid principal (entre `MetricsPanel` e `NearbyPanel`). |
| `src/screens/simple-mode.tsx` | Quando `view.kind === "connected"`, adicionar uma única linha discreta abaixo do `SimplePeerCard`: `you're a relay · helping {N} nearby` quando N > 0, ou `you're a relay · ready to help` quando N === 0 e `status.role.includes("relay")`. |
| `src/lib/rpc-types.ts` | Adicionar campo opcional `peers_via_me?: number` em `Stats` (TBD-RPC se kernel ainda não expõe — fallback `null` + fonte `route.table`). |
| `src/hooks/use-relay-contribution.ts` *(novo)* | Hook que combina `status.stats` + `route.table` e devolve `{ active: boolean, peersViaMe: number, packetsForwarded: number, bytesForwarded: number }`. Reusa o channel single-listener (W1 invariant). |

**Não muda:** o número de `listen()` calls (W1 invariant — o hook lê dos atoms que já fazem subscribe).

**Saída visível:** quem ligou pim e ficou só "client" (porque escolheu opt-out em 06-01) vê uma frase neutra, "client only · not forwarding" — também honesto.

**Estimativa:** 1 componente novo, 1 hook novo, ~200 LoC TSX, 5 testes Vitest novos.

---

### Plan 06-03 — BT-gateway UAT path (NAP server end-to-end)

**Goal:** Garantir que Ruy consegue ligar `[bluetooth].serve_nap = true` no desktop Linux dele e ter o macOS do Pedro pareando + recebendo IP via BT-PAN, com tudo funcionando pela UI (sem editar TOML manualmente).

**Touchpoints:**

| Arquivo | Mudança |
|---|---|
| `src/components/settings/sections/bluetooth-section.tsx` | Adicionar preflight inline para `serve_nap`: detectar se `bridge-utils`/`dnsmasq`/`bnep` estão disponíveis (via Tauri command novo `bt_nap_preflight`); render fail+detail per check (mesmo padrão do `gateway-section`). |
| `src-tauri/src/rpc/commands.rs` | Adicionar `bt_nap_preflight` command que checa `which bt-network`, `which dnsmasq`, `bridge-utils`, `bnep` module, retorna `BtNapPreflight { supported, checks: Vec<Check> }`. |
| `src/screens/dashboard.tsx` | Quando `[bluetooth].serve_nap === true`, badge "BT-NAP · {N} paired" no status header (lê `bluetooth.nap_clients` se RPC expuser, fallback contagem de peers com `transport === "bluetooth"`). |
| `docs/RESILIENCE-LAB.md` *(novo)* §3 | Passo a passo BT pareamento: macOS → System Settings → Bluetooth → Connect to "PIM-{ruy-desktop}"; expected: aparece em `peers.discovered` com `mechanism: "bluetooth"` em ≤ 30 s. |

**Não muda:** o kernel (já suporta `bt-network -s nap`).

**Risco:** TCC do macOS pode bloquear inquiry mesmo com pareamento manual. Documentar como troubleshooting esperado, não como bloqueador.

**Estimativa:** 1 Tauri command novo + 1 fieldset com preflight + 1 badge + ~150 linhas de runbook.

---

### Plan 06-04 — Lab harness `scripts/lab-tri-node.sh` + runbook

**Goal:** Um único script que, dado três hosts (com socket/RPC acessível ou via SSH), gera o relatório de saúde da malha tri-node, executa pings entre todos e reporta diff-able.

**Touchpoints:**

| Arquivo | Mudança |
|---|---|
| `scripts/lab-tri-node.sh` *(novo)* | Bash que aceita 3 args: `desktop_host laptop_host pc_host`, conecta via SSH ou usa socket local, faz: 1) `rpc.hello` em cada um; 2) lê `status.role` e valida (gateway/relay+client/client+relay); 3) `peers.list` em cada um e checa que todos veem todos; 4) `route.table` em cada um e checa que cliente alcança gateway com `hops` esperado; 5) ping ICMP entre `mesh_ip`s; 6) `curl http://example.com` no cliente via gateway. Output: tabela markdown mais um JSON snapshot em `lab-tri-node-run-{timestamp}.json`. |
| `scripts/lab-tri-node.helpers.sh` *(novo)* | Funções shared: `rpc_call <host> <method> <params>` (newline-JSON sobre Unix socket via `socat`/`nc`), `assert_role`, `assert_peer_seen`, `assert_route_hop_count`. |
| `docs/RESILIENCE-LAB.md` *(novo)* | Doc completo: pré-requisitos hardware (BT controller no desktop, Wi-Fi compartilhada), topologia desejada, passo de bring-up de cada nó, como rodar `lab-tri-node.sh`, como interpretar saída, troubleshooting. |
| `.planning/phases/06-resilience-lab-and-relay-honesty/HUMAN-UAT.md` *(novo)* | Checklist de 12 itens para o batch UAT — pareia com critérios de sucesso de Phase 6. |

**Comportamento esperado da matriz:**

```
                  desktop(GW+BT)   laptop(R+C)    pc(C)
desktop(GW+BT)        —              ping ✓        ping ✓ via laptop
laptop(R+C)         ping ✓           —             ping ✓
pc(C)            ping ✓ via laptop  ping ✓         —

internet via mesh:
  laptop  → desktop (1 hop)        ✓
  pc      → laptop → desktop (2 hops)  ✓
```

**Não muda:** binário do daemon. Só consome RPC público.

**Estimativa:** ~400 linhas de bash, ~250 linhas de markdown.

---

### Plan 06-05 — Tests (Rust + Vitest + integration)

**Goal:** Prevenir regressão silenciosa em qualquer um dos pontos de honestidade do role + cobertura do harness.

**Vitest (frontend):**

| Arquivo | Caso |
|---|---|
| `src/components/settings/sections/relay-section.test.tsx` | (1) abre dialog ao tentar flipar para `false`; (2) Cancel mantém `true`; (3) Confirm escreve `false` via `useSectionSave`; (4) reabre e mostra ainda `false` (após reload do hook). |
| `src/components/dashboard/relay-contribution-panel.test.tsx` | (1) renderiza nada se `status.role` não incluir `"relay"`; (2) renderiza counters quando inclui; (3) calcula `peersViaMe` corretamente de uma fixture de `route.table`. |
| `src/screens/simple-mode.test.tsx` | (1) view `connected` mostra a linha "you're a relay · helping N" quando role inclui relay; (2) não mostra quando não inclui. |
| `src/hooks/use-relay-contribution.test.ts` | Lê de fixture do atom + mock route table, retorna shape correto. |

**Rust unit (backend):**

| Arquivo | Caso |
|---|---|
| `src-tauri/src/daemon/default_config.rs` (existente) | Adicionar `render_share_my_internet_still_relay_true` e `render_join_the_mesh_relay_explicit` — assertam que a combinação `relay+gateway` nunca regride para `client-only` mesmo se alguém futuramente tentar otimizar o template. |
| `src-tauri/src/rpc/commands.rs` | `bt_nap_preflight_returns_unsupported_on_macos` (cfg-gated), `bt_nap_preflight_detects_missing_bridge_utils_on_linux` (mocked PATH). |

**Integration (executável manual ou em CI Linux):**

| Comando | Verifica |
|---|---|
| `bash scripts/lab-tri-node.sh --self-test` | Roda 3 daemons em loopback (nat namespaces?), valida que o script reporta a matriz esperada. **Não-bloqueante** em macOS — o self-test falha cedo com diagnostic claro. |
| `pnpm test` | Vitest suite completa. Adicionar a `package.json` script "test": "vitest run". |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust suite completa. |

**Não-tests:** UAT real é Plan 06-06; testes aqui são unit + integration de software.

**Estimativa:** ~30 testes novos, ~800 LoC test code.

---

### Plan 06-06 — UAT walkthrough tri-node + findings sweep

**Goal:** Executar o `lab-tri-node.sh` em hardware real (Ruy desktop Linux + Pedro laptop macOS + parceiro PC) e fechar o batch UAT do milestone v0.1.

**Pré-requisitos:**

1. Plans 06-01..05 mergeados.
2. `pim-daemon` binário Linux + macOS pré-build em mãos (Ruy compila do `proximity-internet-mesh`).
3. Pareamento BT manual já feito antes do dia da sessão.

**Roteiro (≤ 90 minutos):**

| Bloco | Tempo | O que validar |
|---|---|---|
| Bring-up 3 nós | 20 min | Cada um abre `pim-ui`, completa first-run, escolhe role correto (Ruy=Share my internet + serve_nap; Pedro=Join the mesh; partner=Join the mesh + opta por client-only via dialog para testar 06-01) |
| Mesh discovery | 10 min | Cada UI mostra os outros dois em `Nearby — not yet paired` ou `Peers`; transports honestos (laptop tem BT? mostra "bluetooth"; partner sem BT mostra "tcp") |
| Pair + route on | 15 min | Pedro pares com Ruy via BT, partner pares com Pedro via LAN; ambos ativam "Route internet via mesh"; dashboard mostra "Routing through {ruy-node} (via {pedro-node})" para o partner |
| Saúde da malha | 10 min | Rodar `lab-tri-node.sh`; toda matriz `✓`; relay panel do Pedro mostra `peers_via_me >= 1` |
| Resiliência: gateway gone | 10 min | Ruy mata daemon; partner deve ver kill-switch banner em ≤ 5 s; Pedro deve ver gateway perdido; contagem volta após reinício |
| Resiliência: relay gone | 10 min | Pedro mata daemon (com Ruy ainda up); partner deve perder rota mas — se vir Ruy direto via LAN — re-routear, ou kill-switch caso contrário |
| Findings + sweep | 15 min | Anotar cada gap encontrado; abrir issues; bater com `HUMAN-UAT.md` checkboxes; gerar relatório markdown |

**Saída:** `docs/RESILIENCE-LAB-2026-04-XX-RUN.md` com (a) screenshots por bloco, (b) `lab-tri-node.json` snapshot, (c) checklist final, (d) lista de bugs encontrados. Esse documento dispara `/gsd:complete-milestone` para v0.1.

---

## 6. Test strategy (consolidado)

| Camada | Ferramenta | Cobertura |
|---|---|---|
| Rust unit | `cargo test` | `default_config` invariants, `bt_nap_preflight` per-platform |
| TS unit | Vitest (novo — adicionar em Plan 06-01 setup) | `relay-section` confirm flow, `RelayContributionPanel`, simple-mode role line, `use-relay-contribution` |
| TS integration | Vitest + RPC mock (novo) | end-to-end fluxo: bootstrap → status reporta role → painel renderiza |
| Bash integration | `lab-tri-node.sh --self-test` | RPC client local (3 daemons em loopback), valida output diff-able |
| UAT manual | `HUMAN-UAT.md` checklist (12 itens) | Plan 06-06 walkthrough |
| Brand voice | `audit-copy.mjs` (existente) | Confirma copy do dialog 06-01 e do painel 06-02 |
| W1 invariant | `grep -c "listen(" src/hooks/use-daemon-state.ts === 2` | Plan 06-02 não pode adicionar nova subscrição |

**Sem flaky:** o self-test do harness usa namespaces network locais (Linux only). Em macOS, o self-test falha cedo com `lab-tri-node.sh requires Linux network namespaces; run on a Linux host or skip with --skip-self-test for full hardware UAT only.` Honesto, sem mock fingindo passar.

---

## 7. Cronograma + dependências

```
Day 1  ────  Plan 06-01 (lock-in copy)        ┐
       ────  Plan 06-02 (relay panel)         ├── paralelo
       ────  Plan 06-03 (BT NAP preflight)    ┘
Day 2  ────  Plan 06-04 (harness + runbook)
Day 3  ────  Plan 06-05 (tests + Vitest setup)
Day 4  ────  Plan 06-06 (UAT walkthrough com Ruy)
Day 4+ ────  /gsd:complete-milestone v0.1
```

Sem blockers do kernel — o `proximity-internet-mesh` já tem tudo que precisamos (capabilities flags, `route.table`, `bt-network -s nap`, `peers.discovered`). Se o kernel expuser `peers_via_me` no `stats` futuramente, o Plan 06-02 tem `TBD-RPC-FALLBACK` documentado.

---

## 8. Open questions (a decidir antes de começar)

1. **Vitest setup:** o repo não tem TS test runner. Plan 06-01 ou 06-05 instala? **Sugestão:** 06-05 instala (mais coerente — tests dão suporte a tudo).
2. **`peers_via_me`:** vamos calcular sempre via `route.table` filter (`via === local_node_id`) ou pedir ao kernel maintainer um campo novo? **Sugestão:** começar com cálculo client-side; se métricas divergirem do daemon em algum cenário, abrir issue no kernel.
3. **Confirm dialog em 06-01:** texto exato "client only (0x01)" pode ser jargão demais para Aria. **Sugestão:** parafrasear como "client-only mode (less helpful to the mesh)" e deixar `0x01` em tooltip — alinhado com a pirâmide de divulgação da `UX-PLAN.md`.
4. **Self-test do harness em macOS:** vale a pena pagar o custo de portar para Multipass/Lima? **Sugestão:** não nessa fase — o harness existe para Linux + uso real cross-platform; macOS users rodam o UAT manual.

---

## 9. Não-objetivos (NÃO vamos fazer agora)

- Mudar `default_config.rs` (já está correto).
- Reescrever `bluetooth-section.tsx` (já tem `serve_nap` toggle).
- Implementar Wi-Fi Direct testing (Plan 06-03 só cobre BT-PAN — WFD é outra fase).
- Suporte a Windows como gateway (kernel não suporta — already out of scope per `PROJECT.md:51`).
- Container/Docker support do `pim-ui` (fora de escopo — UI é Tauri-bundle, não containerizada).
- Mock daemon server completo (Plan 06-05 usa mocks só nos testes Vitest; UAT real usa daemon real).

---

## 10. Como verificamos sucesso

Phase 6 está completa quando:

1. ✅ Os 4 SCs do Plan 06-01..03 passam Vitest + Rust tests.
2. ✅ `bash scripts/lab-tri-node.sh --self-test` retorna 0 num host Linux.
3. ✅ `HUMAN-UAT.md` (12 itens) está 100% checked.
4. ✅ `docs/RESILIENCE-LAB-2026-XX-XX-RUN.md` existe, tem screenshots, e descreve uma sessão de pelo menos 1 hora real com 3 hosts.
5. ✅ Cada bug encontrado virou issue (independent de fix nesta fase).
6. ✅ `/gsd:complete-milestone v0.1` foi disparado e arquivou o milestone.

---

## 11. Anexo — referências de research

- Kernel `pim-daemon`:
  - Capabilities: `proximity-internet-mesh/crates/pim-daemon/src/runtime_config.rs:200`
  - Default config schema: `proximity-internet-mesh/crates/pim-core/src/config/model.rs:299`
  - RPC contract: `proximity-internet-mesh/crates/pim-daemon/src/rpc.rs:317` (13 métodos: `rpc.hello`, `status`, `status.subscribe`, `peers.list`, `peers.discovered`, `peers.add_static`, `peers.remove`, `route.table`, `route.set_split_default`, `gateway.status`, `gateway.preflight`, `config.get`, `config.save`, `logs.subscribe`)
  - Multi-hop test fixtures: `proximity-internet-mesh/docker/compose/phase2-relay.yml`, `phase5-multigateway.yml`
  - Test helpers: `proximity-internet-mesh/docker/common.sh`
  - BT implementation: `proximity-internet-mesh/crates/pim-bluetooth/src/lib.rs`
- pim-ui:
  - Default config render: `src-tauri/src/daemon/default_config.rs:280`
  - First-run role picker: `src/screens/first-run.tsx`
  - Settings sections: `src/components/settings/sections/{relay,bluetooth,gateway}-section.tsx`
  - Simple-mode shell: `src/screens/simple-mode.tsx`
  - W1 invariant: `src/hooks/use-daemon-state.ts` (exatos 2 `listen()` calls)
  - UX principles: `docs/UX-PLAN.md` §1
  - Brand voice: `docs/COPY.md`
- Project state:
  - Milestone v0.1 status: `README.md:38-43`
  - Roadmap tracker: `.planning/ROADMAP.md`
  - Decisions log: `.planning/PROJECT.md:90-99`

---

*Spec criada via `superpowers:brainstorming` em 2026-04-29. Próximo passo: aprovação do Pedro → `superpowers:writing-plans` por sub-plan, ou conversão para `.planning/phases/06-…/` no fluxo GSD do projeto.*
