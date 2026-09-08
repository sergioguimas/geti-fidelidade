# Contrato — Motor de pontos

| | |
|---|---|
| **Estado** | **TO-BE** — é o contrato que corrige a maior parte da dívida do sistema |
| **Depende de** | Promessas 1, 2 e 4 do [plano](../00-plano-de-negocio.md) · D1, D2, D4, D5, D8, D11, D12 · N2, N4 |
| **Bloqueado por** | **Parcialmente por N1** — tudo que envolve compra lançada pelo cliente está marcado como `⏸ N1` e não deve ser implementado ainda |
| **Schemas** | [`src/contracts/motor-pontos.ts`](../../src/contracts/motor-pontos.ts) |
| **Corrige** | [S3](../03-defeitos-e-riscos.md), S4, S5, S6, S8, S11, S12 |

O motor mora em PL/pgSQL e é a **única** autoridade sobre quantos pontos existem (D5). O
TypeScript grava a compra e os itens, chama a RPC e lê o resultado. Nunca calcula.

## Vocabulário

| Termo | Significado |
|---|---|
| **Lote** | Bloco de pontos gerado por uma compra. Um lote por compra aprovada. |
| **Ledger** | `pontos_movimentacoes`, append-only. **Fonte da verdade** de tudo que aconteceu. |
| **Saldo** | Cache em `clientes_fidelidade`, sempre derivado dos lotes e do ledger. Nunca escrito à mão. |
| **Streak** | Número de compras aprovadas consecutivas sem intervalo maior que `dias_para_perder_streak`. |
| **Dívida** | Saldo negativo: pontos consumidos que deixaram de ter lastro após um cancelamento. |

## Ponto de entrada único — D1

`fn_processar_compra(compra_id)` é chamada **só por RPC**, depois de a compra e os itens
estarem gravados. O trigger `trg_compras_processar` é **dropado**.

> **Por quê:** o trigger dispara `AFTER INSERT` em `compras`, quando os itens ainda não
> existem. Em produção isso gerou **363 lotes de 0 pontos para 365 compras**
> ([S3](../03-defeitos-e-riscos.md)). O lote-lixo depois é cancelado pela RPC, mas fica no
> histórico e vai aparecer no extrato do cliente.

Consequência aceita: `INSERT` manual em `compras` pelo Studio deixa de pontuar. É desejado.

## Cálculo dos pontos de uma compra

### 1. Percentual de cada item — corrige S11

```
percentual_item =
  teto_produto IS NULL  ->  percentual_nivel                     -- sem teto próprio
  teto_produto = 0      ->  0                                    -- não bonifica
  teto_produto > 0      ->  least(teto_produto, percentual_nivel)
```

> **Armadilha que está sendo corrigida:** hoje `teto = 0` cai no `else` e recebe o percentual
> **cheio** do nível. O item que o lojista marcou como "não bonifica" é o que mais pontua.
> Isso contraria diretamente a promessa 4 do plano.

Exige migration tornando `produtos.teto_percentual` **nullable**. Os dois produtos que hoje
estão com `0` (`ESCOLTA` e `COLUNA 21M EMINEX`) precisam de decisão do Sérgio antes: viram `0`
na semântica nova, ou `NULL`? Ver [contrato de produtos](produtos.md).

### 2. Contribuição exata por item, truncamento uma vez só — N4

```
contribuicao_i = subtotal_i × percentual_item_i / 100        -- exata, sem arredondar
pontos_brutos  = floor( Σ contribuicao_i )                   -- trunca UMA vez
pontos         = teto_nivel > 0 ? least(pontos_brutos, teto_nivel) : pontos_brutos
```

> Hoje é `Σ floor(contribuicao_i)`, que descarta fração em cada item, sempre contra o cliente.
> Numa compra real do piloto, com 8 itens, 7 descartaram fração individualmente.

**Isto resolve S6 de vez.** As colunas passam a ter papéis distintos e não concorrentes:

