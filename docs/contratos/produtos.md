# Contrato — Produtos e importação de produtos

| | |
|---|---|
| **Estado** | **AS-IS** no CRUD e na importação · **TO-BE** na semântica do teto e na exclusão |
| **Depende de** | Promessa 4 do [plano](../00-plano-de-negocio.md) (teto protege margem) · D5 (cálculo mora no banco) |
| **Bloqueado por** | — |
| **Schemas** | [`src/contracts/produtos.ts`](../../src/contracts/produtos.ts) |

Produto é o item do catálogo do lojista. Ele existe por **um motivo só**: carregar o
`teto_percentual`, que limita quanto daquele item vira ponto. Sem essa coluna o produto seria
apenas uma descrição.

## Entidade

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | gerado pelo banco |
| `lojista_id` | uuid | **sempre** do contexto de sessão, nunca do request |
| `descricao` | varchar(200) | obrigatória, `trim`, 1 a 200 caracteres |
| `teto_percentual` | numeric(5,2) | 0 a 100 — semântica em disputa, ver abaixo |
| `ativo` | boolean | default `true` |
| `created_at` / `updated_at` | timestamptz | banco |

## A semântica do teto — TO-BE

Como o motor lê hoje ([S11](../03-defeitos-e-riscos.md)):

```sql
if teto_produto > 0 then least(teto_produto, nivel.percentual_conversao)
else nivel.percentual_conversao      -- teto 0 vira percentual CHEIO
end if
```

> **Armadilha.** O lojista que digita `0` está dizendo "este item não bonifica". O sistema
> entende "bonifica o máximo". Em produção há dois produtos ativos nessa condição:
> `ESCOLTA` e `COLUNA 21M EMINEX`.

**Alvo:** três estados distintos, e para isso a coluna precisa aceitar nulo.

| Valor | Significado | Percentual aplicado ao item |
|---|---|---|
| `NULL` | sem teto próprio — segue o nível | `nivel.percentual_conversao` |
| `0` | não bonifica | `0` |
| `n > 0` | teto próprio | `least(n, nivel.percentual_conversao)` |

Isso exige migration tornando `teto_percentual` nullable e ajustando `fn_processar_compra`.

**Decidido em 08/set/2026:** os dois produtos que hoje estão com `0` (`ESCOLTA` e
`COLUNA 21M EMINEX`) **continuam com `0`** e passam a não pontuar — que é o que o lojista quis
dizer ao digitar zero. A migration não precisa converter nada: só mudar a semântica de leitura
no motor. O efeito prático é que esses dois itens deixam de gerar pontos nas próximas compras.

## Operações

### Listar — `GET /api/lojista/produtos?busca=`

Filtra por `lojista_id` do contexto, `ilike` em `descricao` quando há busca, ordena por
`descricao` ascendente. Devolve `teto_percentual` já convertido para `number` (o Postgres
devolve `numeric` como string).

> **TO-BE:** remover o `console.log("listProdutos debug", { lojistaId, data, error })` de
> `src/lib/merchant/produtos.ts` — hoje despeja o catálogo inteiro no log do servidor a cada
> chamada.

### Criar — `POST /api/lojista/produtos`

Request: `descricao`, `tetoPercentual`, `ativo?`. `lojista_id` vem do contexto.

> **Proposta (não implementar sem aprovação):** hoje nada impede dois produtos com a mesma
> descrição no mesmo lojista, e a importação deduplica por descrição normalizada — então um
> catálogo com duplicata deixa a importação sem saber qual atualizar. Um índice único
> `(lojista_id, lower(trim(descricao)))` fecharia isso, mas pode falhar na criação se já
> houver duplicata em produção.

### Atualizar — `PATCH /api/lojista/produtos`

Request: `id`, `descricao`, `tetoPercentual`, `ativo?`. A query já filtra por `id` **e**
`lojista_id` — manter assim.

> **Armadilha:** `ativo` usa `input.ativo ?? true`. Omitir o campo **reativa** um produto
> inativo, em vez de preservar o estado. No contrato TO-BE, `ativo` omitido preserva o valor
> atual; só muda quando vier explícito.

### Excluir — `DELETE /api/lojista/produtos?id=`

