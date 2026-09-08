# Contrato — Programa de fidelidade e níveis

| | |
|---|---|
| **Estado** | **TO-BE** — o código atual está fora de conformidade em três pontos |
| **Depende de** | Promessas 1, 2 e 3 do [plano](../00-plano-de-negocio.md) · D2 (campo único de prazo) · R4/N3 (um programa ativo) · [S5](../03-defeitos-e-riscos.md) e [S12](../03-defeitos-e-riscos.md) |
| **Bloqueado por** | — |
| **Schemas** | [`src/contracts/programa-niveis.ts`](../../src/contracts/programa-niveis.ts) |

Este é o contrato mais importante desta rodada. O programa e seus níveis **são** as promessas
1 e 2 do plano de negócio: pontuação progressiva e exigência de frequência. Os dois defeitos
que ele corrige são os que mais afetam o produto hoje.

## Entidades

### `programas_fidelidade`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | banco |
| `lojista_id` | uuid | do contexto |
| `nome` | varchar(120) | obrigatório, `trim` |
| `dias_expiracao_pontos` | integer | **a fonte da verdade da validade** (D2). Maior ou igual a 0; `0` significa "não expira" |
| `dias_para_perder_streak` | integer | **a fonte da verdade da janela de frequência** (D2). Maior que 0 |
| `ativo` | boolean | ver invariante 1 |
| ~~`validade_dias`~~ | — | **removida** pela migration de D2, com backfill para `dias_expiracao_pontos` |

### `programa_niveis`

| Campo | Tipo | Regra |
|---|---|---|
| `programa_id` | uuid | FK, `ON DELETE CASCADE` |
| `nome` | varchar | obrigatório |
| `streak_min` | integer | maior ou igual a 1 |
| `streak_max` | integer nulo | nulo significa "sem topo"; obrigatório ser nulo na última faixa |
| `percentual_conversao` | numeric(5,2) | 0 a 100 — quantos % do valor viram ponto |
| `teto_pontos_compra` | integer | maior ou igual a 0; `0` significa "sem teto" |
| `ordem` | integer | ordena a exibição e desempata faixa |

## Os três desvios que este contrato corrige

### 1. TO-BE — a configuração de prazo precisa ser lida pelo motor

Hoje a tela grava `dias_expiracao_pontos` e `dias_para_perder_streak`, e o motor ignora os
dois: lê `validade_dias` (que ninguém escreve, logo nulo) para validade, e usa
`interval '30 days'` escrito no código para streak.

Medido em produção em 08/set: **1073 de 1076 lotes com `expira_em` nulo**, e os dois programas
com `validade_dias` nulo e `dias_expiracao_pontos` preenchido (180 e 60). Ou seja, **nenhum
ponto expira hoje** e a janela de streak dos dois lojistas (45 e 60 dias) não vale nada — o
motor usa 30.

Alvo:

- `fn_processar_compra` calcula `expira_em` a partir de `dias_expiracao_pontos`;
- `fn_rebuild_cliente_fidelidade` agrupa o streak por `dias_para_perder_streak`;
- `validade_dias` é dropada;
- `clientes_fidelidade.validade_dias_custom` passa a **substituir** o valor do programa
  (`coalesce(custom, programa)`) em vez de `greatest`, que só permitia aumentar.

### 2. TO-BE — as faixas de streak não podem deixar buraco

`fn_nivel_por_streak` **lança exceção** quando nenhuma faixa cobre o streak, e roda no fim de
`fn_processar_compra`. Logo, cliente fora de faixa **derruba a venda inteira**
([S12](../03-defeitos-e-riscos.md)). Em produção há um lojista cujo único nível cobre streak
de 1 a 3, com clientes ativos: está a uma compra de travar.

Alvo, nas duas pontas:

- **No motor:** se nenhuma faixa casar, usar a de maior `ordem` em vez de estourar. Venda
  nunca falha por configuração de nível.
