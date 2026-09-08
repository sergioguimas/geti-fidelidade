# Contratos

Um contrato descreve **o que uma área do sistema deve fazer**, com regra, invariante e forma
de entrada e saída. É o que o Sonnet lê para implementar e contra o que o Opus revisa.

## Como ler

Todo contrato abre com um cabeçalho:

| Campo | Significado |
|---|---|
| **Estado** | `AS-IS` documenta o que já existe e funciona — implementar é preservar. `TO-BE` descreve o alvo; o código atual está fora de conformidade e precisa ser trazido para cá. Um contrato pode ser AS-IS no geral com pontos TO-BE marcados. |
| **Depende de** | Decisões de [04-decisoes-em-aberto.md](../04-decisoes-em-aberto.md) e regras de [00-plano-de-negocio.md](../00-plano-de-negocio.md) que sustentam o contrato. |
| **Bloqueado por** | Perguntas ainda abertas. Se houver, a parte afetada **não deve ser implementada**. |

Marcações no corpo:

- **TO-BE** — muda comportamento atual. Exige migration, mudança de tela, ou ambos.
- **Proposta** — melhoria que eu recomendo mas que ainda não foi decidida. Não implementar sem
  aprovação explícita do Sérgio.
- **Armadilha** — comportamento atual que parece certo e não é. Existe para o implementador
  não "consertar" de volta para o errado.

## Onde mora cada coisa

```
docs/contratos/*.md      regra de negócio e invariante, em português   ← fonte
src/contracts/*.ts       schemas Zod de request e response             ← runtime
src/lib/database.types.ts  shape das tabelas, GERADO                   ← nunca editar à mão
```

`src/lib/database.types.ts` é gerado por `npx supabase gen types typescript --linked --schema public`.
Regerar depois de toda migration; nunca corrigir à mão.

## Convenções que valem para todos os contratos

**1. O `lojista_id` nunca vem do cliente.** Vem sempre de `requireLojistaContext(request)`.
Qualquer rota que aceite `lojistaId` no body está errada, mesmo que valide depois.

**2. Filtro por tenant em toda query, além da RLS.** Todo `select`/`update`/`delete` de recurso
de lojista carrega `.eq("lojista_id", lojistaId)` — ou, em tabelas filhas, o join equivalente.
A RLS é a barreira; o filtro é a segunda linha. Hoje `premios` não faz isso e depende só da
RLS ([ver contrato](premios.md)).

**3. Nada de valor derivado vindo do cliente.** Pontos, saldo, percentual aplicado e status de
lote são sempre calculados pelo banco (decisão D5). Request que traga esses campos deve
rejeitá-los, não ignorá-los em silêncio.

**4. Validar com Zod antes de tocar no banco.** Toda rota faz `Schema.safeParse(body)` como
primeira instrução após a autenticação. Nunca confiar no CHECK do Postgres como validação de
entrada: ele existe como última defesa e a mensagem dele não serve para o usuário.

**5. Envelope de resposta.**

```ts
// sucesso — já é assim hoje, não mudar
{ data: T }

// erro — TO-BE, hoje é { error: string } com status 500 para tudo
{ error: { codigo: string, mensagem: string, campos?: Record<string, string> } }
```

Os códigos HTTP passam a ser: `400` request malformado, `422` falhou validação de schema ou
regra de negócio, `401` sem sessão, `403` sessão sem permissão sobre o recurso, `404` recurso
inexistente, `409` conflito (duplicidade, estado inválido), `500` só para falha inesperada.

> **TO-BE coordenado.** Mudar o envelope de erro quebra todo componente que hoje lê
> `json.error` como string. Quem implementar isso muda os dois lados na mesma leva, ou não
> muda. A lista de componentes afetados está em cada contrato.

**6. Erro de negócio não é 500.** Hoje toda exceção do Postgres sobe crua com status 500
([S9](../03-defeitos-e-riscos.md)). Cada contrato lista os erros de negócio esperados com o
código e a mensagem que o usuário deve ver.

## Contratos desta rodada

| Domínio | Estado | Bloqueio |
|---|---|---|
| [produtos.md](produtos.md) | AS-IS com pontos TO-BE | — |
| [premios.md](premios.md) | AS-IS com pontos TO-BE | — |
| [programa-e-niveis.md](programa-e-niveis.md) | **TO-BE** | — |
| [admin.md](admin.md) | AS-IS | — |

Fora desta rodada, esperando decisão: **compras** e **aprovação** (bloqueados por N1),
**resgate** e **área do cliente** (bloqueados por N1 e R3), **motor de pontos** (depende de
N2 e N4).
