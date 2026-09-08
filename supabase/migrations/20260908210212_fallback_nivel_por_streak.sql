-- Passo 1 da ordem de implementação de docs/contratos/motor-de-pontos.md.
-- Corrige S12: cliente que passa da última faixa de streak derruba a VENDA.
--
-- fn_nivel_por_streak lançava exceção quando nenhuma faixa cobria o streak, e
-- ela roda dentro de fn_rebuild_cliente_fidelidade, que roda no fim de
-- fn_processar_compra. O resultado não era pontuação errada: era o lançamento
-- inteiro falhando, com o texto cru do Postgres chegando na tela do lojista.
--
-- Em produção (08/set/2026) os DOIS lojistas estão nessa condição: um tem nível
-- cobrindo streak 1..3 com clientes ativos, e o outro 1..60 com streak máximo
-- de 15. Nenhum dos dois tem faixa aberta no topo.
--
-- Esta é a defesa de dentro. A de fora — impedir que se configure assim — é a
-- validação de cobertura em src/lib/merchant/configuracoes.ts, que vai junto.

create or replace function public.fn_nivel_por_streak(
  p_programa_id uuid,
  p_streak integer
)
returns public.programa_niveis
language plpgsql
as $$
declare
  v_nivel public.programa_niveis;
begin
  select *
    into v_nivel
  from public.programa_niveis pn
  where pn.programa_id = p_programa_id
    and p_streak >= pn.streak_min
    and (pn.streak_max is null or p_streak <= pn.streak_max)
  order by pn.ordem desc
  limit 1;

  -- Nenhuma faixa cobre o streak: usa a de maior ordem em vez de estourar.
  -- Venda nunca pode falhar por causa de configuração de nível.
  if v_nivel.id is null then
    select *
      into v_nivel
    from public.programa_niveis pn
    where pn.programa_id = p_programa_id
    order by pn.ordem desc, pn.streak_min desc
    limit 1;
  end if;

  -- Programa sem nenhum nível continua sendo erro: não há o que aplicar, e
  -- isso é configuração ausente, não faixa mal desenhada.
  if v_nivel.id is null then
    raise exception 'Programa % não tem nenhum nível configurado', p_programa_id;
  end if;

  return v_nivel;
end;
$$;

-- create or replace preserva os GRANTs existentes, inclusive a revogação de
-- anon feita na migration 20260908191820.