- **Na configuração:** ao salvar qualquer nível, validar o conjunto do programa —
  1. a menor faixa começa em `streak_min = 1`;
  2. as faixas são contíguas: `streak_min` de cada faixa é `streak_max` da anterior + 1;
  3. não há sobreposição;
  4. exatamente uma faixa tem `streak_max` nulo, e é a de maior `ordem`.

  A validação é do **conjunto**, não da linha. Salvar um nível isolado que quebre a cobertura
  deve ser recusado com `422` explicando qual regra falhou.

### 3. TO-BE — um programa ativo por lojista

`fn_programa_ativo` faz `order by created_at desc limit 1`: havendo dois ativos, um é
silenciosamente ignorado. Com R4 (multi-programa fora de escopo), isso vira invariante:
índice único parcial `unique (lojista_id) where ativo`.

> Se a migration falhar por já existir lojista com dois ativos, **não force**: isso é
> informação, não obstáculo. Levante quais são e trate antes.

## Operações

Todas em `/api/lojista/configuracoes`, hoje multiplexadas por `body.type`.

| Método | `type` | Efeito |
|---|---|---|
| `GET` | — | Devolve `{ programa, niveis }`. Programa ativo mais recente do lojista; níveis ordenados por `ordem` |
| `PATCH` | `programa` | Atualiza nome, prazos e `ativo` |
| `PATCH` | `nivel` | Atualiza um nível |
| `POST` | `nivel` | Cria nível |
| `DELETE` | — (`?id=`) | Exclui nível |

> **TO-BE:** `updateNivel` e `deleteNivel` recebem `lojistaId` e **não o usam** no `WHERE`.
> A RLS de `programa_niveis` protege, mas a convenção 2 do [README](README.md) exige o filtro
> explícito. Corrigir.

> **Armadilha na exclusão de nível.** `programa_niveis` é referenciada por
> `clientes_fidelidade.nivel_atual_id` e por `premios.nivel_minimo_id`, ambas sem
> `ON DELETE`, portanto `RESTRICT`. Excluir um nível em uso falha com erro de integridade que
> hoje sobe como 500. A rota deve checar antes e responder `409` dizendo **quantos** clientes
> e prêmios dependem daquele nível. E, mesmo sem referência, a exclusão só é permitida se o
> conjunto restante continuar cobrindo de 1 ao infinito.

## Invariantes

1. Cada lojista tem **no máximo um** programa ativo.
2. As faixas de streak de um programa cobrem `[1, ∞)` sem buraco e sem sobreposição.
3. Exatamente um nível por programa tem `streak_max` nulo.
4. Nenhuma venda falha por causa de configuração de nível.
5. `percentual_conversao` está entre 0 e 100; `teto_pontos_compra` e os prazos não são
   negativos.
6. Prazo e teto são **sempre** lidos do programa do lojista. Nenhum default global no motor
   (promessa 3 do plano).

## Erros de negócio esperados

| Situação | HTTP | Código |
|---|---|---|
| Faixas com buraco ou sobreposição | 422 | `NIVEIS_COBERTURA_INVALIDA` |
| Nenhuma faixa com `streak_max` nulo, ou mais de uma | 422 | `NIVEIS_TOPO_INVALIDO` |
| Segundo programa ativo no mesmo lojista | 409 | `PROGRAMA_ATIVO_DUPLICADO` |
| Excluir nível referenciado | 409 | `NIVEL_EM_USO` |
| Excluir nível que deixaria buraco na cobertura | 422 | `NIVEIS_COBERTURA_INVALIDA` |
| Programa de outro lojista | 404 | `PROGRAMA_NAO_ENCONTRADO` |

## Ordem sugerida de implementação

1. Validação de cobertura de faixas na configuração (fecha a porta).
2. Fallback no `fn_nivel_por_streak` (para de derrubar venda).
3. Migration de D2: motor passa a ler `dias_expiracao_pontos` e `dias_para_perder_streak`,
   `validade_dias` é dropada.
4. Índice único de programa ativo.

Os passos 1 e 2 são independentes e podem ir juntos; o 3 muda comportamento visível — pontos
passam a expirar — e merece aviso ao lojista antes de subir.

## Componentes que mudam junto

`src/components/lojista/programa-form.tsx`, `nivel-form.tsx`, `niveis-table.tsx`,
`src/app/(merchant)/lojista/configuracoes/programa/page.tsx`.
