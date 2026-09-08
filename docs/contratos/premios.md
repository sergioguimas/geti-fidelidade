# Contrato — Prêmios

| | |
|---|---|
| **Estado** | **AS-IS** no CRUD · **TO-BE** no isolamento de tenant e na validação de nível |
| **Depende de** | D7 (resgate é validado no servidor) · [S7](../03-defeitos-e-riscos.md) |
| **Bloqueado por** | — (o **resgate** está bloqueado; o cadastro de prêmio não) |
| **Schemas** | [`src/contracts/premios.ts`](../../src/contracts/premios.ts) |

Prêmio é o que o cliente troca por pontos. Hoje ele só é cadastrado: nada no sistema consome
`pontos_necessarios` nem `nivel_minimo_id`, porque o fluxo de resgate é inalcançável
([S7](../03-defeitos-e-riscos.md)). Este contrato cobre **só o cadastro**, mas define as
regras de forma que o contrato de resgate possa se apoiar nelas depois.

## Entidade

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | banco |
| `lojista_id` | uuid | do contexto |
| `nome` | varchar(150) | obrigatório, `trim` |
| `descricao` | text nulo | `trim`; string vazia vira `null` |
| `pontos_necessarios` | integer | **maior que 0** — ver TO-BE abaixo |
| `nivel_minimo_id` | uuid nulo | nulo = disponível em qualquer nível |
| `ativo` | boolean | default `true` |
| `created_at` | timestamptz | banco |

## Pontos TO-BE

### 1. Filtrar por lojista na query, não só na RLS

`updatePremio` e `deactivatePremio` **não recebem nem usam** `lojistaId`:

```ts
.eq("id", input.id)     // e nada mais
```

A RLS de `premios` protege de fato (as policies `own_lojista` estão corretas e esta tabela
nunca teve policy permissiva). Mas a convenção 2 do [README](README.md) exige o filtro
explícito como segunda linha, e `updateProduto` já faz assim. Uniformizar:
`.eq("id", ...).eq("lojista_id", lojistaId)`.

### 2. `nivel_minimo_id` precisa ser validado

Nada verifica que o nível informado pertence ao programa do próprio lojista. A FK
(`premios_nivel_minimo_id_fkey`) confirma apenas que o uuid existe em `programa_niveis` — e
FK **não** consulta RLS. Um lojista pode, hoje, apontar o prêmio para o nível de outro
lojista.

Alvo: validar no servidor que `nivel_minimo_id` pertence ao programa ativo do lojista do
contexto. Se não pertencer, `422`.

### 3. `pontos_necessarios` sem piso

A coluna é `integer NOT NULL` sem CHECK, então `0` e negativos entram. Prêmio de 0 pontos é
resgate infinito de graça. Alvo: CHECK `> 0` no banco e validação Zod na entrada.

## Operações

### Listar — `GET /api/lojista/premios?busca=`

Filtra por `lojista_id`, `ilike` em `nome`, ordena por `created_at` desc. Traz o nível mínimo
embutido (`programa_niveis(id, nome, ordem)`), normalizado para o objeto `nivel_minimo`.

> **Armadilha:** o Supabase devolve o relacionamento embutido ora como objeto, ora como array
> de um elemento, dependendo de como infere a cardinalidade. O código atual trata os dois casos
> (`Array.isArray(item.programa_niveis) ? [0] : item`). **Manter esse tratamento.** Removê-lo
> "porque é redundante" quebra a tela de forma intermitente.

### Opções de nível — `GET /api/lojista/premios?mode=niveis`

Devolve `{ id, nome, ordem }` dos níveis do programa ativo, ordenados por `ordem`. Se o
lojista não tiver programa ativo, devolve lista vazia — **não** erro.

### Criar — `POST` · Atualizar — `PATCH`

Request: `nome`, `descricao?`, `pontosNecessarios`, `nivelMinimoId?`, `ativo?`. No `PATCH`,
mais o `id`.

> **Armadilha herdada:** como em produtos, `ativo: input.ativo ?? true` faz a omissão do campo
> **reativar** um prêmio inativo. No TO-BE, omitir preserva o valor atual.

### Desativar — `DELETE /api/lojista/premios?id=`

É desativação (`ativo = false`), não exclusão física — e está certo assim. Prêmio referenciado
por `resgates` é histórico. Manter.

## Regras que o contrato de resgate vai herdar

Registradas aqui para não se perderem, **não implementar nesta rodada**:

1. `pontos_solicitados` de um resgate é derivado de `premios.pontos_necessarios` no servidor,
   nunca aceito do cliente (D7).
2. Só prêmio com `ativo = true` pode ser resgatado.
3. Se `nivel_minimo_id` estiver preenchido, o cliente precisa estar em nível de `ordem` maior
   ou igual à do nível mínimo.
4. As três checagens acontecem no servidor no momento da solicitação **e** de novo na
   aprovação — entre um e outro o cliente pode ter mudado de nível ou o prêmio ter sido
   desativado.

## Invariantes

1. Todo prêmio pertence a exatamente um lojista.
2. `pontos_necessarios > 0`.
3. `nivel_minimo_id`, quando presente, aponta para um nível do programa do próprio lojista.
4. Prêmio nunca é excluído fisicamente.

## Erros de negócio esperados

| Situação | HTTP | Código |
|---|---|---|
| Schema inválido | 422 | `PREMIO_INVALIDO` |
| `nivel_minimo_id` de outro programa | 422 | `NIVEL_MINIMO_INVALIDO` |
| Prêmio de outro lojista | 404 | `PREMIO_NAO_ENCONTRADO` |

## Componentes que mudam junto

`src/components/lojista/premios-table.tsx`, `premio-form.tsx`,
`src/app/(merchant)/lojista/premios/page.tsx`.
