import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompraCreateInput,
  CompraUpdateInput,
  CompraItemInput,
  CompraCancelamentoPreview,
} from "../types";

function round2(value: number) {
  return Math.round(value * 100) / 100;
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

    if (item.quantidade <= 0) {
      throw new Error("Quantidade deve ser maior que zero.");
    }

    if (item.valorUnitario < 0) {
      throw new Error("Valor unitário inválido.");
    }

    const quantidade = Number(item.quantidade);
    const valorUnitario = round2(Number(item.valorUnitario));
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

export async function listCompras(
  supabase: SupabaseClient,
  lojistaId: string,
  busca?: string
) {
  let query = supabase
  .from("compras")
  .select(`
    id,
    lojista_id,
    cliente_id,
    valor_total,
    pontos_total,
    status,
    origem,
    data_compra,
    created_at,
    updated_at,
    clientes (
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
  `)
  .eq("lojista_id", lojistaId)
  .order("data_compra", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []).map((item: any) => {
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
    lotes.find((lp: any) => lp.status === "disponivel" || lp.status === "pendente") ??
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

  if (busca?.trim()) {
    const term = busca.trim().toLowerCase();
    rows = rows.filter((item: any) =>
      item.cliente?.nome?.toLowerCase().includes(term)
    );
  }

  return rows;
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

  const compraItens = buildCompraItens(produtosMap, input.itens);

  const valorTotal = round2(
    compraItens.reduce((sum, item) => sum + item.subtotal, 0)
  );

  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .insert({
      lojista_id: lojistaId,
      cliente_id: input.clienteId,
      pontos_total: 0,
      valor_total: valorTotal,
      origem: input.origem ?? "lojista",
      status: input.status ?? "aprovada",
      data_compra: input.dataCompra,
    })
    .select(
      "id, lojista_id, cliente_id, valor_total, pontos_total, status, origem, data_compra, created_at, updated_at"
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
      "id, lojista_id, cliente_id, valor_total, pontos_total, status, origem, data_compra, created_at, updated_at"
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

  const compraItens = buildCompraItens(produtosMap, input.itens);

  const valorTotal = round2(
    compraItens.reduce((sum, item) => sum + item.subtotal, 0)
  );

  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .update({
      cliente_id: input.clienteId,
      valor_total: valorTotal,
      pontos_total: 0,
      origem: input.origem ?? "lojista",
      status: input.status ?? "aprovada",
      data_compra: input.dataCompra,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("lojista_id", lojistaId)
    .select(
      "id, lojista_id, cliente_id, valor_total, pontos_total, status, origem, data_compra, created_at, updated_at"
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
        "id, lojista_id, cliente_id, valor_total, pontos_total, status, origem, data_compra, created_at, updated_at"
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