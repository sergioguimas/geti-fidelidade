# 02 — Motor de pontos (AS-IS)

Lido de `supabase/migrations/20260908181954_remote_schema.sql` (espelho da produção).
Descreve o que o código **faz**, não o que deveria fazer. Divergências e defeitos estão
marcados com ⚠ e detalhados em [03](03-defeitos-e-riscos.md); as decisões pendentes que
eles geram estão em [04](04-decisoes-em-aberto.md).

## Conceitos

- **Lote** (`lotes_pontos`) — a unidade de pontos. Cada compra gera um lote. Um lote tem
  `pontos_gerados` e se decompõe em `pontos_disponiveis + pontos_pendentes + pontos_gastos +
  pontos_expirados + pontos_cancelados`, com CHECK garantindo que a soma nunca ultrapasse
  `pontos_gerados`.
- **Status do lote** — `pendente` | `disponivel` | `expirado` | `cancelado`.
- **Streak** — número de compras aprovadas consecutivas sem um intervalo grande entre elas.
- **Nível** (`programa_niveis`) — faixa de streak que define `percentual_conversao` (quantos %
  do valor viram ponto) e `teto_pontos_compra`.
- **Saldo** (`clientes_fidelidade`) — cache desnormalizado, recalculado por
  `fn_rebuild_cliente_fidelidade`.
- **Livro-razão** (`pontos_movimentacoes`) — append-only, escrito por
  `fn_registrar_movimentacao_pontos`. Só registra; não altera saldo nenhum.

## Pontuação — `fn_processar_compra(compra_id)`

Ponto de entrada de tudo. Chamada por **dois caminhos**: pela RPC dentro de
`createCompra`/`updateCompra` e pelo trigger `trg_compras_processar`
(AFTER INSERT OR UPDATE OF status, valor_total, data_compra). ⚠ D1

1. Garante o vínculo `clientes_fidelidade` (`fn_garantir_cliente_fidelidade`).
2. Se a compra está `cancelada` ou `recusada`: só faz rebuild e sai.
3. Se **qualquer lote da compra tem `pontos_gastos > 0`** → exception. Compra com pontos já
   consumidos não pode ser reprocessada; tem que ser cancelada.
4. Cancela os lotes anteriores da compra (`pontos_disponiveis + pontos_pendentes` viram
   `pontos_cancelados`, status `cancelado`).
5. **Programa** = o `ativo` mais recente do lojista (`order by created_at desc limit 1`). ⚠ D6
6. **Nível** = `clientes_fidelidade.nivel_atual_id`, ou seja, o nível que o cliente tinha
   **antes** desta compra. Se estiver nulo, cai no nível de menor `ordem`. ⚠ D5
7. Para cada item:

   ```
   percentual_item = teto_produto > 0
                     ? least(teto_produto, nivel.percentual_conversao)
                     : nivel.percentual_conversao

   pontos_item     = floor(item.subtotal * percentual_item / 100)   -- floor POR ITEM
   ```

   `item.subtotal` já chega líquido de desconto (o TypeScript grava assim).
8. Soma os itens. Se `nivel.teto_pontos_compra > 0`, aplica `least(total, teto)`.
9. Status do lote: compra `aprovada` → lote `disponivel`, tudo em `pontos_disponiveis`;
   qualquer outro status → lote `pendente`, tudo em `pontos_pendentes`.
10. **Validade**: `dias = greatest(programa.validade_dias, cliente.validade_dias_custom)`,
    ambos com `coalesce(..., 0)`. Se `dias > 0` → `expira_em = now() + dias`; senão `null`
    (não expira). ⚠ D2 — usa `now()` e não `data_compra`, e lê `validade_dias` e não
    `dias_expiracao_pontos`.
11. Grava `compras.pontos_total`, insere o lote, registra movimentação `geracao`.
12. `fn_rebuild_cliente_fidelidade` no fim — atualiza saldo, streak e nível.

### ⚠ O TypeScript calcula pontos de novo, com outra fórmula

`buildCompraItens()` em `src/lib/merchant/compras.ts` grava em `compra_itens`:

```ts
tetoPercentualNivel = produto.teto_percentual          // não é o percentual do nível
percentualAplicado  = min(produto.teto, produto.teto)  // = teto do produto
pontosGerados       = round2(subtotal * percentual / 100)   // arredonda, não trunca
```

O banco usa `least(teto_produto, nivel.percentual_conversao)` e `floor`. Logo as colunas
`compra_itens.teto_percentual_nivel`, `percentual_aplicado` e `pontos_gerados` são
**cosméticas e divergem do lote real** sempre que `nivel.percentual_conversao` for diferente
do teto do produto. A tela de vendas mostra a versão do TypeScript; o saldo do cliente vem
da versão do banco.

### Desconto

Duas formas, mutuamente exclusivas (o TypeScript rejeita as duas juntas):

- **Por item** — campo `desconto` no item.
- **Total da nota** — rateio proporcional em centavos, distribuindo o resto pelos maiores
  restos fracionários, com trava para nenhum item ficar com desconto maior que o subtotal.

Nos dois casos o que chega ao banco é `subtotal` líquido, então o motor não precisa saber de
desconto. `subtotal_bruto` e `desconto` ficam gravados só para exibição e auditoria.

## Streak e nível — `fn_rebuild_cliente_fidelidade(cliente, lojista)`

Recalcula tudo do zero, a partir dos fatos:

