-- =========================================================
-- GETI FIDELIDADE - V1 CONSOLIDADA
-- Banco novo / reset completo
-- =========================================================

-- =========================================================
-- 1) RESET DO SCHEMA PUBLIC
-- =========================================================
drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
grant all on all tables in schema public to postgres, service_role;
grant all on all functions in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;

alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;

-- =========================================================
-- 2) EXTENSÕES
-- =========================================================
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- pg_cron pode não estar disponível em todos os projetos/plans.
-- Se falhar, comente esta linha e o bloco de agendamento no final.
create extension if not exists pg_cron;

-- =========================================================
-- 3) ENUMS
-- =========================================================
create type public.compra_status as enum (
  'pendente',
  'aprovada',
  'recusada',
  'cancelada'
);

create type public.origem_compra as enum (
  'cliente',
  'lojista'
);

create type public.lote_status as enum (
  'pendente',
  'disponivel',
  'cancelado',
  'expirado'
);

create type public.resgate_status as enum (
  'pendente',
  'aprovado',
  'recusado',
  'cancelado'
);

create type public.alocacao_status as enum (
  'pendente',
  'gasto',
  'revertido'
);

create type public.ajuste_tipo as enum (
  'compensacao_cancelamento',
  'saldo_negativo',
  'ajuste_manual'
);

-- =========================================================
-- 4) TABELAS
-- =========================================================

-- 4.1 Lojistas
create table public.lojistas (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia varchar(150) not null,
  razao_social varchar(150),
  email varchar(150),
  telefone varchar(50),
  created_at timestamptz not null default now()
);

-- 4.2 Clientes
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  nome varchar(150) not null,
  telefone varchar(50),
  email varchar(150),
  cpf varchar(20),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clientes_lojista on public.clientes(lojista_id);
create index idx_clientes_nome on public.clientes(nome);

-- 4.3 Programas de fidelidade
create table public.programas_fidelidade (
  id uuid primary key default gen_random_uuid(),
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  nome varchar(120) not null,
  dias_para_perder_streak int not null default 30,
  dias_expiracao_pontos int not null default 180,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_programas_lojista on public.programas_fidelidade(lojista_id);

-- 4.4 Níveis do programa
create table public.programa_niveis (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.programas_fidelidade(id) on delete cascade,
  nome varchar(100) not null,
  streak_min int not null,
  streak_max int,
  percentual_conversao numeric(5,2) not null,
  teto_pontos_compra int not null,
  ordem int not null,
  created_at timestamptz not null default now(),
  constraint chk_programa_niveis_streak_validos
    check (streak_max is null or streak_max >= streak_min),
  constraint chk_programa_niveis_percentual_nonnegative
    check (percentual_conversao >= 0),
  constraint chk_programa_niveis_teto_positive
    check (teto_pontos_compra >= 0)
);

create index idx_niveis_programa on public.programa_niveis(programa_id);
create index idx_niveis_programa_ordem on public.programa_niveis(programa_id, ordem);

-- 4.5 Snapshot do cliente
create table public.clientes_fidelidade (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  programa_id uuid references public.programas_fidelidade(id),
  streak_atual int not null default 0,
  nivel_atual_id uuid references public.programa_niveis(id),
  ultima_compra_valida_em timestamptz,
  saldo_disponivel int not null default 0,
  saldo_pendente int not null default 0,
  saldo_negativo int not null default 0,
  updated_at timestamptz not null default now(),
  unique (cliente_id, lojista_id)
);

create index idx_clientes_fidelidade_lojista on public.clientes_fidelidade(lojista_id);

-- 4.6 Compras
create table public.compras (
  id uuid primary key default gen_random_uuid(),
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  valor_total numeric(12,2) not null,
  origem public.origem_compra not null,
  status public.compra_status not null default 'pendente',
  data_compra timestamptz not null,
  created_at timestamptz not null default now(),
  constraint chk_compras_valor_total_positive check (valor_total >= 0)
);

create index idx_compras_cliente on public.compras(cliente_id);
create index idx_compras_cliente_data on public.compras(cliente_id, data_compra);
create index idx_compras_lojista on public.compras(lojista_id);

-- 4.7 Lotes de pontos
create table public.lotes_pontos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  compra_id uuid not null references public.compras(id) on delete cascade,
  nivel_id uuid references public.programa_niveis(id),
  percentual_aplicado numeric(5,2),
  teto_aplicado int,
  pontos_gerados int not null,
  pontos_disponiveis int not null default 0,
  pontos_pendentes int not null default 0,
  pontos_gastos int not null default 0,
  pontos_expirados int not null default 0,
  pontos_cancelados int not null default 0,
  status public.lote_status not null default 'pendente',
  gerado_em timestamptz not null default now(),
  expira_em timestamptz,
  created_at timestamptz not null default now(),
  unique (compra_id),
  constraint chk_lotes_pontos_nonnegative check (
    pontos_gerados >= 0 and
    pontos_disponiveis >= 0 and
    pontos_pendentes >= 0 and
    pontos_gastos >= 0 and
    pontos_expirados >= 0 and
    pontos_cancelados >= 0
  )
);

