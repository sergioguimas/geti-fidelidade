-- Fecha as duas brechas remotamente exploráveis encontradas na varredura de 08/set/2026.
-- Contexto: docs/03-defeitos-e-riscos.md, achados S1 e S2.
--
-- O app está publicado (Vercel, geti-fidelidade.vercel.app) com a chave anônima no bundle,
-- e o repositório é público. As duas coisas abaixo eram exploráveis por qualquer pessoa.

-- =====================================================================
-- S1 · Nenhuma função do domínio continua executável sem autenticação
-- =====================================================================
-- Em Postgres toda função nasce com EXECUTE para PUBLIC, e além disso havia
-- GRANT ALL explícito para "anon". Revogar só de anon não resolveria nada:
-- o grant implícito de PUBLIC continuaria valendo. Os dois caem juntos.
--
-- Quatro dessas funções são SECURITY DEFINER, ou seja, rodavam como postgres
-- ignorando RLS. fn_expirar_lotes() sem argumento nenhum expirava os pontos de
-- todos os lojistas de uma vez.

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- Impede que funções novas voltem a nascer liberadas para anon.
alter default privileges for role postgres in schema public
  revoke all on functions from anon;

-- "authenticated" é mantido de propósito: o app chama fn_processar_compra,
-- fn_prever_cancelamento_compra, fn_cancelar_compra_com_compensacao e
-- fn_processar_status_resgate por RPC com a sessão do usuário. Falta ainda a
-- checagem de tenant dentro dessas quatro (hoje um usuário logado consegue
-- chamá-las com o UUID de outro lojista) — fica para a migration seguinte,
-- que precisa de teste manual das telas antes de ir.
-- "service_role" é mantido: é o que a rota /api/internal/expirar-lotes usa.

-- =====================================================================
-- S2 · A RLS multi-tenant volta a valer
-- =====================================================================
-- Policies permissivas são combinadas com OR, então uma policy USING (true)
-- anula todas as outras da mesma tabela. Estas seis desligavam na prática o
-- isolamento entre lojistas: qualquer usuário autenticado — inclusive um
-- cliente final com login — lia e escrevia dados de todos os lojistas.

drop policy if exists "compras: acesso autenticado"            on public.compras;
drop policy if exists "compra_itens: acesso autenticado"       on public.compra_itens;
drop policy if exists "produtos: acesso autenticado"           on public.produtos;
drop policy if exists "clientes_usuarios: acesso autenticado"  on public.clientes_usuarios;
drop policy if exists "lojistas_usuarios: acesso autenticado"  on public.lojistas_usuarios;
drop policy if exists "lojistas: acesso autenticado"           on public.lojistas;

-- As cinco primeiras já tinham um conjunto completo de policies por lojista
-- por baixo. "lojistas" não tinha nenhuma outra: ficaria sem leitura alguma,
-- e sem ela requireLojistaContext() derruba o painel inteiro do lojista.
-- Esta policy repõe exatamente os dois acessos legítimos que existem hoje:
--   1. o próprio lojista lendo seu registro (requireLojistaContext, middleware);
--   2. o admin da plataforma listando lojistas (/admin/lojistas).
-- Escrita em lojistas continua sem policy de propósito: todo INSERT/UPDATE/DELETE
-- da tabela passa por service role nas rotas de admin.

create policy "lojistas_select_own_ou_admin" on public.lojistas
  for select to authenticated
  using (
    exists (
      select 1
      from public.lojistas_usuarios lu
      where lu.lojista_id = lojistas.id
        and lu.auth_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.admins_plataforma a
      where a.auth_user_id = auth.uid()
        and a.ativo
    )
  );

-- =====================================================================
-- Rollback, se algo quebrar
-- =====================================================================
-- Recriar as seis policies e devolver os grants:
--
--   create policy "compras: acesso autenticado" on public.compras
--     to authenticated using (true) with check (true);
--   (idem para compra_itens, produtos, clientes_usuarios, lojistas_usuarios, lojistas)
--   drop policy "lojistas_select_own_ou_admin" on public.lojistas;
--   grant execute on all functions in schema public to anon;
--
-- Voltar a esse estado reabre as duas brechas. Se a quebra for no painel do
-- lojista, o suspeito é a policy de "lojistas" acima, não os grants.
