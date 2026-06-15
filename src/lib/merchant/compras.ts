import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompraCreateInput,
  CompraUpdateInput,
  CompraItemInput,
  CompraCancelamentoPreview,
  CompraListFilters,
} from "../types";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function round4(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function addDaysToDateOnly(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function toSaoPauloStartOfDay(dateOnly: string) {
  return `${dateOnly}T00:00:00.000-03:00`;
}

function normalizeCompraDateToSaoPauloStart(value: string) {
  const dateOnly = value.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new Error("Data da compra inválida.");
  }

  return toSaoPauloStartOfDay(dateOnly);
}

function toCents(value: number) {
  return Math.round(round2(value) * 100);
}

function fromCents(value: number) {
  return round2(value / 100);
}

async function loadProdutos(
  supabase: SupabaseClient,
  lojistaId: string,
  produtoIds: string[]
) {
  const { data, error } = await supabase
    .from("produtos")
    .select("id, lojista_id, descricao, teto_percentual, ativo")
    .eq("lojista_id", lojistaId)
    .in("id", produtoIds)
    .eq("ativo", true);

  if (error) throw new Error(error.message);

  return new Map((data ?? []).map((item) => [item.id, item]));
}

function buildCompraItens(
  produtosMap: Map<string, any>,
  itens: CompraItemInput[]
) {
  return itens.map((item) => {
    const produto = produtosMap.get(item.produtoId);

    if (!produto) {
      throw new Error(`Produto inválido ou não encontrado: ${item.produtoId}`);
    }

    const quantidade = Number(item.quantidade);
    const valorUnitario = round4(Number(item.valorUnitario));

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new Error("Quantidade deve ser maior que zero.");
    }

    if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
      throw new Error("Valor unitário inválido.");
    }

    const subtotalBruto = round2(quantidade * valorUnitario);
    const desconto = round2(Number(item.desconto ?? 0));

    if (Number.isNaN(desconto) || desconto < 0) {
      throw new Error("Desconto inválido.");
    }

    if (desconto > subtotalBruto) {
      throw new Error("O desconto não pode ser maior que o subtotal do item.");
    }

    const subtotal = round2(subtotalBruto - desconto);

    const tetoPercentualProduto = Number(produto.teto_percentual);
    const tetoPercentualNivel = Number(produto.teto_percentual);
    const percentualAplicado = Math.min(
      tetoPercentualProduto,
      tetoPercentualNivel
    );

    const pontosGerados = round2((subtotal * percentualAplicado) / 100);

    return {
      produto_id: produto.id,
      descricao_produto: produto.descricao,
      quantidade,
      valor_unitario: valorUnitario,
      subtotal_bruto: subtotalBruto,
      desconto,
      subtotal,
      teto_percentual_produto: tetoPercentualProduto,
      teto_percentual_nivel: tetoPercentualNivel,
      percentual_aplicado: percentualAplicado,
      pontos_gerados: pontosGerados,
    };
  });
}

