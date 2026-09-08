--
-- PostgreSQL database dump
--

\restrict 5sFNKS3TaACQcYS8gNHEPRoV61K315es3iBlBSH4Pm9bVD56yqhpkC6HQMGMGdX

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

-- Started on 2026-05-26 22:56:34

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 70 (class 2615 OID 41691)
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO postgres;

--
-- TOC entry 1275 (class 1247 OID 41740)
-- Name: ajuste_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ajuste_tipo AS ENUM (
    'compensacao_cancelamento',
    'saldo_negativo',
    'ajuste_manual'
);


ALTER TYPE public.ajuste_tipo OWNER TO postgres;

--
-- TOC entry 1272 (class 1247 OID 41732)
-- Name: alocacao_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.alocacao_status AS ENUM (
    'pendente',
    'gasto',
    'revertido'
);


ALTER TYPE public.alocacao_status OWNER TO postgres;

--
-- TOC entry 1260 (class 1247 OID 41696)
-- Name: compra_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.compra_status AS ENUM (
    'pendente',
    'aprovada',
    'recusada',
    'cancelada'
);


ALTER TYPE public.compra_status OWNER TO postgres;

--
-- TOC entry 1266 (class 1247 OID 41712)
-- Name: lote_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.lote_status AS ENUM (
    'pendente',
    'disponivel',
    'cancelado',
    'expirado'
);


ALTER TYPE public.lote_status OWNER TO postgres;

--
-- TOC entry 1263 (class 1247 OID 41706)
-- Name: origem_compra; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.origem_compra AS ENUM (
    'cliente',
    'lojista'
);


ALTER TYPE public.origem_compra OWNER TO postgres;

--
-- TOC entry 1331 (class 1247 OID 57201)
-- Name: pontos_movimentacao_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.pontos_movimentacao_tipo AS ENUM (
    'geracao',
    'resgate',
    'compensacao_cancelamento',
    'expiracao',
    'ajuste_manual',
    'saldo_negativo'
);


ALTER TYPE public.pontos_movimentacao_tipo OWNER TO postgres;

--
-- TOC entry 1269 (class 1247 OID 41722)
-- Name: resgate_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.resgate_status AS ENUM (
    'pendente',
    'aprovado',
    'recusado',
    'cancelado'
);


ALTER TYPE public.resgate_status OWNER TO postgres;

