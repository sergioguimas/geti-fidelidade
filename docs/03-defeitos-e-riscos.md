# 03 — Defeitos e riscos confirmados

Tudo aqui foi verificado contra o baseline de produção
(`supabase/migrations/20260908181954_remote_schema.sql`), não contra os dumps antigos.
Ordenado por gravidade. O que exige decisão de negócio aparece também em
[04](04-decisoes-em-aberto.md).

---

## S1 · Crítico · Todas as funções do motor estão liberadas para `anon`

Toda função PL/pgSQL do schema `public` tem `GRANT ALL ... TO anon`. Como o PostgREST expõe
`POST /rest/v1/rpc/<função>` e a chave anônima está no bundle do navegador, qualquer pessoa
na internet pode chamá-las. Quatro delas são `SECURITY DEFINER`, ou seja, rodam como `postgres`
e **ignoram RLS**:

| Função | SECURITY DEFINER | Efeito de uma chamada anônima |
|---|---|---|
| `fn_expirar_lotes()` | sim | Expira pontos de **todos os lojistas** de uma vez |
| `fn_cancelar_compra_com_compensacao(uuid)` | sim | Cancela a compra de qualquer lojista e gera dívida no cliente |
| `fn_processar_compra(uuid)` | sim | Reprocessa/recria lotes de qualquer compra |
| `fn_registrar_movimentacao_pontos(...)` | sim | Escreve linha arbitrária no livro-razão |
| `fn_processar_status_resgate(uuid, status)` | não | Aprova resgate (barrado por RLS hoje, mas depende de S2) |

O único dado que o atacante precisa é um UUID de compra. Não precisa nem estar logado.

**Correção:** `REVOKE EXECUTE ... FROM anon, authenticated` em tudo que muta, deixando só
`service_role`. As funções que a aplicação chama via RPC com sessão de usuário
(`fn_processar_compra`, `fn_prever_cancelamento_compra`, `fn_cancelar_compra_com_compensacao`,
`fn_processar_status_resgate`) precisam antes ser movidas para trás de um route handler que
use service role, ou ganhar checagem interna de tenant.

---

## S2 · Crítico · RLS de multi-tenant está anulada em 6 tabelas

Além das policies por lojista, existem policies permissivas assim:

```sql
CREATE POLICY "compras: acesso autenticado" ON public.compras
  TO authenticated USING (true) WITH CHECK (true);
```

Em Postgres, policies permissivas são combinadas com **OR**. Uma policy `USING (true)`
portanto **anula** todas as outras da mesma tabela. Afeta:

`compras`, `compra_itens`, `produtos`, `lojistas`, `lojistas_usuarios`, `clientes_usuarios`.

Consequência: qualquer usuário autenticado — inclusive um cliente final com login liberado —
pode ler e escrever compras, itens e produtos **de todos os lojistas** falando direto com o
PostgREST pela chave anônima. O isolamento entre lojistas hoje é feito só pelo `.eq("lojista_id", ...)`
do TypeScript, que é conveniência de query, não barreira de segurança.

**Correção:** dropar as 6 policies `USING (true)`. Antes disso, conferir se alguma tela
depende delas (a leitura de `lojistas` pelo próprio lojista, por exemplo, pode não ter policy
específica — a tabela `lojistas` só tem essa uma policy).

---

## S3 · Alto · Toda compra grava um lote-lixo, e toda edição grava dois

`trg_compras_processar` roda `fn_processar_compra` **AFTER INSERT** em `compras`. Nesse
instante os `compra_itens` ainda não foram inseridos — o TypeScript insere a compra, depois os
itens, e só então chama a RPC. Resultado da criação de uma compra:

1. trigger dispara com zero itens → cria lote com `pontos_gerados = 0` e registra uma
   movimentação `geracao` de 0 pontos;
2. o app insere os itens e chama a RPC;
3. a RPC cancela o lote de 0 pontos e cria o lote verdadeiro.

Em `updateCompra` é pior: o `UPDATE` em `compras` dispara o trigger **antes** de os itens
serem substituídos, então o lote intermediário é calculado com os itens **antigos**.

Sintoma visível: `lotes_pontos` acumula lotes `cancelado` de 0 pontos, e
`pontos_movimentacoes` acumula linhas `geracao` de 0 pontos, poluindo qualquer auditoria e o
extrato que o cliente final vai ver quando a área dele existir.

**Correção:** escolher um único ponto de entrada — ou o trigger, ou a RPC. Ver D1.

---

## S4 · Alto · Saldo negativo é silenciosamente perdoado