function aplicarDescontoTotalNosItens(
  itens: ReturnType<typeof buildCompraItens>,
  descontoTotalInput: number
) {
  const descontoTotal = round2(Number(descontoTotalInput ?? 0));

  if (Number.isNaN(descontoTotal) || descontoTotal < 0) {
    throw new Error("Desconto total inválido.");
  }

  if (descontoTotal <= 0) {
    return itens;
  }

  const temDescontoIndividual = itens.some((item) => item.desconto > 0);

  if (temDescontoIndividual) {
    throw new Error(
      "Use desconto por item ou desconto total da nota, não os dois ao mesmo tempo."
    );
  }

  const subtotaisCents = itens.map((item) => toCents(item.subtotal_bruto));
  const subtotalBrutoCents = subtotaisCents.reduce((sum, value) => sum + value, 0);
  const descontoTotalCents = toCents(descontoTotal);

  if (subtotalBrutoCents <= 0) {
    throw new Error("Não é possível aplicar desconto total em uma compra sem subtotal.");
  }

  if (descontoTotalCents > subtotalBrutoCents) {
    throw new Error("O desconto total não pode ser maior que o subtotal da compra.");
  }

  /**
   * Rateio proporcional:
   * Cada item recebe uma parte do desconto proporcional ao seu subtotal.
   *
   * Exemplo:
   * Compra: R$ 1.000,00
   * Desconto: R$ 100,00
   * Item de R$ 500,00 recebe R$ 50,00
   * Item de R$ 20,00 recebe R$ 2,00
   */
  const distribuicao = subtotaisCents.map((subtotalCents, index) => {
    const valorIdeal = (descontoTotalCents * subtotalCents) / subtotalBrutoCents;
    const descontoBaseCents = Math.floor(valorIdeal);

    return {
      index,
      subtotalCents,
      descontoCents: descontoBaseCents,
      resto: valorIdeal - descontoBaseCents,
    };
  });

  let centsRestantes =
    descontoTotalCents -
    distribuicao.reduce((sum, item) => sum + item.descontoCents, 0);

  /**
   * Distribui os centavos restantes para os itens com maiores frações,
   * sem deixar nenhum desconto passar do subtotal do próprio item.
   */
  const ordemPorResto = [...distribuicao].sort((a, b) => b.resto - a.resto);

  for (const item of ordemPorResto) {
    if (centsRestantes <= 0) break;

    if (item.descontoCents < item.subtotalCents) {
      item.descontoCents += 1;
      centsRestantes -= 1;
    }
  }

  const descontosPorIndex = new Map(
    distribuicao.map((item) => [item.index, item.descontoCents])
  );

  return itens.map((item, index) => {
    const descontoRateadoCents = descontosPorIndex.get(index) ?? 0;

    if (descontoRateadoCents > subtotaisCents[index]) {
      throw new Error(
        "O desconto proporcional ficou maior que o subtotal de um dos itens."
      );
    }

    const descontoRateado = fromCents(descontoRateadoCents);
    const subtotal = fromCents(subtotaisCents[index] - descontoRateadoCents);
    const pontosGerados = round2((subtotal * item.percentual_aplicado) / 100);

    return {
      ...item,
      desconto: descontoRateado,
      subtotal,
      pontos_gerados: pontosGerados,
    };
  });
}

