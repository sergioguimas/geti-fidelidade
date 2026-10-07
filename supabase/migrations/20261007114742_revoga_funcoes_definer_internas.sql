-- S15 · Fecha para usuários logados as funções SECURITY DEFINER que o app nunca
-- chama com a sessão do usuário.
-- Contexto: docs/05-revisao-de-bugs-out-2026.md, achado S15.
--
-- A migration 20260908191820 revogou EXECUTE de PUBLIC e anon, mas o baseline
-- tem GRANT ALL explícito para "authenticated" em todas as funções. Com isso
-- qualquer usuário logado — inclusive cliente final — ainda chamava estas duas
-- por /rest/v1/rpc, rodando como postgres e ignorando RLS:
--
--   fn_registrar_movimentacao_pontos  escreve linha arbitrária no livro-razão
--                                     de qualquer lojista
--   fn_expirar_lotes                  roda a expiração de todos os tenants
--
-- Por que é seguro revogar (dependências conferidas em produção em 07/out):
--   - fn_registrar_movimentacao_pontos só é chamada por fn_processar_compra,
--     fn_cancelar_compra_com_compensacao e fn_expirar_lotes, todas DEFINER:
--     dentro delas o papel corrente já é postgres.
--   - fn_expirar_lotes é chamada pelo job do pg_cron (dono postgres) e pela
--     rota /api/internal/expirar-lotes, que usa service_role. Os dois mantêm
--     EXECUTE.
--   - Nenhuma das duas é chamada por função INVOKER, nem pelo app via RPC.
--
-- Fica de fora DE PROPÓSITO: fn_garantir_cliente_fidelidade. Ela também é
-- DEFINER, mas é chamada por fn_rebuild_cliente_fidelidade (INVOKER), que roda
-- com o papel do usuário quando o lojista decide um resgate
-- (fn_processar_status_resgate, INVOKER, chamada por RPC em resgates.ts).
-- Revogar aqui quebraria esse caminho. Ela sai junto com o S1.1, quando
-- fn_processar_status_resgate ganhar guarda de tenant e virar DEFINER.
--
-- fn_calcular_streak_cliente vai junto: é código morto (S9), INVOKER, e não é
-- chamada por ninguém.

revoke execute on function public.fn_registrar_movimentacao_pontos(
  uuid, uuid, public.pontos_movimentacao_tipo, integer, integer,
  uuid, uuid, uuid, uuid, text, jsonb, integer
) from authenticated;

revoke execute on function public.fn_expirar_lotes() from authenticated;

revoke execute on function public.fn_calcular_streak_cliente(
  uuid, uuid, timestamp with time zone
) from authenticated;

-- =====================================================================
-- Verificação (rodar depois de aplicar)
-- =====================================================================
--   select proname,
--          has_function_privilege('authenticated', oid, 'execute') as authenticated,
--          has_function_privilege('service_role',  oid, 'execute') as service_role
--   from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname in ('fn_registrar_movimentacao_pontos', 'fn_expirar_lotes',
--                     'fn_calcular_streak_cliente');
--   -- esperado: authenticated = false, service_role = true nas três
--
-- Teste em tela: lançar e cancelar uma venda logado como lojista (o caminho
-- passa por fn_registrar_movimentacao_pontos dentro das funções DEFINER).
--
-- =====================================================================
-- Rollback
-- =====================================================================
--   grant execute on function public.fn_registrar_movimentacao_pontos(
--     uuid, uuid, public.pontos_movimentacao_tipo, integer, integer,
--     uuid, uuid, uuid, uuid, text, jsonb, integer) to authenticated;
--   grant execute on function public.fn_expirar_lotes() to authenticated;
--   grant execute on function public.fn_calcular_streak_cliente(
--     uuid, uuid, timestamp with time zone) to authenticated;