| Coluna | Passa a significar |
|---|---|
| `compra_itens.percentual_aplicado` | o percentual do item, calculado **pelo banco** |
| `compra_itens.pontos_gerados` | a **contribuição exata** daquele item, sem truncar — é auditoria, não é ponto |
| `lotes_pontos.pontos_gerados` | os pontos de verdade: soma truncada, com teto aplicado |
| `compras.pontos_total` | igual ao lote |

A soma das contribuições dos itens **não** precisa bater com o lote — a diferença é a fração
descartada mais o teto do nível. A tela deve deixar isso explícito em vez de esconder.

### 3. Qual nível se aplica

O nível é o que o cliente tinha **antes desta compra** (`clientes_fidelidade.nivel_atual_id`).
A compra que promove de Bronze para Prata é pontuada como Bronze; a próxima já é Prata.

Isso é intencional e foi confirmado por R2: como a importação retroativa é lançada uma a uma
em ordem cronológica, o replay reproduz a evolução real — cada compra pontua com o nível que
as anteriores construíram.

### 4. Nível por streak nunca falha — corrige S12

`fn_nivel_por_streak` **para de lançar exceção**. Se nenhuma faixa cobrir o streak, usa a de
maior `ordem`.

> **Por quê:** a função roda dentro de `fn_rebuild_cliente_fidelidade`, que roda no fim de
> `fn_processar_compra`. Cliente fora de faixa não pontua errado — **derruba a venda inteira**.
> As duas configurações reais de produção estão nessa condição hoje: uma cobre streak 1–3 e a
> outra 1–60, nenhuma com faixa aberta no topo.

A porta do lado da configuração é fechada pelo [contrato de programa e níveis](programa-e-niveis.md),
com `validarCoberturaDeFaixas`. As duas defesas são necessárias: a validação impede configurar
errado daqui pra frente, o fallback protege o que já está errado hoje.

## Validade dos pontos — corrige S5, decide N2

```
dias      = coalesce(cliente.validade_dias_custom, programa.dias_expiracao_pontos)
expira_em = dias > 0 ? data_compra + dias : NULL
```

Três mudanças de uma vez:

1. **A fonte passa a ser `dias_expiracao_pontos`.** `validade_dias` é dropada com backfill.
   Em produção, os dois programas têm `dias_expiracao_pontos` preenchido (180 e 60) e
   `validade_dias` nulo — por isso **1073 dos 1076 lotes nunca vencem**.
2. **A contagem parte de `data_compra`, não de `now()`** (N2, plano fiel). Compra retroativa
   antiga gera lote já vencido, e isso é o resultado correto: a pergunta que o lojista faz é
   "quantos pontos ele teria hoje".
3. **`validade_dias_custom` substitui**, não amplia. Hoje é `greatest(programa, custom)`, o que
   só permite aumentar a validade. Passa a ser `coalesce`, permitindo os dois sentidos.

**Lote que nasce vencido nasce `expirado`**, com `pontos_expirados = pontos_gerados` e
`pontos_disponiveis = 0` — não `disponivel` esperando o cron. Isso preserva a invariante de que
lote `disponivel` nunca contém ponto vencido, e faz a importação retroativa dar o número certo
sem depender de agendamento.

### Agendamento

`fn_expirar_lotes()` roda por **`pg_cron` diário**. A rota `POST /api/internal/expirar-lotes`
continua existindo como gatilho manual de suporte. Hoje o `pg_cron` está instalado **sem
nenhum job** e a rota não é chamada por ninguém.

A função passa a **chamar `fn_rebuild_cliente_fidelidade`** em vez de decrementar
`saldo_disponivel` na mão — hoje ela mexe no saldo diretamente e nem recalcula o pendente.

## Streak — corrige S5

