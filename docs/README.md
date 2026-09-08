# Documentação de arquitetura — geti-fidelidade

Estes documentos são o **terreno** para a esteira
`regras de negócio → contratos (Opus) → código (Sonnet) → revisão (Opus)`.

| Arquivo | O que é | Fase |
|---|---|---|
| [01-mapa-atual.md](01-mapa-atual.md) | Inventário do que existe hoje: superfícies, camadas, o que é real e o que é fachada | AS-IS |
| [02-motor-de-pontos-as-is.md](02-motor-de-pontos-as-is.md) | O motor de pontos destrinchado como ele **é**, não como o README diz que é | AS-IS |
| [03-defeitos-e-riscos.md](03-defeitos-e-riscos.md) | Defeitos confirmados contra o banco de produção, ordenados por gravidade | AS-IS |
| [04-decisoes-em-aberto.md](04-decisoes-em-aberto.md) | As perguntas que precisam de resposta **antes** de escrever contrato | Decisão |

Ainda não existem: `contratos/` (fase 2) e `specs/` (fase 3). Eles só devem ser escritos
depois que [04-decisoes-em-aberto.md](04-decisoes-em-aberto.md) estiver respondido, porque
cada decisão em aberto muda a forma do contrato.

## Regra de ouro deste repositório

A verdade sobre o comportamento **não está no TypeScript**. Está nas funções PL/pgSQL do
Supabase. Até 08/set/2026 o schema nem versionado era — ver [../supabase/README.md](../supabase/README.md).
Antes de afirmar qualquer coisa sobre o motor de pontos, ler
`supabase/migrations/20260908181954_remote_schema.sql`, que é o espelho da produção.

Estes documentos foram escritos a partir desse baseline. Se o baseline mudar, eles envelhecem
junto — atualize-os na mesma migration.