create index idx_lotes_cliente on public.lotes_pontos(cliente_id);
create index idx_lotes_lojista on public.lotes_pontos(lojista_id);
create index idx_lotes_expiracao on public.lotes_pontos(expira_em);
create index idx_lotes_fifo on public.lotes_pontos(cliente_id, status, expira_em, created_at);

-- 4.8 Prêmios
create table public.premios (
  id uuid primary key default gen_random_uuid(),
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  nome varchar(150) not null,
  descricao text,
  pontos_necessarios int not null,
  nivel_minimo_id uuid references public.programa_niveis(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_premios_pontos_positive check (pontos_necessarios >= 0)
);

create index idx_premios_lojista on public.premios(lojista_id);

-- 4.9 Resgates
create table public.resgates (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  premio_id uuid not null references public.premios(id) on delete restrict,
  pontos_solicitados int not null,
  status public.resgate_status not null default 'pendente',
  solicitado_em timestamptz not null default now(),
  decidido_em timestamptz,
  constraint chk_resgates_pontos_positive check (pontos_solicitados > 0)
);

create index idx_resgates_cliente on public.resgates(cliente_id);
create index idx_resgates_status on public.resgates(status);
create index idx_resgates_lojista on public.resgates(lojista_id);

-- 4.10 Alocações FIFO dos resgates
create table public.resgate_alocacoes (
  id uuid primary key default gen_random_uuid(),
  resgate_id uuid not null references public.resgates(id) on delete cascade,
  lote_id uuid not null references public.lotes_pontos(id) on delete restrict,
  pontos_alocados int not null,
  status public.alocacao_status not null default 'pendente',
  created_at timestamptz not null default now(),
  constraint chk_resgate_alocacoes_positive check (pontos_alocados > 0)
);

create index idx_resgate_alocacoes_resgate on public.resgate_alocacoes(resgate_id);
create index idx_resgate_alocacoes_lote on public.resgate_alocacoes(lote_id);

-- 4.11 Ajustes de pontos
create table public.ajustes_pontos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  lojista_id uuid not null references public.lojistas(id) on delete cascade,
  tipo public.ajuste_tipo not null,
  pontos int not null,
  descricao text,
  referencia_compra uuid references public.compras(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chk_ajustes_pontos_positive check (pontos >= 0)
);

create index idx_ajustes_cliente on public.ajustes_pontos(cliente_id);
create index idx_ajustes_lojista on public.ajustes_pontos(lojista_id);

-- =========================================================
-- 5) FUNÇÕES UTILITÁRIAS
-- =========================================================

