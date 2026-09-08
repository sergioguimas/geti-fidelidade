# Contrato — Provisionamento de tenant e acesso por link

| | |
|---|---|
| **Estado** | **TO-BE** · parte existe (criação de lojista, primeiro acesso), parte **não existe** (reset de senha self-service, rota de confirmação server-side) |
| **Depende de** | Q3 (acesso do cliente é liberado pelo lojista) · [contrato de programa e níveis](programa-e-niveis.md) |
| **Bloqueado por** | — |
| **Schemas** | [`src/contracts/acesso.ts`](../../src/contracts/acesso.ts) · [`src/contracts/admin.ts`](../../src/contracts/admin.ts) |

Cobre três coisas que hoje estão emendadas e mal costuradas: criar um lojista, dar o primeiro
acesso ao dono dele, e recuperar senha depois.

---

## 1. Criação do tenant

### 🔴 O tenant nasce inoperante — e este é o achado que justifica a rodada

**Nada no sistema inteiro cria um `programas_fidelidade`.** Nem a rota de admin, nem a tela de
configurações do lojista. `configuracoes.ts` só lê e atualiza (`updatePrograma` exige um `id`
que já exista), e a rota `POST /api/lojista/configuracoes` recusa qualquer `type` que não seja
`"nivel"`.

O efeito em cadeia, para todo lojista criado pelo portal:

1. `getConfiguracoes` devolve `{ programa: null, niveis: [] }` — a tela de configuração fica
   vazia e **sem botão que resolva**;
2. não há programa, logo não há nível;
3. na primeira venda, `fn_programa_ativo` lança `Nenhum programa de fidelidade ativo
   encontrado para o lojista X`, e a venda **falha**.

Os dois programas que existem em produção foram criados à mão pelo Studio. Ou seja: o portal
admin, hoje, entrega um tenant que não funciona, e a única saída é acesso direto ao banco.

**Alvo:** a criação do lojista provisiona, na mesma transação lógica, um programa ativo com
pelo menos um nível cobrindo `[1, ∞)`.

Valores iniciais, **confirmados pelo Sérgio em 08/set/2026**:

| Campo | Proposto | Por quê |
|---|---|---|
| `programas_fidelidade.nome` | `"Programa de Fidelidade"` | neutro, o lojista renomeia |
| `dias_expiracao_pontos` | `180` | é o que o lojista piloto usa |
| `dias_para_perder_streak` | `45` | idem |
| nível único: `nome` | `"Padrão"` | — |
| `streak_min` / `streak_max` | `1` / `null` | **faixa aberta**, para nunca cair no S12 |
| `percentual_conversao` | `1.00` | conservador: é mais fácil o lojista aumentar do que explicar que pagou demais |
| `teto_pontos_compra` | `0` (sem teto) | o lojista decide |
| `ordem` | `1` | — |

O nível inicial com `streak_max = null` não é detalhe: é o que garante a invariante de
cobertura do [contrato de programa e níveis](programa-e-niveis.md) desde o primeiro segundo do
tenant.

> **Decisão relacionada:** com o programa provisionado, a tela de configurações continua sem
> precisar de "criar programa" — ela só edita. Se um dia o lojista puder ter o programa
> desativado e criar outro, aí sim entra um `POST type: "programa"`. Fora de escopo por R4.

### Sequência de criação — TO-BE

```
1. valida o request (Zod)
2. recusa se o CNPJ já existe                    -> 409 LOJISTA_CNPJ_DUPLICADO
3. recusa se o loginEmail já tem usuário no Auth -> 409 EMAIL_LOGIN_EM_USO   [novo]
4. cria usuário no Auth
5. insere lojistas
6. insere lojistas_usuarios (papel = owner)
7. provisiona programa + nível inicial            [novo]
8. gera UM link de primeiro acesso                [muda]
9. envia o MESMO link por WhatsApp e por e-mail   [muda]
```

> **Armadilha 1 — a compensação não é transação.** Falha em 5 apaga o usuário do Auth; falha em
> 6 apaga lojista e usuário. Se a própria compensação falhar, sobra órfão silencioso. Com o
> passo 7 a cadeia fica mais longa e o problema piora.
>
> **Alvo:** mover os passos 5 a 7 para uma função PL/pgSQL `fn_provisionar_lojista(...)`
> `SECURITY DEFINER`, chamada por RPC com service role. Aí é uma transação de verdade: ou nasce
> tudo, ou nada. Só a criação do usuário no Auth (passo 4) fica fora, e ela tem compensação
> simples e única.

> **Armadilha 2 — e-mail de login já usado.** `createUser` falha com "User already registered"
> e sobe como 500 com texto em inglês. O caso é real: alguém que já é cliente final querer ser
> lojista, ou o admin repetir um e-mail. Checar antes e responder 409 com mensagem clara.

