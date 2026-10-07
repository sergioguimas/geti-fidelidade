# 05 — Revisão de bugs · 07/out/2026

Revisão do código no estado do commit `e272da8` ("Implementa provisionamento do tenant…"),
com foco na **criação de novos tenants** e em defeitos do que já é entregue. Novas features
ficaram de fora de propósito.

**Como foi feito:** leitura de `src/` e das migrations versionadas
(`supabase/migrations/*`, baseline de 08/set), e depois **consultas só de leitura no banco de
produção** (projeto Supabase "Fidelidade") — ver [seção 0](#0-verificação-em-produção--07out2026).
O build não foi rodado (sem `node_modules`). Itens marcados *"confirmar"* dependem de teste em tela.

Numeração: `T*` = criação de tenant, `S*` = continua a série do
[03-defeitos-e-riscos.md](03-defeitos-e-riscos.md), `C*` = vendas, `A*` = painel admin.

---

## Resumo executivo

O provisionamento de 08/set resolveu o pior (tenant nascia sem programa), mas o fluxo de
criação **ainda não entrega um tenant que o lojista consiga configurar e que o admin consiga
acompanhar**:

| # | Gravidade | Em uma frase |
|---|---|---|
| **P1** | 🔴 Crítico | O lojista **AR E-UTIL**, criado em 08/set, está **sem programa** em produção e o dono nunca conseguiu entrar |
| **P2** | 🟡 Médio | Conta de teste (`teste@empresa.com`) é **owner do piloto Eminex**; "Loja Teste" não tem nenhum usuário |
| **T1** | 🔴 Alto | Um tenant novo **nunca consegue ter mais de um nível**: a validação de cobertura recusa qualquer passo intermediário |
| **T2** | 🔴 Alto | Falha do N8N (404/500) é contada como "enviado por WhatsApp" e o e-mail de reserva **não sai** |
| **T3** | 🔴 Alto | Falha do e-mail do Supabase (rate limit, SMTP) é contada como "enviado por e-mail" |
| **T5** | 🔴 Alto | Botão **bloquear/ativar lojista** chama uma rota que não existe |
| **S15** | 🔴 Alto | Qualquer usuário logado (inclusive cliente final) ainda executa `fn_registrar_movimentacao_pontos` e `fn_expirar_lotes`, que são `SECURITY DEFINER` |
| **S11** | 🔴 Crítico (já conhecido, aberto) | Teto de produto 0 pontua o máximo — e o formulário de produto grava 0 quando o campo fica **vazio** |
| T4, T6–T11, C1–C2, A1–A3 | 🟡 Médio/Baixo | Detalhes abaixo |

A recomendação é resolver **P1 hoje** (um SQL e um reenvio) e depois uma
**rodada curta de correções (≈ 2–3 dias)** — seção
[Plano de ação](#plano-de-ação) — antes de criar o próximo lojista pelo portal.

---

## 0. Verificação em produção — 07/out/2026

Consultas só de leitura. Nada foi alterado no banco.

**Schema em dia com o repositório:** as três migrations versionadas estão aplicadas, e os
corpos de `fn_processar_compra`, `fn_nivel_por_streak` e `fn_rebuild_cliente_fidelidade`
batem com o que está no repo (com o fallback do S12 e ainda com o bug do teto 0 do S11).

### P1 · 🔴 Crítico · NOVO · Existe um tenant inoperante em produção agora

> **Backfill aplicado em 07/out/2026** (autorizado pelo Sérgio): programa `c747c29c` e nível
> `Padrão [1, ∞)` `b9b3bf4e`. Verificado: `fn_programa_ativo` devolve o programa e
> `fn_nivel_por_streak` devolve "Padrão" para streak 1 e 99. **Falta** reenviar o convite e
> confirmar que o dono conseguiu entrar.

| Lojista | Criado em | Programa | Dono | Situação |
|---|---|---|---|---|
| **AR E-UTIL TECNOLOGIA E SEGURANCA** (`f3a4841b`) | 08/set 15:05 (BRT) | **nenhum** | `victor@areutil.com.br` | **nunca entrou** |

Ele foi criado **uma hora antes** do commit que passou a provisionar programa e nível
(`e272da8`, 08/set 18:06 BRT). Portanto está exatamente no estado do S13: tela de configuração
vazia e sem saída, e a primeira venda falha em `fn_programa_ativo`. Além disso, o dono tem
`recovery_sent_at` um minuto depois da criação e nunca fez login — é o padrão do código
antigo (link do WhatsApp morto pelo e-mail logo em seguida). Ele provavelmente nunca teve um
link válido nas mãos.

**Correção (hoje, antes de qualquer outra coisa):** backfill do programa e reenvio do convite.

```sql
-- Provisiona o tenant criado antes do e272da8. Mesmos valores de src/contracts/acesso.ts.
with p as (
  insert into public.programas_fidelidade (lojista_id, nome, dias_expiracao_pontos, dias_para_perder_streak, ativo)
  values ('f3a4841b-0e5a-452d-ab15-b5219816cc28', 'Programa de Fidelidade', 180, 45, true)
  returning id
)
insert into public.programa_niveis (programa_id, nome, streak_min, streak_max, percentual_conversao, teto_pontos_compra, ordem)
select id, 'Padrão', 1, null, 1.00, 0, 1 from p;
```

Depois, usar **Reenviar convite** no portal — de preferência já com T2/T3 corrigidos, para
saber se o link saiu de fato.

### P2 · 🟡 Médio · NOVO · Conta de teste é dona do lojista piloto

> **Decisão em 07/out/2026:** a conta fica no Eminex por enquanto — o Sérgio usa para acompanhar
> o cliente. Reavaliar quando houver papel de acompanhamento (somente leitura) ou acesso admin
> ao painel do lojista.

- `teste@empresa.com` tem vínculo **owner** em **Eminex** (o piloto, 125 clientes, 426
  vendas), com último login em 08/set. É uma conta de teste com acesso total a dados reais.
- O lojista **Loja Teste** (`9f69ff2a`) não tem **nenhum** usuário vinculado: é um tenant
  órfão, que ninguém consegue operar.

**Correção:** decidir se a conta de teste deve sair do Eminex (provável) e se Loja Teste deve
ser desativada. Como `lojistas_usuarios.auth_user_id` é único, a conta de teste só pode estar
em um lojista — hoje ela está no errado.

### O que o banco confirmou, corrigiu ou dimensionou

| Item | Resultado em produção | Efeito no relatório |
|---|---|---|
| **S15** | Confirmado. `authenticated` executa todas as funções do schema; o *Security Advisor* do Supabase aponta as 6 `SECURITY DEFINER` (lint `0029`) | Mantido como Alto |
| **S5 / T8** | **Corrige o doc 03:** existe job no `pg_cron` — `expirar-lotes-fidelidade-diario`, 02:00 UTC, 215 execuções com sucesso, a última hoje. A expiração está morta **só** porque `validade_dias` é nulo nos 3 programas | Ligar `validade_dias` passa a **ligar a expiração de verdade no dia seguinte**. Não fazer sem decidir a D2 |
| **Streak** | Eminex configurou `dias_para_perder_streak = 60`; o motor usa 30 fixo. Os clientes do piloto perdem o streak na metade do prazo que a tela mostra | Reforça T8 |
| **S11** | 2 produtos ativos com teto 0 (os mesmos de setembro) | Sem mudança |
| **S3** | 428 lotes de 0 pontos em 1.220 | Continua crescendo, ~1 por venda |
| **S4** | 0 clientes com saldo negativo, 0 linhas em `ajustes_pontos` | Ainda não causou dano |
| **S7** | 0 resgates | Sem mudança |
| **C1** | 0 compras sem itens | Ainda não aconteceu |
| **A1** | Nenhum cliente criado pela tela do lojista desde maio tem CNPJ, então o caminho nunca foi exercido; os 2 clientes com login são de teste, de março | Continua *"confirmar"* |
| **A2** | 10 usuários no Auth | Rebaixado: só morde depois de 50 |

### P3 · 🟡 Médio · NOVO · Qualidade do cadastro de clientes

- **28 clientes** criados desde maio **sem nenhum documento** (`cnpj` e `documento` nulos).
  O formulário do lojista só tem o campo "CNPJ", opcional; quem compra como pessoa física fica
  sem documento. Sem documento não há deduplicação entre lojistas, e o cliente **nunca poderá
  ter login** (o CHECK `clientes_login_documento_chk` exige documento).
- **17 clientes sem vínculo** com nenhum lojista, todos criados entre 29/abr e 15/jun — a janela
  do bug corrigido em "Correção de RLS ao criar cliente" (15/jun): o cliente global era
  inserido com service role e o vínculo falhava. Invisíveis para todo mundo; podem ser apagados
  depois de conferir que não têm compras.
- Nos 111 clientes que têm documento, `cnpj` e `documento` são iguais — vieram da importação
  de abril.

**Correção:** campo "CPF/CNPJ" (gravando `documento` e `cnpj`), e limpeza dos 17 órfãos. Se
o CPF for obrigatório ou não é decisão de negócio.

### Outros alertas do Security Advisor

- 11 funções com `search_path` mutável (lint `0011`) — corrigir junto com o S1.1, nas mesmas
  funções.
- Proteção contra senha vazada (HaveIBeenPwned) **desligada** no Auth — um clique no painel.
- `resgates`, `resgate_alocacoes` e `ajustes_pontos` com RLS e sem policy (só service role
  acessa) — coerente com o fluxo de resgate ainda não existir.
- 3 admins da plataforma nunca fizeram login (`lucaspeixoto`, `joaoartur.eutil`, `elmer`) —
  conferir se ainda devem ter acesso.

---

## 1. Criação de tenant — ponta a ponta

Fluxo atual: `NovoLojistaDialog` → `POST /api/admin/lojistas` → Auth `createUser` → `lojistas`
→ `lojistas_usuarios` → `programas_fidelidade` → `programa_niveis` (1 nível `[1, ∞)`) →
convite (WhatsApp **ou** e-mail) → `/primeiro-acesso` → painel do lojista.

### T1 · 🔴 Alto · O lojista novo fica preso a um único nível

`src/lib/merchant/configuracoes.ts` valida a invariante de cobertura (que é uma regra do
**conjunto** de faixas) a cada operação de **uma linha**. O tenant nasce com
`Padrão [1, ∞)`, e a partir daí não há sequência de chamadas que chegue em dois níveis:

| Tentativa do lojista | Conjunto validado | Resultado |
|---|---|---|
| Criar `Prata [4, ∞)` | `[1,∞)` + `[4,∞)` | ❌ "2 níveis estão sem limite superior" |
| Criar `Prata [4, 10]` | `[1,∞)` + `[4,10]` | ❌ "O nível sem limite superior precisa ser o de maior faixa" |
| Editar `Padrão` para `[1, 3]` primeiro | `[1,3]` | ❌ "Nenhum nível está sem limite superior" |
| Excluir `Padrão` | `∅` | ❌ "O programa precisa de pelo menos um nível" |

Os dois tenants antigos também caem nisso assim que tentarem adicionar um nível.
A correção do S12 trocou "configuração ruim derruba a venda" por "configuração boa é
impossível de salvar".

**Solução (imediata):** salvar o conjunto inteiro de uma vez.
- Novo `PUT /api/lojista/configuracoes` com `type: "niveis"` recebendo **todas** as faixas;
  valida com `validarCoberturaDeFaixas` e grava numa função `fn_salvar_niveis(programa_id, jsonb)`
  (transação: upsert dos enviados, delete dos ausentes com a mesma checagem de `NIVEL_EM_USO`).
- Alternativa mais barata, se a tela não puder mudar agora: em `createNivel`, quando o nível
  novo for o aberto e tiver `streak_min` maior que o aberto atual, **fechar o anterior**
  (`streak_max = novo.streak_min - 1`) na mesma operação — de preferência numa RPC, para não
  deixar o conjunto inválido se a segunda escrita falhar.

### T2 · 🔴 Alto · Falha do N8N vira "enviado por WhatsApp"

> **✅ Corrigido em 07/out/2026** em `src/lib/admin/convite.ts` (`enviarConvite`), usado pelas duas
> rotas: checa `res.ok`, timeout de 8 s, e só então cai no e-mail. Limite que fica: se o fluxo
> do N8N responder 200 **antes** de enviar, falha posterior do WhatsApp não chega aqui.

`src/app/api/admin/lojistas/route.ts:285` e `reenviar-convite/route.ts:460`:

```ts
await fetch(process.env.N8N_WEBHOOK_WHATSAPP!, { ... });
conviteEnviadoPor = "whatsapp";
```

`fetch` só lança em erro de rede. Webhook desativado no N8N (404 "webhook not registered"),
erro 500 do fluxo ou instância de WhatsApp desconectada respondem normalmente — o código marca
sucesso, **pula o e-mail de reserva**, e o lojista não recebe nada. Também não há timeout: se
o N8N travar, a rota trava junto até o limite da função na Vercel (ver T7).

**Solução:** checar `res.ok` e usar `AbortSignal.timeout(8000)`; só marcar `"whatsapp"` com
2xx. Mesmo ajuste nas duas rotas — vale extrair um `enviarConvite()` compartilhado em
`src/lib/admin/convite.ts`, porque hoje a lógica está duplicada e já divergiu (o reenvio não
devolve o canal).

### T3 · 🔴 Alto · Falha do e-mail vira "enviado por e-mail"

> **✅ Corrigido em 07/out/2026** no mesmo `enviarConvite`: o `{ error }` é checado; sem nenhum
> canal a criação devolve `conviteEnviadoPor: "nenhum"` e o reenvio devolve 502.

`route.ts:311` e `reenviar-convite/route.ts:484`:

```ts
try {
  await supabaseAdmin.auth.resetPasswordForEmail(loginEmail, { redirectTo });
  conviteEnviadoPor = "email";
} catch { ... }
```

O supabase-js **não lança** — devolve `{ error }`. Rate limit, SMTP recusado ou `redirectTo`
fora da allow-list passam como sucesso. Atenção especial: com o SMTP padrão do Supabase o
limite é de poucos e-mails **por hora** para o projeto inteiro; criar 3–4 lojistas seguidos
estoura sem nenhum aviso.

**Solução:** `const { error } = await ...; if (!error) conviteEnviadoPor = "email";` e logar o
erro. Conferir no painel do Supabase se há SMTP próprio configurado e se
`${NEXT_PUBLIC_APP_URL}/primeiro-acesso` está em *Redirect URLs*.

### T4 · 🟡 Médio · O admin nunca fica sabendo que o convite não saiu

> **Parte imediata feita em 07/out/2026:** criação e reenvio mostram o canal real, e a criação
> avisa em vermelho quando o convite não saiu. Continua pendente a coluna de status fictícia.

- `NovoLojistaDialog` ignora `conviteEnviadoPor` e sempre mostra "Lojista criado com sucesso."
  O caso `"nenhum"`, que a rota documenta como "o admin precisa usar o reenvio", é invisível.
- A rota de reenvio não devolve o canal, e a tela marca `ultimo_envio_status: "enviado"`
  incondicionalmente.
- As colunas de status do convite (`convite_enviado_em`, `ativado_em`,
  `ultimo_envio_status`) **não existem no banco**: a tabela mostra "Pendente" para todo mundo,
  e o "Convite enviado" some no próximo refresh. Os cards "ativados" do resumo são sempre 0.

**Solução imediata:** mostrar o canal (ou o alerta "convite não enviado — use Reenviar") no
retorno da criação e do reenvio. A persistência do status (colunas em `lojistas_usuarios`) é
melhoria, pode esperar — mas aí convém esconder a coluna "Status do convite" até lá, para a
tela não afirmar algo falso.

### T5 · 🔴 Alto · Bloquear/ativar lojista não funciona

`admin-lojistas-page.tsx:112` chama `PATCH /api/admin/lojistas/${id}/status`. Essa rota
**não existe** (só existe a equivalente de clientes). O Next responde 404 em HTML, o
`response.json()` estoura e o admin vê um erro de parse. Não há hoje nenhum caminho pelo
portal para bloquear um lojista inadimplente ou criado por engano.

**Solução:** criar `src/app/api/admin/lojistas/[id]/status/route.ts` (molde:
`api/admin/clientes/[id]/status`), com `requireAdminApi` + `createAdminClient` atualizando
`lojistas.ativo`. O middleware e `requireLojistaContext` já respeitam `ativo = false`.

### T6 · 🟡 Médio · E-mail de login já usado vira 500 em inglês

Previsto no contrato (`EMAIL_LOGIN_EM_USO`, armadilha 2) e ainda não feito. Casos reais:
admin repetindo o e-mail, ou um cliente final com login virando lojista. `createUser` devolve
"A user with this email address has already been registered" como HTTP 500.

**Solução:** mapear o erro do `createUser` (`code === "email_exists"` / status 422) para 409
com mensagem em português. Não é preciso consultar antes — o próprio erro basta.

### T7 · 🟡 Médio · Criação não é atômica — e há um caminho real para órfão

A compensação manual não confere o resultado dos próprios `delete`. Além disso há um cenário
concreto: se o envio do convite demorar (N8N lento, T2) e a função da Vercel estourar o tempo,
o admin recebe erro **depois** de lojista, programa e nível já gravados. Ele tenta de novo e
recebe `409 LOJISTA_CNPJ_DUPLICADO` — o tenant existe, mas o convite talvez não.

**Solução:** o timeout do T2 resolve o caso mais provável. A solução completa é o passo 5 do
contrato: `fn_provisionar_lojista(...)` transacional, chamada por service role, deixando de
fora só o `createUser` (compensação única e simples).

### T8 · 🟡 Médio · O programa provisionado promete expiração e streak que o motor ignora

O tenant nasce com `dias_expiracao_pontos = 180` e `dias_para_perder_streak = 45`, e a tela
mostra esses valores. Mas o motor lê `validade_dias` (que fica nulo → ponto nunca expira) e usa
`interval '30 days'` fixo para o streak. É o S5, agora replicado em todo tenant novo — e o
lojista novo é justamente quem vai acreditar no que a tela mostra.

**Solução:** depende da D2. Atenção: em produção **o job de expiração existe e roda todo dia**
(ver seção 0), então preencher `validade_dias` liga a expiração de verdade na madrugada
seguinte — inclusive para os lotes antigos, se for feito backfill de `expira_em`. Enquanto a D2 não fecha,
marcar na tela que expiração e janela de streak "ainda não estão ativas", para não vender
uma regra que não roda.

### T9 · 🟡 Médio · O lojista consegue desligar o próprio programa e travar o tenant

`programa-form.tsx` tem o checkbox "Programa ativo", e `updatePrograma` grava `ativo: false`
sem conferir nada. Depois disso `getConfiguracoes` filtra `ativo = true` e devolve
`programa: null` (tela vazia, sem botão para reativar) e toda venda falha em
`fn_programa_ativo`. É o S13 de volta, agora com um clique.

**Solução:** tirar o checkbox da tela e recusar `ativo: false` em `updatePrograma` (o contrato
já diz que programa desativado/troca de programa está fora de escopo, R4).

### T10 · 🟡 Médio · `/primeiro-acesso` pode trocar a senha da pessoa errada

- Se o link vier inválido/expirado (o GoTrue redireciona com `#error=...&error_code=otp_expired`)
  e o navegador **já tiver uma sessão** — o admin testando o link, ou um computador
  compartilhado —, o formulário aceita e chama `updateUser({ password })` na conta logada.
- `#error=` não é tratado: a pessoa vê a mensagem genérica sem saber que o link expirou.
- Senha mínima ainda é 6, só no cliente (contrato pede 8 nos dois lados).

**Solução imediata:** exigir que a página tenha recebido `access_token` ou `code` naquela
carga (senão, erro "link inválido"); tratar `error_code=otp_expired` com "Seu link expirou,
peça um novo ao suporte"; trocar a validação para `senhaSchema` de `src/contracts/acesso.ts`.
A solução definitiva continua sendo a rota `/auth/confirmar` com `verifyOtp` (S14).

### T11 · 🟢 Baixo · Arestas da rota de criação

- `requireAdminApi` lança `Error` genérico → sessão expirada vira **500** em vez de 401/403.
- `NEXT_PUBLIC_APP_URL` não é validado: se faltar, o link vai como `undefined/primeiro-acesso`
  e o GoTrue cai na Site URL (o token chega em `/login`, que não sabe tratá-lo).
- Corpo validado à mão, sem Zod: e-mail com formato inválido só falha no Auth, em inglês.
- Telefone vai ao N8N só com dígitos e **sem DDI** (`11999999999`). Conferir se o fluxo do N8N
  acrescenta o `55`; se não acrescentar, número digitado sem DDI pode não entregar.

---

## 2. Segurança

### S15 · 🔴 Alto · NOVO · `authenticated` ainda executa funções DEFINER que o app nunca chama

> **Migration preparada em 07/out/2026:** `20261007120000_revoga_funcoes_definer_internas.sql`
> revoga `fn_registrar_movimentacao_pontos`, `fn_expirar_lotes` e `fn_calcular_streak_cliente`.
> **`fn_garantir_cliente_fidelidade` ficou de fora:** o mapa de chamadas em produção mostrou que
> `fn_processar_status_resgate` (INVOKER, chamada pelo app) → `fn_rebuild_cliente_fidelidade`
> (INVOKER) → `fn_garantir_cliente_fidelidade` roda com o papel do usuário. Ela sai junto com o
> S1.1. O SQL sugerido abaixo foi o rascunho anterior a essa checagem.

A migration `20260908191820` revogou `EXECUTE` de `PUBLIC` e `anon`, mas o baseline tem
`GRANT ALL ... TO authenticated` explícito em **todas** as funções, e esse grant continua.
O S1.1 trata só das 4 RPCs que o app usa. Ficaram de fora estas, todas `SECURITY DEFINER`
(rodam como `postgres`, ignoram RLS):

| Função | Quem chama no app | O que um usuário logado qualquer consegue |
|---|---|---|
| `fn_registrar_movimentacao_pontos(...)` | ninguém (só outras funções) | Escrever linha arbitrária no livro-razão de **qualquer** lojista/cliente |
| `fn_expirar_lotes()` | `/api/internal/expirar-lotes` com **service role** | Rodar a expiração global de todos os tenants |
| `fn_garantir_cliente_fidelidade(cliente, lojista)` | ninguém (só outras funções) | Vincular qualquer cliente a qualquer lojista |

"Usuário logado qualquer" inclui o cliente final com login liberado, falando direto com
`/rest/v1/rpc/...` usando a chave anônima do bundle.

**Solução (sem impacto no app):**

```sql
revoke execute on function public.fn_registrar_movimentacao_pontos(uuid, uuid, public.pontos_movimentacao_tipo, integer, integer, uuid, uuid, uuid, uuid, text, jsonb, integer) from authenticated;
revoke execute on function public.fn_expirar_lotes() from authenticated;
revoke execute on function public.fn_garantir_cliente_fidelidade(uuid, uuid) from authenticated;
-- idem para as não-DEFINER que só são chamadas por dentro:
-- fn_alocar_fifo_resgate, fn_calcular_streak_cliente, fn_rebuild_cliente_fidelidade,
-- fn_nivel_por_streak, fn_programa_ativo
```

As funções chamadas **de dentro** de uma DEFINER rodam como `postgres` e não precisam do grant.
Cuidado só com `fn_processar_status_resgate` (não é DEFINER e chama `fn_rebuild...` com o papel
do usuário) — ela fica para a mesma rodada do S1.1. *Confirmar em produção com*
`select proname, has_function_privilege('authenticated', oid, 'execute') from pg_proc where pronamespace = 'public'::regnamespace;`

### S1.1 · 🔴 Alto · Ainda aberto

Checagem de tenant dentro de `fn_processar_compra`, `fn_prever_cancelamento_compra`,
`fn_cancelar_compra_com_compensacao`, `fn_processar_status_resgate`. Sem mudança desde 08/set.

### S16 · 🟡 Médio · Cadastro global de cliente editável por qualquer lojista vinculado

`clientes` é global (deduplicado por CNPJ entre lojistas) e a policy de UPDATE libera qualquer
lojista que tenha vínculo em `clientes_fidelidade`. O lojista B consegue trocar nome, e-mail e
CNPJ de um cliente que também é do lojista A. Se o cliente tiver login, o e-mail muda na
tabela mas **não** no Auth. Ponto de atenção de modelo (D3.1); a mitigação imediata é
`updateCliente` não alterar `email`/`cnpj` de cliente que já tem `auth_user_id`.

### Atenção · Renovação de sessão nas rotas de API

`getServerSupabase` e `getPageSupabase` têm `set()` vazio, e o `matcher` do middleware não
cobre `/api/*`. Se o access token vencer entre duas navegações, a rota de API renova o token
no servidor e descarta o resultado; com rotação de refresh token isso pode derrubar a sessão
do usuário (logout "aleatório"). Não é bug confirmado — fica como suspeito se aparecer relato
de logout inesperado.

---

## 3. Vendas

### C1 · 🟡 Médio · Rollback de `createCompra` falha em silêncio e deixa compra fantasma

O `INSERT` em `compras` dispara o trigger (S3), que grava um lote de 0 pontos e uma
movimentação apontando para a compra — ambas com FK **sem cascade**. Se a inserção dos itens
falhar (ex.: `desconto > subtotal_bruto`, quantidade 0), o código faz
`delete from compras` **sem checar erro**; o delete bate na FK e não acontece. Resultado: uma
compra `aprovada`, sem itens, com lote de 0 pontos, aparecendo na lista e contando no streak
do cliente.

**Solução:** curto prazo, checar o erro do delete e, em caso de falha, marcar a compra como
`cancelada` em vez de deixá-la `aprovada`. Definitivo: D1 (um único ponto de entrada,
`fn_lancar_compra` transacional recebendo compra + itens).

### C2 · 🟡 Médio · `updateCompra` não tem compensação nenhuma

Apaga os itens, insere os novos e reprocessa. Se o insert falhar, a compra fica sem itens e
com o lote antigo calculado pelo trigger com os itens antigos. Mesmo destino do C1.

### S11 · 🔴 Crítico · Ainda aberto — e o formulário piora

Além do motor tratar teto `0` como "percentual cheio", `produto-form.tsx` converte o campo
**vazio** com `Number("") === 0` e aceita. Lojista novo que cadastra produto sem preencher o
teto cria exatamente o produto que mais pontua. **Correção mínima imediata (só front/API):**
tornar o teto obrigatório e recusar string vazia no formulário, na API e no importador. A
correção do motor segue a decisão já tomada ("teto 0 = não pontua").

### Já conhecidos, sem mudança

S3 (lote-lixo por compra), S4 (dívida perdoada no rebuild), S5 (expiração/streak mortos),
S6 (duas fórmulas de ponto), S7 (resgate inalcançável), S14 (`?code=` do primeiro acesso).

---

## 4. Painel admin

### A1 · 🟡 Médio · Liberar login de cliente criado pelo lojista provavelmente falha — *confirmar*

`clientes_login_documento_chk` exige `documento`, `email` e `auth_user_id` quando
`pode_fazer_login = true`. O cadastro pelo **lojista** grava só `cnpj` e nunca `documento`
(o admin grava `documento`). Ao liberar login, `ensureClienteAuthAccess` **primeiro cria o
usuário no Auth** e **depois** faz o UPDATE — que viola o CHECK. Fica um usuário órfão no Auth,
e a próxima tentativa falha com "already registered".

O teste de 08/set ("liberação de acesso de cliente funciona") pode ter usado um cliente com
`documento` preenchido. Conferir com um cliente cadastrado pela tela do lojista. **Solução:**
gravar `documento = cnpj` no cadastro do lojista (e backfill dos existentes), e inverter a
ordem — validar antes de criar o usuário no Auth.

Relacionado: a deduplicação do lojista procura por `cnpj`, a do admin e o índice único usam
`documento`. O mesmo cliente pode nascer duas vezes, uma por cada porta.

### A2 · 🟢 Baixo · Promover admin só enxerga os 50 primeiros usuários do Auth (hoje há 10)

`POST /api/admin/admins` faz `listUsers()` sem paginação (padrão: 50 por página) e procura o
e-mail na primeira página. Com os clientes com login do piloto, o usuário procurado pode não
estar nela → "Não existe usuário Auth com esse email".

### A3 · 🟡 Médio · Lista de clientes do admin vem vazia (S10) — já conhecido

---

## Plano de ação

Ordenado por "destrava o próximo tenant" e "custo baixo / risco baixo". Estimativas para uma
pessoa, com teste manual em tela.

### Rodada 0 — hoje (≈ 1 hora)

| Item | O que fazer |
|---|---|
| **P1** | Rodar o backfill de programa/nível do AR E-UTIL (SQL na seção 0) e reenviar o convite; confirmar com o Victor que o link chegou e abriu |
| **P2** | Tirar `teste@empresa.com` do Eminex; decidir o destino da "Loja Teste" |
| **S15** | Migration de `revoke` (pode ir já — o app não chama essas funções com sessão de usuário) |
| Auth | Ligar a proteção contra senha vazada no painel |

### Rodada 1 — antes de criar o próximo lojista (≈ 1 dia)

| Ordem | Item | O que fazer | Arquivos |
|---|---|---|---|
| 1 | **T2 + T3** | Extrair `enviarConvite()` com `res.ok`, timeout de 8 s e checagem de `{ error }`; usar nas duas rotas e devolver o canal real | `src/lib/admin/convite.ts` (novo), `api/admin/lojistas/route.ts`, `reenviar-convite/route.ts` |
| 2 | **T4** (parte imediata) | Mostrar o canal / alerta "convite não enviado" no dialog e no reenvio; esconder a coluna de status fictícia | `novo-lojista-dialog.tsx`, `admin-lojistas-page.tsx` |
| 3 | **T5** | Criar `PATCH /api/admin/lojistas/[id]/status` | novo `route.ts` |
| 4 | **T6** | Mapear `email_exists` → 409 `EMAIL_LOGIN_EM_USO` | `api/admin/lojistas/route.ts` |
| 5 | **T9** | Remover checkbox "Programa ativo" e recusar `ativo: false` | `programa-form.tsx`, `configuracoes.ts` |
| 6 | Config | Conferir no Supabase: SMTP próprio, *Redirect URLs*, expiração do link de recovery; conferir no N8N se o fluxo devolve erro HTTP quando o envio falha e se põe o DDI 55 | painel |

**Teste de aceite da rodada:** criar um lojista de teste pelo portal (1) com telefone e N8N
ok, (2) com o webhook do N8N desligado — tem que cair no e-mail e a tela dizer "e-mail",
(3) com e-mail já usado — 409 em português; bloquear e reativar esse lojista; entrar como
ele e salvar o programa.

### Rodada 2 — o lojista novo consegue configurar (≈ 1 dia)

| Ordem | Item | O que fazer |
|---|---|---|
| 1 | **T1** | Salvamento do conjunto de níveis (`PUT type: "niveis"` + `fn_salvar_niveis` transacional) e a tela de níveis editando a lista inteira antes de salvar |
| 2 | **S11** (mínimo) | Teto de produto obrigatório no form, na API e no importador |
| 3 | **T10** | `/primeiro-acesso` exigir token na carga, tratar `otp_expired`, senha ≥ 8 com `senhaSchema` |
| 4 | **T8** | Aviso na tela de configuração de que expiração e janela de streak ainda não estão ativas |

**Teste de aceite:** no lojista de teste, montar Bronze `[1,3]`, Prata `[4,9]`, Ouro `[10,∞)`;
cadastrar produto sem teto (tem que recusar); lançar venda; abrir o link de convite
expirado estando logado como admin (tem que recusar).

### Rodada 3 — robustez (≈ 1–2 dias, pode intercalar com decisões)

- **S1.1** — guarda de tenant nas 4 RPCs (com teste de lançar/cancelar venda logado como lojista).
- **C1/C2** — checar o resultado das compensações agora; `fn_lancar_compra` transacional junto com D1/S3.
- **A1 + P3** — campo "CPF/CNPJ" gravando `documento`; validar antes do `createUser`; limpar os 17 clientes órfãos.
- **T7** — `fn_provisionar_lojista` transacional.
- **A2** — paginação em `listUsers`.
- **T11** — Zod no corpo da criação, 401/403 corretos, validação de `NEXT_PUBLIC_APP_URL` no boot.

### Fica para depois (exige decisão de negócio ou é feature)

S3/D1, S4/D8, S5/D2 (ligar expiração de fato), S6/D5, S7/D7, S14 (rota `/auth/confirmar`),
reset de senha self-service, área do cliente (hoje é dado fixo em
`api/cliente/dashboard`), S10.
