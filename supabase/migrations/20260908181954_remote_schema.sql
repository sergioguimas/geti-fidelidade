


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."ajuste_tipo" AS ENUM (
    'compensacao_cancelamento',
    'saldo_negativo',
    'ajuste_manual'
);


ALTER TYPE "public"."ajuste_tipo" OWNER TO "postgres";


CREATE TYPE "public"."alocacao_status" AS ENUM (
    'pendente',
    'gasto',
    'revertido'
);


ALTER TYPE "public"."alocacao_status" OWNER TO "postgres";


CREATE TYPE "public"."compra_status" AS ENUM (
    'pendente',
    'aprovada',
    'recusada',
    'cancelada'
);


ALTER TYPE "public"."compra_status" OWNER TO "postgres";


CREATE TYPE "public"."lote_status" AS ENUM (
    'pendente',
    'disponivel',
    'cancelado',
    'expirado'
);


ALTER TYPE "public"."lote_status" OWNER TO "postgres";


CREATE TYPE "public"."origem_compra" AS ENUM (
    'cliente',
    'lojista'
);


ALTER TYPE "public"."origem_compra" OWNER TO "postgres";


CREATE TYPE "public"."pontos_movimentacao_tipo" AS ENUM (
    'geracao',
    'resgate',
    'compensacao_cancelamento',
    'expiracao',
    'ajuste_manual',
    'saldo_negativo'
);


ALTER TYPE "public"."pontos_movimentacao_tipo" OWNER TO "postgres";


CREATE TYPE "public"."resgate_status" AS ENUM (
    'pendente',
    'aprovado',
    'recusado',
    'cancelado'
);