-- 5.1 updated_at genérico
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 5.2 Buscar programa ativo
create or replace function public.fn_programa_ativo(p_lojista_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_programa_id uuid;
begin
  select pf.id
    into v_programa_id
  from public.programas_fidelidade pf
  where pf.lojista_id = p_lojista_id
    and pf.ativo = true
  order by pf.created_at desc
  limit 1;

  if v_programa_id is null then
    raise exception 'Nenhum programa de fidelidade ativo encontrado para o lojista %', p_lojista_id;
  end if;

  return v_programa_id;
end;
$$;

-- 5.3 Buscar nível pela streak
create or replace function public.fn_nivel_por_streak(
  p_programa_id uuid,
  p_streak int
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

  if v_nivel.id is null then
    raise exception 'Nenhum nível encontrado para programa % e streak %', p_programa_id, p_streak;
  end if;

  return v_nivel;
end;
$$;

-- 5.4 Garantir snapshot do cliente
create or replace function public.fn_garantir_cliente_fidelidade(
  p_cliente_id uuid,
  p_lojista_id uuid
)
returns void
language plpgsql
as $$
declare
  v_programa_id uuid;
begin
  v_programa_id := public.fn_programa_ativo(p_lojista_id);

  insert into public.clientes_fidelidade (
    cliente_id,
    lojista_id,
    programa_id,
    streak_atual,
    saldo_disponivel,
    saldo_pendente,
    saldo_negativo,
    updated_at
  )
  values (
    p_cliente_id,
    p_lojista_id,
    v_programa_id,
    0,
    0,
    0,
    0,
    now()
  )
  on conflict (cliente_id, lojista_id) do nothing;
end;
$$;

-- 5.5 Calcular streak do cliente para nova compra
create or replace function public.fn_calcular_streak_cliente(
  p_cliente_id uuid,
  p_lojista_id uuid,
  p_data_compra timestamptz
)
returns int
language plpgsql
as $$
declare
  v_programa_id uuid;
  v_dias_limite int;
  v_ultima_compra timestamptz;
  v_streak_atual int;
begin
  v_programa_id := public.fn_programa_ativo(p_lojista_id);

  select pf.dias_para_perder_streak
    into v_dias_limite
  from public.programas_fidelidade pf
  where pf.id = v_programa_id;

  select cf.ultima_compra_valida_em, coalesce(cf.streak_atual, 0)
    into v_ultima_compra, v_streak_atual
  from public.clientes_fidelidade cf
  where cf.cliente_id = p_cliente_id
    and cf.lojista_id = p_lojista_id;

  if v_ultima_compra is null then
    return 1;
  end if;

  if p_data_compra <= (v_ultima_compra + make_interval(days => v_dias_limite)) then
    return v_streak_atual + 1;
  end if;

  return 1;
end;
$$;

-- 5.6 Rebuild do snapshot do cliente
create or replace function public.fn_rebuild_cliente_fidelidade(
  p_cliente_id uuid,
  p_lojista_id uuid
)
returns void
language plpgsql
as $$
declare
  v_programa_id uuid;
  v_dias_limite int;
  v_saldo_disponivel int;
  v_saldo_pendente int;
  v_saldo_negativo int;
  v_ultima_compra timestamptz;
  v_streak int := 0;
  v_nivel public.programa_niveis;
begin
  perform public.fn_garantir_cliente_fidelidade(p_cliente_id, p_lojista_id);

  v_programa_id := public.fn_programa_ativo(p_lojista_id);

  select pf.dias_para_perder_streak
    into v_dias_limite
  from public.programas_fidelidade pf
  where pf.id = v_programa_id;

  select coalesce(sum(lp.pontos_disponiveis), 0)
    into v_saldo_disponivel
  from public.lotes_pontos lp
  where lp.cliente_id = p_cliente_id
    and lp.lojista_id = p_lojista_id
    and lp.status = 'disponivel'
    and (lp.expira_em is null or lp.expira_em > now());

  select coalesce(sum(lp.pontos_pendentes), 0)
    into v_saldo_pendente
  from public.lotes_pontos lp
  where lp.cliente_id = p_cliente_id
    and lp.lojista_id = p_lojista_id
    and lp.status in ('pendente', 'disponivel');

  select coalesce(sum(
    case
      when ap.tipo in ('saldo_negativo', 'compensacao_cancelamento') then ap.pontos
      else 0
    end
  ), 0)
    into v_saldo_negativo
  from public.ajustes_pontos ap
  where ap.cliente_id = p_cliente_id
    and ap.lojista_id = p_lojista_id;

  select max(c.data_compra)
    into v_ultima_compra
  from public.compras c
  where c.cliente_id = p_cliente_id
    and c.lojista_id = p_lojista_id
    and c.status = 'aprovada';

  if v_ultima_compra is null then
    update public.clientes_fidelidade
       set programa_id = v_programa_id,
           streak_atual = 0,
           nivel_atual_id = null,
           ultima_compra_valida_em = null,
           saldo_disponivel = v_saldo_disponivel,
           saldo_pendente = v_saldo_pendente,
           saldo_negativo = v_saldo_negativo,
           updated_at = now()
     where cliente_id = p_cliente_id
       and lojista_id = p_lojista_id;
    return;
  end if;

  -- Reconstroi a streak mais recente de trás para frente
  with compras_ordenadas as (
    select c.data_compra
    from public.compras c
    where c.cliente_id = p_cliente_id
      and c.lojista_id = p_lojista_id
      and c.status = 'aprovada'
    order by c.data_compra desc
  ),
  compras_com_anterior as (
    select
      data_compra,
      lead(data_compra) over (order by data_compra desc) as compra_anterior_na_sequencia
    from compras_ordenadas
  ),
  streak_rows as (
    select
      data_compra,
      compra_anterior_na_sequencia,
      case
        when compra_anterior_na_sequencia is null then 1
        when compra_anterior_na_sequencia >= (data_compra - make_interval(days => v_dias_limite)) then 1
        else 0
      end as mantem
    from compras_com_anterior
  )
  select count(*)
    into v_streak
  from (
    select *
    from streak_rows
    where mantem = 1
    union all
    select *
    from (
      select *
      from streak_rows
      where mantem = 0
      order by data_compra desc
      limit 0
    ) z
  ) q;

  -- Ajuste fino: contar até a primeira quebra
  v_streak := 0;
  for v_ultima_compra in
    select c.data_compra
    from public.compras c
    where c.cliente_id = p_cliente_id
      and c.lojista_id = p_lojista_id
      and c.status = 'aprovada'
    order by c.data_compra desc
  loop
    if v_streak = 0 then
      v_streak := 1;
    else
      exit when exists (
        select 1
        from public.compras c2
        where c2.cliente_id = p_cliente_id
          and c2.lojista_id = p_lojista_id
          and c2.status = 'aprovada'
          and c2.data_compra < v_ultima_compra
          and c2.data_compra < (v_ultima_compra - make_interval(days => v_dias_limite))
      );
      v_streak := v_streak + 1;
    end if;
  end loop;

  v_nivel := public.fn_nivel_por_streak(v_programa_id, v_streak);

  update public.clientes_fidelidade
     set programa_id = v_programa_id,
         streak_atual = v_streak,
         nivel_atual_id = v_nivel.id,
         ultima_compra_valida_em = (
           select max(c.data_compra)
           from public.compras c
           where c.cliente_id = p_cliente_id
             and c.lojista_id = p_lojista_id
             and c.status = 'aprovada'
         ),
         saldo_disponivel = v_saldo_disponivel,
         saldo_pendente = v_saldo_pendente,
         saldo_negativo = v_saldo_negativo,
         updated_at = now()
   where cliente_id = p_cliente_id
     and lojista_id = p_lojista_id;
end;
$$;

-- =========================================================
-- 6) PROCESSAMENTO DE COMPRAS
-- =========================================================

-- 6.1 Cancelar compra com compensação
create or replace function public.fn_cancelar_compra_com_compensacao(
  p_compra_id uuid
)
returns void
language plpgsql
as $$
declare
  v_compra public.compras;
  v_lote public.lotes_pontos;
  v_deficit int := 0;
  v_outro_lote record;
  v_abater int;
begin
  select *
    into v_compra
  from public.compras
  where id = p_compra_id;

  if v_compra.id is null then
    raise exception 'Compra % não encontrada', p_compra_id;
  end if;

  select *
    into v_lote
  from public.lotes_pontos
  where compra_id = p_compra_id
  limit 1;

  if v_lote.id is null then
    update public.compras
       set status = 'cancelada'
     where id = p_compra_id;
    return;
  end if;

  -- Quanto já foi comprometido desse lote além do saldo disponível
  v_deficit := greatest(v_lote.pontos_pendentes + v_lote.pontos_gastos, 0);

  update public.lotes_pontos
     set pontos_disponiveis = 0,
         pontos_pendentes = 0,
         pontos_cancelados = pontos_cancelados + (
           pontos_gerados - pontos_cancelados - pontos_expirados
         ),
         status = 'cancelado'
   where id = v_lote.id;

  if v_deficit > 0 then
    for v_outro_lote in
      select lp.*
      from public.lotes_pontos lp
      where lp.cliente_id = v_compra.cliente_id
        and lp.lojista_id = v_compra.lojista_id
        and lp.id <> v_lote.id
        and lp.status = 'disponivel'
        and lp.pontos_disponiveis > 0
        and (lp.expira_em is null or lp.expira_em > now())
      order by lp.expira_em asc nulls last, lp.created_at asc
    loop
      exit when v_deficit <= 0;

      v_abater := least(v_outro_lote.pontos_disponiveis, v_deficit);

      update public.lotes_pontos
         set pontos_disponiveis = pontos_disponiveis - v_abater,
             pontos_cancelados = pontos_cancelados + v_abater
       where id = v_outro_lote.id;

      insert into public.ajustes_pontos (
        cliente_id,
        lojista_id,
        tipo,
        pontos,
        descricao,
        referencia_compra,
        created_at
      )
      values (
        v_compra.cliente_id,
        v_compra.lojista_id,
        'compensacao_cancelamento',
        v_abater,
        'Compensação FIFO por cancelamento de compra com lote já consumido',
        p_compra_id,
        now()
      );

      v_deficit := v_deficit - v_abater;
    end loop;
  end if;

  if v_deficit > 0 then
    insert into public.ajustes_pontos (
      cliente_id,
      lojista_id,
      tipo,
      pontos,
      descricao,
      referencia_compra,
      created_at
    )
    values (
      v_compra.cliente_id,
      v_compra.lojista_id,
      'saldo_negativo',
      v_deficit,
      'Saldo negativo gerado por cancelamento de compra sem saldo posterior suficiente',
      p_compra_id,
      now()
    );
  end if;

  update public.compras
     set status = 'cancelada'
   where id = p_compra_id;

  perform public.fn_rebuild_cliente_fidelidade(v_compra.cliente_id, v_compra.lojista_id);
end;
$$;

-- 6.2 Processar compra e gerar/atualizar lote
create or replace function public.fn_processar_compra(
  p_compra_id uuid
)
returns void
language plpgsql
as $$
declare
  v_compra public.compras;
  v_programa_id uuid;
  v_streak int;
  v_nivel public.programa_niveis;
  v_percentual numeric(5,2);
  v_teto int;
  v_pontos_brutos numeric;
  v_pontos_final int;
  v_dias_expiracao int;
  v_lote_id uuid;
begin
  select *
    into v_compra
  from public.compras
  where id = p_compra_id;

  if v_compra.id is null then
    raise exception 'Compra % não encontrada', p_compra_id;
  end if;

  perform public.fn_garantir_cliente_fidelidade(v_compra.cliente_id, v_compra.lojista_id);

  v_programa_id := public.fn_programa_ativo(v_compra.lojista_id);

  select dias_expiracao_pontos
    into v_dias_expiracao
  from public.programas_fidelidade
  where id = v_programa_id;

  if v_compra.status in ('pendente', 'aprovada') then
    v_streak := public.fn_calcular_streak_cliente(
      v_compra.cliente_id,
      v_compra.lojista_id,
      v_compra.data_compra
    );

    v_nivel := public.fn_nivel_por_streak(v_programa_id, v_streak);
    v_percentual := v_nivel.percentual_conversao;
    v_teto := v_nivel.teto_pontos_compra;

    v_pontos_brutos := v_compra.valor_total * (v_percentual / 100.0);
    v_pontos_final := least(floor(v_pontos_brutos)::int, v_teto);

    select lp.id
      into v_lote_id
    from public.lotes_pontos lp
    where lp.compra_id = v_compra.id
    limit 1;

    if v_lote_id is null then
      insert into public.lotes_pontos (
        cliente_id,
        lojista_id,
        compra_id,
        nivel_id,
        percentual_aplicado,
        teto_aplicado,
        pontos_gerados,
        pontos_disponiveis,
        pontos_pendentes,
        pontos_gastos,
        pontos_expirados,
        pontos_cancelados,
        status,
        gerado_em,
        expira_em,
        created_at
      )
      values (
        v_compra.cliente_id,
        v_compra.lojista_id,
        v_compra.id,
        v_nivel.id,
        v_percentual,
        v_teto,
        v_pontos_final,
        case when v_compra.status = 'aprovada' then v_pontos_final else 0 end,
        case when v_compra.status = 'pendente' then v_pontos_final else 0 end,
        0,
        0,
        0,
        case when v_compra.status = 'aprovada' then 'disponivel' else 'pendente' end,
        now(),
        now() + make_interval(days => v_dias_expiracao),
        now()
      );
    else
      update public.lotes_pontos
         set nivel_id = v_nivel.id,
             percentual_aplicado = v_percentual,
             teto_aplicado = v_teto,
             pontos_gerados = v_pontos_final,
             pontos_disponiveis = case when v_compra.status = 'aprovada' then v_pontos_final else 0 end,
             pontos_pendentes = case when v_compra.status = 'pendente' then v_pontos_final else 0 end,
             status = case when v_compra.status = 'aprovada' then 'disponivel' else 'pendente' end,
             expira_em = now() + make_interval(days => v_dias_expiracao)
       where id = v_lote_id;
    end if;
  elsif v_compra.status = 'recusada' then
    update public.lotes_pontos
       set pontos_disponiveis = 0,
           pontos_pendentes = 0,
           pontos_cancelados = pontos_gerados,
           status = 'cancelado'
     where compra_id = v_compra.id;
  elsif v_compra.status = 'cancelada' then
    perform public.fn_cancelar_compra_com_compensacao(v_compra.id);
    return;
  end if;

  perform public.fn_rebuild_cliente_fidelidade(v_compra.cliente_id, v_compra.lojista_id);
end;
$$;

-- 6.3 Trigger de processamento de compras
create or replace function public.trg_processar_compra()
returns trigger
language plpgsql
as $$
begin
  perform public.fn_processar_compra(new.id);
  return new;
end;
$$;

-- =========================================================
-- 7) PROCESSAMENTO DE RESGATES
-- =========================================================

