# Banco de dados

O banco é um projeto Supabase hospedado (`Fidelidade`, ref `wdtthggpzfyjqtoriwvm`, Postgres 17).
**A regra de negócio de pontos mora aqui**, em funções PL/pgSQL — não no TypeScript.

## Baseline

`migrations/20260908181954_remote_schema.sql` é o **espelho do schema de produção** em
08/set/2026, gerado com `supabase db pull` e registrado no histórico remoto
(`supabase_migrations.schema_migrations`) via `migration repair`.

Até esta data o schema **não era versionado**: o `.gitignore` da raiz tinha `*.sql`, e todo
o DDL era aplicado à mão pelo Studio. O resultado é que correções feitas direto em produção
não existiam em lugar nenhum no repositório — por exemplo, a chamada de
`fn_rebuild_cliente_fidelidade` no fim de `fn_processar_compra`, que conserta a atualização de
saldo/streak/nível depois de uma compra, só foi descoberta ao puxar o schema.

`_arquivo_pre_baseline/` guarda os dumps e migrations soltos anteriores, apenas como
registro histórico. **Não aplicar**: estão defasados e já foram absorvidos pelo baseline.

## Fluxo daqui pra frente

Toda mudança de schema vira arquivo de migration, nunca DDL solto no Studio:

```bash
npx supabase migration new nome_da_mudanca   # cria o arquivo
# escreve o DDL no arquivo gerado
npx supabase db push                         # aplica em produção
```

Se algo for alterado direto no Studio (emergência), reconciliar depois:

```bash
npx supabase db pull                         # traz a diferença como nova migration
```

`supabase db pull` e `db push` precisam do **Docker Desktop rodando** (o CLI executa o
`pg_dump` dentro de um container). As credenciais de acesso já estão no login do CLI
(`supabase login`) — não há segredo em arquivo neste diretório.

## Pontos em aberto conhecidos

- A tela de configurações grava `programas_fidelidade.dias_expiracao_pontos`, mas
  `fn_processar_compra` calcula `expira_em` a partir de `validade_dias`. Nada no `src/`
  escreve `validade_dias`.
- A extensão `pg_cron` está instalada, mas **não há job agendado**: `fn_expirar_lotes` só roda
  se alguém chamar `POST /api/internal/expirar-lotes`.