export async function listCompras(
  supabase: SupabaseClient,
  lojistaId: string,
  filters: CompraListFilters = {}
) {
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = Math.min(
    Math.max(1, Math.trunc(filters.pageSize ?? 20)),
    100
  );

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const busca = filters.busca?.trim();

  const clienteRelation = busca ? "clientes!inner" : "clientes";

  let query = supabase
    .from("compras")
    .select(
      `
        id,
        lojista_id,
        cliente_id,
        subtotal_bruto,
        desconto_total,
        valor_total,
        pontos_total,
        status,
        origem,
        data_compra,
        created_at,
        updated_at,
        ${clienteRelation} (
          id,
          nome,
          email,
          telefone
        ),
        compra_itens (
          id,
          produto_id,
          descricao_produto,
          quantidade,
          valor_unitario,
          subtotal_bruto,
          desconto,
          subtotal,
          percentual_aplicado,
          pontos_gerados
        ),
        lotes_pontos (
          id,
          compra_id,
          cliente_id,
          lojista_id,
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
      `,
      { count: "exact" }
    )
    .eq("lojista_id", lojistaId)
    .order("data_compra", { ascending: false })
    .order("created_at", { ascending: false });

  if (busca) {
    query = query.ilike("clientes.nome", `%${busca}%`);
  }

  if (filters.dataInicio) {
    query = query.gte(
      "data_compra",
      toSaoPauloStartOfDay(filters.dataInicio)
    );
  }

  if (filters.dataFim) {
    const diaPosterior = addDaysToDateOnly(filters.dataFim, 1);

    query = query.lt(
      "data_compra",
      toSaoPauloStartOfDay(diaPosterior)
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((item: any) => {
    const lotes = (item.lotes_pontos ?? [])
      .map((lp: any) => ({
        ...lp,
        percentual_aplicado: Number(lp.percentual_aplicado ?? 0),
        teto_aplicado: Number(lp.teto_aplicado ?? 0),
        pontos_gerados: Number(lp.pontos_gerados ?? 0),
        pontos_disponiveis: Number(lp.pontos_disponiveis ?? 0),
        pontos_pendentes: Number(lp.pontos_pendentes ?? 0),
        pontos_gastos: Number(lp.pontos_gastos ?? 0),
        pontos_expirados: Number(lp.pontos_expirados ?? 0),
        pontos_cancelados: Number(lp.pontos_cancelados ?? 0),
      }))
      .sort((a: any, b: any) => {
        const aTime = new Date(a.created_at ?? 0).getTime();
        const bTime = new Date(b.created_at ?? 0).getTime();

        return bTime - aTime;
      });

    const loteAtual =
      lotes.find(
        (lp: any) =>
          lp.status === "disponivel" || lp.status === "pendente"
      ) ??
      lotes[0] ??
      null;

    const cliente = Array.isArray(item.clientes)
      ? item.clientes[0] ?? null
      : item.clientes ?? null;

    return {
      id: item.id,
      lojista_id: item.lojista_id,
      cliente_id: item.cliente_id,
      valor_total: Number(item.valor_total ?? 0),
      pontos_total: Number(item.pontos_total ?? 0),
      status: item.status ?? null,
      origem: item.origem ?? null,
      data_compra: item.data_compra,
      created_at: item.created_at,
      updated_at: item.updated_at ?? null,
      subtotal_bruto: Number(item.subtotal_bruto ?? 0),
      desconto_total: Number(item.desconto_total ?? 0),
      cliente,
      compra_itens: (item.compra_itens ?? []).map((ci: any) => ({
        ...ci,
        quantidade: Number(ci.quantidade),
        valor_unitario: Number(ci.valor_unitario),
        subtotal_bruto: Number(ci.subtotal_bruto ?? 0),
        desconto: Number(ci.desconto ?? 0),
        subtotal: Number(ci.subtotal),
        percentual_aplicado: Number(ci.percentual_aplicado),
        pontos_gerados: Number(ci.pontos_gerados),
      })),
      lotes_pontos: lotes,
      lote: loteAtual,
    };
  });

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

export async function createCompra(
  supabase: SupabaseClient,
  lojistaId: string,
  input: CompraCreateInput
) {
  if (!input.itens?.length) {
    throw new Error("A compra precisa ter ao menos um item.");
  }

  const produtosMap = await loadProdutos(
    supabase,
    lojistaId,
    input.itens.map((item) => item.produtoId)
  );

  const compraItensBase = buildCompraItens(produtosMap, input.itens);

  const descontoTotal = round2(Number(input.descontoTotal ?? 0));

  const compraItens = aplicarDescontoTotalNosItens(
    compraItensBase,
    descontoTotal
  );

  const subtotalBruto = round2(
    compraItens.reduce((sum, item) => sum + item.subtotal_bruto, 0)
  );

  const valorTotal = round2(
    compraItens.reduce((sum, item) => sum + item.subtotal, 0)
  );

  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .insert({
      lojista_id: lojistaId,
      cliente_id: input.clienteId,
      subtotal_bruto: subtotalBruto,
      desconto_total: descontoTotal,
      pontos_total: 0,
      valor_total: valorTotal,
      origem: input.origem ?? "lojista",
      status: input.status ?? "aprovada",
      data_compra: normalizeCompraDateToSaoPauloStart(input.dataCompra),
    })
    .select(
      "id, lojista_id, cliente_id, subtotal_bruto, desconto_total, valor_total, pontos_total, status, origem, data_compra, created_at, updated_at"
    )
    .single();

  if (compraError || !compra) {
    throw new Error(compraError?.message ?? "Erro ao criar compra.");
  }

  const itensPayload = compraItens.map((item) => ({
    compra_id: compra.id,
    ...item,
  }));

  const { error: itensError } = await supabase
    .from("compra_itens")
    .insert(itensPayload);

  if (itensError) {
    await supabase.from("compras").delete().eq("id", compra.id);
    throw new Error(itensError.message);
  }

  const { error: processarError } = await supabase.rpc("fn_processar_compra", {
    p_compra_id: compra.id,
  });

  if (processarError) {
    await supabase.from("compra_itens").delete().eq("compra_id", compra.id);
    await supabase.from("compras").delete().eq("id", compra.id);
    throw new Error(processarError.message);
  }

  const { data: compraProcessada, error: compraProcessadaError } = await supabase
    .from("compras")
    .select(
      "id, lojista_id, cliente_id, subtotal_bruto, desconto_total, valor_total, pontos_total, status, origem, data_compra, created_at, updated_at"
    )
    .eq("id", compra.id)
    .single();

  if (compraProcessadaError || !compraProcessada) {
    throw new Error(
      compraProcessadaError?.message ??
        "Compra criada, mas não foi possível recarregar o resultado final."
    );
  }

  return compraProcessada;
}

export async function updateCompra(
  supabase: SupabaseClient,
  lojistaId: string,
  input: CompraUpdateInput
) {
  if (!input.itens?.length) {
    throw new Error("A compra precisa ter ao menos um item.");
  }

  const produtosMap = await loadProdutos(
    supabase,
    lojistaId,
    input.itens.map((item) => item.produtoId)
  );

  const compraItensBase = buildCompraItens(produtosMap, input.itens);

  const descontoTotal = round2(Number(input.descontoTotal ?? 0));

  const compraItens = aplicarDescontoTotalNosItens(
    compraItensBase,
    descontoTotal
  );

  const subtotalBruto = round2(
    compraItens.reduce((sum, item) => sum + item.subtotal_bruto, 0)
  );

  const valorTotal = round2(
    compraItens.reduce((sum, item) => sum + item.subtotal, 0)
  );

  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .update({
      cliente_id: input.clienteId,
      subtotal_bruto: subtotalBruto,
      desconto_total: descontoTotal,
      valor_total: valorTotal,
      pontos_total: 0,
      origem: input.origem ?? "lojista",
      status: input.status ?? "aprovada",
      data_compra: normalizeCompraDateToSaoPauloStart(input.dataCompra),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("lojista_id", lojistaId)
    .select(
      "id, lojista_id, cliente_id, subtotal_bruto, desconto_total, valor_total, pontos_total, status, origem, data_compra, created_at, updated_at"
    )
    .single();

  if (compraError || !compra) {
    throw new Error(compraError?.message ?? "Erro ao atualizar compra.");
  }

  const { error: deleteItensError } = await supabase
    .from("compra_itens")
    .delete()
    .eq("compra_id", input.id);

  if (deleteItensError) {
    throw new Error(deleteItensError.message);
  }

  const itensPayload = compraItens.map((item) => ({
    compra_id: input.id,
    ...item,
  }));

  const { error: itensError } = await supabase
    .from("compra_itens")
    .insert(itensPayload);

  if (itensError) {
    throw new Error(itensError.message);
  }

  const { error: processarError } = await supabase.rpc("fn_processar_compra", {
    p_compra_id: input.id,
  });

  if (processarError) {
    throw new Error(processarError.message);
  }

  const { data: compraProcessada, error: compraProcessadaError } =
    await supabase
      .from("compras")
      .select(
        "id, lojista_id, cliente_id, subtotal_bruto, desconto_total, valor_total, pontos_total, status, origem, data_compra, created_at, updated_at"
      )
      .eq("id", input.id)
      .single();

  if (compraProcessadaError || !compraProcessada) {
    throw new Error(
      compraProcessadaError?.message ??
        "Compra atualizada, mas erro ao recarregar dados."
    );
  }

  return compraProcessada;
}

export async function previewCancelCompra(
  supabase: SupabaseClient,
  lojistaId: string,
  id: string
): Promise<CompraCancelamentoPreview> {
  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .select("id, lojista_id")
    .eq("id", id)
    .eq("lojista_id", lojistaId)
    .single();

  if (compraError || !compra) {
    throw new Error(compraError?.message ?? "Compra não encontrada.");
  }

  const { data, error } = await supabase.rpc(
    "fn_prever_cancelamento_compra",
    { p_compra_id: id }
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as Record<string, unknown> | null;

  if (!result) {
    throw new Error("Não foi possível prever o cancelamento da compra.");
  }

  return {
    compraId: String(result.compraId ?? id),
    statusCompra: result.statusCompra ? String(result.statusCompra) : null,
    pontosGerados: Number(result.pontosGerados ?? 0),
    pontosDisponiveisNoLote: Number(result.pontosDisponiveisNoLote ?? 0),
    pontosJaUsados: Number(result.pontosJaUsados ?? 0),
    saldoDisponivelEmOutrosLotes: Number(
      result.saldoDisponivelEmOutrosLotes ?? 0
    ),
    saldoNegativoResultante: Number(result.saldoNegativoResultante ?? 0),
    precisaConfirmacaoEspecial: Boolean(
      result.precisaConfirmacaoEspecial ?? false
    ),
  };
}

export async function cancelCompra(
  supabase: SupabaseClient,
  lojistaId: string,
  id: string
) {
  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .select("id, lojista_id, status")
    .eq("id", id)
    .eq("lojista_id", lojistaId)
    .single();

  if (compraError || !compra) {
    throw new Error(compraError?.message ?? "Compra não encontrada.");
  }

  const { error } = await supabase.rpc(
    "fn_cancelar_compra_com_compensacao",
    { p_compra_id: id }
  );

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function listClienteOptions(
  supabase: SupabaseClient,
  lojistaId: string
) {
  const { data, error } = await supabase
    .from("clientes_fidelidade")
    .select(`
      cliente_id,
      ativo,
      clientes (
        id,
        nome
      )
    `)
    .eq("lojista_id", lojistaId)
    .eq("ativo", true)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const map = new Map<string, { id: string; nome: string }>();

  for (const row of data ?? []) {
    const cliente = Array.isArray(row.clientes) ? row.clientes[0] : row.clientes;

    if (cliente?.id && !map.has(cliente.id)) {
      map.set(cliente.id, {
        id: cliente.id,
        nome: cliente.nome,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}