# 03 — Defeitos e riscos confirmados

Tudo aqui foi verificado contra o baseline de produção
(`supabase/migrations/20260908181954_remote_schema.sql`), não contra os dumps antigos.
Ordenado por gravidade. O que exige decisão de negócio aparece também em
[04](04-decisoes-em-aberto.md).

---

## S1 · ✅ CORRIGIDO em 08/set/2026 · Todas as funções do motor estavam liberadas para `anon`

> Corrigido pela migration `20260908191820_fecha_execucao_anonima_e_restaura_rls`.
> Verificado contra produção: antes, `POST /rest/v1/rpc/fn_programa_ativo` com a chave
> anônima executava a função e devolvia erro de negócio (`P0001`); depois, devolve
> `42501 permission denied`. **Continua pendente** a checagem de tenant dentro das quatro
> funções que a aplicação chama com sessão de usuário — ver S1.1.

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

## S2 · ✅ CORRIGIDO em 08/set/2026 · RLS de multi-tenant estava anulada em 6 tabelas

> Corrigido pela mesma migration. As seis policies `USING (true)` foram dropadas e
> `lojistas` — que só tinha aquela — ganhou `lojistas_select_own_ou_admin`, cobrindo os dois
> acessos legítimos que existem no código: o lojista lendo o próprio registro e o admin
> listando todos. **Verificado pelo Sérgio em 08/set**: login do lojista e liberação de acesso
> de cliente funcionam — os dois caminhos autenticados que a mudança de policy poderia ter
> quebrado. Correção fechada.

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


---

## S1.1 · Alto · PENDENTE · Falta checagem de tenant nas 4 RPCs que o app chama

A migration de 08/set fechou o acesso anônimo, mas manteve `EXECUTE` para `authenticated` em
`fn_processar_compra`, `fn_prever_cancelamento_compra`, `fn_cancelar_compra_com_compensacao` e
`fn_processar_status_resgate`, porque é assim que a aplicação as chama (com a sessão do
usuário). Como as três primeiras são `SECURITY DEFINER`, **qualquer usuário logado — inclusive
um cliente final — ainda consegue chamá-las com o UUID de um registro de outro lojista.**

A correção é uma guarda no topo de cada uma:

```sql
if not public.fn_pode_operar_lojista(v_compra.lojista_id) then
  raise exception 'Acesso negado' using errcode = '42501';
end if;
```

com um helper que libera quando não há JWT (pg_cron, service role) e, havendo, exige vínculo
em `lojistas_usuarios` ou admin ativo.

Não foi aplicada junto porque muda o corpo das funções do motor e o modo de falha — lojista
sem conseguir lançar venda — só aparece em tela logada, que eu não consigo testar. Deve ir
junto com um teste manual, ou dentro da rodada de contratos.

---

## S10 · Médio · A lista de clientes do painel admin já vem vazia

`GET /api/admin/clientes` lê a tabela `clientes` com a **sessão do admin**, mas todas as
policies de `clientes` exigem vínculo em `lojistas_usuarios` — e um admin da plataforma não
tem esse vínculo. A consulta retorna `[]` sempre.

Isso é anterior à migration de 08/set e **não foi alterado por ela**: nenhuma das seis policies
dropadas era de `clientes`. Corrigir exige uma policy de leitura para admin, o que é mudança
de comportamento do painel (a tela passa a mostrar dados que hoje não mostra) — por isso ficou
de fora da migration de segurança e entra como decisão de escopo.

---

## S11 · Crítico para o negócio · Teto de produto igual a zero pontua o máximo

Descoberto ao confrontar o motor com a promessa 4 do [plano de negócio](00-plano-de-negocio.md).
Trecho real de `fn_processar_compra`, linha 764 do baseline:

```sql
v_teto_produto := coalesce(v_item.teto_percentual, 0);

if v_teto_produto > 0 then
  v_percentual_item := least(v_teto_produto, v_nivel.percentual_conversao);
else
  v_percentual_item := v_nivel.percentual_conversao;   -- <== teto 0 vira percentual cheio
end if;
```

O lojista que cadastra um produto com `teto_percentual = 0` está dizendo "este item não
bonifica". O motor entende o contrário e aplica o percentual **integral** do nível — o máximo
possível. Um item de revenda de margem zero passa a ser o item que mais pontua da loja.

O zero é um valor perfeitamente cadastrável: o CHECK da tabela aceita `>= 0`, o formulário
aceita, e o importador de CSV/XLSX também.