-- 7.1 Alocar FIFO para resgate
create or replace function public.fn_alocar_fifo_resgate(
  p_resgate_id uuid
)
returns void
language plpgsql
as $$
declare
  v_resgate public.resgates;
  v_saldo int;
  v_restante int;
  v_lote record;
  v_alocar int;
  v_nivel_cliente_id uuid;
  v_nivel_premio_id uuid;
  v_ordem_cliente int;
  v_ordem_premio int;
begin
  select *
    into v_resgate
  from public.resgates
  where id = p_resgate_id;

  if v_resgate.id is null then
    raise exception 'Resgate % não encontrado', p_resgate_id;
  end if;

  if v_resgate.status <> 'pendente' then
    return;
  end if;

  perform public.fn_garantir_cliente_fidelidade(v_resgate.cliente_id, v_resgate.lojista_id);
  perform public.fn_rebuild_cliente_fidelidade(v_resgate.cliente_id, v_resgate.lojista_id);

  select cf.nivel_atual_id
    into v_nivel_cliente_id
  from public.clientes_fidelidade cf
  where cf.cliente_id = v_resgate.cliente_id
    and cf.lojista_id = v_resgate.lojista_id;

  select p.nivel_minimo_id
    into v_nivel_premio_id
  from public.premios p
  where p.id = v_resgate.premio_id;

  if v_nivel_premio_id is not null then
    select ordem into v_ordem_cliente
    from public.programa_niveis
    where id = v_nivel_cliente_id;

    select ordem into v_ordem_premio
    from public.programa_niveis
    where id = v_nivel_premio_id;

    if coalesce(v_ordem_cliente, -1) < coalesce(v_ordem_premio, -1) then
      raise exception 'Cliente não possui nível mínimo para este prêmio';
    end if;
  end if;

  select coalesce(sum(lp.pontos_disponiveis), 0)
    into v_saldo
  from public.lotes_pontos lp
  where lp.cliente_id = v_resgate.cliente_id
    and lp.lojista_id = v_resgate.lojista_id
    and lp.status = 'disponivel'
    and (lp.expira_em is null or lp.expira_em > now());

  if v_saldo < v_resgate.pontos_solicitados then
    raise exception 'Saldo insuficiente para o resgate %', p_resgate_id;
  end if;

  v_restante := v_resgate.pontos_solicitados;

  for v_lote in
    select lp.*
    from public.lotes_pontos lp
    where lp.cliente_id = v_resgate.cliente_id
      and lp.lojista_id = v_resgate.lojista_id
      and lp.status = 'disponivel'
      and lp.pontos_disponiveis > 0
      and (lp.expira_em is null or lp.expira_em > now())
    order by lp.expira_em asc nulls last, lp.created_at asc
  loop
    exit when v_restante <= 0;

    v_alocar := least(v_lote.pontos_disponiveis, v_restante);

    insert into public.resgate_alocacoes (
      resgate_id,
      lote_id,
      pontos_alocados,
      status,
      created_at
    )
    values (
      p_resgate_id,
      v_lote.id,
      v_alocar,
      'pendente',
      now()
    );

    update public.lotes_pontos
       set pontos_disponiveis = pontos_disponiveis - v_alocar,
           pontos_pendentes = pontos_pendentes + v_alocar
     where id = v_lote.id;

    v_restante := v_restante - v_alocar;
  end loop;

  if v_restante > 0 then
    raise exception 'Falha na alocação FIFO do resgate %, restante %', p_resgate_id, v_restante;
  end if;

  perform public.fn_rebuild_cliente_fidelidade(v_resgate.cliente_id, v_resgate.lojista_id);
