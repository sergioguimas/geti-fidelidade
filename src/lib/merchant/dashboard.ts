import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardData,
  DashboardNivelDistribuicao,
  DashboardPeriod,
  DashboardSolicitacao,
  DashboardSummary,
  DashboardTopCliente,
} from "@/lib/types";

function addDaysToDateOnly(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDaysInclusive(dataInicio: string, dataFim: string) {
  const start = new Date(`${dataInicio}T00:00:00.000Z`);
  const end = new Date(`${dataFim}T00:00:00.000Z`);

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(diffDays + 1, 1);
}

function toSaoPauloStartOfDay(dateOnly: string) {
  return `${dateOnly}T00:00:00.000-03:00`;
}

function getPeriodBounds(period: DashboardPeriod) {
  const days = diffDaysInclusive(period.dataInicio, period.dataFim);

  const currentStartDate = period.dataInicio;
  const currentEndExclusiveDate = addDaysToDateOnly(period.dataFim, 1);

  const previousEndExclusiveDate = currentStartDate;
  const previousStartDate = addDaysToDateOnly(currentStartDate, -days);

  return {
    currentStart: toSaoPauloStartOfDay(currentStartDate),
    currentEnd: toSaoPauloStartOfDay(currentEndExclusiveDate),
    previousStart: toSaoPauloStartOfDay(previousStartDate),
    previousEnd: toSaoPauloStartOfDay(previousEndExclusiveDate),
  };
}

function buildTrend(current: number, previous: number) {
  if (previous === 0 && current === 0) {
    return {
      current,
      previous,
      change_percent: 0,
      direction: "neutral" as const,
    };
  }

  if (previous === 0 && current > 0) {
    return {
      current,
      previous,
      change_percent: null,
      direction: "up" as const,
    };
  }

  const change = ((current - previous) / previous) * 100;

  return {
    current,
    previous,
    change_percent: change,
    direction:
      change > 0 ? ("up" as const) : change < 0 ? ("down" as const) : ("neutral" as const),
  };
}

function sumCompraSubtotal(compraItens: any[] | null | undefined) {
  return (compraItens ?? []).reduce(
    (sum, item) => sum + Number(item?.subtotal ?? 0),
    0
  );
}

export async function getDashboardData(
  supabase: SupabaseClient,
  lojistaId: string,
  period: DashboardPeriod
): Promise<DashboardData> {
  const { currentStart, currentEnd, previousStart, previousEnd } =
    getPeriodBounds(period);

  const [
    clientesResp,
    clientesAtivosProgramaResp,
    comprasPeriodoResp,
    comprasPeriodoAnteriorResp,
    clientesNovosPeriodoResp,
    clientesNovosPeriodoAnteriorResp,
    resgatesPeriodoResp,
    resgatesPeriodoAnteriorResp,
    clientesFidelidadeResp,
    resgatesPendentesResp,
    premiosAtivosResp,
    topClientesComprasResp,
    niveisResp,
    resgatesRecentesResp,
  ] = await Promise.all([
    supabase
      .from("clientes_fidelidade")
      .select("cliente_id", { count: "exact", head: true })
      .eq("lojista_id", lojistaId),

    supabase
      .from("clientes_fidelidade")
      .select("cliente_id", { count: "exact", head: true })
      .eq("lojista_id", lojistaId)
      .eq("ativo", true),

    supabase
      .from("compras")
      .select(`
        id,
        cliente_id,
        pontos_total,
        data_compra,
        compra_itens (
          subtotal,
          pontos_gerados
        )
      `)
      .eq("lojista_id", lojistaId)
      .gte("data_compra", currentStart)
      .lt("data_compra", currentEnd),

    supabase
      .from("compras")
      .select(`
        id,
        cliente_id,
        pontos_total,
        data_compra,
        compra_itens (
          subtotal,
          pontos_gerados
        )
      `)
      .eq("lojista_id", lojistaId)
      .gte("data_compra", previousStart)
      .lt("data_compra", previousEnd),

    supabase
      .from("clientes_fidelidade")
      .select("cliente_id", { count: "exact", head: true })
      .eq("lojista_id", lojistaId)
      .gte("updated_at", currentStart)
      .lt("updated_at", currentEnd),

    supabase
      .from("clientes_fidelidade")
      .select("cliente_id", { count: "exact", head: true })
      .eq("lojista_id", lojistaId)
      .gte("updated_at", previousStart)
      .lt("updated_at", previousEnd),

    supabase
      .from("resgates")
      .select("id", { count: "exact", head: true })
      .eq("lojista_id", lojistaId)
      .gte("solicitado_em", currentStart)
      .lt("solicitado_em", currentEnd),

    supabase
      .from("resgates")
      .select("id", { count: "exact", head: true })
      .eq("lojista_id", lojistaId)
      .gte("solicitado_em", previousStart)
      .lt("solicitado_em", previousEnd),

    supabase
      .from("clientes_fidelidade")
      .select(`
        saldo_disponivel,
        ultima_compra_valida_em,
        nivel_atual_id,
        programa_niveis (
          id,
          nome
        )
      `)
      .eq("lojista_id", lojistaId)
      .gte("updated_at", currentStart)
      .lt("updated_at", currentEnd),

    supabase
      .from("resgates")
      .select("id", { count: "exact", head: true })
      .eq("lojista_id", lojistaId)
      .eq("status", "pendente")
      .gte("solicitado_em", currentStart)
      .lt("solicitado_em", currentEnd),

    supabase
      .from("premios")
      .select("id", { count: "exact", head: true })
      .eq("lojista_id", lojistaId)
      .eq("ativo", true)
      .gte("created_at", currentStart)
      .lt("created_at", currentEnd),

    supabase
      .from("compras")
      .select(`
        cliente_id,
        compra_itens (
          subtotal
        ),
        clientes (
          id,
          nome
        )
      `)
      .eq("lojista_id", lojistaId)
      .gte("data_compra", currentStart)
      .lt("data_compra", currentEnd),

    supabase
      .from("clientes_fidelidade")
      .select(`
        nivel_atual_id,
        programa_niveis (
          id,
          nome
        )
      `)
      .eq("lojista_id", lojistaId)
      .gte("updated_at", currentStart)
      .lt("updated_at", currentEnd),

    supabase
      .from("resgates")
      .select(`
        id,
        status,
        solicitado_em,
        clientes (
          id,
          nome
        ),
        premios (
          id,
          nome
        )
      `)
      .eq("lojista_id", lojistaId)
      .gte("solicitado_em", currentStart)
      .lt("solicitado_em", currentEnd)
      .order("solicitado_em", { ascending: false })
      .limit(8),
  ]);

  if (clientesResp.error) throw new Error(clientesResp.error.message);
  if (clientesAtivosProgramaResp.error) throw new Error(clientesAtivosProgramaResp.error.message);
  if (comprasPeriodoResp.error) throw new Error(comprasPeriodoResp.error.message);
  if (comprasPeriodoAnteriorResp.error) throw new Error(comprasPeriodoAnteriorResp.error.message);
  if (clientesNovosPeriodoResp.error) throw new Error(clientesNovosPeriodoResp.error.message);
  if (clientesNovosPeriodoAnteriorResp.error) throw new Error(clientesNovosPeriodoAnteriorResp.error.message);
  if (resgatesPeriodoResp.error) throw new Error(resgatesPeriodoResp.error.message);
  if (resgatesPeriodoAnteriorResp.error) throw new Error(resgatesPeriodoAnteriorResp.error.message);
  if (clientesFidelidadeResp.error) throw new Error(clientesFidelidadeResp.error.message);
  if (resgatesPendentesResp.error) throw new Error(resgatesPendentesResp.error.message);
  if (premiosAtivosResp.error) throw new Error(premiosAtivosResp.error.message);
  if (topClientesComprasResp.error) throw new Error(topClientesComprasResp.error.message);
  if (niveisResp.error) throw new Error(niveisResp.error.message);
  if (resgatesRecentesResp.error) throw new Error(resgatesRecentesResp.error.message);

  const compras = comprasPeriodoResp.data ?? [];
  const comprasPeriodoAnterior = comprasPeriodoAnteriorResp.data ?? [];
  const clientesFidelidade = clientesFidelidadeResp.data ?? [];
  const topClientesRaw = topClientesComprasResp.data ?? [];
  const niveisRaw = niveisResp.data ?? [];
  const resgatesRecentesRaw = resgatesRecentesResp.data ?? [];

  const vendasPeriodo = compras.reduce(
    (sum, item: any) => sum + sumCompraSubtotal(item.compra_itens),
    0
  );

  const vendasPeriodoAnterior = comprasPeriodoAnterior.reduce(
    (sum, item: any) => sum + sumCompraSubtotal(item.compra_itens),
    0
  );

  const comprasPeriodo = compras.length;
  const ticketMedio = comprasPeriodo > 0 ? vendasPeriodo / comprasPeriodo : 0;

  const pontosDisponiveis = clientesFidelidade.reduce(
    (sum, item: any) => sum + Number(item.saldo_disponivel ?? 0),
    0
  );

  const now = new Date();
  const clientesRecorrentes = clientesFidelidade.filter((item: any) => {
    if (!item.ultima_compra_valida_em) return false;

    const last = new Date(item.ultima_compra_valida_em);
    const diffMs = now.getTime() - last.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    return diffDays <= 30;
  }).length;

  const clientesAtivosPrograma = clientesAtivosProgramaResp.count ?? 0;

  const taxaRecorrencia =
    clientesAtivosPrograma > 0
      ? (clientesRecorrentes / clientesAtivosPrograma) * 100
      : 0;

  const clientesNovosPeriodo = clientesNovosPeriodoResp.count ?? 0;
  const clientesNovosPeriodoAnterior = clientesNovosPeriodoAnteriorResp.count ?? 0;

  const pontosGeradosPeriodo = compras.reduce(
    (sum, compra: any) =>
      sum +
      (compra.compra_itens ?? []).reduce(
        (inner: number, item: any) => inner + Number(item.pontos_gerados ?? 0),
        0
      ),
    0
  );

  const pontosGeradosPeriodoAnterior = comprasPeriodoAnterior.reduce(
    (sum, compra: any) =>
      sum +
      (compra.compra_itens ?? []).reduce(
        (inner: number, item: any) => inner + Number(item.pontos_gerados ?? 0),
        0
      ),
    0
  );

  const resgatesPeriodo = resgatesPeriodoResp.count ?? 0;
  const resgatesPeriodoAnterior = resgatesPeriodoAnteriorResp.count ?? 0;

  const topClientesMap = new Map<string, DashboardTopCliente>();

  for (const item of topClientesRaw as any[]) {
    const cliente = Array.isArray(item.clientes) ? item.clientes[0] : item.clientes;
    if (!cliente?.id) continue;

    const valorCompra = sumCompraSubtotal(item.compra_itens);
    const current = topClientesMap.get(cliente.id);

    if (!current) {
      topClientesMap.set(cliente.id, {
        cliente_id: cliente.id,
        nome: cliente.nome,
        total_gasto: valorCompra,
        compras: 1,
      });
    } else {
      current.total_gasto += valorCompra;
      current.compras += 1;
    }
  }

  const topClientes = Array.from(topClientesMap.values())
    .sort((a, b) => b.total_gasto - a.total_gasto)
    .slice(0, 5);

  const niveisMap = new Map<string, number>();

  for (const item of niveisRaw as any[]) {
    const nivel = Array.isArray(item.programa_niveis)
      ? item.programa_niveis[0]
      : item.programa_niveis;

    const nome = nivel?.nome ?? "Sem nível";
    niveisMap.set(nome, (niveisMap.get(nome) ?? 0) + 1);
  }

  const niveis: DashboardNivelDistribuicao[] = Array.from(niveisMap.entries()).map(
    ([nivel, quantidade]) => ({
      nivel,
      quantidade,
    })
  );

  const solicitacoes: DashboardSolicitacao[] = (resgatesRecentesRaw as any[]).map(
    (item) => {
      const cliente = Array.isArray(item.clientes) ? item.clientes[0] : item.clientes;
      const premio = Array.isArray(item.premios) ? item.premios[0] : item.premios;

      return {
        id: item.id,
        tipo: "resgate",
        cliente_nome: cliente?.nome ?? "Cliente não encontrado",
        titulo: premio?.nome ?? "Prêmio não encontrado",
        status: item.status,
        data: item.solicitado_em,
      };
    }
  );

  const summary: DashboardSummary = {
    clientes_total: clientesResp.count ?? 0,
    clientes_ativos_programa: clientesAtivosPrograma,
    compras_periodo: comprasPeriodo,
    vendas_periodo: vendasPeriodo,
    ticket_medio: ticketMedio,
    pontos_disponiveis: pontosDisponiveis,
    resgates_pendentes: resgatesPendentesResp.count ?? 0,
    premios_ativos: premiosAtivosResp.count ?? 0,
    taxa_recorrencia: taxaRecorrencia,
  };

  const trends = {
    clientes: buildTrend(clientesNovosPeriodo, clientesNovosPeriodoAnterior),
    vendas: buildTrend(vendasPeriodo, vendasPeriodoAnterior),
    pontos: buildTrend(pontosGeradosPeriodo, pontosGeradosPeriodoAnterior),
    resgates: buildTrend(resgatesPeriodo, resgatesPeriodoAnterior),
  };

  return {
    summary,
    trends,
    top_clientes: topClientes,
    niveis,
    solicitacoes,
  };
}