# Contrato — Painel da plataforma (admin)

| | |
|---|---|
| **Estado** | **AS-IS** · com três armadilhas documentadas e um TO-BE de convite |
| **Depende de** | Q3 (acesso do cliente é liberado pelo lojista) · [S10](../03-defeitos-e-riscos.md) |
| **Bloqueado por** | — |
| **Schemas** | [`src/contracts/admin.ts`](../../src/contracts/admin.ts) |

O admin da plataforma é quem cadastra lojistas, promove outros admins e bloqueia contas. Não é
o dono de nenhum lojista: ele não tem vínculo em `lojistas_usuarios`, e é isso que explica o
comportamento estranho de [S10](../03-defeitos-e-riscos.md).

## Autorização

Toda rota passa por `requireAdminApi(request)`, que exige linha ativa em `admins_plataforma`
para o `auth.uid()` da sessão.

Depois disso, as rotas usam **dois clientes diferentes**, e a distinção é intencional:

| Cliente | Quando | Por quê |
|---|---|---|
| sessão do usuário (`supabase`) | leitura | passa por RLS — a policy `lojistas_select_own_ou_admin` é quem autoriza |
| service role (`createAdminClient()`) | escrita e busca global | ignora RLS; é o único jeito de criar usuário no Auth e de procurar por CNPJ na base inteira |

> Nunca trocar um pelo outro "para simplificar". Usar service role em leitura remove a
> checagem de RLS; usar sessão em escrita quebra a criação de lojista.

## Lojistas

### Listar — `GET /api/admin/lojistas`

Leitura com a sessão do admin, ordenada por `created_at` desc. Depende da policy
`lojistas_select_own_ou_admin`, criada na migration de segurança de 08/set — antes dela, quem
autorizava era a policy permissiva `USING (true)`.

### Criar — `POST /api/admin/lojistas`

Validação AS-IS: `razaoSocial` obrigatória; `cnpj` obrigatório e com exatamente 14 dígitos
após remover não-dígitos; `loginEmail` obrigatório. `nomeFantasia` cai para `razaoSocial`
quando vazio. Telefone é normalizado para só dígitos.

Duplicidade: rejeita com **409** e código `LOJISTA_CNPJ_DUPLICADO` se o CNPJ já existir,
devolvendo o registro existente para o admin ver qual é.

Sequência da criação, nesta ordem:

1. cria usuário no Auth com `email_confirm: true` e `user_metadata.tipo = "lojista_owner"`;
2. insere `lojistas`;
3. insere `lojistas_usuarios` com `papel = "owner"`;
4. gera link de primeiro acesso;
5. dispara WhatsApp via N8N;
6. dispara e-mail de definição de senha.

> **Armadilha 1 — a compensação não é transação.** Falha no passo 2 apaga o usuário do Auth;
> falha no passo 3 apaga o lojista e o usuário. Se a própria compensação falhar, sobra órfão e
> ninguém percebe. Os passos 4 a 6 **não** desfazem nada: lojista criado sem convite enviado é
> considerado sucesso, e o admin tem a rota de reenvio para resolver.

> **Armadilha 2 — TO-BE — o e-mail provavelmente mata o link do WhatsApp.** O passo 4 chama
> `generateLink({ type: "recovery" })` e o link vai para o WhatsApp. O passo 6 chama
> `resetPasswordForEmail`, que **gera um novo token de recuperação para o mesmo usuário**. O
> GoTrue guarda um token de recuperação por usuário, então o segundo invalida o primeiro — o
> link que o lojista recebeu no WhatsApp tende a chegar morto, e o que vale é o do e-mail.
>
> Isso explica o histórico de commits em torno de "Primeiro Acesso bug fix" e "Link de acesso".
> Correção: escolher **um** canal como emissor do token, ou enviar nos dois canais **o mesmo**
> `action_link` gerado no passo 4, sem chamar `resetPasswordForEmail` depois.

### Reenviar convite — `POST /api/admin/lojistas/reenviar-convite`

Mesma mecânica de link. Vale a mesma armadilha 2.

## Clientes

### Listar — `GET /api/admin/clientes`

> **Armadilha 3 — esta rota devolve lista vazia hoje.** Ela lê `clientes` com a sessão do
> admin, e todas as policies de `clientes` exigem vínculo em `lojistas_usuarios` — que o admin
> não tem. Não é regressão da migration de segurança: nenhuma das policies dropadas era de
> `clientes`.
>
> Corrigir é decisão de escopo, não de implementação: dar leitura de `clientes` ao admin faz a
> tela passar a mostrar dado que hoje não mostra, e isso conflita com o princípio de isolamento
> de D3.1. **Não implementar sem decisão do Sérgio.**

### Criar — `POST /api/admin/clientes` · Bloquear — `PATCH /api/admin/clientes/[id]/status`

Ambas com service role. A criação procura duplicidade por `documento` na base inteira, o que
só é possível ignorando RLS — é a mecânica do cadastro global (decisão D3).

## Admins da plataforma

### Promover — `POST /api/admin/admins`

Recebe `email` e `nome?`. Procura o usuário no Auth por e-mail e insere em `admins_plataforma`.
**Não cria** usuário: se não existir no Auth, responde 400 pedindo que se crie antes.

> **Armadilha 4 — `listUsers()` sem paginação.** A busca usa
> `supabaseAdmin.auth.admin.listUsers()`, que devolve **a primeira página** (50 usuários por
> padrão). Quando a base passar de 50 usuários no Auth, promover alguém que esteja fora da
> primeira página falha com "Não existe usuário Auth com esse email" — mensagem que manda o
> admin para o caminho errado. Alvo: usar `getUserByEmail` ou paginar até encontrar.
>
> Isto **vai** acontecer: cada lojista e cada cliente com login é um usuário no Auth.

### Remover — `DELETE /api/admin/admins?id=`

Remove a linha de `admins_plataforma`. Recusa remover o próprio acesso (400) — regra correta,
manter. O usuário no Auth **não** é apagado: ele deixa de ser admin e continua existindo, o
que é o comportamento desejado.

## Invariantes

1. Toda rota de admin exige linha ativa em `admins_plataforma`.
2. CNPJ de lojista é único na plataforma (índice `uq_lojistas_cnpj`).
3. Um admin nunca remove o próprio acesso.
4. Criar lojista é atômico do ponto de vista do usuário: ou existem lojista, usuário e vínculo,
   ou não existe nenhum dos três.
5. O admin não é dono de lojista nenhum e não deve ganhar acesso a dado de cliente sem decisão
   explícita.

## Erros de negócio esperados

| Situação | HTTP | Código |
|---|---|---|
| Sem sessão | 401 | `NAO_AUTENTICADO` |
| Sessão sem linha ativa de admin | 403 | `NAO_AUTORIZADO` |
| CNPJ já cadastrado | 409 | `LOJISTA_CNPJ_DUPLICADO` |
| CNPJ sem 14 dígitos | 422 | `CNPJ_INVALIDO` |
| Promover e-mail sem usuário no Auth | 422 | `USUARIO_AUTH_INEXISTENTE` |
| Remover o próprio acesso | 409 | `AUTO_REMOCAO_PROIBIDA` |

## Componentes que mudam junto

`src/components/admin/admin-lojistas-page.tsx`, `admin-clientes-page.tsx`, `admins-page.tsx`,
`novo-lojista-dialog.tsx`, `novo-cliente-dialog.tsx`.