- `saldo_disponivel` = soma de `pontos_disponiveis` dos lotes `disponivel` não expirados.
- `saldo_pendente` = soma de `pontos_pendentes` dos lotes `pendente` **e** `disponivel`. ⚠ D4
- `saldo_negativo` = soma de `ajustes_pontos` dos tipos `saldo_negativo` e
  `compensacao_cancelamento`. ⚠ **Nada no sistema insere em `ajustes_pontos`.**
- `ultima_compra_valida_em` = maior `data_compra` entre as compras `aprovada`.
- `streak` = tamanho do último grupo de compras aprovadas, agrupadas por intervalo de
  **`30 days` fixo no código** ⚠ D2 — o campo `programas_fidelidade.dias_para_perder_streak`
  é ignorado.
- `nivel_atual_id` = `fn_nivel_por_streak(programa, streak)`: a faixa em que
  `streak_min <= streak <= streak_max` (ou `streak_max` nulo), desempate por `ordem desc`.

Chamada por `fn_processar_compra`, `fn_alocar_fifo_resgate` e `fn_processar_status_resgate`.
**Não** é chamada por `fn_cancelar_compra_com_compensacao` nem por `fn_expirar_lotes`. ⚠

`fn_calcular_streak_cliente` existe, usa `dias_para_perder_streak` corretamente, e é
**código morto** — ninguém a chama.

## Resgate

**Criação** — o `INSERT` em `resgates` com status `pendente` dispara `trg_resgates_reservar`,
que chama `fn_alocar_fifo_resgate`:

- soma o saldo disponível; se for menor que `pontos_solicitados` → exception;
- consome lotes em **FIFO por vencimento**: `order by expira_em asc nulls last, created_at asc`;
- para cada lote consumido cria uma linha em `resgate_alocacoes` (status `pendente`) e move
  `pontos_disponiveis` para `pontos_pendentes`;
- faz rebuild no fim.

⚠ Não valida `premio.pontos_necessarios`, `premio.ativo` nem `premio.nivel_minimo_id`.
`pontos_solicitados` é um número livre, vindo de quem inserir a linha. E **não existe nenhum
endpoint que insira essa linha** — o fluxo inteiro é inalcançável pela aplicação. ⚠ D7

**Decisão** — `fn_processar_status_resgate(resgate, status)`:

- `aprovado`: alocações `pendente` viram `gasto`; nos lotes, `pontos_pendentes` vira
  `pontos_gastos`.
- `recusado` / `cancelado`: alocações viram `revertido`; nos lotes, `pontos_pendentes` volta
  para `pontos_disponiveis`.
- rebuild no fim.

## Cancelamento de compra — `fn_cancelar_compra_com_compensacao(compra_id)`

1. `compras.status = 'cancelada'`, `pontos_total = 0`.
2. Para cada lote da compra: o remanescente (`disponiveis + pendentes`) vira
   `pontos_cancelados`, status `cancelado`, com movimentação `compensacao_cancelamento`.
3. Se o lote tinha `pontos_gastos > 0`, esses pontos já foram embora e precisam ser
   **compensados consumindo outros lotes do cliente**, em FIFO por vencimento.
4. O que não couber em outros lotes vira dívida: `clientes_fidelidade.saldo_negativo += resto`
   mais uma movimentação `saldo_negativo`.

⚠ Grava `saldo_negativo` direto na tabela, mas **não insere em `ajustes_pontos`**, que é de
onde o rebuild lê. O primeiro rebuild seguinte zera a dívida.
⚠ Não chama rebuild no fim, então `saldo_disponivel` fica desatualizado até o próximo evento.

**Prévia** — `fn_prever_cancelamento_compra` devolve JSON com `pontosGerados`,
`pontosJaUsados`, `saldoDisponivelEmOutrosLotes`, `saldoNegativoResultante` e
`precisaConfirmacaoEspecial` (verdadeiro sempre que houve ponto gasto). A UI usa isso para
exigir confirmação extra antes de cancelar.

## Expiração — `fn_expirar_lotes()`

Varre lotes `disponivel` com `expira_em <= now()`, marca como `expirado`, move
`pontos_disponiveis` para `pontos_expirados`, registra movimentação e **decrementa
`saldo_disponivel` na mão** (sem rebuild, e sem recalcular `saldo_pendente`). Retorna a
contagem de lotes expirados.

Só é acionada por `POST /api/internal/expirar-lotes` com o header
`Authorization: Bearer $INTERNAL_CRON_SECRET`. **Não há job agendado** — o `pg_cron` está
instalado no banco, mas sem nenhuma entrada. ⚠ D2

## Invariantes que o banco garante hoje

- `lotes_pontos`: todos os componentes não negativos;
  `disponiveis + gastos + expirados + cancelados <= gerados`.
- `compra_itens`: `quantidade > 0`, `subtotal >= 0`, `desconto >= 0`,
  `desconto <= subtotal_bruto`, percentuais entre 0 e 100.
- `compras`: `desconto_total <= subtotal_bruto`.
- `clientes`: se `pode_fazer_login`, então `auth_user_id`, `email` e `documento` não podem ser
  nulos.
- `programas_fidelidade.validade_dias` e `clientes_fidelidade.validade_dias_custom`: nulos ou
  não negativos.

Invariantes que **não** existem e provavelmente deveriam:

- `resgates.pontos_solicitados` coerente com `premios.pontos_necessarios`;
- unicidade de programa ativo por lojista;
- não sobreposição de faixas de streak entre níveis do mesmo programa;
- `compras.valor_total` igual à soma dos `compra_itens.subtotal`.