end;
$$;

-- 7.2 Processar mudança de status do resgate
create or replace function public.fn_processar_status_resgate(
  p_resgate_id uuid,
  p_novo_status public.resgate_status
)
returns void
language plpgsql
as $$
declare
  v_resgate public.resgates;
  v_aloc record;
begin
  select *
    into v_resgate
  from public.resgates
  where id = p_resgate_id;

  if v_resgate.id is null then
    raise exception 'Resgate % não encontrado', p_resgate_id;
  end if;

  if p_novo_status = 'aprovado' then
    for v_aloc in
      select *
      from public.resgate_alocacoes
      where resgate_id = p_resgate_id
        and status = 'pendente'
    loop
      update public.lotes_pontos
         set pontos_pendentes = pontos_pendentes - v_aloc.pontos_alocados,
             pontos_gastos = pontos_gastos + v_aloc.pontos_alocados
       where id = v_aloc.lote_id;

      update public.resgate_alocacoes
         set status = 'gasto'
       where id = v_aloc.id;
    end loop;

    update public.resgates
       set status = 'aprovado',
           decidido_em = now()
     where id = p_resgate_id;

  elsif p_novo_status in ('recusado', 'cancelado') then
    for v_aloc in
      select *
      from public.resgate_alocacoes
      where resgate_id = p_resgate_id
        and status = 'pendente'
    loop
      update public.lotes_pontos
         set pontos_pendentes = pontos_pendentes - v_aloc.pontos_alocados,
             pontos_disponiveis = pontos_disponiveis + v_aloc.pontos_alocados
       where id = v_aloc.lote_id;

      update public.resgate_alocacoes
         set status = 'revertido'
       where id = v_aloc.id;
    end loop;

    update public.resgates
       set status = p_novo_status,
           decidido_em = now()
     where id = p_resgate_id;
  else
    raise exception 'Status % não suportado para processamento do resgate', p_novo_status;
  end if;

  perform public.fn_rebuild_cliente_fidelidade(v_resgate.cliente_id, v_resgate.lojista_id);