> **Decisão pendente:** o lojista nasce com `ativo = true`, antes de o dono ter acessado. Isso
> significa que ele conta como ativo em qualquer métrica desde a criação. Alternativa: nascer
> ativo mesmo assim (mais simples) e a data de primeiro acesso ficar registrada em
> `lojistas_usuarios`. Recomendo manter `ativo = true` e **não** criar um estado a mais.

---

## 2. Primeiro acesso por link

### Como funciona hoje

`POST /api/admin/lojistas` gera o link com `generateLink({ type: "recovery" })`, manda o
`action_link` pelo WhatsApp via N8N, e **em seguida chama `resetPasswordForEmail`**. A página
`/primeiro-acesso` é client-side e tenta duas coisas: `exchangeCodeForSession` quando há
`?code=`, e `setSession` quando há `#access_token` no fragmento.

### 🔴 O e-mail mata o link do WhatsApp

O GoTrue guarda **um** token de recuperação por usuário. O passo 9 (`resetPasswordForEmail`)
emite um novo e **invalida o que foi para o WhatsApp**. Quem clicar primeiro no link do
WhatsApp encontra um token morto.

Isso é coerente com o histórico do repositório — "Envio de redefinição de senha", "Geração de
link para primeiro acesso", "Primeiro Acesso bug fix", "Link de acesso", quatro commits em
volta do mesmo ponto.

**Alvo:** gerar **um** link e mandar o mesmo texto nos dois canais. Nunca chamar
`resetPasswordForEmail` depois de `generateLink` para o mesmo usuário.

### 🔴 O caminho `?code=` não pode funcionar para link gerado pelo admin

O projeto usa `@supabase/ssr`, cujo `flowType` padrão é **PKCE**. No PKCE, quem inicia o fluxo
guarda um `code_verifier` no próprio navegador, e `exchangeCodeForSession` precisa dele. Num
link **gerado no servidor e enviado para outra pessoa**, esse verificador não existe em lugar
nenhum — o `?code=` nunca vai trocar.

Na prática o que salva hoje é o segundo ramo, o do `#access_token`. E ele tem problemas
próprios: fragmento não chega ao servidor, então o middleware não vê sessão nenhuma até o
JavaScript rodar; e o token fica no histórico do navegador.

**Alvo — usar `token_hash` com verificação no servidor:**

```
generateLink() devolve properties.hashed_token
   ↓
link montado por nós:
   {APP_URL}/auth/confirmar?token_hash=...&type=recovery&next=/primeiro-acesso
   ↓
GET /auth/confirmar  (route handler, NÃO existe hoje)
   supabase.auth.verifyOtp({ type: "recovery", token_hash })
   → grava os cookies de sessão no servidor
   → redirect para `next`
   ↓
/primeiro-acesso já abre com sessão válida: só pede a senha
```

Ganhos: funciona para link enviado por qualquer canal, sem PKCE; nenhum token no fragmento nem
no histórico; a sessão existe antes do primeiro render, então o middleware enxerga; e a página
`/primeiro-acesso` deixa de ter a lógica de dois ramos — vira um formulário de senha.

`next` precisa ser validado como caminho **interno** (começa com `/`, sem `//` nem `http`),
senão vira redirecionamento aberto.

### Segurança do envio por WhatsApp

O link é uma credencial ao portador: quem tiver o link entra na conta. Ele transita por um
webhook N8N e pelo WhatsApp, ou seja, por dois terceiros.

Isso é aceitável para o caso de uso, mas o contrato registra as condições: token de uso único
(o GoTrue já garante), expiração curta (configurável no painel do Supabase — confirmar qual
está valendo), e a mensagem **não** deve conter senha nem dado do cliente, só o link e a
identificação do sistema. O reenvio de convite invalida o link anterior, e isso é desejável.

---

## 3. Reset de senha — **não existe**

`RecoverPasswordPanel` é uma maquete. Tem um `input` sem `onChange`, um botão "Voltar", e um
aviso escrito na própria interface: *"Esta tela pode virar um fluxo real depois, com envio de
email, validação de CNPJ e confirmação por código."* Nenhuma chamada ao Supabase.

### Alvo

Dois fluxos com a mesma mecânica de link, e uma diferença importante em relação ao convite:
aqui **quem inicia é o próprio navegador do usuário**, então PKCE funciona normalmente e não
há o problema do `code_verifier`.

```
POST /api/auth/recuperar-senha   { email }
   → supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_URL}/redefinir-senha`
     })
   → responde SEMPRE 200, com a mesma mensagem
