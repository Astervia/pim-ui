# Brief rápido — pim-ui

Construindo a UI desktop + mobile do pim (Tauri 2 + React). Brand + scaffold prontos. Preciso tuas respostas pra seguir:

**v0.1 crítico:**
1. Daemon↔UI via **JSON-RPC num Unix socket** com métodos `status`, `peers.list/add/remove/discovered`, `route.set_split_default/table`, `gateway.enable/disable`, `config.get/save`, `logs.stream` — ok, ou prefere outro transport (HTTP local / CLI `--json` / gRPC)?
2. Se o raw TOML editor salvar algo não representável no GUI form (ex: comentários), aceitar com banner "raw é source of truth" — ok?

**v0.3:**
3. Default macOS: abrir **janela** no first-run + menu bar também disponível — ok, ou menu-bar-first?
4. `pim://invite/...` link — fallback page pra quem não tem pim instalado: em qual domínio (tem algum pra Astervia/pim)?

**v0.5 (mobile):**
5. Mobile = **companion** (app conecta em daemon remoto rodando num laptop/relay) ou vale já tentar **full-node** (daemon embedado via VpnService Android + NetworkExtension iOS, exige Apple Developer + aprovação)?

**Podem esperar mas queria direção:**
6. Backup de identidade: **sem backup default** (Briar model — perdeu device = re-pair), com export opcional pra quem quer — ok?
7. Auto-trust entre devices da mesma pessoa (laptop + celular + servidor caseiro) — ignorar no v1 e tratar como peers normais, ok?
8. Gateway caiu e daemon fez failover automático pro próximo: **silent** (só atualiza dashboard), **toast in-app**, ou **system notification**?
9. System notification só em eventos críticos (**all gateways lost / kill-switch ativo**) e o resto silent — ok?

**Workflow:**
10. Posso escrever `docs/RPC.md` no kernel repo como rascunho e mandar PR pra você revisar?

Responde só número + resposta curta, ex: `1: ok / 2: ok / 3: prefiro menu-bar / 4: use invite.pim.xyz / ...`