--
-- TOC entry 505 (class 1255 OID 41982)
-- Name: fn_alocar_fifo_resgate(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_alocar_fifo_resgate(p_resgate_id uuid) RETURNS void
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_alocar_fifo_resgate(p_resgate_id uuid) OWNER TO postgres;

--
-- TOC entry 433 (class 1255 OID 41976)
-- Name: fn_calcular_streak_cliente(uuid, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_calcular_streak_cliente(p_cliente_id uuid, p_lojista_id uuid, p_data_compra timestamp with time zone) RETURNS integer
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_calcular_streak_cliente(p_cliente_id uuid, p_lojista_id uuid, p_data_compra timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 504 (class 1255 OID 57198)
-- Name: fn_cancelar_compra_com_compensacao(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_cancelar_compra_com_compensacao(p_compra_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.fn_cancelar_compra_com_compensacao(p_compra_id uuid) OWNER TO postgres;

--
-- TOC entry 465 (class 1255 OID 59556)
-- Name: fn_expirar_lotes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_expirar_lotes() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.fn_expirar_lotes() OWNER TO postgres;

--
-- TOC entry 421 (class 1255 OID 41977)
-- Name: fn_garantir_cliente_fidelidade(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_garantir_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
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


ALTER FUNCTION public.fn_garantir_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 391 (class 1259 OID 41786)
-- Name: programa_niveis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.programa_niveis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    programa_id uuid,
    nome character varying(100),
    streak_min integer NOT NULL,
    streak_max integer,
    percentual_conversao numeric(5,2) NOT NULL,
    teto_pontos_compra integer NOT NULL,
    ordem integer NOT NULL
);


ALTER TABLE public.programa_niveis OWNER TO postgres;

--
-- TOC entry 417 (class 1255 OID 41975)
-- Name: fn_nivel_por_streak(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_nivel_por_streak(p_programa_id uuid, p_streak integer) RETURNS public.programa_niveis
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_nivel_por_streak(p_programa_id uuid, p_streak integer) OWNER TO postgres;

--
-- TOC entry 476 (class 1255 OID 57199)
-- Name: fn_prever_cancelamento_compra(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_prever_cancelamento_compra(p_compra_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.fn_prever_cancelamento_compra(p_compra_id uuid) OWNER TO postgres;

--
-- TOC entry 528 (class 1255 OID 41979)
-- Name: fn_processar_compra(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_processar_compra(p_compra_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

  if v_compra.status in ('cancelada', 'recusada') then
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
  set
    pontos_cancelados = coalesce(pontos_cancelados, 0)
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
end;
$$;


ALTER FUNCTION public.fn_processar_compra(p_compra_id uuid) OWNER TO postgres;

--
-- TOC entry 495 (class 1255 OID 41985)
-- Name: fn_processar_status_resgate(uuid, public.resgate_status); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_processar_status_resgate(p_resgate_id uuid, p_novo_status public.resgate_status) RETURNS void
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_processar_status_resgate(p_resgate_id uuid, p_novo_status public.resgate_status) OWNER TO postgres;

--
-- TOC entry 515 (class 1255 OID 41974)
-- Name: fn_programa_ativo(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_programa_ativo(p_lojista_id uuid) RETURNS uuid
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_programa_ativo(p_lojista_id uuid) OWNER TO postgres;

--
-- TOC entry 478 (class 1255 OID 41978)
-- Name: fn_rebuild_cliente_fidelidade(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_rebuild_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) RETURNS void
    LANGUAGE plpgsql
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


ALTER FUNCTION public.fn_rebuild_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) OWNER TO postgres;

--
-- TOC entry 409 (class 1259 OID 57213)
-- Name: pontos_movimentacoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pontos_movimentacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lojista_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    compra_id uuid,
    lote_id uuid,
    lote_origem_id uuid,
    lote_destino_id uuid,
    tipo public.pontos_movimentacao_tipo NOT NULL,
    pontos integer NOT NULL,
    sinal integer DEFAULT 1 NOT NULL,
    saldo_resultante integer,
    descricao text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pontos_movimentacoes_chk_pontos_positivos CHECK ((pontos >= 0)),
    CONSTRAINT pontos_movimentacoes_chk_sinal_valido CHECK ((sinal = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE public.pontos_movimentacoes OWNER TO postgres;

--
-- TOC entry 442 (class 1255 OID 57271)
-- Name: fn_registrar_movimentacao_pontos(uuid, uuid, public.pontos_movimentacao_tipo, integer, integer, uuid, uuid, uuid, uuid, text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_registrar_movimentacao_pontos(p_lojista_id uuid, p_cliente_id uuid, p_tipo public.pontos_movimentacao_tipo, p_pontos integer, p_sinal integer DEFAULT 1, p_compra_id uuid DEFAULT NULL::uuid, p_lote_id uuid DEFAULT NULL::uuid, p_lote_origem_id uuid DEFAULT NULL::uuid, p_lote_destino_id uuid DEFAULT NULL::uuid, p_descricao text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_saldo_resultante integer DEFAULT NULL::integer) RETURNS public.pontos_movimentacoes
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.fn_registrar_movimentacao_pontos(p_lojista_id uuid, p_cliente_id uuid, p_tipo public.pontos_movimentacao_tipo, p_pontos integer, p_sinal integer, p_compra_id uuid, p_lote_id uuid, p_lote_origem_id uuid, p_lote_destino_id uuid, p_descricao text, p_metadata jsonb, p_saldo_resultante integer) OWNER TO postgres;

--
-- TOC entry 416 (class 1255 OID 41969)
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- TOC entry 472 (class 1255 OID 41980)
-- Name: trg_processar_compra(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_processar_compra() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform public.fn_processar_compra(new.id);
  return new;
end;
$$;


ALTER FUNCTION public.trg_processar_compra() OWNER TO postgres;

--
-- TOC entry 420 (class 1255 OID 41983)
-- Name: trg_reservar_pontos_resgate(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_reservar_pontos_resgate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.status = 'pendente' then
    perform public.fn_alocar_fifo_resgate(new.id);
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.trg_reservar_pontos_resgate() OWNER TO postgres;

--
-- TOC entry 510 (class 1255 OID 45468)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- TOC entry 410 (class 1259 OID 60685)
-- Name: admins_plataforma; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins_plataforma (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    nome character varying(150),
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admins_plataforma OWNER TO postgres;

--
-- TOC entry 398 (class 1259 OID 41947)
-- Name: ajustes_pontos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ajustes_pontos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid,
    lojista_id uuid,
    tipo public.ajuste_tipo NOT NULL,
    pontos integer NOT NULL,
    descricao text,
    referencia_compra uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ajustes_pontos OWNER TO postgres;

--
-- TOC entry 389 (class 1259 OID 41756)
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lojista_id uuid,
    nome character varying(150) NOT NULL,
    telefone character varying(50),
    email character varying(150),
    cnpj character varying(20),
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    auth_user_id uuid,
    pode_fazer_login boolean DEFAULT false NOT NULL,
    acesso_ativado_em timestamp with time zone,
    ultimo_login_em timestamp with time zone,
    documento character varying(20),
    endereco text,
    codigo_externo character varying(50),
    CONSTRAINT clientes_login_consistencia_chk CHECK (((pode_fazer_login = false) OR ((pode_fazer_login = true) AND (auth_user_id IS NOT NULL)))),
    CONSTRAINT clientes_login_documento_chk CHECK (((pode_fazer_login = false) OR ((pode_fazer_login = true) AND (documento IS NOT NULL) AND (email IS NOT NULL) AND (auth_user_id IS NOT NULL))))
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- TOC entry 392 (class 1259 OID 41798)
-- Name: clientes_fidelidade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes_fidelidade (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid,
    lojista_id uuid,
    programa_id uuid,
    streak_atual integer DEFAULT 0,
    nivel_atual_id uuid,
    ultima_compra_valida_em timestamp with time zone,
    saldo_disponivel integer DEFAULT 0,
    saldo_pendente integer DEFAULT 0,
    saldo_negativo integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    ativo boolean DEFAULT true NOT NULL,
    validade_dias_custom integer,
    CONSTRAINT clientes_fidelidade_chk_validade_dias_custom_nao_negativa CHECK (((validade_dias_custom IS NULL) OR (validade_dias_custom >= 0)))
);


ALTER TABLE public.clientes_fidelidade OWNER TO postgres;

--
-- TOC entry 404 (class 1259 OID 54422)
-- Name: clientes_usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes_usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    auth_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.clientes_usuarios OWNER TO postgres;

--
-- TOC entry 406 (class 1259 OID 54471)
-- Name: compra_itens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compra_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    compra_id uuid NOT NULL,
    produto_id uuid NOT NULL,
    descricao_produto character varying(200) NOT NULL,
    quantidade numeric(10,3) NOT NULL,
    valor_unitario numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    teto_percentual_produto numeric(5,2) NOT NULL,
    teto_percentual_nivel numeric(5,2) NOT NULL,
    percentual_aplicado numeric(5,2) NOT NULL,
    pontos_gerados numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compra_itens_percentual_aplicado_check CHECK (((percentual_aplicado >= (0)::numeric) AND (percentual_aplicado <= (100)::numeric))),
    CONSTRAINT compra_itens_pontos_gerados_check CHECK ((pontos_gerados >= (0)::numeric)),
    CONSTRAINT compra_itens_quantidade_check CHECK ((quantidade > (0)::numeric)),
    CONSTRAINT compra_itens_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT compra_itens_teto_percentual_nivel_check CHECK (((teto_percentual_nivel >= (0)::numeric) AND (teto_percentual_nivel <= (100)::numeric))),
    CONSTRAINT compra_itens_teto_percentual_produto_check CHECK (((teto_percentual_produto >= (0)::numeric) AND (teto_percentual_produto <= (100)::numeric))),
    CONSTRAINT compra_itens_valor_unitario_check CHECK ((valor_unitario >= (0)::numeric))
);


ALTER TABLE public.compra_itens OWNER TO postgres;

--
-- TOC entry 393 (class 1259 OID 41831)
-- Name: compras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lojista_id uuid,
    cliente_id uuid,
    valor_total numeric(12,2) NOT NULL,
    origem public.origem_compra NOT NULL,
    status public.compra_status DEFAULT 'pendente'::public.compra_status,
    data_compra timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    pontos_total numeric(12,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.compras OWNER TO postgres;

--
-- TOC entry 388 (class 1259 OID 41747)
-- Name: lojistas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lojistas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome_fantasia character varying(150) NOT NULL,
    razao_social character varying(150) NOT NULL,
    email character varying(150),
    telefone character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    nome_responsavel character varying(150),
    cnpj character varying(30),
    endereco text,
    ativo boolean DEFAULT true NOT NULL
);


ALTER TABLE public.lojistas OWNER TO postgres;

--
-- TOC entry 403 (class 1259 OID 54396)
-- Name: lojistas_usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lojistas_usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lojista_id uuid NOT NULL,
    auth_user_id uuid NOT NULL,
    papel character varying(30) DEFAULT 'owner'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lojistas_usuarios OWNER TO postgres;

--
-- TOC entry 394 (class 1259 OID 41850)
-- Name: lotes_pontos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lotes_pontos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    lojista_id uuid NOT NULL,
    compra_id uuid NOT NULL,
    nivel_id uuid,
    percentual_aplicado numeric(5,2) NOT NULL,
    teto_aplicado integer NOT NULL,
    pontos_gerados integer NOT NULL,
    pontos_disponiveis integer NOT NULL,
    pontos_pendentes integer DEFAULT 0,
    pontos_gastos integer DEFAULT 0,
    pontos_expirados integer DEFAULT 0,
    pontos_cancelados integer DEFAULT 0,
    status public.lote_status DEFAULT 'pendente'::public.lote_status NOT NULL,
    gerado_em timestamp with time zone DEFAULT now() NOT NULL,
    expira_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lotes_pontos_chk_percentual_nao_negativo CHECK ((percentual_aplicado >= (0)::numeric)),
    CONSTRAINT lotes_pontos_chk_pontos_nao_negativos CHECK (((pontos_gerados >= 0) AND (pontos_disponiveis >= 0) AND (pontos_pendentes >= 0) AND (pontos_gastos >= 0) AND (pontos_expirados >= 0) AND (pontos_cancelados >= 0))),
    CONSTRAINT lotes_pontos_chk_soma_componentes CHECK (((((pontos_disponiveis + pontos_gastos) + pontos_expirados) + pontos_cancelados) <= pontos_gerados)),
    CONSTRAINT lotes_pontos_chk_teto_nao_negativo CHECK ((teto_aplicado >= 0))
);


ALTER TABLE public.lotes_pontos OWNER TO postgres;

--
-- TOC entry 395 (class 1259 OID 41885)
-- Name: premios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.premios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lojista_id uuid,
    nome character varying(150) NOT NULL,
    descricao text,
    pontos_necessarios integer NOT NULL,
    nivel_minimo_id uuid,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.premios OWNER TO postgres;

--
-- TOC entry 405 (class 1259 OID 54447)
-- Name: produtos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produtos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lojista_id uuid NOT NULL,
    descricao character varying(200) NOT NULL,
    teto_percentual numeric(5,2) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT produtos_teto_percentual_check CHECK (((teto_percentual >= (0)::numeric) AND (teto_percentual <= (100)::numeric)))
);


ALTER TABLE public.produtos OWNER TO postgres;

--
-- TOC entry 390 (class 1259 OID 41771)
-- Name: programas_fidelidade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.programas_fidelidade (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lojista_id uuid,
    nome character varying(120) NOT NULL,
    dias_para_perder_streak integer DEFAULT 30,
    dias_expiracao_pontos integer DEFAULT 180,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    validade_dias integer,
    CONSTRAINT programas_fidelidade_chk_validade_dias_nao_negativa CHECK (((validade_dias IS NULL) OR (validade_dias >= 0)))
);


ALTER TABLE public.programas_fidelidade OWNER TO postgres;

--
-- TOC entry 397 (class 1259 OID 41929)
-- Name: resgate_alocacoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resgate_alocacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resgate_id uuid,
    lote_id uuid,
    pontos_alocados integer NOT NULL,
    status public.alocacao_status DEFAULT 'pendente'::public.alocacao_status,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.resgate_alocacoes OWNER TO postgres;

--
-- TOC entry 396 (class 1259 OID 41905)
-- Name: resgates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resgates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid,
    lojista_id uuid,
    premio_id uuid,
    pontos_solicitados integer NOT NULL,
    status public.resgate_status DEFAULT 'pendente'::public.resgate_status,
    solicitado_em timestamp with time zone DEFAULT now(),
    decidido_em timestamp with time zone
);


ALTER TABLE public.resgates OWNER TO postgres;

--
-- TOC entry 3897 (class 2606 OID 60695)
-- Name: admins_plataforma admins_plataforma_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins_plataforma
    ADD CONSTRAINT admins_plataforma_auth_user_id_key UNIQUE (auth_user_id);


--
-- TOC entry 3899 (class 2606 OID 60693)
-- Name: admins_plataforma admins_plataforma_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins_plataforma
    ADD CONSTRAINT admins_plataforma_pkey PRIMARY KEY (id);


--
-- TOC entry 3861 (class 2606 OID 41955)
-- Name: ajustes_pontos ajustes_pontos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ajustes_pontos
    ADD CONSTRAINT ajustes_pontos_pkey PRIMARY KEY (id);


--
-- TOC entry 3821 (class 2606 OID 45459)
-- Name: clientes clientes_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_auth_user_id_key UNIQUE (auth_user_id);


--
-- TOC entry 3833 (class 2606 OID 41810)
-- Name: clientes_fidelidade clientes_fidelidade_cliente_id_lojista_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_fidelidade
    ADD CONSTRAINT clientes_fidelidade_cliente_id_lojista_id_key UNIQUE (cliente_id, lojista_id);


--
-- TOC entry 3835 (class 2606 OID 41808)
-- Name: clientes_fidelidade clientes_fidelidade_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_fidelidade
    ADD CONSTRAINT clientes_fidelidade_pkey PRIMARY KEY (id);


--
-- TOC entry 3823 (class 2606 OID 41764)
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- TOC entry 3871 (class 2606 OID 54433)
-- Name: clientes_usuarios clientes_usuarios_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_usuarios
    ADD CONSTRAINT clientes_usuarios_auth_user_id_key UNIQUE (auth_user_id);


--
-- TOC entry 3873 (class 2606 OID 54431)
-- Name: clientes_usuarios clientes_usuarios_cliente_id_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_usuarios
    ADD CONSTRAINT clientes_usuarios_cliente_id_auth_user_id_key UNIQUE (cliente_id, auth_user_id);


--
-- TOC entry 3875 (class 2606 OID 54429)
-- Name: clientes_usuarios clientes_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_usuarios
    ADD CONSTRAINT clientes_usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 3884 (class 2606 OID 54484)
-- Name: compra_itens compra_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compra_itens
    ADD CONSTRAINT compra_itens_pkey PRIMARY KEY (id);


--
-- TOC entry 3837 (class 2606 OID 41838)
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);


--
-- TOC entry 3818 (class 2606 OID 41755)
-- Name: lojistas lojistas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lojistas
    ADD CONSTRAINT lojistas_pkey PRIMARY KEY (id);


--
-- TOC entry 3865 (class 2606 OID 54408)
-- Name: lojistas_usuarios lojistas_usuarios_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lojistas_usuarios
    ADD CONSTRAINT lojistas_usuarios_auth_user_id_key UNIQUE (auth_user_id);


--
-- TOC entry 3867 (class 2606 OID 54406)
-- Name: lojistas_usuarios lojistas_usuarios_lojista_id_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lojistas_usuarios
    ADD CONSTRAINT lojistas_usuarios_lojista_id_auth_user_id_key UNIQUE (lojista_id, auth_user_id);


--
-- TOC entry 3869 (class 2606 OID 54404)
-- Name: lojistas_usuarios lojistas_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lojistas_usuarios
    ADD CONSTRAINT lojistas_usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 3850 (class 2606 OID 41862)
-- Name: lotes_pontos lotes_pontos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lotes_pontos
    ADD CONSTRAINT lotes_pontos_pkey PRIMARY KEY (id);


--
-- TOC entry 3895 (class 2606 OID 57226)
-- Name: pontos_movimentacoes pontos_movimentacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pontos_movimentacoes
    ADD CONSTRAINT pontos_movimentacoes_pkey PRIMARY KEY (id);


--
-- TOC entry 3853 (class 2606 OID 41894)
-- Name: premios premios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.premios
    ADD CONSTRAINT premios_pkey PRIMARY KEY (id);


--
-- TOC entry 3881 (class 2606 OID 54456)
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);


--
-- TOC entry 3831 (class 2606 OID 41791)
-- Name: programa_niveis programa_niveis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programa_niveis
    ADD CONSTRAINT programa_niveis_pkey PRIMARY KEY (id);


--
-- TOC entry 3828 (class 2606 OID 41780)
-- Name: programas_fidelidade programas_fidelidade_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programas_fidelidade
    ADD CONSTRAINT programas_fidelidade_pkey PRIMARY KEY (id);


--
-- TOC entry 3859 (class 2606 OID 41936)
-- Name: resgate_alocacoes resgate_alocacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resgate_alocacoes
    ADD CONSTRAINT resgate_alocacoes_pkey PRIMARY KEY (id);


--
-- TOC entry 3857 (class 2606 OID 41912)
-- Name: resgates resgates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resgates
    ADD CONSTRAINT resgates_pkey PRIMARY KEY (id);


--
-- TOC entry 3900 (class 1259 OID 60701)
-- Name: idx_admins_plataforma_auth_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admins_plataforma_auth_user_id ON public.admins_plataforma USING btree (auth_user_id);


--
-- TOC entry 3901 (class 1259 OID 60702)
-- Name: idx_admins_plataforma_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admins_plataforma_email ON public.admins_plataforma USING btree (lower((email)::text));


--
-- TOC entry 3824 (class 1259 OID 41770)
-- Name: idx_clientes_lojista; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clientes_lojista ON public.clientes USING btree (lojista_id);


--
-- TOC entry 3876 (class 1259 OID 54445)
-- Name: idx_clientes_usuarios_auth_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clientes_usuarios_auth_user_id ON public.clientes_usuarios USING btree (auth_user_id);


--
-- TOC entry 3877 (class 1259 OID 54444)
-- Name: idx_clientes_usuarios_cliente_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clientes_usuarios_cliente_id ON public.clientes_usuarios USING btree (cliente_id);


--
-- TOC entry 3885 (class 1259 OID 54495)
-- Name: idx_compra_itens_compra_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compra_itens_compra_id ON public.compra_itens USING btree (compra_id);


--
-- TOC entry 3886 (class 1259 OID 54496)
-- Name: idx_compra_itens_produto_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compra_itens_produto_id ON public.compra_itens USING btree (produto_id);


--
-- TOC entry 3838 (class 1259 OID 41849)
-- Name: idx_compras_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compras_cliente ON public.compras USING btree (cliente_id);


--
-- TOC entry 3839 (class 1259 OID 54469)
-- Name: idx_compras_cliente_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compras_cliente_id ON public.compras USING btree (cliente_id);


--
-- TOC entry 3840 (class 1259 OID 41967)
-- Name: idx_compras_data; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compras_data ON public.compras USING btree (cliente_id, data_compra);


--
-- TOC entry 3841 (class 1259 OID 54468)
-- Name: idx_compras_lojista_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compras_lojista_id ON public.compras USING btree (lojista_id);


--
-- TOC entry 3816 (class 1259 OID 60755)
-- Name: idx_lojistas_ativo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lojistas_ativo ON public.lojistas USING btree (ativo);


--
-- TOC entry 3862 (class 1259 OID 54420)
-- Name: idx_lojistas_usuarios_auth_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lojistas_usuarios_auth_user_id ON public.lojistas_usuarios USING btree (auth_user_id);


--
-- TOC entry 3863 (class 1259 OID 54419)
-- Name: idx_lojistas_usuarios_lojista_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lojistas_usuarios_lojista_id ON public.lojistas_usuarios USING btree (lojista_id);


--
-- TOC entry 3842 (class 1259 OID 41883)
-- Name: idx_lotes_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lotes_cliente ON public.lotes_pontos USING btree (cliente_id);


--
-- TOC entry 3843 (class 1259 OID 41884)
-- Name: idx_lotes_expiracao; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lotes_expiracao ON public.lotes_pontos USING btree (expira_em);


--
-- TOC entry 3844 (class 1259 OID 41966)
-- Name: idx_lotes_fifo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lotes_fifo ON public.lotes_pontos USING btree (cliente_id, status, expira_em);


--
-- TOC entry 3845 (class 1259 OID 57186)
-- Name: idx_lotes_pontos_cliente_lojista; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lotes_pontos_cliente_lojista ON public.lotes_pontos USING btree (cliente_id, lojista_id);


--
-- TOC entry 3846 (class 1259 OID 57187)
-- Name: idx_lotes_pontos_compra; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lotes_pontos_compra ON public.lotes_pontos USING btree (compra_id);


--
-- TOC entry 3847 (class 1259 OID 59557)
-- Name: idx_lotes_pontos_expiracao_execucao; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lotes_pontos_expiracao_execucao ON public.lotes_pontos USING btree (status, expira_em) WHERE (status = 'disponivel'::public.lote_status);


--
-- TOC entry 3848 (class 1259 OID 57185)
-- Name: idx_lotes_pontos_lojista_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lotes_pontos_lojista_status ON public.lotes_pontos USING btree (lojista_id, status);


--
-- TOC entry 3829 (class 1259 OID 41797)
-- Name: idx_niveis_programa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_niveis_programa ON public.programa_niveis USING btree (programa_id);


--
-- TOC entry 3887 (class 1259 OID 57258)
-- Name: idx_pontos_movimentacoes_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pontos_movimentacoes_cliente ON public.pontos_movimentacoes USING btree (cliente_id);


--
-- TOC entry 3888 (class 1259 OID 57263)
-- Name: idx_pontos_movimentacoes_cliente_lojista_data; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pontos_movimentacoes_cliente_lojista_data ON public.pontos_movimentacoes USING btree (cliente_id, lojista_id, created_at DESC);


--
-- TOC entry 3889 (class 1259 OID 57259)
-- Name: idx_pontos_movimentacoes_compra; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pontos_movimentacoes_compra ON public.pontos_movimentacoes USING btree (compra_id);


--
-- TOC entry 3890 (class 1259 OID 57262)
-- Name: idx_pontos_movimentacoes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pontos_movimentacoes_created_at ON public.pontos_movimentacoes USING btree (created_at DESC);


--
-- TOC entry 3891 (class 1259 OID 57257)
-- Name: idx_pontos_movimentacoes_lojista; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pontos_movimentacoes_lojista ON public.pontos_movimentacoes USING btree (lojista_id);


--
-- TOC entry 3892 (class 1259 OID 57260)
-- Name: idx_pontos_movimentacoes_lote; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pontos_movimentacoes_lote ON public.pontos_movimentacoes USING btree (lote_id);


--
-- TOC entry 3893 (class 1259 OID 57261)
-- Name: idx_pontos_movimentacoes_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pontos_movimentacoes_tipo ON public.pontos_movimentacoes USING btree (tipo);


--
-- TOC entry 3878 (class 1259 OID 54463)
-- Name: idx_produtos_descricao; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_produtos_descricao ON public.produtos USING btree (descricao);


--
-- TOC entry 3879 (class 1259 OID 54462)
-- Name: idx_produtos_lojista_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_produtos_lojista_id ON public.produtos USING btree (lojista_id);


--
-- TOC entry 3854 (class 1259 OID 41928)
-- Name: idx_resgates_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resgates_cliente ON public.resgates USING btree (cliente_id);


--
-- TOC entry 3855 (class 1259 OID 41968)
-- Name: idx_resgates_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resgates_status ON public.resgates USING btree (status);


--
-- TOC entry 3819 (class 1259 OID 60756)
-- Name: uq_lojistas_cnpj; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_lojistas_cnpj ON public.lojistas USING btree (cnpj);


--
-- TOC entry 3851 (class 1259 OID 58449)
-- Name: uq_lotes_pontos_compra_nivel_ativo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_lotes_pontos_compra_nivel_ativo ON public.lotes_pontos USING btree (compra_id, nivel_id) WHERE (status = ANY (ARRAY['pendente'::public.lote_status, 'disponivel'::public.lote_status]));


--
-- TOC entry 3882 (class 1259 OID 54464)
-- Name: uq_produtos_lojista_descricao; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_produtos_lojista_descricao ON public.produtos USING btree (lojista_id, lower((descricao)::text));


--
-- TOC entry 3825 (class 1259 OID 60826)
-- Name: ux_clientes_documento_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_clientes_documento_unique ON public.clientes USING btree (documento) WHERE (documento IS NOT NULL);


--
-- TOC entry 3826 (class 1259 OID 74221)
-- Name: ux_clientes_lojista_codigo_externo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_clientes_lojista_codigo_externo ON public.clientes USING btree (lojista_id, codigo_externo) WHERE (codigo_externo IS NOT NULL);


--
-- TOC entry 3942 (class 2620 OID 41971)
-- Name: clientes_fidelidade trg_clientes_fidelidade_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_clientes_fidelidade_updated_at BEFORE UPDATE ON public.clientes_fidelidade FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 3939 (class 2620 OID 41970)
-- Name: clientes trg_clientes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 3943 (class 2620 OID 41981)
-- Name: compras trg_compras_processar; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_compras_processar AFTER INSERT OR UPDATE OF status, valor_total, data_compra ON public.compras FOR EACH ROW EXECUTE FUNCTION public.trg_processar_compra();


--
-- TOC entry 3949 (class 2620 OID 57264)
-- Name: pontos_movimentacoes trg_pontos_movimentacoes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pontos_movimentacoes_updated_at BEFORE UPDATE ON public.pontos_movimentacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3941 (class 2620 OID 41973)
-- Name: programas_fidelidade trg_programas_fidelidade_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_programas_fidelidade_updated_at BEFORE UPDATE ON public.programas_fidelidade FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 3945 (class 2620 OID 41984)
-- Name: resgates trg_resgates_reservar; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_resgates_reservar AFTER INSERT ON public.resgates FOR EACH ROW EXECUTE FUNCTION public.trg_reservar_pontos_resgate();


--
-- TOC entry 3950 (class 2620 OID 60703)
-- Name: admins_plataforma update_admins_plataforma_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_admins_plataforma_updated_at BEFORE UPDATE ON public.admins_plataforma FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3940 (class 2620 OID 45469)
-- Name: clientes update_clientes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3947 (class 2620 OID 54446)
-- Name: clientes_usuarios update_clientes_usuarios_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_clientes_usuarios_updated_at BEFORE UPDATE ON public.clientes_usuarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3944 (class 2620 OID 54470)
-- Name: compras update_compras_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_compras_updated_at BEFORE UPDATE ON public.compras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3946 (class 2620 OID 54421)
-- Name: lojistas_usuarios update_lojistas_usuarios_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_lojistas_usuarios_updated_at BEFORE UPDATE ON public.lojistas_usuarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3948 (class 2620 OID 54465)
-- Name: produtos update_produtos_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3938 (class 2606 OID 60696)
-- Name: admins_plataforma admins_plataforma_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins_plataforma
    ADD CONSTRAINT admins_plataforma_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 3923 (class 2606 OID 41956)
-- Name: ajustes_pontos ajustes_pontos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ajustes_pontos
    ADD CONSTRAINT ajustes_pontos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- TOC entry 3924 (class 2606 OID 41961)
-- Name: ajustes_pontos ajustes_pontos_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ajustes_pontos
    ADD CONSTRAINT ajustes_pontos_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id);


--
-- TOC entry 3902 (class 2606 OID 45460)
-- Name: clientes clientes_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 3906 (class 2606 OID 41811)
-- Name: clientes_fidelidade clientes_fidelidade_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_fidelidade
    ADD CONSTRAINT clientes_fidelidade_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- TOC entry 3907 (class 2606 OID 41816)
-- Name: clientes_fidelidade clientes_fidelidade_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_fidelidade
    ADD CONSTRAINT clientes_fidelidade_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id) ON DELETE CASCADE;


--
-- TOC entry 3908 (class 2606 OID 41826)
-- Name: clientes_fidelidade clientes_fidelidade_nivel_atual_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_fidelidade
    ADD CONSTRAINT clientes_fidelidade_nivel_atual_id_fkey FOREIGN KEY (nivel_atual_id) REFERENCES public.programa_niveis(id);


--
-- TOC entry 3909 (class 2606 OID 41821)
-- Name: clientes_fidelidade clientes_fidelidade_programa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_fidelidade
    ADD CONSTRAINT clientes_fidelidade_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id);


--
-- TOC entry 3903 (class 2606 OID 41765)
-- Name: clientes clientes_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id) ON DELETE CASCADE;


--
-- TOC entry 3927 (class 2606 OID 54439)
-- Name: clientes_usuarios clientes_usuarios_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_usuarios
    ADD CONSTRAINT clientes_usuarios_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 3928 (class 2606 OID 54434)
-- Name: clientes_usuarios clientes_usuarios_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes_usuarios
    ADD CONSTRAINT clientes_usuarios_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- TOC entry 3930 (class 2606 OID 54485)
-- Name: compra_itens compra_itens_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compra_itens
    ADD CONSTRAINT compra_itens_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;


--
-- TOC entry 3931 (class 2606 OID 54490)
-- Name: compra_itens compra_itens_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compra_itens
    ADD CONSTRAINT compra_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE RESTRICT;


--
-- TOC entry 3910 (class 2606 OID 41844)
-- Name: compras compras_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- TOC entry 3911 (class 2606 OID 41839)
-- Name: compras compras_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id);


--
-- TOC entry 3925 (class 2606 OID 54414)
-- Name: lojistas_usuarios lojistas_usuarios_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lojistas_usuarios
    ADD CONSTRAINT lojistas_usuarios_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 3926 (class 2606 OID 54409)
-- Name: lojistas_usuarios lojistas_usuarios_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lojistas_usuarios
    ADD CONSTRAINT lojistas_usuarios_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id) ON DELETE CASCADE;


--
-- TOC entry 3912 (class 2606 OID 41863)
-- Name: lotes_pontos lotes_pontos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lotes_pontos
    ADD CONSTRAINT lotes_pontos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- TOC entry 3913 (class 2606 OID 41873)
-- Name: lotes_pontos lotes_pontos_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lotes_pontos
    ADD CONSTRAINT lotes_pontos_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id);


--
-- TOC entry 3914 (class 2606 OID 41868)
-- Name: lotes_pontos lotes_pontos_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lotes_pontos
    ADD CONSTRAINT lotes_pontos_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id);


--
-- TOC entry 3915 (class 2606 OID 41878)
-- Name: lotes_pontos lotes_pontos_nivel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lotes_pontos
    ADD CONSTRAINT lotes_pontos_nivel_id_fkey FOREIGN KEY (nivel_id) REFERENCES public.programa_niveis(id);


--
-- TOC entry 3932 (class 2606 OID 57232)
-- Name: pontos_movimentacoes pontos_movimentacoes_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pontos_movimentacoes
    ADD CONSTRAINT pontos_movimentacoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- TOC entry 3933 (class 2606 OID 57237)
-- Name: pontos_movimentacoes pontos_movimentacoes_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pontos_movimentacoes
    ADD CONSTRAINT pontos_movimentacoes_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id);


--
-- TOC entry 3934 (class 2606 OID 57227)
-- Name: pontos_movimentacoes pontos_movimentacoes_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pontos_movimentacoes
    ADD CONSTRAINT pontos_movimentacoes_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id);