`fn_cancelar_compra_com_compensacao` grava a dívida em
`clientes_fidelidade.saldo_negativo += resto`. Mas `fn_rebuild_cliente_fidelidade` recalcula
esse campo a partir da tabela `ajustes_pontos` — e **nada em todo o sistema insere em
`ajustes_pontos`**. A tabela está vazia por construção.

Sequência do bug:

1. cancela-se uma compra cujos pontos já foram gastos → `saldo_negativo = 300`;
2. o cliente faz qualquer compra nova (ou qualquer resgate é decidido) → rebuild;
3. rebuild lê `ajustes_pontos` (vazio) e grava `saldo_negativo = 0`.

A dívida some. O livro-razão em `pontos_movimentacoes` mantém o registro, mas nada o lê.

**Correção:** decidir a fonte da verdade — ou o cancelamento passa a inserir em
`ajustes_pontos`, ou o rebuild passa a derivar o negativo do livro-razão. Ver D8.

---

## S5 · Alto · Expiração de pontos está morta em dois lugares independentes

1. A tela de configurações grava `programas_fidelidade.dias_expiracao_pontos`, mas
   `fn_processar_compra` calcula `expira_em` a partir de `validade_dias`. Nada no `src/`
   escreve `validade_dias`, então ele é nulo, então `expira_em` é nulo, então nenhum lote
   jamais vence.
2. Mesmo que vencesse: `pg_cron` está instalado no banco **sem nenhum job cadastrado**, e a
   rota `POST /api/internal/expirar-lotes` não é chamada por ninguém.

O mesmo padrão atinge o streak: a tela grava `dias_para_perder_streak`, e
`fn_rebuild_cliente_fidelidade` usa `interval '30 days'` escrito no código.

**Correção:** unificar campo e agendar. Ver D2.

---

## S6 · Médio · Dois cálculos de ponto que discordam

Detalhado em [02](02-motor-de-pontos-as-is.md). O TypeScript grava em `compra_itens` um
`pontos_gerados` por item que usa o teto do produto no lugar do percentual do nível e
arredonda em vez de truncar. O banco calcula outro número, e é o do banco que vira saldo.

Impacto: a tela de vendas mostra por item um total que não bate com os pontos que o cliente
recebeu. Com nível de 5% e produto com teto de 10%, a divergência é de 2x.

**Correção:** ver D5 — ou o TypeScript para de calcular e passa a ler o resultado do banco,
ou a fórmula vira uma só, num lugar só.

---

## S7 · Médio · Fluxo de resgate é inalcançável e não valida prêmio

Não existe rota que crie um `resgate`. O motor de resgate (alocação FIFO, aprovação, reversão)
está inteiro e nunca roda em produção. Quando for ligado, do jeito que está:

- `pontos_solicitados` é livre — ninguém confere contra `premios.pontos_necessarios`;
- `premios.ativo` e `premios.nivel_minimo_id` não são checados em lugar nenhum.

Ver D7.

---

## S8 · Médio · `saldo_pendente` mistura dois significados opostos

O campo `lotes_pontos.pontos_pendentes` é usado para duas coisas contrárias:

- pontos de uma compra ainda **não aprovada** (vão virar disponíveis quando aprovar);
- pontos **reservados para um resgate pendente** (vão virar gastos quando aprovar).

`fn_rebuild_cliente_fidelidade` soma os dois no mesmo `saldo_pendente`. Para o cliente final,
"pendente" vai significar ora "ponto que você vai ganhar", ora "ponto que você já
comprometeu". Ver D4.

---

## S9 · Baixo · Inconsistências menores

- `fn_expirar_lotes` mexe em `saldo_disponivel` na mão em vez de chamar rebuild, e não
  recalcula `saldo_pendente`.
- `fn_cancelar_compra_com_compensacao` não chama rebuild no fim.
- `fn_calcular_streak_cliente` é código morto.
- `authFetch` envia `Authorization: Bearer`, mas `getServerSupabase` só lê cookie. O header é
  ignorado.
- `deleteNivel` e `updateNivel` recebem `lojistaId` e **não o usam** no `WHERE` — a proteção
  fica só na RLS de `programa_niveis` (que, essa sim, está correta).
- Todo erro de regra de negócio volta como HTTP 500 com a mensagem crua do Postgres.
- `console.log("garantindo vínculo clientes_fidelidade")` esquecido em
  `src/lib/merchant/clientes.ts`.
- `compras.valor_total` e `subtotal_bruto` são calculados no TypeScript e nunca conferidos
  contra a soma dos itens no banco.
