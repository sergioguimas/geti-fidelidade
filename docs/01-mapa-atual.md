# 01 — Mapa atual do sistema (AS-IS)

Fotografia de 08/set/2026. Código parado desde 15/jun/2026 (commit `45025af`).

## Stack

Next.js 16 (App Router, React Compiler, PWA via `@ducanh2912/next-pwa`) · React 19 ·
TypeScript · Tailwind v4 · shadcn/ui · Supabase (Auth + Postgres 17 + RLS).
Sem testes, sem CI, sem containerização, sem deploy. Roda só em `npm run dev`.

## Três superfícies

| Superfície | Rotas | Estado |
|---|---|---|
| **Lojista** | `/lojista/*` | Real e em uso |
| **Admin da plataforma** | `/admin/*` | Real |
| **Cliente final** | `/cliente/*` | **Fachada.** `GET /api/cliente/dashboard` devolve JSON hardcoded ("Loja Centro", "Loja Norte", 1280 pontos). Nenhuma query ao banco. |

## Camadas e quem tem autoridade

```
componente client ──authFetch──► route handler ──► lib/merchant/*.ts ──► Supabase JS
                                                          │
                                                          └──rpc──► função PL/pgSQL  ◄── AUTORIDADE
                                                                          ▲
trigger em `compras` ──────────────────────────────────────────────────────┘
```

- **`src/app/api/**/route.ts`** — validação rasa (checa presença de campo, nunca tipo/faixa),
  try/catch que devolve `{ error: message }` com status 500 para qualquer falha, inclusive
  as de regra de negócio. Sem Zod, sem schema de request.
- **`src/lib/merchant/*.ts`** — monta payload, chama Supabase, normaliza `Number(...)`.
  **Recalcula pontos por item por conta própria, com fórmula diferente da do banco** (ver
  [02](02-motor-de-pontos-as-is.md)).
- **Funções PL/pgSQL** — onde a regra realmente vive. 16 funções, 12 triggers.

### Autenticação

- `middleware.ts` resolve o papel a cada request consultando 3 tabelas
  (`admins_plataforma`, `lojistas_usuarios`, `clientes`) e redireciona. Um usuário pode casar
  com mais de um papel; a precedência é admin > lojista > cliente.
- Route handlers reautenticam via `requireLojistaContext` / `requireAdminApi`, que leem a
  sessão **do cookie**. O header `Authorization: Bearer` que o `authFetch` envia é ignorado
  pelo servidor — é decorativo.
- Escrita privilegiada (criar usuário no Auth, buscar cliente global por CNPJ) usa
  `createAdminClient()` com a `SUPABASE_SERVICE_ROLE_KEY`.

## Modelo de dados

17 tabelas. Núcleo:

```
lojistas ──1:N── lojistas_usuarios ──► auth.users
   │
   ├──1:N── produtos            (descricao, teto_percentual)
   ├──1:N── programas_fidelidade ──1:N── programa_niveis
   │                                      (streak_min/max, percentual_conversao,
   │                                       teto_pontos_compra, ordem)
   ├──1:N── premios              (pontos_necessarios, nivel_minimo_id)
   │
   └──N:N── clientes  via  clientes_fidelidade
                            (streak_atual, nivel_atual_id, saldo_disponivel,
                             saldo_pendente, saldo_negativo, validade_dias_custom)

compras ──1:N── compra_itens
   └──1:N── lotes_pontos ──1:N── resgate_alocacoes ──N:1── resgates
pontos_movimentacoes   (livro-razão append-only de tudo)
ajustes_pontos         (tabela órfã: NADA escreve nela — ver 03)
```

**Ambiguidade estrutural:** `clientes` tem `lojista_id` **e** existe `clientes_fidelidade`
como N:N. Os dois modelos convivem. O código trata cliente como global (busca por CNPJ com
service role em `findGlobalClienteByCnpj`), mas as policies de RLS de `clientes` filtram por
`lojista_id`. É a decisão D3 em [04](04-decisoes-em-aberto.md).

## Superfície de API atual

Todas devolvem `{ data }` em sucesso e `{ error: string }` em falha. Nenhuma tem contrato
declarado; a forma da resposta é o que o `lib/` retorna.

| Rota | Métodos | Observação |
|---|---|---|
| `/api/lojista/clientes` | GET POST PATCH DELETE | DELETE = desativa, não apaga |
| `/api/lojista/compras` | GET POST PATCH DELETE | GET multiplexa 3 respostas por `?mode=` (`clientes`, `cancel-preview`, listagem paginada). DELETE = cancela com compensação |
| `/api/lojista/produtos` | GET POST PATCH DELETE | |
| `/api/lojista/produtos/importar/preview` | POST | XLSX/CSV → novos/duplicados/inválidos |
| `/api/lojista/produtos/importar/confirmar` | POST | aplica criar/atualizar |
| `/api/lojista/premios` | GET POST PATCH DELETE | |
| `/api/lojista/resgates` | GET PATCH | PATCH só aceita `aprovado`/`recusado`. **Não existe POST: nada no sistema cria um resgate** |
| `/api/lojista/configuracoes` | GET PATCH POST DELETE | multiplexa programa/nível por `body.type` |
| `/api/lojista/dashboard` | GET | |
| `/api/admin/lojistas` | GET POST | POST cria lojista + usuário no Auth + convite (e-mail e WhatsApp via N8N) |
| `/api/admin/lojistas/reenviar-convite` | POST | |
| `/api/admin/clientes` | GET POST | |
| `/api/admin/clientes/[id]/status` | PATCH | |
| `/api/admin/admins` | POST DELETE | |
| `/api/cliente/dashboard` | GET | **mock** |
| `/api/internal/expirar-lotes` | POST | protegida por `INTERNAL_CRON_SECRET`; **ninguém a chama** |

## Variáveis de ambiente

`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_CRON_SECRET`, `N8N_WEBHOOK_WHATSAPP`.