--
-- TOC entry 3935 (class 2606 OID 57252)
-- Name: pontos_movimentacoes pontos_movimentacoes_lote_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pontos_movimentacoes
    ADD CONSTRAINT pontos_movimentacoes_lote_destino_id_fkey FOREIGN KEY (lote_destino_id) REFERENCES public.lotes_pontos(id);


--
-- TOC entry 3936 (class 2606 OID 57242)
-- Name: pontos_movimentacoes pontos_movimentacoes_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pontos_movimentacoes
    ADD CONSTRAINT pontos_movimentacoes_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes_pontos(id);


--
-- TOC entry 3937 (class 2606 OID 57247)
-- Name: pontos_movimentacoes pontos_movimentacoes_lote_origem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pontos_movimentacoes
    ADD CONSTRAINT pontos_movimentacoes_lote_origem_id_fkey FOREIGN KEY (lote_origem_id) REFERENCES public.lotes_pontos(id);


--
-- TOC entry 3916 (class 2606 OID 41895)
-- Name: premios premios_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.premios
    ADD CONSTRAINT premios_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id);


--
-- TOC entry 3917 (class 2606 OID 41900)
-- Name: premios premios_nivel_minimo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.premios
    ADD CONSTRAINT premios_nivel_minimo_id_fkey FOREIGN KEY (nivel_minimo_id) REFERENCES public.programa_niveis(id);