ALTER TYPE "public"."resgate_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_alocar_fifo_resgate"("p_resgate_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_resgate public.resgates;
  v_saldo int;
  v_restante int;
  v_lote record;
  v_alocar int;
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


ALTER FUNCTION "public"."fn_alocar_fifo_resgate"("p_resgate_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_calcular_streak_cliente"("p_cliente_id" "uuid", "p_lojista_id" "uuid", "p_data_compra" timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fn_calcular_streak_cliente"("p_cliente_id" "uuid", "p_lojista_id" "uuid", "p_data_compra" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cancelar_compra_com_compensacao"("p_compra_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_compra record;
  v_lote record;
  v_lote_fifo record;
  v_pontos_para_compensar integer;
  v_consumir integer;
  v_remanescente_lote integer;
  v_total_estornado integer := 0;
begin
  select *
  into v_compra
  from public.compras
  where id = p_compra_id;

  if not found then
    raise exception 'Compra não encontrada: %', p_compra_id;
  end if;

  if v_compra.status = 'cancelada' then
    return;
  end if;

  update public.compras
  set status = 'cancelada',
      pontos_total = 0,
      updated_at = now()
  where id = p_compra_id;

  for v_lote in
    select *
    from public.lotes_pontos
    where compra_id = p_compra_id
    order by created_at asc
  loop
    v_remanescente_lote :=
      coalesce(v_lote.pontos_disponiveis, 0) +
      coalesce(v_lote.pontos_pendentes, 0);

    v_pontos_para_compensar := coalesce(v_lote.pontos_gastos, 0);

    update public.lotes_pontos
    set
      status = 'cancelado',
      pontos_cancelados = coalesce(v_lote.pontos_cancelados, 0) + v_remanescente_lote,
      pontos_disponiveis = 0,
      pontos_pendentes = 0
    where id = v_lote.id;

    if v_remanescente_lote > 0 then
      perform public.fn_registrar_movimentacao_pontos(
        p_lojista_id      := v_compra.lojista_id,
        p_cliente_id      := v_compra.cliente_id,
        p_tipo            := 'compensacao_cancelamento',
        p_pontos          := v_remanescente_lote,
        p_sinal           := -1,
        p_compra_id       := v_compra.id,
        p_lote_id         := v_lote.id,
        p_lote_origem_id  := v_lote.id,
        p_descricao       := 'Cancelamento do saldo remanescente do lote da compra',
        p_metadata        := jsonb_build_object(
          'origem', 'fn_cancelar_compra_com_compensacao',
          'etapa', 'cancelamento_remanescente_lote'
        )
      );

      v_total_estornado := v_total_estornado + v_remanescente_lote;
    end if;

    if v_pontos_para_compensar <= 0 then
      continue;
    end if;

    for v_lote_fifo in
      select *
      from public.lotes_pontos
      where cliente_id = v_compra.cliente_id
        and lojista_id = v_compra.lojista_id
        and compra_id <> p_compra_id
        and status = 'disponivel'
        and pontos_disponiveis > 0
      order by expira_em asc nulls last, created_at asc
    loop
      exit when v_pontos_para_compensar <= 0;

      v_consumir := least(v_pontos_para_compensar, v_lote_fifo.pontos_disponiveis);

      update public.lotes_pontos
      set
        pontos_disponiveis = pontos_disponiveis - v_consumir,
        pontos_gastos = pontos_gastos + v_consumir
      where id = v_lote_fifo.id;

      perform public.fn_registrar_movimentacao_pontos(
        p_lojista_id      := v_compra.lojista_id,
        p_cliente_id      := v_compra.cliente_id,
        p_tipo            := 'compensacao_cancelamento',
        p_pontos          := v_consumir,
        p_sinal           := -1,
        p_compra_id       := v_compra.id,
        p_lote_origem_id  := v_lote.id,
        p_lote_destino_id := v_lote_fifo.id,
        p_descricao       := 'Compensação FIFO por cancelamento de compra',
        p_metadata        := jsonb_build_object(
          'origem', 'fn_cancelar_compra_com_compensacao',
          'etapa', 'compensacao_fifo'
        )
      );

      v_total_estornado := v_total_estornado + v_consumir;
      v_pontos_para_compensar := v_pontos_para_compensar - v_consumir;
    end loop;

    if v_pontos_para_compensar > 0 then
      update public.clientes_fidelidade
      set saldo_negativo = coalesce(saldo_negativo, 0) + v_pontos_para_compensar,
          updated_at = now()
      where cliente_id = v_compra.cliente_id
        and lojista_id = v_compra.lojista_id;

      perform public.fn_registrar_movimentacao_pontos(
        p_lojista_id      := v_compra.lojista_id,
        p_cliente_id      := v_compra.cliente_id,
        p_tipo            := 'saldo_negativo',
        p_pontos          := v_pontos_para_compensar,
        p_sinal           := -1,
        p_compra_id       := v_compra.id,
        p_lote_origem_id  := v_lote.id,
        p_descricao       := 'Saldo negativo após cancelamento sem cobertura FIFO',
        p_metadata        := jsonb_build_object(
          'origem', 'fn_cancelar_compra_com_compensacao',
          'etapa', 'saldo_negativo'
        )
      );

      v_total_estornado := v_total_estornado + v_pontos_para_compensar;
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."fn_cancelar_compra_com_compensacao"("p_compra_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_expirar_lotes"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_lote record;
  v_expirados integer := 0;
begin
  for v_lote in
    select *
    from public.lotes_pontos
    where status = 'disponivel'
      and pontos_disponiveis > 0
      and expira_em is not null
      and expira_em <= now()
    order by expira_em asc, created_at asc
  loop
    update public.lotes_pontos
    set
      status = 'expirado',
      pontos_expirados = coalesce(pontos_expirados, 0) + coalesce(v_lote.pontos_disponiveis, 0),
      pontos_disponiveis = 0
    where id = v_lote.id;

    perform public.fn_registrar_movimentacao_pontos(
      p_lojista_id      := v_lote.lojista_id,
      p_cliente_id      := v_lote.cliente_id,
      p_tipo            := 'expiracao',
      p_pontos          := coalesce(v_lote.pontos_disponiveis, 0),
      p_sinal           := -1,
      p_compra_id       := v_lote.compra_id,
      p_lote_id         := v_lote.id,
      p_lote_origem_id  := v_lote.id,
      p_descricao       := 'Expiração automática de pontos',
      p_metadata        := jsonb_build_object(
        'origem', 'fn_expirar_lotes',
        'expira_em', v_lote.expira_em
      )
    );

    update public.clientes_fidelidade
    set
      saldo_disponivel = greatest(coalesce(saldo_disponivel, 0) - coalesce(v_lote.pontos_disponiveis, 0), 0),
      updated_at = now()
    where cliente_id = v_lote.cliente_id
      and lojista_id = v_lote.lojista_id;

    v_expirados := v_expirados + 1;
  end loop;

  return v_expirados;
end;
$$;


ALTER FUNCTION "public"."fn_expirar_lotes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_garantir_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_programa_id uuid;
  v_nivel_id uuid;
begin
  v_programa_id := public.fn_programa_ativo(p_lojista_id);

  select pn.id
    into v_nivel_id
  from public.programa_niveis pn
  where pn.programa_id = v_programa_id
    and 0 >= pn.streak_min
    and (pn.streak_max is null or 0 <= pn.streak_max)
  order by pn.ordem desc
  limit 1;

  if v_nivel_id is null then
    select pn.id
      into v_nivel_id
    from public.programa_niveis pn
    where pn.programa_id = v_programa_id
    order by pn.ordem asc
    limit 1;
  end if;

  if v_nivel_id is null then
    raise exception 'Nenhum nível encontrado para o programa %', v_programa_id;
  end if;

  insert into public.clientes_fidelidade (
    cliente_id,
    lojista_id,
    programa_id,
    nivel_atual_id,
    streak_atual,
    saldo_disponivel,
    saldo_pendente,
    saldo_negativo,
    ativo,
    updated_at
  )
  values (
    p_cliente_id,
    p_lojista_id,
    v_programa_id,
    v_nivel_id,
    0,
    0,
    0,
    0,
    true,
    now()
  )
  on conflict (cliente_id, lojista_id)
  do update set
    programa_id = coalesce(clientes_fidelidade.programa_id, excluded.programa_id),
    nivel_atual_id = coalesce(clientes_fidelidade.nivel_atual_id, excluded.nivel_atual_id),
    ativo = true,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."fn_garantir_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."programa_niveis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "programa_id" "uuid",
    "nome" character varying(100),
    "streak_min" integer NOT NULL,
    "streak_max" integer,
    "percentual_conversao" numeric(5,2) NOT NULL,
    "teto_pontos_compra" integer NOT NULL,
    "ordem" integer NOT NULL
);


ALTER TABLE "public"."programa_niveis" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_nivel_por_streak"("p_programa_id" "uuid", "p_streak" integer) RETURNS "public"."programa_niveis"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fn_nivel_por_streak"("p_programa_id" "uuid", "p_streak" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_prever_cancelamento_compra"("p_compra_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_compra record;
  v_pontos_gerados int := 0;
  v_pontos_disponiveis int := 0;
  v_pontos_gastos int := 0;
  v_outros_lotes_disponiveis int := 0;
  v_saldo_negativo int := 0;
begin
  select *
  into v_compra
  from public.compras
  where id = p_compra_id;

  if not found then
    raise exception 'Compra não encontrada';
  end if;

  select
    coalesce(sum(lp.pontos_gerados), 0),
    coalesce(sum(lp.pontos_disponiveis), 0),
    coalesce(sum(lp.pontos_gastos), 0)
  into
    v_pontos_gerados,
    v_pontos_disponiveis,
    v_pontos_gastos
  from public.lotes_pontos lp
  where lp.compra_id = p_compra_id;

  select coalesce(sum(lp.pontos_disponiveis), 0)
  into v_outros_lotes_disponiveis
  from public.lotes_pontos lp
  where lp.cliente_id = v_compra.cliente_id
    and lp.lojista_id = v_compra.lojista_id
    and lp.compra_id <> p_compra_id
    and lp.status = 'disponivel';

  if v_pontos_gastos > v_outros_lotes_disponiveis then
    v_saldo_negativo := v_pontos_gastos - v_outros_lotes_disponiveis;
  end if;

  return json_build_object(
    'compraId', p_compra_id,
    'statusCompra', v_compra.status,
    'pontosGerados', v_pontos_gerados,
    'pontosDisponiveisNoLote', v_pontos_disponiveis,
    'pontosJaUsados', v_pontos_gastos,
    'saldoDisponivelEmOutrosLotes', v_outros_lotes_disponiveis,
    'saldoNegativoResultante', v_saldo_negativo,
    'precisaConfirmacaoEspecial', (v_pontos_gastos > 0)
  );
end;
$$;


ALTER FUNCTION "public"."fn_prever_cancelamento_compra"("p_compra_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_processar_compra"("p_compra_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_compra record;
  v_programa record;
  v_cliente_fidelidade record;
  v_nivel record;
  v_item record;
  v_lote_id uuid;

  v_teto_nivel integer;
  v_teto_produto numeric(5,2);
  v_percentual_item numeric(5,2);

  v_pontos_item numeric;
  v_pontos_gerados integer := 0;

  v_status_lote public.lote_status;
  v_pontos_disponiveis integer := 0;
  v_pontos_pendentes integer := 0;

  v_validade_programa integer := 0;
  v_validade_cliente integer := 0;
  v_validade_final integer := 0;
  v_expira_em timestamptz := null;
begin
  select *
    into v_compra
  from public.compras
  where id = p_compra_id;

  if not found then
    raise exception 'Compra não encontrada: %', p_compra_id;
  end if;

  -- Garante que o cliente esteja vinculado ao programa antes de calcular
  perform public.fn_garantir_cliente_fidelidade(
    v_compra.cliente_id,
    v_compra.lojista_id
  );

  if v_compra.status in ('cancelada', 'recusada') then
    perform public.fn_rebuild_cliente_fidelidade(
      v_compra.cliente_id,
      v_compra.lojista_id
    );
    return;
  end if;

  if exists (
    select 1
    from public.lotes_pontos
    where compra_id = v_compra.id
      and pontos_gastos > 0
  ) then
    raise exception 'Não é possível reprocessar compra com pontos já utilizados. Cancele a compra.';
  end if;

  update public.lotes_pontos
     set pontos_cancelados = coalesce(pontos_cancelados, 0)
       + coalesce(pontos_disponiveis, 0)
       + coalesce(pontos_pendentes, 0),
         pontos_disponiveis = 0,
         pontos_pendentes = 0,
         status = 'cancelado'
   where compra_id = v_compra.id
     and pontos_gastos = 0;

  select pf.*
    into v_programa
  from public.programas_fidelidade pf
  where pf.lojista_id = v_compra.lojista_id
    and pf.ativo = true
  order by pf.created_at desc
  limit 1;

  if not found then
    raise exception 'Nenhum programa de fidelidade ativo para o lojista %', v_compra.lojista_id;
  end if;

  select cf.*
    into v_cliente_fidelidade
  from public.clientes_fidelidade cf
  where cf.cliente_id = v_compra.cliente_id
    and cf.lojista_id = v_compra.lojista_id
    and cf.ativo = true
  limit 1;

  if not found then
    raise exception 'Cliente fidelidade não encontrado/ativo para cliente % e lojista %',
      v_compra.cliente_id, v_compra.lojista_id;
  end if;

  select pn.*
    into v_nivel
  from public.programa_niveis pn
  where pn.id = v_cliente_fidelidade.nivel_atual_id
    and pn.programa_id = v_cliente_fidelidade.programa_id
  limit 1;

  if not found then
    select pn.*
      into v_nivel
    from public.programa_niveis pn
    where pn.programa_id = v_programa.id
    order by pn.ordem asc
    limit 1;
  end if;

  if v_nivel.id is null then
    raise exception 'Cliente fidelidade sem nível configurado para cliente % e lojista %',
      v_compra.cliente_id, v_compra.lojista_id;
  end if;

  v_teto_nivel := coalesce(v_nivel.teto_pontos_compra, 0);

  for v_item in
    select
      ci.*,
      p.teto_percentual
    from public.compra_itens ci
    join public.produtos p
      on p.id = ci.produto_id
    where ci.compra_id = v_compra.id
  loop
    v_teto_produto := coalesce(v_item.teto_percentual, 0);

    if v_teto_produto > 0 then
      v_percentual_item := least(v_teto_produto, v_nivel.percentual_conversao);
    else
      v_percentual_item := v_nivel.percentual_conversao;
    end if;

    v_pontos_item := coalesce(v_item.subtotal, 0) * (v_percentual_item / 100.0);
    v_pontos_gerados := v_pontos_gerados + floor(v_pontos_item);
  end loop;

  if v_teto_nivel > 0 then
    v_pontos_gerados := least(v_pontos_gerados, v_teto_nivel);
  end if;

  if v_compra.status = 'aprovada' then
    v_status_lote := 'disponivel';
    v_pontos_disponiveis := v_pontos_gerados;
    v_pontos_pendentes := 0;
  else
    v_status_lote := 'pendente';
    v_pontos_disponiveis := 0;
    v_pontos_pendentes := v_pontos_gerados;
  end if;

  v_validade_programa := greatest(coalesce(v_programa.validade_dias, 0), 0);
  v_validade_cliente := greatest(coalesce(v_cliente_fidelidade.validade_dias_custom, 0), 0);
  v_validade_final := greatest(v_validade_programa, v_validade_cliente);

  if v_validade_final > 0 then
    v_expira_em := now() + make_interval(days => v_validade_final);
  else
    v_expira_em := null;
  end if;

  update public.compras
     set pontos_total = v_pontos_gerados
   where id = v_compra.id;

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
    v_nivel.percentual_conversao,
    v_teto_nivel,
    v_pontos_gerados,
    v_pontos_disponiveis,
    v_pontos_pendentes,
    0,
    0,
    0,
    v_status_lote,
    now(),
    v_expira_em,
    now()
  )
  returning id into v_lote_id;

  perform public.fn_registrar_movimentacao_pontos(
    p_lojista_id      := v_compra.lojista_id,
    p_cliente_id      := v_compra.cliente_id,
    p_tipo            := 'geracao',
    p_pontos          := v_pontos_gerados,
    p_sinal           := 1,
    p_compra_id       := v_compra.id,
    p_lote_id         := v_lote_id,
    p_descricao       := 'Geração de pontos por compra',
    p_metadata        := jsonb_build_object(
      'origem', 'fn_processar_compra',
      'status_compra', v_compra.status,
      'valor_total', v_compra.valor_total,
      'percentual_nivel', v_nivel.percentual_conversao,
      'teto_nivel', v_teto_nivel,
      'validade_programa_dias', v_validade_programa,
      'validade_cliente_dias', v_validade_cliente,
      'validade_final_dias', v_validade_final
    )
  );

  -- Ponto principal da correção:
  -- atualiza saldo, streak, nível e última compra do cliente
  perform public.fn_rebuild_cliente_fidelidade(
    v_compra.cliente_id,
    v_compra.lojista_id
  );
end;
$$;


ALTER FUNCTION "public"."fn_processar_compra"("p_compra_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_processar_status_resgate"("p_resgate_id" "uuid", "p_novo_status" "public"."resgate_status") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fn_processar_status_resgate"("p_resgate_id" "uuid", "p_novo_status" "public"."resgate_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_programa_ativo"("p_lojista_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."fn_programa_ativo"("p_lojista_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_rebuild_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_programa_id uuid;
  v_saldo_disponivel int;
  v_saldo_pendente int;
  v_saldo_negativo int;
  v_ultima_compra timestamptz;
  v_streak int;
  v_nivel public.programa_niveis;
begin
  perform public.fn_garantir_cliente_fidelidade(p_cliente_id, p_lojista_id);

  v_programa_id := public.fn_programa_ativo(p_lojista_id);

  select coalesce(sum(lp.pontos_disponiveis), 0)
    into v_saldo_disponivel
  from public.lotes_pontos lp
  where lp.cliente_id = p_cliente_id
    and lp.lojista_id = p_lojista_id
    and lp.status in ('disponivel')
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

  select coalesce(count(*), 0)
    into v_streak
  from (
    with compras_validas as (
      select c.data_compra,
             lag(c.data_compra) over (order by c.data_compra) as data_anterior
      from public.compras c
      where c.cliente_id = p_cliente_id
        and c.lojista_id = p_lojista_id
        and c.status = 'aprovada'
      order by c.data_compra
    )
    select *
    from compras_validas
  ) x;

  if v_ultima_compra is null then
    v_streak := 0;
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

  -- streak real reconstruída de trás pra frente
  with compras_validas as (
    select c.data_compra,
           lag(c.data_compra) over (order by c.data_compra) as data_anterior
    from public.compras c
    where c.cliente_id = p_cliente_id
      and c.lojista_id = p_lojista_id
      and c.status = 'aprovada'
  ),
  grupos as (
    select data_compra,
           sum(
             case
               when data_anterior is null then 1
               when data_compra > data_anterior + interval '30 days' then 1
               else 0
             end
           ) over (order by data_compra) as grp
    from compras_validas
  )
  select count(*)
    into v_streak
  from grupos
  where grp = (select max(grp) from grupos);

  v_nivel := public.fn_nivel_por_streak(v_programa_id, v_streak);

  update public.clientes_fidelidade
     set programa_id = v_programa_id,
         streak_atual = v_streak,
         nivel_atual_id = v_nivel.id,
         ultima_compra_valida_em = v_ultima_compra,
         saldo_disponivel = v_saldo_disponivel,
         saldo_pendente = v_saldo_pendente,
         saldo_negativo = v_saldo_negativo,
         updated_at = now()
   where cliente_id = p_cliente_id
     and lojista_id = p_lojista_id;
end;
$$;


ALTER FUNCTION "public"."fn_rebuild_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pontos_movimentacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lojista_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "compra_id" "uuid",
    "lote_id" "uuid",
    "lote_origem_id" "uuid",
    "lote_destino_id" "uuid",
    "tipo" "public"."pontos_movimentacao_tipo" NOT NULL,
    "pontos" integer NOT NULL,
    "sinal" integer DEFAULT 1 NOT NULL,
    "saldo_resultante" integer,
    "descricao" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pontos_movimentacoes_chk_pontos_positivos" CHECK (("pontos" >= 0)),
    CONSTRAINT "pontos_movimentacoes_chk_sinal_valido" CHECK (("sinal" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."pontos_movimentacoes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_registrar_movimentacao_pontos"("p_lojista_id" "uuid", "p_cliente_id" "uuid", "p_tipo" "public"."pontos_movimentacao_tipo", "p_pontos" integer, "p_sinal" integer DEFAULT 1, "p_compra_id" "uuid" DEFAULT NULL::"uuid", "p_lote_id" "uuid" DEFAULT NULL::"uuid", "p_lote_origem_id" "uuid" DEFAULT NULL::"uuid", "p_lote_destino_id" "uuid" DEFAULT NULL::"uuid", "p_descricao" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_saldo_resultante" integer DEFAULT NULL::integer) RETURNS "public"."pontos_movimentacoes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_mov public.pontos_movimentacoes;
begin
  if p_lojista_id is null then
    raise exception 'lojista_id é obrigatório';
  end if;

  if p_cliente_id is null then
    raise exception 'cliente_id é obrigatório';
  end if;

  if p_tipo is null then
    raise exception 'tipo é obrigatório';
  end if;

  if p_pontos is null or p_pontos < 0 then
    raise exception 'pontos deve ser >= 0';
  end if;

  if p_sinal not in (-1, 1) then
    raise exception 'sinal deve ser -1 ou 1';
  end if;

  insert into public.pontos_movimentacoes (
    lojista_id,
    cliente_id,
    compra_id,
    lote_id,
    lote_origem_id,
    lote_destino_id,
    tipo,
    pontos,
    sinal,
    saldo_resultante,
    descricao,
    metadata
  )
  values (
    p_lojista_id,
    p_cliente_id,
    p_compra_id,
    p_lote_id,
    p_lote_origem_id,
    p_lote_destino_id,
    p_tipo,
    p_pontos,
    p_sinal,
    p_saldo_resultante,
    p_descricao,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_mov;

  return v_mov;
end;
$$;


ALTER FUNCTION "public"."fn_registrar_movimentacao_pontos"("p_lojista_id" "uuid", "p_cliente_id" "uuid", "p_tipo" "public"."pontos_movimentacao_tipo", "p_pontos" integer, "p_sinal" integer, "p_compra_id" "uuid", "p_lote_id" "uuid", "p_lote_origem_id" "uuid", "p_lote_destino_id" "uuid", "p_descricao" "text", "p_metadata" "jsonb", "p_saldo_resultante" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_processar_compra"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.fn_processar_compra(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_processar_compra"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_reservar_pontos_resgate"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.status = 'pendente' then
    perform public.fn_alocar_fifo_resgate(new.id);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_reservar_pontos_resgate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admins_plataforma" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "nome" character varying(150),
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admins_plataforma" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ajustes_pontos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "lojista_id" "uuid",
    "tipo" "public"."ajuste_tipo" NOT NULL,
    "pontos" integer NOT NULL,
    "descricao" "text",
    "referencia_compra" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ajustes_pontos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lojista_id" "uuid",
    "nome" character varying(150) NOT NULL,
    "telefone" character varying(50),
    "email" character varying(150),
    "cnpj" character varying(20),
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auth_user_id" "uuid",
    "pode_fazer_login" boolean DEFAULT false NOT NULL,
    "acesso_ativado_em" timestamp with time zone,
    "ultimo_login_em" timestamp with time zone,
    "documento" character varying(20),
    "endereco" "text",
    "codigo_externo" character varying(50),
    CONSTRAINT "clientes_login_consistencia_chk" CHECK ((("pode_fazer_login" = false) OR (("pode_fazer_login" = true) AND ("auth_user_id" IS NOT NULL)))),
    CONSTRAINT "clientes_login_documento_chk" CHECK ((("pode_fazer_login" = false) OR (("pode_fazer_login" = true) AND ("documento" IS NOT NULL) AND ("email" IS NOT NULL) AND ("auth_user_id" IS NOT NULL))))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes_fidelidade" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "lojista_id" "uuid",
    "programa_id" "uuid",
    "streak_atual" integer DEFAULT 0,
    "nivel_atual_id" "uuid",
    "ultima_compra_valida_em" timestamp with time zone,
    "saldo_disponivel" integer DEFAULT 0,
    "saldo_pendente" integer DEFAULT 0,
    "saldo_negativo" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ativo" boolean DEFAULT true NOT NULL,
    "validade_dias_custom" integer,
    CONSTRAINT "clientes_fidelidade_chk_validade_dias_custom_nao_negativa" CHECK ((("validade_dias_custom" IS NULL) OR ("validade_dias_custom" >= 0)))
);


ALTER TABLE "public"."clientes_fidelidade" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes_usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clientes_usuarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compra_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "compra_id" "uuid" NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "descricao_produto" character varying(200) NOT NULL,
    "quantidade" numeric(10,3) NOT NULL,
    "valor_unitario" numeric(12,4) NOT NULL,
    "subtotal" numeric(12,2) NOT NULL,
    "teto_percentual_produto" numeric(5,2) NOT NULL,
    "teto_percentual_nivel" numeric(5,2) NOT NULL,
    "percentual_aplicado" numeric(5,2) NOT NULL,
    "pontos_gerados" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subtotal_bruto" numeric(12,2) NOT NULL,
    "desconto" numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "compra_itens_desconto_menor_igual_subtotal_bruto" CHECK (("desconto" <= "subtotal_bruto")),
    CONSTRAINT "compra_itens_desconto_nao_negativo" CHECK (("desconto" >= (0)::numeric)),
    CONSTRAINT "compra_itens_percentual_aplicado_check" CHECK ((("percentual_aplicado" >= (0)::numeric) AND ("percentual_aplicado" <= (100)::numeric))),
    CONSTRAINT "compra_itens_pontos_gerados_check" CHECK (("pontos_gerados" >= (0)::numeric)),
    CONSTRAINT "compra_itens_quantidade_check" CHECK (("quantidade" > (0)::numeric)),
    CONSTRAINT "compra_itens_subtotal_bruto_nao_negativo" CHECK (("subtotal_bruto" >= (0)::numeric)),
    CONSTRAINT "compra_itens_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "compra_itens_teto_percentual_nivel_check" CHECK ((("teto_percentual_nivel" >= (0)::numeric) AND ("teto_percentual_nivel" <= (100)::numeric))),
    CONSTRAINT "compra_itens_teto_percentual_produto_check" CHECK ((("teto_percentual_produto" >= (0)::numeric) AND ("teto_percentual_produto" <= (100)::numeric))),
    CONSTRAINT "compra_itens_valor_unitario_check" CHECK (("valor_unitario" >= (0)::numeric))
);


ALTER TABLE "public"."compra_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lojista_id" "uuid",
    "cliente_id" "uuid",
    "valor_total" numeric(12,2) NOT NULL,
    "origem" "public"."origem_compra" NOT NULL,
    "status" "public"."compra_status" DEFAULT 'pendente'::"public"."compra_status",
    "data_compra" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pontos_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subtotal_bruto" numeric(12,2) DEFAULT 0 NOT NULL,
    "desconto_total" numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "compras_desconto_total_menor_igual_subtotal_bruto" CHECK (("desconto_total" <= "subtotal_bruto")),
    CONSTRAINT "compras_desconto_total_nao_negativo" CHECK (("desconto_total" >= (0)::numeric)),
    CONSTRAINT "compras_subtotal_bruto_nao_negativo" CHECK (("subtotal_bruto" >= (0)::numeric))
);


ALTER TABLE "public"."compras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lojistas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_fantasia" character varying(150) NOT NULL,
    "razao_social" character varying(150) NOT NULL,
    "email" character varying(150),
    "telefone" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nome_responsavel" character varying(150),
    "cnpj" character varying(30),
    "endereco" "text",
    "ativo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."lojistas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lojistas_usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lojista_id" "uuid" NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "papel" character varying(30) DEFAULT 'owner'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lojistas_usuarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lotes_pontos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "lojista_id" "uuid" NOT NULL,
    "compra_id" "uuid" NOT NULL,
    "nivel_id" "uuid",
    "percentual_aplicado" numeric(5,2) NOT NULL,
    "teto_aplicado" integer NOT NULL,
    "pontos_gerados" integer NOT NULL,
    "pontos_disponiveis" integer NOT NULL,
    "pontos_pendentes" integer DEFAULT 0,
    "pontos_gastos" integer DEFAULT 0,
    "pontos_expirados" integer DEFAULT 0,
    "pontos_cancelados" integer DEFAULT 0,
    "status" "public"."lote_status" DEFAULT 'pendente'::"public"."lote_status" NOT NULL,
    "gerado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expira_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lotes_pontos_chk_percentual_nao_negativo" CHECK (("percentual_aplicado" >= (0)::numeric)),
    CONSTRAINT "lotes_pontos_chk_pontos_nao_negativos" CHECK ((("pontos_gerados" >= 0) AND ("pontos_disponiveis" >= 0) AND ("pontos_pendentes" >= 0) AND ("pontos_gastos" >= 0) AND ("pontos_expirados" >= 0) AND ("pontos_cancelados" >= 0))),
    CONSTRAINT "lotes_pontos_chk_soma_componentes" CHECK ((((("pontos_disponiveis" + "pontos_gastos") + "pontos_expirados") + "pontos_cancelados") <= "pontos_gerados")),
    CONSTRAINT "lotes_pontos_chk_teto_nao_negativo" CHECK (("teto_aplicado" >= 0))
);


ALTER TABLE "public"."lotes_pontos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."premios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lojista_id" "uuid",
    "nome" character varying(150) NOT NULL,
    "descricao" "text",
    "pontos_necessarios" integer NOT NULL,
    "nivel_minimo_id" "uuid",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."premios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lojista_id" "uuid" NOT NULL,
    "descricao" character varying(200) NOT NULL,
    "teto_percentual" numeric(5,2) NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "produtos_teto_percentual_check" CHECK ((("teto_percentual" >= (0)::numeric) AND ("teto_percentual" <= (100)::numeric)))
);


ALTER TABLE "public"."produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programas_fidelidade" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lojista_id" "uuid",
    "nome" character varying(120) NOT NULL,
    "dias_para_perder_streak" integer DEFAULT 30,
    "dias_expiracao_pontos" integer DEFAULT 180,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "validade_dias" integer,
    CONSTRAINT "programas_fidelidade_chk_validade_dias_nao_negativa" CHECK ((("validade_dias" IS NULL) OR ("validade_dias" >= 0)))
);


ALTER TABLE "public"."programas_fidelidade" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resgate_alocacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resgate_id" "uuid",
    "lote_id" "uuid",
    "pontos_alocados" integer NOT NULL,
    "status" "public"."alocacao_status" DEFAULT 'pendente'::"public"."alocacao_status",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."resgate_alocacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resgates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "lojista_id" "uuid",
    "premio_id" "uuid",
    "pontos_solicitados" integer NOT NULL,
    "status" "public"."resgate_status" DEFAULT 'pendente'::"public"."resgate_status",
    "solicitado_em" timestamp with time zone DEFAULT "now"(),
    "decidido_em" timestamp with time zone
);


ALTER TABLE "public"."resgates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admins_plataforma"
    ADD CONSTRAINT "admins_plataforma_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."admins_plataforma"
    ADD CONSTRAINT "admins_plataforma_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ajustes_pontos"
    ADD CONSTRAINT "ajustes_pontos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."clientes_fidelidade"
    ADD CONSTRAINT "clientes_fidelidade_cliente_id_lojista_id_key" UNIQUE ("cliente_id", "lojista_id");



ALTER TABLE ONLY "public"."clientes_fidelidade"
    ADD CONSTRAINT "clientes_fidelidade_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes_usuarios"
    ADD CONSTRAINT "clientes_usuarios_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."clientes_usuarios"
    ADD CONSTRAINT "clientes_usuarios_cliente_id_auth_user_id_key" UNIQUE ("cliente_id", "auth_user_id");



ALTER TABLE ONLY "public"."clientes_usuarios"
    ADD CONSTRAINT "clientes_usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compra_itens"
    ADD CONSTRAINT "compra_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compras"
    ADD CONSTRAINT "compras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lojistas"
    ADD CONSTRAINT "lojistas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lojistas_usuarios"
    ADD CONSTRAINT "lojistas_usuarios_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."lojistas_usuarios"
    ADD CONSTRAINT "lojistas_usuarios_lojista_id_auth_user_id_key" UNIQUE ("lojista_id", "auth_user_id");



ALTER TABLE ONLY "public"."lojistas_usuarios"
    ADD CONSTRAINT "lojistas_usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lotes_pontos"
    ADD CONSTRAINT "lotes_pontos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pontos_movimentacoes"
    ADD CONSTRAINT "pontos_movimentacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."premios"
    ADD CONSTRAINT "premios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programa_niveis"
    ADD CONSTRAINT "programa_niveis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programas_fidelidade"
    ADD CONSTRAINT "programas_fidelidade_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resgate_alocacoes"
    ADD CONSTRAINT "resgate_alocacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resgates"
    ADD CONSTRAINT "resgates_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admins_plataforma_auth_user_id" ON "public"."admins_plataforma" USING "btree" ("auth_user_id");



CREATE INDEX "idx_admins_plataforma_email" ON "public"."admins_plataforma" USING "btree" ("lower"(("email")::"text"));



CREATE INDEX "idx_clientes_lojista" ON "public"."clientes" USING "btree" ("lojista_id");



CREATE INDEX "idx_clientes_usuarios_auth_user_id" ON "public"."clientes_usuarios" USING "btree" ("auth_user_id");



CREATE INDEX "idx_clientes_usuarios_cliente_id" ON "public"."clientes_usuarios" USING "btree" ("cliente_id");



CREATE INDEX "idx_compra_itens_compra_id" ON "public"."compra_itens" USING "btree" ("compra_id");



CREATE INDEX "idx_compra_itens_produto_id" ON "public"."compra_itens" USING "btree" ("produto_id");



CREATE INDEX "idx_compras_cliente" ON "public"."compras" USING "btree" ("cliente_id");



CREATE INDEX "idx_compras_cliente_id" ON "public"."compras" USING "btree" ("cliente_id");



CREATE INDEX "idx_compras_data" ON "public"."compras" USING "btree" ("cliente_id", "data_compra");



CREATE INDEX "idx_compras_lojista_id" ON "public"."compras" USING "btree" ("lojista_id");



CREATE INDEX "idx_lojistas_ativo" ON "public"."lojistas" USING "btree" ("ativo");



CREATE INDEX "idx_lojistas_usuarios_auth_user_id" ON "public"."lojistas_usuarios" USING "btree" ("auth_user_id");



CREATE INDEX "idx_lojistas_usuarios_lojista_id" ON "public"."lojistas_usuarios" USING "btree" ("lojista_id");



CREATE INDEX "idx_lotes_cliente" ON "public"."lotes_pontos" USING "btree" ("cliente_id");



CREATE INDEX "idx_lotes_expiracao" ON "public"."lotes_pontos" USING "btree" ("expira_em");



CREATE INDEX "idx_lotes_fifo" ON "public"."lotes_pontos" USING "btree" ("cliente_id", "status", "expira_em");



CREATE INDEX "idx_lotes_pontos_cliente_lojista" ON "public"."lotes_pontos" USING "btree" ("cliente_id", "lojista_id");



CREATE INDEX "idx_lotes_pontos_compra" ON "public"."lotes_pontos" USING "btree" ("compra_id");



CREATE INDEX "idx_lotes_pontos_expiracao_execucao" ON "public"."lotes_pontos" USING "btree" ("status", "expira_em") WHERE ("status" = 'disponivel'::"public"."lote_status");



CREATE INDEX "idx_lotes_pontos_lojista_status" ON "public"."lotes_pontos" USING "btree" ("lojista_id", "status");



CREATE INDEX "idx_niveis_programa" ON "public"."programa_niveis" USING "btree" ("programa_id");



CREATE INDEX "idx_pontos_movimentacoes_cliente" ON "public"."pontos_movimentacoes" USING "btree" ("cliente_id");



CREATE INDEX "idx_pontos_movimentacoes_cliente_lojista_data" ON "public"."pontos_movimentacoes" USING "btree" ("cliente_id", "lojista_id", "created_at" DESC);



CREATE INDEX "idx_pontos_movimentacoes_compra" ON "public"."pontos_movimentacoes" USING "btree" ("compra_id");



CREATE INDEX "idx_pontos_movimentacoes_created_at" ON "public"."pontos_movimentacoes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pontos_movimentacoes_lojista" ON "public"."pontos_movimentacoes" USING "btree" ("lojista_id");



CREATE INDEX "idx_pontos_movimentacoes_lote" ON "public"."pontos_movimentacoes" USING "btree" ("lote_id");



CREATE INDEX "idx_pontos_movimentacoes_tipo" ON "public"."pontos_movimentacoes" USING "btree" ("tipo");



CREATE INDEX "idx_produtos_descricao" ON "public"."produtos" USING "btree" ("descricao");



CREATE INDEX "idx_produtos_lojista_id" ON "public"."produtos" USING "btree" ("lojista_id");



CREATE INDEX "idx_resgates_cliente" ON "public"."resgates" USING "btree" ("cliente_id");



CREATE INDEX "idx_resgates_status" ON "public"."resgates" USING "btree" ("status");



CREATE UNIQUE INDEX "uq_lojistas_cnpj" ON "public"."lojistas" USING "btree" ("cnpj");



CREATE UNIQUE INDEX "uq_lotes_pontos_compra_nivel_ativo" ON "public"."lotes_pontos" USING "btree" ("compra_id", "nivel_id") WHERE ("status" = ANY (ARRAY['pendente'::"public"."lote_status", 'disponivel'::"public"."lote_status"]));



CREATE UNIQUE INDEX "uq_produtos_lojista_descricao" ON "public"."produtos" USING "btree" ("lojista_id", "lower"(("descricao")::"text"));



CREATE UNIQUE INDEX "ux_clientes_documento_unique" ON "public"."clientes" USING "btree" ("documento") WHERE ("documento" IS NOT NULL);



CREATE UNIQUE INDEX "ux_clientes_lojista_codigo_externo" ON "public"."clientes" USING "btree" ("lojista_id", "codigo_externo") WHERE ("codigo_externo" IS NOT NULL);



CREATE OR REPLACE TRIGGER "trg_clientes_fidelidade_updated_at" BEFORE UPDATE ON "public"."clientes_fidelidade" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_clientes_updated_at" BEFORE UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_compras_processar" AFTER INSERT OR UPDATE OF "status", "valor_total", "data_compra" ON "public"."compras" FOR EACH ROW EXECUTE FUNCTION "public"."trg_processar_compra"();



CREATE OR REPLACE TRIGGER "trg_pontos_movimentacoes_updated_at" BEFORE UPDATE ON "public"."pontos_movimentacoes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_programas_fidelidade_updated_at" BEFORE UPDATE ON "public"."programas_fidelidade" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_resgates_reservar" AFTER INSERT ON "public"."resgates" FOR EACH ROW EXECUTE FUNCTION "public"."trg_reservar_pontos_resgate"();



CREATE OR REPLACE TRIGGER "update_admins_plataforma_updated_at" BEFORE UPDATE ON "public"."admins_plataforma" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clientes_updated_at" BEFORE UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clientes_usuarios_updated_at" BEFORE UPDATE ON "public"."clientes_usuarios" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_compras_updated_at" BEFORE UPDATE ON "public"."compras" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lojistas_usuarios_updated_at" BEFORE UPDATE ON "public"."lojistas_usuarios" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_produtos_updated_at" BEFORE UPDATE ON "public"."produtos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admins_plataforma"
    ADD CONSTRAINT "admins_plataforma_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ajustes_pontos"
    ADD CONSTRAINT "ajustes_pontos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."ajustes_pontos"
    ADD CONSTRAINT "ajustes_pontos_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clientes_fidelidade"
    ADD CONSTRAINT "clientes_fidelidade_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes_fidelidade"
    ADD CONSTRAINT "clientes_fidelidade_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes_fidelidade"
    ADD CONSTRAINT "clientes_fidelidade_nivel_atual_id_fkey" FOREIGN KEY ("nivel_atual_id") REFERENCES "public"."programa_niveis"("id");



ALTER TABLE ONLY "public"."clientes_fidelidade"
    ADD CONSTRAINT "clientes_fidelidade_programa_id_fkey" FOREIGN KEY ("programa_id") REFERENCES "public"."programas_fidelidade"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes_usuarios"
    ADD CONSTRAINT "clientes_usuarios_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes_usuarios"
    ADD CONSTRAINT "clientes_usuarios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compra_itens"
    ADD CONSTRAINT "compra_itens_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compra_itens"
    ADD CONSTRAINT "compra_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."compras"
    ADD CONSTRAINT "compras_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."compras"
    ADD CONSTRAINT "compras_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id");



ALTER TABLE ONLY "public"."lojistas_usuarios"
    ADD CONSTRAINT "lojistas_usuarios_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lojistas_usuarios"
    ADD CONSTRAINT "lojistas_usuarios_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lotes_pontos"
    ADD CONSTRAINT "lotes_pontos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."lotes_pontos"
    ADD CONSTRAINT "lotes_pontos_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id");



ALTER TABLE ONLY "public"."lotes_pontos"
    ADD CONSTRAINT "lotes_pontos_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id");



ALTER TABLE ONLY "public"."lotes_pontos"
    ADD CONSTRAINT "lotes_pontos_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "public"."programa_niveis"("id");



ALTER TABLE ONLY "public"."pontos_movimentacoes"
    ADD CONSTRAINT "pontos_movimentacoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."pontos_movimentacoes"
    ADD CONSTRAINT "pontos_movimentacoes_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id");



ALTER TABLE ONLY "public"."pontos_movimentacoes"
    ADD CONSTRAINT "pontos_movimentacoes_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id");



ALTER TABLE ONLY "public"."pontos_movimentacoes"
    ADD CONSTRAINT "pontos_movimentacoes_lote_destino_id_fkey" FOREIGN KEY ("lote_destino_id") REFERENCES "public"."lotes_pontos"("id");



ALTER TABLE ONLY "public"."pontos_movimentacoes"
    ADD CONSTRAINT "pontos_movimentacoes_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes_pontos"("id");



ALTER TABLE ONLY "public"."pontos_movimentacoes"
    ADD CONSTRAINT "pontos_movimentacoes_lote_origem_id_fkey" FOREIGN KEY ("lote_origem_id") REFERENCES "public"."lotes_pontos"("id");



ALTER TABLE ONLY "public"."premios"
    ADD CONSTRAINT "premios_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id");