O agrupamento passa a usar `programa.dias_para_perder_streak` no lugar do
`interval '30 days'` escrito no código. Este é o mecanismo da **promessa 2** do plano: é o que
impede o cliente de comprar uma vez por ano e resgatar prêmio alto. Os dois lojistas de
produção configuraram 45 e 60 dias, e nenhum dos dois valores tem efeito hoje.

`fn_calcular_streak_cliente` é **removida**: é código morto e implementa a regra certa num
lugar que ninguém chama, o que é pior que não existir.

## Os quatro saldos — corrige S8, decide D4

`lotes_pontos.pontos_pendentes` hoje guarda duas coisas opostas. Passa a ser duas colunas:

| Coluna do lote | Significa | Vira o quê no cliente |
|---|---|---|
| `pontos_disponiveis` | pode ser usado agora | `saldo_disponivel` |
| `pontos_a_liberar` | compra ainda não aprovada | `saldo_a_liberar` |
| `pontos_reservados` | comprometido com resgate pendente | `saldo_reservado` |
| `pontos_gastos` | resgate aprovado | — |
| `pontos_expirados` | venceu | — |
| `pontos_cancelados` | compra cancelada | — |

Para o cliente final, "a liberar" é promessa e "reservado" é compromisso — e hoje os dois
aparecem no mesmo número, com sinais opostos.

O CHECK de soma passa a incluir as duas colunas novas.

## Dívida — corrige S4, decide D8 e R5

**Fonte da verdade é o ledger.** `ajustes_pontos` é **dropada**: nada nunca escreveu nela, e é
exatamente por isso que o rebuild zerava a dívida silenciosamente.

O ledger ganha o tipo `quitacao_saldo_negativo` no enum `pontos_movimentacao_tipo`.

```
divida = Σ movimentações 'saldo_negativo' − Σ movimentações 'quitacao_saldo_negativo'
```

### Como a dívida é abatida

Na geração de pontos, **antes** de o lote ficar disponível:

1. o lote nasce com o valor **cheio** — isso é requisito de R5, para o extrato contar a
   história inteira;
2. se há dívida, abate-se `min(divida, pontos_do_lote)`, movendo de `pontos_disponiveis` para
   `pontos_gastos` e registrando `quitacao_saldo_negativo`;
3. o cliente vê "ganhou X" e "X usados para abatimento", não um silencioso "ganhou 0".

**Por padrão o abatimento é de 100%** dos pontos da compra até quitar (R5). A dívida **não
prescreve** — fica indefinidamente até ser quitada.

> Se um dia o limite virar configurável por lojista, o campo entra em `programas_fidelidade` e
> este contrato muda junto. Hoje é 100% fixo, e é assim que deve ser implementado — sem campo
> "para o futuro".

## Cancelamento de compra

O comportamento atual está **correto** e deve ser preservado: cancela o remanescente do lote,
compensa em FIFO por vencimento o que já foi gasto, e o que não couber vira dívida.

Duas correções:

1. **registrar a dívida no ledger** (tipo `saldo_negativo`), e não gravar direto em
   `clientes_fidelidade.saldo_negativo`;
2. **chamar `fn_rebuild_cliente_fidelidade` no fim** — hoje não chama, e o saldo fica
   desatualizado até o próximo evento.

`fn_prever_cancelamento_compra` continua como está: é ela que alimenta a confirmação extra na
tela quando há ponto já gasto.

## Importação retroativa — D12, R2

Não é um caminho paralelo: é um **laço cronológico sobre o fluxo normal**. Para cada compra do
arquivo, em ordem crescente de `data_compra`, faz-se exatamente o que uma compra nova faz. É
isso que faz o nível evoluir mês a mês em vez de o histórico inteiro ser pontuado com o nível
final.

**Limitação conhecida e aceita:** inserir uma compra com data anterior a compras já
processadas recalcula o streak e o nível **atuais** (o rebuild lê todo o histórico), mas **não
repontua** os lotes já criados — eles mantêm o percentual do nível vigente quando foram
gerados. Reprocessar o histórico inteiro é caro e arriscado, e ficou fora de escopo.