--
-- TOC entry 3929 (class 2606 OID 54457)
-- Name: produtos produtos_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id) ON DELETE CASCADE;


--
-- TOC entry 3905 (class 2606 OID 41792)
-- Name: programa_niveis programa_niveis_programa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programa_niveis
    ADD CONSTRAINT programa_niveis_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES public.programas_fidelidade(id) ON DELETE CASCADE;


--
-- TOC entry 3904 (class 2606 OID 41781)
-- Name: programas_fidelidade programas_fidelidade_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programas_fidelidade
    ADD CONSTRAINT programas_fidelidade_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id) ON DELETE CASCADE;


--
-- TOC entry 3921 (class 2606 OID 41942)
-- Name: resgate_alocacoes resgate_alocacoes_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resgate_alocacoes
    ADD CONSTRAINT resgate_alocacoes_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes_pontos(id);


--
-- TOC entry 3922 (class 2606 OID 41937)
-- Name: resgate_alocacoes resgate_alocacoes_resgate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resgate_alocacoes
    ADD CONSTRAINT resgate_alocacoes_resgate_id_fkey FOREIGN KEY (resgate_id) REFERENCES public.resgates(id) ON DELETE CASCADE;


--
-- TOC entry 3918 (class 2606 OID 41913)
-- Name: resgates resgates_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resgates
    ADD CONSTRAINT resgates_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- TOC entry 3919 (class 2606 OID 41918)