ALTER TABLE ONLY "public"."premios"
    ADD CONSTRAINT "premios_nivel_minimo_id_fkey" FOREIGN KEY ("nivel_minimo_id") REFERENCES "public"."programa_niveis"("id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programa_niveis"
    ADD CONSTRAINT "programa_niveis_programa_id_fkey" FOREIGN KEY ("programa_id") REFERENCES "public"."programas_fidelidade"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programas_fidelidade"
    ADD CONSTRAINT "programas_fidelidade_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resgate_alocacoes"
    ADD CONSTRAINT "resgate_alocacoes_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes_pontos"("id");



ALTER TABLE ONLY "public"."resgate_alocacoes"
    ADD CONSTRAINT "resgate_alocacoes_resgate_id_fkey" FOREIGN KEY ("resgate_id") REFERENCES "public"."resgates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resgates"
    ADD CONSTRAINT "resgates_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."resgates"
    ADD CONSTRAINT "resgates_lojista_id_fkey" FOREIGN KEY ("lojista_id") REFERENCES "public"."lojistas"("id");



ALTER TABLE ONLY "public"."resgates"
    ADD CONSTRAINT "resgates_premio_id_fkey" FOREIGN KEY ("premio_id") REFERENCES "public"."premios"("id");



ALTER TABLE "public"."admins_plataforma" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins_plataforma_delete_admin" ON "public"."admins_plataforma" FOR DELETE TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "admins_plataforma_insert_admin" ON "public"."admins_plataforma" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admins_plataforma" "ap"
  WHERE (("ap"."auth_user_id" = "auth"."uid"()) AND ("ap"."ativo" = true)))));