Recomendação para a tela: importar o histórico **antes** de começar o uso corrente, e avisar o
lojista quando a data for anterior à última compra já lançada.

## Simulação de pontos — Q1

`fn_simular_pontos(p_lojista_id uuid, p_cliente_id uuid, p_itens jsonb)` devolve o cálculo sem
gravar nada. Usa **exatamente** o mesmo caminho de código da pontuação real — não é uma segunda
implementação.

É o que permite a tela de vendas mostrar a prévia depois que o cálculo saiu do TypeScript (D5).

## ⏸ N1 — o que fica pendente

Não implementar enquanto N1 não for decidido:

- compra com `origem = 'cliente'` e o estado *aguardando detalhamento*;
- a transição de aprovação movendo `pontos_a_liberar` para `pontos_disponiveis`;
- validação da chave de acesso e unicidade de `(lojista_id, chave_acesso)`;
- `produtos.codigo_externo` e o casamento de item de XML.

O resto deste contrato **não depende de N1** e pode ser implementado agora.

## Invariantes

1. Nenhuma venda falha por causa de configuração de programa ou nível.
2. `pontos_disponiveis + a_liberar + reservados + gastos + expirados + cancelados ≤ pontos_gerados`.
3. Todo saldo em `clientes_fidelidade` é derivado; nenhuma função escreve nele fora do rebuild.
4. Todo movimento de ponto tem uma linha no ledger, e o ledger nunca é alterado nem apagado.
5. Lote `disponivel` nunca contém ponto vencido.
6. Compra com ponto já gasto não é reprocessada — precisa ser cancelada (regra atual, manter).
7. Todo limite e prazo vem do programa do lojista. Nenhum valor fixo no motor (promessa 3).
8. O cálculo acontece só no Postgres.

## Erros de negócio esperados

| Situação | HTTP | Código |
|---|---|---|
| Compra sem itens | 422 | `COMPRA_SEM_ITENS` |
| Reprocessar compra com ponto gasto | 409 | `COMPRA_COM_PONTOS_USADOS` |
| Lojista sem programa ativo | 422 | `PROGRAMA_INEXISTENTE` |
| Programa sem nenhum nível | 422 | `PROGRAMA_SEM_NIVEIS` |
| Data de compra no futuro | 422 | `DATA_COMPRA_FUTURA` |

## Ordem de implementação

Da menor para a maior superfície de risco. Cada passo é uma migration própria, e os três
primeiros não mudam número nenhum que já esteja na tela:

1. **Fallback de nível** (S12) — para de derrubar venda. Urgente: os dois lojistas estão
   configurados de forma a travar.
2. **Dropar o trigger** (S3) — para de gerar lote-lixo.
3. **Ledger como fonte da dívida** (S4) — cria `quitacao_saldo_negativo`, dropa `ajustes_pontos`,
   cancelamento passa a registrar no ledger e a chamar rebuild.
4. **Separar os saldos** (S8) — duas colunas novas, CHECK atualizado, rebuild ajustado.
5. **Percentual do item e floor no total** (S11, N4) — `teto_percentual` nullable; **exige a
   decisão sobre os dois produtos com zero**.
6. **Validade e streak lendo a configuração** (S5, N2) — dropa `validade_dias`, `pg_cron`
   diário. **Muda número visível: pontos passam a expirar.** Avisar os lojistas antes.
7. **Abatimento de dívida na geração** (D8, R5).
8. **`fn_simular_pontos`** (Q1) e a prévia na tela de vendas.

O passo 6 é o único que muda saldo de cliente existente. Vale rodar em janela combinada e
medir antes e depois.

## Componentes que mudam junto

`src/lib/merchant/compras.ts` (para de calcular pontos), `compra-form.tsx` (prévia via RPC),
`compras-table.tsx` (mostrar contribuição do item x pontos do lote),
`clientes-table.tsx` e `dashboard.ts` (quatro saldos em vez de três).