-- Name: resgates resgates_lojista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resgates
    ADD CONSTRAINT resgates_lojista_id_fkey FOREIGN KEY (lojista_id) REFERENCES public.lojistas(id);


--
-- TOC entry 3920 (class 2606 OID 41923)
-- Name: resgates resgates_premio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resgates
    ADD CONSTRAINT resgates_premio_id_fkey FOREIGN KEY (premio_id) REFERENCES public.premios(id);


--
-- TOC entry 4115 (class 0 OID 60685)
-- Dependencies: 410
-- Name: admins_plataforma; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admins_plataforma ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4175 (class 3256 OID 60859)
-- Name: admins_plataforma admins_plataforma_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admins_plataforma_delete_admin ON public.admins_plataforma FOR DELETE TO authenticated USING ((auth_user_id = auth.uid()));


--
-- TOC entry 4172 (class 3256 OID 60705)
-- Name: admins_plataforma admins_plataforma_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admins_plataforma_insert_admin ON public.admins_plataforma FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.admins_plataforma ap
  WHERE ((ap.auth_user_id = auth.uid()) AND (ap.ativo = true)))));


--
-- TOC entry 4173 (class 3256 OID 60857)
-- Name: admins_plataforma admins_plataforma_select_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admins_plataforma_select_admin ON public.admins_plataforma FOR SELECT TO authenticated USING (((auth_user_id = auth.uid()) AND (ativo = true)));


--
-- TOC entry 4174 (class 3256 OID 60858)
-- Name: admins_plataforma admins_plataforma_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admins_plataforma_update_admin ON public.admins_plataforma FOR UPDATE TO authenticated USING ((auth_user_id = auth.uid())) WITH CHECK ((auth_user_id = auth.uid()));


--
-- TOC entry 4109 (class 0 OID 41947)
-- Dependencies: 398
-- Name: ajustes_pontos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ajustes_pontos ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4100 (class 0 OID 41756)
-- Dependencies: 389
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4164 (class 3256 OID 56043)
-- Name: clientes clientes_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_delete_own_lojista ON public.clientes FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.clientes_fidelidade cf
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = cf.lojista_id)))
  WHERE ((cf.cliente_id = clientes.id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4103 (class 0 OID 41798)
-- Dependencies: 392
-- Name: clientes_fidelidade; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clientes_fidelidade ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4157 (class 3256 OID 56017)
-- Name: clientes_fidelidade clientes_fidelidade_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_fidelidade_delete_own_lojista ON public.clientes_fidelidade FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = clientes_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4155 (class 3256 OID 56014)
-- Name: clientes_fidelidade clientes_fidelidade_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_fidelidade_insert_own_lojista ON public.clientes_fidelidade FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = clientes_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4154 (class 3256 OID 56013)
-- Name: clientes_fidelidade clientes_fidelidade_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_fidelidade_select_own_lojista ON public.clientes_fidelidade FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = clientes_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4156 (class 3256 OID 56015)
-- Name: clientes_fidelidade clientes_fidelidade_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_fidelidade_update_own_lojista ON public.clientes_fidelidade FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = clientes_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = clientes_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4138 (class 3256 OID 56040)
-- Name: clientes clientes_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_insert_own_lojista ON public.clientes FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE (lu.auth_user_id = auth.uid()))));