CREATE POLICY "admins_plataforma_select_admin" ON "public"."admins_plataforma" FOR SELECT TO "authenticated" USING ((("auth_user_id" = "auth"."uid"()) AND ("ativo" = true)));



CREATE POLICY "admins_plataforma_update_admin" ON "public"."admins_plataforma" FOR UPDATE TO "authenticated" USING (("auth_user_id" = "auth"."uid"())) WITH CHECK (("auth_user_id" = "auth"."uid"()));



ALTER TABLE "public"."ajustes_pontos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_delete_own_lojista" ON "public"."clientes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clientes_fidelidade" "cf"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "cf"."lojista_id")))
  WHERE (("cf"."cliente_id" = "clientes"."id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."clientes_fidelidade" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_fidelidade_delete_own_lojista" ON "public"."clientes_fidelidade" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "clientes_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "clientes_fidelidade_insert_own_lojista" ON "public"."clientes_fidelidade" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "clientes_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "clientes_fidelidade_select_own_lojista" ON "public"."clientes_fidelidade" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "clientes_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "clientes_fidelidade_update_own_lojista" ON "public"."clientes_fidelidade" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "clientes_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "clientes_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "clientes_insert_own_lojista" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE ("lu"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "clientes_select_own_lojista" ON "public"."clientes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clientes_fidelidade" "cf"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "cf"."lojista_id")))
  WHERE (("cf"."cliente_id" = "clientes"."id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "clientes_update_own_lojista" ON "public"."clientes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clientes_fidelidade" "cf"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "cf"."lojista_id")))
  WHERE (("cf"."cliente_id" = "clientes"."id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."clientes_fidelidade" "cf"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "cf"."lojista_id")))
  WHERE (("cf"."cliente_id" = "clientes"."id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."clientes_usuarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_usuarios: acesso autenticado" ON "public"."clientes_usuarios" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "clientes_usuarios_delete_own_lojista" ON "public"."clientes_usuarios" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clientes" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "clientes_usuarios"."cliente_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "clientes_usuarios_insert_own_lojista" ON "public"."clientes_usuarios" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."clientes" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "clientes_usuarios"."cliente_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "clientes_usuarios_select_own" ON "public"."clientes_usuarios" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "clientes_usuarios_select_own_lojista" ON "public"."clientes_usuarios" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clientes" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "clientes_usuarios"."cliente_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "clientes_usuarios_update_own_lojista" ON "public"."clientes_usuarios" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clientes" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "clientes_usuarios"."cliente_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."clientes" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "clientes_usuarios"."cliente_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."compra_itens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "compra_itens: acesso autenticado" ON "public"."compra_itens" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "compra_itens_delete_own_lojista" ON "public"."compra_itens" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."compras" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "compra_itens"."compra_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "compra_itens_insert_own_lojista" ON "public"."compra_itens" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."compras" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "compra_itens"."compra_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "compra_itens_select_own_cliente" ON "public"."compra_itens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."compras" "c"
     JOIN "public"."clientes_usuarios" "cu" ON (("cu"."cliente_id" = "c"."cliente_id")))
  WHERE (("c"."id" = "compra_itens"."compra_id") AND ("cu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "compra_itens_select_own_lojista" ON "public"."compra_itens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."compras" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "compra_itens"."compra_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "compra_itens_update_own_lojista" ON "public"."compra_itens" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."compras" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "compra_itens"."compra_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."compras" "c"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "c"."lojista_id")))
  WHERE (("c"."id" = "compra_itens"."compra_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."compras" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "compras: acesso autenticado" ON "public"."compras" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "compras_delete_own_lojista" ON "public"."compras" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "compras"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "compras_insert_own_lojista" ON "public"."compras" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "compras"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "compras_select_own_cliente" ON "public"."compras" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clientes_usuarios" "cu"
  WHERE (("cu"."cliente_id" = "compras"."cliente_id") AND ("cu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "compras_select_own_lojista" ON "public"."compras" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "compras"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "compras_update_own_lojista" ON "public"."compras" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "compras"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "compras"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."lojistas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lojistas: acesso autenticado" ON "public"."lojistas" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."lojistas_usuarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lojistas_usuarios: acesso autenticado" ON "public"."lojistas_usuarios" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "lojistas_usuarios_select_own" ON "public"."lojistas_usuarios" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



ALTER TABLE "public"."lotes_pontos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lotes_pontos_delete_own_lojista" ON "public"."lotes_pontos" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "lotes_pontos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "lotes_pontos_insert_own_lojista" ON "public"."lotes_pontos" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "lotes_pontos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."compras" "c"
  WHERE (("c"."id" = "lotes_pontos"."compra_id") AND ("c"."lojista_id" = "lotes_pontos"."lojista_id") AND ("c"."cliente_id" = "lotes_pontos"."cliente_id"))))));



CREATE POLICY "lotes_pontos_select_own_cliente" ON "public"."lotes_pontos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clientes_usuarios" "cu"
  WHERE (("cu"."cliente_id" = "lotes_pontos"."cliente_id") AND ("cu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "lotes_pontos_select_own_lojista" ON "public"."lotes_pontos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "lotes_pontos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "lotes_pontos_update_own_lojista" ON "public"."lotes_pontos" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "lotes_pontos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "lotes_pontos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."compras" "c"
  WHERE (("c"."id" = "lotes_pontos"."compra_id") AND ("c"."lojista_id" = "lotes_pontos"."lojista_id") AND ("c"."cliente_id" = "lotes_pontos"."cliente_id"))))));



ALTER TABLE "public"."pontos_movimentacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pontos_movimentacoes_delete_own_lojista" ON "public"."pontos_movimentacoes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "pontos_movimentacoes"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "pontos_movimentacoes_insert_own_lojista" ON "public"."pontos_movimentacoes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "pontos_movimentacoes"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "pontos_movimentacoes_select_own_cliente" ON "public"."pontos_movimentacoes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clientes_usuarios" "cu"
  WHERE (("cu"."cliente_id" = "pontos_movimentacoes"."cliente_id") AND ("cu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "pontos_movimentacoes_select_own_lojista" ON "public"."pontos_movimentacoes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "pontos_movimentacoes"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "pontos_movimentacoes_update_own_lojista" ON "public"."pontos_movimentacoes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "pontos_movimentacoes"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "pontos_movimentacoes"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."premios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "premios_delete_own_lojista" ON "public"."premios" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "premios"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "premios_insert_own_lojista" ON "public"."premios" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "premios"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "premios_select_own_lojista" ON "public"."premios" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "premios"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "premios_update_own_lojista" ON "public"."premios" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "premios"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "premios"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."produtos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "produtos: acesso autenticado" ON "public"."produtos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "produtos_delete_own_lojista" ON "public"."produtos" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "produtos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "produtos_insert_own_lojista" ON "public"."produtos" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "produtos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "produtos_select_own_lojista" ON "public"."produtos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "produtos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "produtos_update_own_lojista" ON "public"."produtos" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "produtos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "produtos"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."programa_niveis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programa_niveis_delete_own_lojista" ON "public"."programa_niveis" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."programas_fidelidade" "pf"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "pf"."lojista_id")))
  WHERE (("pf"."id" = "programa_niveis"."programa_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "programa_niveis_insert_own_lojista" ON "public"."programa_niveis" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."programas_fidelidade" "pf"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "pf"."lojista_id")))
  WHERE (("pf"."id" = "programa_niveis"."programa_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "programa_niveis_select_own_lojista" ON "public"."programa_niveis" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."programas_fidelidade" "pf"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "pf"."lojista_id")))
  WHERE (("pf"."id" = "programa_niveis"."programa_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "programa_niveis_update_own_lojista" ON "public"."programa_niveis" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."programas_fidelidade" "pf"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "pf"."lojista_id")))
  WHERE (("pf"."id" = "programa_niveis"."programa_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."programas_fidelidade" "pf"
     JOIN "public"."lojistas_usuarios" "lu" ON (("lu"."lojista_id" = "pf"."lojista_id")))
  WHERE (("pf"."id" = "programa_niveis"."programa_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."programas_fidelidade" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programas_fidelidade_delete_own_lojista" ON "public"."programas_fidelidade" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "programas_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "programas_fidelidade_insert_own_lojista" ON "public"."programas_fidelidade" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "programas_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "programas_fidelidade_select_own_lojista" ON "public"."programas_fidelidade" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "programas_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "programas_fidelidade_update_own_lojista" ON "public"."programas_fidelidade" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "programas_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lojistas_usuarios" "lu"
  WHERE (("lu"."lojista_id" = "programas_fidelidade"."lojista_id") AND ("lu"."auth_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."resgate_alocacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resgates" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."fn_alocar_fifo_resgate"("p_resgate_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_alocar_fifo_resgate"("p_resgate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_alocar_fifo_resgate"("p_resgate_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."fn_calcular_streak_cliente"("p_cliente_id" "uuid", "p_lojista_id" "uuid", "p_data_compra" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_calcular_streak_cliente"("p_cliente_id" "uuid", "p_lojista_id" "uuid", "p_data_compra" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_calcular_streak_cliente"("p_cliente_id" "uuid", "p_lojista_id" "uuid", "p_data_compra" timestamp with time zone) TO "authenticated";



GRANT ALL ON FUNCTION "public"."fn_cancelar_compra_com_compensacao"("p_compra_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_cancelar_compra_com_compensacao"("p_compra_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cancelar_compra_com_compensacao"("p_compra_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_expirar_lotes"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_expirar_lotes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_expirar_lotes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_garantir_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_garantir_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_garantir_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") TO "authenticated";



GRANT ALL ON TABLE "public"."programa_niveis" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."programa_niveis" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."programa_niveis" TO "authenticated";



GRANT ALL ON FUNCTION "public"."fn_nivel_por_streak"("p_programa_id" "uuid", "p_streak" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_nivel_por_streak"("p_programa_id" "uuid", "p_streak" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_nivel_por_streak"("p_programa_id" "uuid", "p_streak" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."fn_prever_cancelamento_compra"("p_compra_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_prever_cancelamento_compra"("p_compra_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_prever_cancelamento_compra"("p_compra_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_processar_compra"("p_compra_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_processar_compra"("p_compra_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_processar_compra"("p_compra_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."fn_processar_status_resgate"("p_resgate_id" "uuid", "p_novo_status" "public"."resgate_status") TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_processar_status_resgate"("p_resgate_id" "uuid", "p_novo_status" "public"."resgate_status") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_processar_status_resgate"("p_resgate_id" "uuid", "p_novo_status" "public"."resgate_status") TO "authenticated";



GRANT ALL ON FUNCTION "public"."fn_programa_ativo"("p_lojista_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_programa_ativo"("p_lojista_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_programa_ativo"("p_lojista_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."fn_rebuild_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_rebuild_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_rebuild_cliente_fidelidade"("p_cliente_id" "uuid", "p_lojista_id" "uuid") TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."pontos_movimentacoes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."pontos_movimentacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."pontos_movimentacoes" TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_registrar_movimentacao_pontos"("p_lojista_id" "uuid", "p_cliente_id" "uuid", "p_tipo" "public"."pontos_movimentacao_tipo", "p_pontos" integer, "p_sinal" integer, "p_compra_id" "uuid", "p_lote_id" "uuid", "p_lote_origem_id" "uuid", "p_lote_destino_id" "uuid", "p_descricao" "text", "p_metadata" "jsonb", "p_saldo_resultante" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_registrar_movimentacao_pontos"("p_lojista_id" "uuid", "p_cliente_id" "uuid", "p_tipo" "public"."pontos_movimentacao_tipo", "p_pontos" integer, "p_sinal" integer, "p_compra_id" "uuid", "p_lote_id" "uuid", "p_lote_origem_id" "uuid", "p_lote_destino_id" "uuid", "p_descricao" "text", "p_metadata" "jsonb", "p_saldo_resultante" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_registrar_movimentacao_pontos"("p_lojista_id" "uuid", "p_cliente_id" "uuid", "p_tipo" "public"."pontos_movimentacao_tipo", "p_pontos" integer, "p_sinal" integer, "p_compra_id" "uuid", "p_lote_id" "uuid", "p_lote_origem_id" "uuid", "p_lote_destino_id" "uuid", "p_descricao" "text", "p_metadata" "jsonb", "p_saldo_resultante" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."trg_processar_compra"() TO "service_role";
GRANT ALL ON FUNCTION "public"."trg_processar_compra"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_processar_compra"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."trg_reservar_pontos_resgate"() TO "service_role";
GRANT ALL ON FUNCTION "public"."trg_reservar_pontos_resgate"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_reservar_pontos_resgate"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."admins_plataforma" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."admins_plataforma" TO "authenticated";
GRANT ALL ON TABLE "public"."admins_plataforma" TO "service_role";



GRANT ALL ON TABLE "public"."ajustes_pontos" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ajustes_pontos" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ajustes_pontos" TO "authenticated";



GRANT ALL ON TABLE "public"."clientes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."clientes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."clientes" TO "authenticated";



GRANT ALL ON TABLE "public"."clientes_fidelidade" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."clientes_fidelidade" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."clientes_fidelidade" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."clientes_usuarios" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."clientes_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes_usuarios" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."compra_itens" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."compra_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."compra_itens" TO "service_role";



GRANT ALL ON TABLE "public"."compras" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."compras" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."compras" TO "authenticated";



GRANT ALL ON TABLE "public"."lojistas" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lojistas" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lojistas" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lojistas_usuarios" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lojistas_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."lojistas_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."lotes_pontos" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lotes_pontos" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lotes_pontos" TO "authenticated";



GRANT ALL ON TABLE "public"."premios" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."premios" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."premios" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."produtos" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos" TO "service_role";



GRANT ALL ON TABLE "public"."programas_fidelidade" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."programas_fidelidade" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."programas_fidelidade" TO "authenticated";



GRANT ALL ON TABLE "public"."resgate_alocacoes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."resgate_alocacoes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."resgate_alocacoes" TO "authenticated";



GRANT ALL ON TABLE "public"."resgates" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."resgates" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."resgates" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