end;
$$;

-- 7.3 Trigger de reserva ao criar resgate
create or replace function public.trg_reservar_pontos_resgate()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'pendente' then
    perform public.fn_alocar_fifo_resgate(new.id);
  end if;
  return new;
end;
$$;

-- =========================================================
-- 8) EXPIRAÇÃO DE LOTES
-- =========================================================
create or replace function public.fn_expirar_lotes()
returns void
language plpgsql
as $$
declare
  v_lote record;
begin
  for v_lote in
    select lp.*
    from public.lotes_pontos lp
    where lp.status in ('disponivel', 'pendente')
      and lp.expira_em is not null
      and lp.expira_em <= now()
      and lp.pontos_disponiveis > 0
  loop
    update public.lotes_pontos
       set pontos_expirados = pontos_expirados + pontos_disponiveis,
           pontos_disponiveis = 0,
           status = case
             when pontos_pendentes > 0 then status
             else 'expirado'
           end
     where id = v_lote.id;

    perform public.fn_rebuild_cliente_fidelidade(v_lote.cliente_id, v_lote.lojista_id);
  end loop;
end;
$$;

-- =========================================================
-- 9) TRIGGERS
-- =========================================================

-- updated_at
drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at
before update on public.clientes
for each row
execute function public.set_updated_at();