--
-- TOC entry 4162 (class 3256 OID 56039)
-- Name: clientes clientes_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_select_own_lojista ON public.clientes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.clientes_fidelidade cf
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = cf.lojista_id)))
  WHERE ((cf.cliente_id = clientes.id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4163 (class 3256 OID 56041)
-- Name: clientes clientes_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_update_own_lojista ON public.clientes FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.clientes_fidelidade cf
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = cf.lojista_id)))
  WHERE ((cf.cliente_id = clientes.id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.clientes_fidelidade cf
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = cf.lojista_id)))
  WHERE ((cf.cliente_id = clientes.id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4111 (class 0 OID 54422)
-- Dependencies: 404
-- Name: clientes_usuarios; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clientes_usuarios ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4137 (class 3256 OID 54657)
-- Name: clientes_usuarios clientes_usuarios: acesso autenticado; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "clientes_usuarios: acesso autenticado" ON public.clientes_usuarios TO authenticated USING (true) WITH CHECK (true);


--
-- TOC entry 4161 (class 3256 OID 56022)
-- Name: clientes_usuarios clientes_usuarios_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_usuarios_delete_own_lojista ON public.clientes_usuarios FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.clientes c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = clientes_usuarios.cliente_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4159 (class 3256 OID 56019)
-- Name: clientes_usuarios clientes_usuarios_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_usuarios_insert_own_lojista ON public.clientes_usuarios FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.clientes c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = clientes_usuarios.cliente_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4117 (class 3256 OID 54498)
-- Name: clientes_usuarios clientes_usuarios_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_usuarios_select_own ON public.clientes_usuarios FOR SELECT USING ((auth_user_id = auth.uid()));


--
-- TOC entry 4158 (class 3256 OID 56018)
-- Name: clientes_usuarios clientes_usuarios_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_usuarios_select_own_lojista ON public.clientes_usuarios FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.clientes c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = clientes_usuarios.cliente_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4160 (class 3256 OID 56020)
-- Name: clientes_usuarios clientes_usuarios_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY clientes_usuarios_update_own_lojista ON public.clientes_usuarios FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.clientes c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = clientes_usuarios.cliente_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.clientes c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = clientes_usuarios.cliente_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4113 (class 0 OID 54471)
-- Dependencies: 406
-- Name: compra_itens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.compra_itens ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4135 (class 3256 OID 54654)
-- Name: compra_itens compra_itens: acesso autenticado; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "compra_itens: acesso autenticado" ON public.compra_itens TO authenticated USING (true) WITH CHECK (true);


--
-- TOC entry 4131 (class 3256 OID 54515)
-- Name: compra_itens compra_itens_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compra_itens_delete_own_lojista ON public.compra_itens FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.compras c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = compra_itens.compra_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4129 (class 3256 OID 54512)
-- Name: compra_itens compra_itens_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compra_itens_insert_own_lojista ON public.compra_itens FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.compras c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = compra_itens.compra_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4128 (class 3256 OID 54511)
-- Name: compra_itens compra_itens_select_own_cliente; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compra_itens_select_own_cliente ON public.compra_itens FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.compras c
     JOIN public.clientes_usuarios cu ON ((cu.cliente_id = c.cliente_id)))
  WHERE ((c.id = compra_itens.compra_id) AND (cu.auth_user_id = auth.uid())))));


--
-- TOC entry 4127 (class 3256 OID 54510)
-- Name: compra_itens compra_itens_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compra_itens_select_own_lojista ON public.compra_itens FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.compras c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = compra_itens.compra_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4130 (class 3256 OID 54513)
-- Name: compra_itens compra_itens_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compra_itens_update_own_lojista ON public.compra_itens FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.compras c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = compra_itens.compra_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.compras c
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = c.lojista_id)))
  WHERE ((c.id = compra_itens.compra_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4104 (class 0 OID 41831)
-- Dependencies: 393
-- Name: compras; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4134 (class 3256 OID 54653)
-- Name: compras compras: acesso autenticado; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "compras: acesso autenticado" ON public.compras TO authenticated USING (true) WITH CHECK (true);


--
-- TOC entry 4126 (class 3256 OID 54509)
-- Name: compras compras_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compras_delete_own_lojista ON public.compras FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = compras.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4124 (class 3256 OID 54506)
-- Name: compras compras_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compras_insert_own_lojista ON public.compras FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = compras.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4123 (class 3256 OID 54505)
-- Name: compras compras_select_own_cliente; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compras_select_own_cliente ON public.compras FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.clientes_usuarios cu
  WHERE ((cu.cliente_id = compras.cliente_id) AND (cu.auth_user_id = auth.uid())))));


--
-- TOC entry 4122 (class 3256 OID 54504)
-- Name: compras compras_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compras_select_own_lojista ON public.compras FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = compras.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4125 (class 3256 OID 54507)
-- Name: compras compras_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compras_update_own_lojista ON public.compras FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = compras.lojista_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = compras.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4099 (class 0 OID 41747)
-- Dependencies: 388
-- Name: lojistas; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lojistas ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4132 (class 3256 OID 54651)
-- Name: lojistas lojistas: acesso autenticado; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "lojistas: acesso autenticado" ON public.lojistas TO authenticated USING (true) WITH CHECK (true);


--
-- TOC entry 4110 (class 0 OID 54396)
-- Dependencies: 403
-- Name: lojistas_usuarios; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lojistas_usuarios ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4136 (class 3256 OID 54656)
-- Name: lojistas_usuarios lojistas_usuarios: acesso autenticado; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "lojistas_usuarios: acesso autenticado" ON public.lojistas_usuarios TO authenticated USING (true) WITH CHECK (true);


--
-- TOC entry 4116 (class 3256 OID 54497)
-- Name: lojistas_usuarios lojistas_usuarios_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lojistas_usuarios_select_own ON public.lojistas_usuarios FOR SELECT USING ((auth_user_id = auth.uid()));


--
-- TOC entry 4105 (class 0 OID 41850)
-- Dependencies: 394
-- Name: lotes_pontos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lotes_pontos ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4169 (class 3256 OID 57194)
-- Name: lotes_pontos lotes_pontos_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lotes_pontos_delete_own_lojista ON public.lotes_pontos FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = lotes_pontos.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4167 (class 3256 OID 57191)
-- Name: lotes_pontos lotes_pontos_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lotes_pontos_insert_own_lojista ON public.lotes_pontos FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = lotes_pontos.lojista_id) AND (lu.auth_user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.compras c
  WHERE ((c.id = lotes_pontos.compra_id) AND (c.lojista_id = lotes_pontos.lojista_id) AND (c.cliente_id = lotes_pontos.cliente_id))))));


--
-- TOC entry 4166 (class 3256 OID 57190)
-- Name: lotes_pontos lotes_pontos_select_own_cliente; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lotes_pontos_select_own_cliente ON public.lotes_pontos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.clientes_usuarios cu
  WHERE ((cu.cliente_id = lotes_pontos.cliente_id) AND (cu.auth_user_id = auth.uid())))));


--
-- TOC entry 4165 (class 3256 OID 57189)
-- Name: lotes_pontos lotes_pontos_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lotes_pontos_select_own_lojista ON public.lotes_pontos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = lotes_pontos.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4168 (class 3256 OID 57192)
-- Name: lotes_pontos lotes_pontos_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lotes_pontos_update_own_lojista ON public.lotes_pontos FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = lotes_pontos.lojista_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = lotes_pontos.lojista_id) AND (lu.auth_user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.compras c
  WHERE ((c.id = lotes_pontos.compra_id) AND (c.lojista_id = lotes_pontos.lojista_id) AND (c.cliente_id = lotes_pontos.cliente_id))))));