**Impacto direto na promessa 4.** O teto por produto existe justamente para o piloto não
pontuar acima da margem em item de revenda. No caso extremo — margem zero — o sistema faz
exatamente o oposto do contratado.

**Correção:** `least(coalesce(teto_produto, nivel.percentual_conversao), nivel.percentual_conversao)`,
tratando **nulo** como "sem teto próprio, usa o do nível" e **zero** como "não pontua". Isso
exige distinguir os dois no schema: hoje `produtos.teto_percentual` é `NOT NULL`, então não há
como expressar "sem teto". Vira decisão de contrato.

**Antes de corrigir, conferir os dados:** se algum produto em produção já está com teto zero,
os lotes gerados por ele foram inflados. Vale um levantamento de quantos produtos estão nessa
condição e de quantas compras foram afetadas.

---

## S12 · Crítico · Cliente que passa da última faixa de streak trava a venda

`fn_nivel_por_streak` **lança exceção** quando nenhuma faixa cobre o streak:

```sql
if v_nivel.id is null then
  raise exception 'Nenhum nível encontrado para programa % e streak %', ...
```

Ela é chamada por `fn_rebuild_cliente_fidelidade`, que por sua vez roda no **fim** de
`fn_processar_compra`. Ou seja: quando o cliente ultrapassa a última faixa configurada, não é a
pontuação que fica errada — **a compra inteira falha**. O lojista não consegue registrar a
venda, e a mensagem que chega à tela é o texto cru do Postgres.

### Estado em produção (08/set/2026)

| Lojista | Programa | Faixas de nível | Clientes | Situação |
|---|---|---|---|---|
| `9f69ff2a` | Programa Padrão | **Bronze: streak 1 a 3** | 3 | 4 compras lançadas. Nenhum cliente chegou a streak 4 **ainda** |
| `9402e00e` (piloto) | Fidelidade | Fidelidade: streak 1 a 60 | 122 | maior streak hoje é 15 |

O piloto está longe do limite. O outro lojista está a **uma compra** de travar: qualquer um dos
três clientes que faça a quarta compra consecutiva dentro da janela de streak derruba o
lançamento.

### Correção

Duas camadas, e as duas são necessárias:

1. **No motor** — a última faixa deve ser aberta. Se nenhuma casar, usar a de maior `ordem` em
   vez de estourar. Nunca fazer uma venda falhar por causa de configuração de nível.
2. **Na configuração** — validar ao salvar que as faixas cobrem de 1 ao infinito sem buraco e
   sem sobreposição, e que a última tem `streak_max` nulo. Hoje nada impede o lojista de
   configurar Bronze de 1 a 3 e parar por aí, que é exatamente o que aconteceu.

Vale também revisar o texto de erro: hoje qualquer falha do motor volta como HTTP 500 com a
mensagem do Postgres ([S9](03-defeitos-e-riscos.md)).

---

## Dimensionamento dos achados em produção — 08/set/2026

Números tirados do banco no dia, para priorizar pelo dano real e não pela gravidade teórica.

| Achado | Medida | Leitura |
|---|---|---|
| [S3](03-defeitos-e-riscos.md) lote-lixo | **363 lotes de 0 pontos** para **365 compras**; 1076 lotes no total | Confirmado: praticamente um lote-lixo por compra, quase 3 lotes por compra contando as edições |
| [S5](03-defeitos-e-riscos.md) expiração morta | **1073 de 1076 lotes** com `expira_em` nulo. Os dois programas têm `dias_expiracao_pontos` preenchido (180 e 60) e `validade_dias` **nulo** | Confirmado pela causa exata que o documento previa: a UI grava um campo, o motor lê outro |
| [S11](03-defeitos-e-riscos.md) teto zero | **2 produtos ativos** com teto 0: `ESCOLTA` e `COLUNA 21M EMINEX` | Real, mas de alcance pequeno hoje. Numa compra observada de R$ 14.912, o `teto_pontos_compra` do nível (50) cortou o total muito antes, mascarando a inflação |
| [S6](03-defeitos-e-riscos.md) duas fórmulas | Na mesma compra, a soma dos itens gravada pelo TypeScript dá **124,13** e o lote tem **50** | Confirmado. Parte da diferença é o teto do nível, parte é a divergência de fórmula |
| S12 faixa de streak | 0 clientes fora de faixa hoje, mas 1 lojista com teto de faixa em 3 e clientes ativos | Bomba-relógio: não dá erro hoje, derruba a venda amanhã |