Hoje é **exclusão física**. `compra_itens.produto_id` tem FK `ON DELETE RESTRICT`, então
excluir um produto já usado em qualquer compra falha com erro de integridade que sobe como
HTTP 500 com o texto do Postgres.

> **TO-BE:** exclusão passa a ser **desativação** (`ativo = false`), como já é em prêmios.
> Um produto usado em compra é histórico contábil e não pode sumir. A exclusão física só
> permanece para produto nunca usado, e nesse caso a rota deve verificar antes e responder
> `409` com mensagem clara em vez de deixar o banco estourar.

### Importar — `POST /api/lojista/produtos/importar/preview`

Recebe `{ csv: string }`. O XLSX é convertido para CSV no navegador (biblioteca `xlsx`); o
servidor só conhece CSV.

Formato esperado, com cabeçalho obrigatório:

```
descricao;tetoPercentual;ativo
```

Regras de parsing, todas AS-IS:

- separador é `;` se a **primeira linha** contiver `;`, senão `,`;
- `descricao` e `tetoPercentual` são colunas obrigatórias; `ativo` é opcional;
- `tetoPercentual` aceita `50`, `50%`, `1,5` — remove `%` e troca vírgula por ponto;
- `ativo` aceita `sim/s/true/1/ativo` e `nao/não/n/false/0/inativo`;
- linhas em branco são descartadas;
- a chave de deduplicação é a descrição **normalizada**: `trim`, espaços internos colapsados,
  minúsculas.

Classificação de cada linha, nesta ordem de precedência:

1. `invalido` — descrição vazia; descrição > 200; `tetoPercentual` nulo ou fora de 0–100;
   descrição repetida **dentro do próprio arquivo** (aponta a primeira linha);
2. `duplicado` — descrição normalizada já existe no catálogo; devolve o registro existente
   para o lojista comparar e decidir;
3. `novo`.

Resposta: `{ novos, duplicados, invalidos, resumo: { totalLinhas, novos, duplicados, invalidos } }`.

> **Armadilhas do parser, todas AS-IS e todas conhecidas:**
> - `ativo` com valor irreconhecível vira `true` silenciosamente, não `invalido`;
> - o split é ingênuo: um campo entre aspas contendo o separador quebra a linha;
> - não há limite de tamanho de arquivo nem de número de linhas.
>
> Nenhuma é para "consertar de passagem" — se forem corrigidas, vira mudança de contrato com
> teste próprio.

> **TO-BE:** esta rota reimplementa a autenticação à mão (`createRouteClient` + consulta a
> `lojistas_usuarios`) em vez de usar `requireLojistaContext`. Unificar. O mesmo vale para
> `importar/confirmar`.

### Confirmar importação — `POST /api/lojista/produtos/importar/confirmar`

Recebe a lista revisada pelo lojista, cada item com `acao: "criar" | "atualizar"`. Itens com
`atualizar` trazem `id`.

## Invariantes

1. Todo produto pertence a exatamente um lojista, e nenhuma operação atravessa essa fronteira.
2. `teto_percentual` está entre 0 e 100 — garantido por CHECK e revalidado por Zod.
3. Produto referenciado por `compra_itens` nunca é excluído fisicamente.
4. A descrição gravada é a original (com maiúsculas e espaçamento do lojista); a normalizada
   só existe como chave de comparação e nunca é persistida.

## Erros de negócio esperados

| Situação | HTTP | Código |
|---|---|---|
| Schema inválido | 422 | `PRODUTO_INVALIDO` (com `campos`) |
| Produto de outro lojista | 404 | `PRODUTO_NAO_ENCONTRADO` (nunca 403 — não confirma existência) |
| Exclusão de produto em uso | 409 | `PRODUTO_EM_USO` |
| CSV sem cabeçalho obrigatório | 422 | `IMPORTACAO_CABECALHO_INVALIDO` |
| CSV vazio | 422 | `IMPORTACAO_VAZIA` |

## Componentes que mudam junto no TO-BE

`src/components/lojista/produtos-table.tsx`, `produto-form.tsx`,
`importacao-produtos-page.tsx`, `src/app/(merchant)/lojista/produtos/page.tsx`.