--
-- TOC entry 4114 (class 0 OID 57213)
-- Dependencies: 409
-- Name: pontos_movimentacoes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pontos_movimentacoes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4141 (class 3256 OID 57270)
-- Name: pontos_movimentacoes pontos_movimentacoes_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pontos_movimentacoes_delete_own_lojista ON public.pontos_movimentacoes FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = pontos_movimentacoes.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4139 (class 3256 OID 57267)
-- Name: pontos_movimentacoes pontos_movimentacoes_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pontos_movimentacoes_insert_own_lojista ON public.pontos_movimentacoes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = pontos_movimentacoes.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4171 (class 3256 OID 57266)
-- Name: pontos_movimentacoes pontos_movimentacoes_select_own_cliente; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pontos_movimentacoes_select_own_cliente ON public.pontos_movimentacoes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.clientes_usuarios cu
  WHERE ((cu.cliente_id = pontos_movimentacoes.cliente_id) AND (cu.auth_user_id = auth.uid())))));


--
-- TOC entry 4170 (class 3256 OID 57265)
-- Name: pontos_movimentacoes pontos_movimentacoes_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pontos_movimentacoes_select_own_lojista ON public.pontos_movimentacoes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = pontos_movimentacoes.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4140 (class 3256 OID 57268)
-- Name: pontos_movimentacoes pontos_movimentacoes_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY pontos_movimentacoes_update_own_lojista ON public.pontos_movimentacoes FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = pontos_movimentacoes.lojista_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = pontos_movimentacoes.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4106 (class 0 OID 41885)
-- Dependencies: 395
-- Name: premios; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.premios ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4148 (class 3256 OID 54828)
-- Name: premios premios_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY premios_delete_own_lojista ON public.premios FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = premios.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4152 (class 3256 OID 54825)
-- Name: premios premios_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY premios_insert_own_lojista ON public.premios FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = premios.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4151 (class 3256 OID 54824)
-- Name: premios premios_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY premios_select_own_lojista ON public.premios FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = premios.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4153 (class 3256 OID 54826)
-- Name: premios premios_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY premios_update_own_lojista ON public.premios FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = premios.lojista_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = premios.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4112 (class 0 OID 54447)
-- Dependencies: 405
-- Name: produtos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4133 (class 3256 OID 54652)
-- Name: produtos produtos: acesso autenticado; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "produtos: acesso autenticado" ON public.produtos TO authenticated USING (true) WITH CHECK (true);


--
-- TOC entry 4121 (class 3256 OID 54503)
-- Name: produtos produtos_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY produtos_delete_own_lojista ON public.produtos FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = produtos.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4119 (class 3256 OID 54500)
-- Name: produtos produtos_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY produtos_insert_own_lojista ON public.produtos FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = produtos.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4118 (class 3256 OID 54499)
-- Name: produtos produtos_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY produtos_select_own_lojista ON public.produtos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = produtos.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4120 (class 3256 OID 54501)
-- Name: produtos produtos_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY produtos_update_own_lojista ON public.produtos FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = produtos.lojista_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = produtos.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4102 (class 0 OID 41786)
-- Dependencies: 391
-- Name: programa_niveis; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.programa_niveis ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4150 (class 3256 OID 54823)
-- Name: programa_niveis programa_niveis_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programa_niveis_delete_own_lojista ON public.programa_niveis FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.programas_fidelidade pf
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = pf.lojista_id)))
  WHERE ((pf.id = programa_niveis.programa_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4147 (class 3256 OID 54820)
-- Name: programa_niveis programa_niveis_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programa_niveis_insert_own_lojista ON public.programa_niveis FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.programas_fidelidade pf
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = pf.lojista_id)))
  WHERE ((pf.id = programa_niveis.programa_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4146 (class 3256 OID 54819)
-- Name: programa_niveis programa_niveis_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programa_niveis_select_own_lojista ON public.programa_niveis FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.programas_fidelidade pf
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = pf.lojista_id)))
  WHERE ((pf.id = programa_niveis.programa_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4149 (class 3256 OID 54821)
-- Name: programa_niveis programa_niveis_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programa_niveis_update_own_lojista ON public.programa_niveis FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.programas_fidelidade pf
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = pf.lojista_id)))
  WHERE ((pf.id = programa_niveis.programa_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.programas_fidelidade pf
     JOIN public.lojistas_usuarios lu ON ((lu.lojista_id = pf.lojista_id)))
  WHERE ((pf.id = programa_niveis.programa_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4101 (class 0 OID 41771)
-- Dependencies: 390
-- Name: programas_fidelidade; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.programas_fidelidade ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4145 (class 3256 OID 54818)
-- Name: programas_fidelidade programas_fidelidade_delete_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programas_fidelidade_delete_own_lojista ON public.programas_fidelidade FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = programas_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4143 (class 3256 OID 54815)
-- Name: programas_fidelidade programas_fidelidade_insert_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programas_fidelidade_insert_own_lojista ON public.programas_fidelidade FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = programas_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4142 (class 3256 OID 54814)
-- Name: programas_fidelidade programas_fidelidade_select_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programas_fidelidade_select_own_lojista ON public.programas_fidelidade FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = programas_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4144 (class 3256 OID 54816)
-- Name: programas_fidelidade programas_fidelidade_update_own_lojista; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY programas_fidelidade_update_own_lojista ON public.programas_fidelidade FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = programas_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lojistas_usuarios lu
  WHERE ((lu.lojista_id = programas_fidelidade.lojista_id) AND (lu.auth_user_id = auth.uid())))));


--
-- TOC entry 4108 (class 0 OID 41929)
-- Dependencies: 397
-- Name: resgate_alocacoes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.resgate_alocacoes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4107 (class 0 OID 41905)
-- Dependencies: 396
-- Name: resgates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.resgates ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4182 (class 0 OID 0)
-- Dependencies: 70
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;