```

> **Resposta uniforme, sempre.** Nunca revelar se o e-mail existe: responder "Se houver conta
> com esse e-mail, você receberá as instruções" nos dois casos. Caso contrário a tela vira um
> oráculo de quais e-mails são clientes de quais lojistas — o que colide direto com o
> isolamento de D3.1.

Página nova `/redefinir-senha`: mesma estrutura de `/primeiro-acesso` (sessão de recuperação já
estabelecida, formulário de senha, `updateUser({ password })`).

> **Proposta:** `/primeiro-acesso` e `/redefinir-senha` compartilham o mesmo componente de
> formulário, mudando só o texto. São a mesma operação — estabelecer senha com sessão de
> recuperação.

### Decisão pendente — recuperação do cliente final

A maquete propõe recuperação **por CNPJ** para o cliente, e por e-mail para o lojista. Mas o
banco já exige e-mail quando `pode_fazer_login = true`
(`clientes_login_documento_chk`), então o caminho por e-mail funciona para os dois públicos e
custa uma implementação só.

Recomendo **e-mail para ambos**. Recuperação por CNPJ exigiria um segundo canal de
confirmação (SMS, WhatsApp), validação de posse do documento e proteção contra enumeração de
CNPJ — é um fluxo inteiro a mais, e o cliente que tem login necessariamente tem e-mail
cadastrado.

---

## 4. Política de senha

Hoje: `password.length < 6`, só no cliente, sem confirmação no servidor. O mínimo do Supabase
também é 6.

**Alvo:** mínimo de 8 caracteres, validado pelo Zod no cliente **e** no servidor, com a
configuração do projeto Supabase alinhada. Sem exigência de símbolo ou maiúscula — regra de
composição empurra o usuário para senha pior e anotada. Comprimento é o que importa.

A confirmação de senha continua sendo validação de formulário, não vai para a API.

---

## Invariantes

1. Todo lojista criado pelo portal nasce com **um programa ativo e pelo menos um nível cobrindo
   `[1, ∞)`**. Um tenant sem programa é estado inválido.
2. Lojista, vínculo de usuário, programa e nível nascem juntos ou não nascem.
3. Existe no máximo **um** link de acesso válido por usuário a cada momento; gerar um novo
   invalida o anterior, e é por isso que só se gera um por vez.
4. A resposta de "esqueci minha senha" é idêntica para e-mail existente e inexistente.
5. Nenhum token de sessão trafega em fragmento de URL.
6. `next` de redirecionamento é sempre caminho interno.
7. Definir senha exige sessão de recuperação válida — nunca só o e-mail.

## Erros de negócio esperados

| Situação | HTTP | Código |
|---|---|---|
| CNPJ já cadastrado | 409 | `LOJISTA_CNPJ_DUPLICADO` |
| E-mail de login já tem usuário no Auth | 409 | `EMAIL_LOGIN_EM_USO` |
| Falha ao provisionar programa inicial | 500 | `PROVISIONAMENTO_FALHOU` (com rollback) |
| `token_hash` inválido ou expirado | 400 | `LINK_INVALIDO` |
| `next` externo | 400 | `REDIRECIONAMENTO_INVALIDO` |
| Senha curta demais | 422 | `SENHA_FRACA` |
| Definir senha sem sessão de recuperação | 401 | `SESSAO_RECUPERACAO_AUSENTE` |

## Ordem de implementação

1. **Provisionar programa e nível na criação do lojista.** É o que desbloqueia o portal admin
   — hoje ele entrega tenant quebrado. Valores iniciais já confirmados: pronto para implementar.
2. **Parar de chamar `resetPasswordForEmail` depois de `generateLink`.** Uma linha removida
   conserta o link do WhatsApp.
3. **Rota `/auth/confirmar` com `verifyOtp`**, e o convite passando a apontar para ela.
4. **`/redefinir-senha` e `POST /api/auth/recuperar-senha`**, com o painel de recuperação
   deixando de ser maquete.
5. **`fn_provisionar_lojista`** transacional, absorvendo os passos 5 a 7.
6. **Política de senha** de 8 caracteres nos dois lados.

Os passos 1 e 2 são pequenos e resolvem os dois problemas que hoje impedem um lojista novo de
entrar e operar. Eu faria os dois primeiro, isolados.

## Componentes que mudam junto

`src/components/auth/recover-password-panel.tsx` (deixa de ser maquete),
`login-tabs.tsx`, `merchant-login-form.tsx`, `customer-login-form.tsx`,
`src/app/primeiro-acesso/primeiro-acesso-form.tsx` (perde a lógica de dois ramos),
`src/components/admin/novo-lojista-dialog.tsx` (mensagens de erro novas).
Arquivos novos: `src/app/auth/confirmar/route.ts`, `src/app/redefinir-senha/`,
`src/app/api/auth/recuperar-senha/route.ts`.