drop trigger if exists trg_programas_fidelidade_updated_at on public.programas_fidelidade;
create trigger trg_programas_fidelidade_updated_at
before update on public.programas_fidelidade
for each row
execute function public.set_updated_at();

drop trigger if exists trg_clientes_fidelidade_updated_at on public.clientes_fidelidade;
create trigger trg_clientes_fidelidade_updated_at
before update on public.clientes_fidelidade
for each row
execute function public.set_updated_at();

-- compras
drop trigger if exists trg_compras_processar on public.compras;
create trigger trg_compras_processar
after insert or update of status, valor_total, data_compra
on public.compras
for each row
execute function public.trg_processar_compra();

-- resgates
drop trigger if exists trg_resgates_reservar on public.resgates;
create trigger trg_resgates_reservar
after insert on public.resgates
for each row
execute function public.trg_reservar_pontos_resgate();

-- =========================================================
-- 10) CRON DE EXPIRAÇÃO
-- =========================================================
do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    begin
      perform cron.unschedule('expirar-lotes-fidelidade-diario');
    exception when others then
      null;
    end;

    perform cron.schedule(
      'expirar-lotes-fidelidade-diario',
      '0 2 * * *',
      $$select public.fn_expirar_lotes();$$
    );
  end if;
end $$;

-- =========================================================
-- 11) OBSERVAÇÕES DE USO
-- =========================================================
-- Aprovar/recusar resgate:
-- select public.fn_processar_status_resgate('UUID_DO_RESGATE', 'aprovado');
-- select public.fn_processar_status_resgate('UUID_DO_RESGATE', 'recusado');

-- Cancelar compra:
-- update public.compras set status = 'cancelada' where id = 'UUID_DA_COMPRA';
-- ou
-- select public.fn_cancelar_compra_com_compensacao('UUID_DA_COMPRA');

-- Rebuild manual:
-- select public.fn_rebuild_cliente_fidelidade('UUID_DO_CLIENTE', 'UUID_DO_LOJISTA');