--
-- TOC entry 4183 (class 0 OID 0)
-- Dependencies: 505
-- Name: FUNCTION fn_alocar_fifo_resgate(p_resgate_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_alocar_fifo_resgate(p_resgate_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.fn_alocar_fifo_resgate(p_resgate_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_alocar_fifo_resgate(p_resgate_id uuid) TO authenticated;


--
-- TOC entry 4184 (class 0 OID 0)
-- Dependencies: 433
-- Name: FUNCTION fn_calcular_streak_cliente(p_cliente_id uuid, p_lojista_id uuid, p_data_compra timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_calcular_streak_cliente(p_cliente_id uuid, p_lojista_id uuid, p_data_compra timestamp with time zone) TO service_role;
GRANT ALL ON FUNCTION public.fn_calcular_streak_cliente(p_cliente_id uuid, p_lojista_id uuid, p_data_compra timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.fn_calcular_streak_cliente(p_cliente_id uuid, p_lojista_id uuid, p_data_compra timestamp with time zone) TO authenticated;


--
-- TOC entry 4185 (class 0 OID 0)
-- Dependencies: 504
-- Name: FUNCTION fn_cancelar_compra_com_compensacao(p_compra_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_cancelar_compra_com_compensacao(p_compra_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_cancelar_compra_com_compensacao(p_compra_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_cancelar_compra_com_compensacao(p_compra_id uuid) TO service_role;


--
-- TOC entry 4186 (class 0 OID 0)
-- Dependencies: 465
-- Name: FUNCTION fn_expirar_lotes(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_expirar_lotes() TO anon;
GRANT ALL ON FUNCTION public.fn_expirar_lotes() TO authenticated;
GRANT ALL ON FUNCTION public.fn_expirar_lotes() TO service_role;


--
-- TOC entry 4187 (class 0 OID 0)
-- Dependencies: 421
-- Name: FUNCTION fn_garantir_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_garantir_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.fn_garantir_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_garantir_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) TO authenticated;


--
-- TOC entry 4188 (class 0 OID 0)
-- Dependencies: 391
-- Name: TABLE programa_niveis; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.programa_niveis TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.programa_niveis TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.programa_niveis TO authenticated;


--
-- TOC entry 4189 (class 0 OID 0)
-- Dependencies: 417
-- Name: FUNCTION fn_nivel_por_streak(p_programa_id uuid, p_streak integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_nivel_por_streak(p_programa_id uuid, p_streak integer) TO service_role;
GRANT ALL ON FUNCTION public.fn_nivel_por_streak(p_programa_id uuid, p_streak integer) TO anon;
GRANT ALL ON FUNCTION public.fn_nivel_por_streak(p_programa_id uuid, p_streak integer) TO authenticated;


--
-- TOC entry 4190 (class 0 OID 0)
-- Dependencies: 476
-- Name: FUNCTION fn_prever_cancelamento_compra(p_compra_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_prever_cancelamento_compra(p_compra_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_prever_cancelamento_compra(p_compra_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_prever_cancelamento_compra(p_compra_id uuid) TO service_role;


--
-- TOC entry 4191 (class 0 OID 0)
-- Dependencies: 528
-- Name: FUNCTION fn_processar_compra(p_compra_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_processar_compra(p_compra_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.fn_processar_compra(p_compra_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_processar_compra(p_compra_id uuid) TO authenticated;


--
-- TOC entry 4192 (class 0 OID 0)
-- Dependencies: 495
-- Name: FUNCTION fn_processar_status_resgate(p_resgate_id uuid, p_novo_status public.resgate_status); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_processar_status_resgate(p_resgate_id uuid, p_novo_status public.resgate_status) TO service_role;
GRANT ALL ON FUNCTION public.fn_processar_status_resgate(p_resgate_id uuid, p_novo_status public.resgate_status) TO anon;
GRANT ALL ON FUNCTION public.fn_processar_status_resgate(p_resgate_id uuid, p_novo_status public.resgate_status) TO authenticated;


--
-- TOC entry 4193 (class 0 OID 0)
-- Dependencies: 515
-- Name: FUNCTION fn_programa_ativo(p_lojista_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_programa_ativo(p_lojista_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.fn_programa_ativo(p_lojista_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_programa_ativo(p_lojista_id uuid) TO authenticated;


--
-- TOC entry 4194 (class 0 OID 0)
-- Dependencies: 478
-- Name: FUNCTION fn_rebuild_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_rebuild_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.fn_rebuild_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_rebuild_cliente_fidelidade(p_cliente_id uuid, p_lojista_id uuid) TO authenticated;


--
-- TOC entry 4195 (class 0 OID 0)
-- Dependencies: 409
-- Name: TABLE pontos_movimentacoes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pontos_movimentacoes TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pontos_movimentacoes TO authenticated;
GRANT ALL ON TABLE public.pontos_movimentacoes TO service_role;


--
-- TOC entry 4196 (class 0 OID 0)
-- Dependencies: 442
-- Name: FUNCTION fn_registrar_movimentacao_pontos(p_lojista_id uuid, p_cliente_id uuid, p_tipo public.pontos_movimentacao_tipo, p_pontos integer, p_sinal integer, p_compra_id uuid, p_lote_id uuid, p_lote_origem_id uuid, p_lote_destino_id uuid, p_descricao text, p_metadata jsonb, p_saldo_resultante integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_registrar_movimentacao_pontos(p_lojista_id uuid, p_cliente_id uuid, p_tipo public.pontos_movimentacao_tipo, p_pontos integer, p_sinal integer, p_compra_id uuid, p_lote_id uuid, p_lote_origem_id uuid, p_lote_destino_id uuid, p_descricao text, p_metadata jsonb, p_saldo_resultante integer) TO anon;
GRANT ALL ON FUNCTION public.fn_registrar_movimentacao_pontos(p_lojista_id uuid, p_cliente_id uuid, p_tipo public.pontos_movimentacao_tipo, p_pontos integer, p_sinal integer, p_compra_id uuid, p_lote_id uuid, p_lote_origem_id uuid, p_lote_destino_id uuid, p_descricao text, p_metadata jsonb, p_saldo_resultante integer) TO authenticated;
GRANT ALL ON FUNCTION public.fn_registrar_movimentacao_pontos(p_lojista_id uuid, p_cliente_id uuid, p_tipo public.pontos_movimentacao_tipo, p_pontos integer, p_sinal integer, p_compra_id uuid, p_lote_id uuid, p_lote_origem_id uuid, p_lote_destino_id uuid, p_descricao text, p_metadata jsonb, p_saldo_resultante integer) TO service_role;


--
-- TOC entry 4197 (class 0 OID 0)
-- Dependencies: 416
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;
GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;


--
-- TOC entry 4198 (class 0 OID 0)
-- Dependencies: 472
-- Name: FUNCTION trg_processar_compra(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_processar_compra() TO service_role;
GRANT ALL ON FUNCTION public.trg_processar_compra() TO anon;
GRANT ALL ON FUNCTION public.trg_processar_compra() TO authenticated;


--
-- TOC entry 4199 (class 0 OID 0)
-- Dependencies: 420
-- Name: FUNCTION trg_reservar_pontos_resgate(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_reservar_pontos_resgate() TO service_role;
GRANT ALL ON FUNCTION public.trg_reservar_pontos_resgate() TO anon;
GRANT ALL ON FUNCTION public.trg_reservar_pontos_resgate() TO authenticated;


--
-- TOC entry 4200 (class 0 OID 0)
-- Dependencies: 510
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- TOC entry 4201 (class 0 OID 0)
-- Dependencies: 410
-- Name: TABLE admins_plataforma; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admins_plataforma TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admins_plataforma TO authenticated;
GRANT ALL ON TABLE public.admins_plataforma TO service_role;


--
-- TOC entry 4202 (class 0 OID 0)
-- Dependencies: 398
-- Name: TABLE ajustes_pontos; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ajustes_pontos TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ajustes_pontos TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ajustes_pontos TO authenticated;


--
-- TOC entry 4203 (class 0 OID 0)
-- Dependencies: 389
-- Name: TABLE clientes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clientes TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clientes TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clientes TO authenticated;


--
-- TOC entry 4204 (class 0 OID 0)
-- Dependencies: 392
-- Name: TABLE clientes_fidelidade; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clientes_fidelidade TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clientes_fidelidade TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clientes_fidelidade TO authenticated;


--
-- TOC entry 4205 (class 0 OID 0)
-- Dependencies: 404
-- Name: TABLE clientes_usuarios; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clientes_usuarios TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clientes_usuarios TO authenticated;
GRANT ALL ON TABLE public.clientes_usuarios TO service_role;


--
-- TOC entry 4206 (class 0 OID 0)
-- Dependencies: 406
-- Name: TABLE compra_itens; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.compra_itens TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.compra_itens TO authenticated;
GRANT ALL ON TABLE public.compra_itens TO service_role;


--
-- TOC entry 4207 (class 0 OID 0)
-- Dependencies: 393
-- Name: TABLE compras; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compras TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.compras TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.compras TO authenticated;


--
-- TOC entry 4208 (class 0 OID 0)
-- Dependencies: 388
-- Name: TABLE lojistas; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lojistas TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lojistas TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lojistas TO authenticated;


--
-- TOC entry 4209 (class 0 OID 0)
-- Dependencies: 403
-- Name: TABLE lojistas_usuarios; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lojistas_usuarios TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lojistas_usuarios TO authenticated;
GRANT ALL ON TABLE public.lojistas_usuarios TO service_role;


--
-- TOC entry 4210 (class 0 OID 0)
-- Dependencies: 394
-- Name: TABLE lotes_pontos; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lotes_pontos TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lotes_pontos TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lotes_pontos TO authenticated;


--
-- TOC entry 4211 (class 0 OID 0)
-- Dependencies: 395
-- Name: TABLE premios; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.premios TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.premios TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.premios TO authenticated;


--
-- TOC entry 4212 (class 0 OID 0)
-- Dependencies: 405
-- Name: TABLE produtos; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.produtos TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.produtos TO authenticated;
GRANT ALL ON TABLE public.produtos TO service_role;


--
-- TOC entry 4213 (class 0 OID 0)
-- Dependencies: 390
-- Name: TABLE programas_fidelidade; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.programas_fidelidade TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.programas_fidelidade TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.programas_fidelidade TO authenticated;


--
-- TOC entry 4214 (class 0 OID 0)
-- Dependencies: 397
-- Name: TABLE resgate_alocacoes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.resgate_alocacoes TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.resgate_alocacoes TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.resgate_alocacoes TO authenticated;


--
-- TOC entry 4215 (class 0 OID 0)
-- Dependencies: 396
-- Name: TABLE resgates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.resgates TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.resgates TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.resgates TO authenticated;


--
-- TOC entry 2556 (class 826 OID 41694)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2557 (class 826 OID 41693)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2555 (class 826 OID 41692)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- Completed on 2026-05-26 22:56:50

--
-- PostgreSQL database dump complete
--

\unrestrict 5sFNKS3TaACQcYS8gNHEPRoV61K315es3iBlBSH4Pm9bVD56yqhpkC6HQMGMGdX

