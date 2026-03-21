import type { SupabaseClient } from "@supabase/supabase-js";

export type CompraItemInput = {
  produtoId: string;
  quantidade: number;
  valorUnitario: number;
};

export type CompraCreateInput = {
  clienteId: string;
  dataCompra: string;
  origem?: string;
  itens: CompraItemInput[];
};

export type CompraUpdateInput = {
  id: string;
  lojistaId: string;
  clienteId: string;
  dataCompra: string;
  origem?: string;
  itens: CompraItemInput[];
};

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

    const subtotal = round2(item.quantidade * item.valorUnitario);

    // provisório: enquanto a regra de nível não for religada,
    // usamos o teto do produto também como teto do nível
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
      quantidade: item.quantidade,
      valor_unitario: round2(item.valorUnitario),
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
      pontos_total,
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
        subtotal,
        percentual_aplicado,
        pontos_gerados
      )
    `)
    .eq("lojista_id", lojistaId)
    .order("data_compra", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []).map((item: any) => ({
    ...item,
    pontos_total: Number(item.pontos_total ?? 0),
    compra_itens: (item.compra_itens ?? []).map((ci: any) => ({
      ...ci,
      quantidade: Number(ci.quantidade),
      valor_unitario: Number(ci.valor_unitario),
      subtotal: Number(ci.subtotal),
      percentual_aplicado: Number(ci.percentual_aplicado),
      pontos_gerados: Number(ci.pontos_gerados),
    })),
  }));

  if (busca?.trim()) {
    const term = busca.trim().toLowerCase();
    rows = rows.filter((item: any) =>
      item.clientes?.nome?.toLowerCase().includes(term)
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
  const pontosTotal = round2(
    compraItens.reduce((sum, item) => sum + item.pontos_gerados, 0)
  );

  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .insert({
      lojista_id: lojistaId,
      cliente_id: input.clienteId,
      pontos_total: pontosTotal,
      origem: input.origem ?? "manual",
      data_compra: input.dataCompra,
    })
    .select("id, lojista_id, cliente_id, pontos_total, origem, data_compra")
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

  return compra;
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
  const pontosTotal = round2(
    compraItens.reduce((sum, item) => sum + item.pontos_gerados, 0)
  );

  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .update({
      cliente_id: input.clienteId,
      pontos_total: pontosTotal,
      origem: input.origem ?? "manual",
      data_compra: input.dataCompra,
    })
    .eq("id", input.id)
    .eq("lojista_id", input.lojistaId)
    .select("id, lojista_id, cliente_id, pontos_total, origem, data_compra")
    .single();

  if (compraError || !compra) {
    throw new Error(compraError?.message ?? "Erro ao atualizar compra.");
  }

  const { error: deleteError } = await supabase
    .from("compra_itens")
    .delete()
    .eq("compra_id", input.id);

  if (deleteError) throw new Error(deleteError.message);

  const { error: itensError } = await supabase.from("compra_itens").insert(
    compraItens.map((item) => ({
      compra_id: input.id,
      ...item,
    }))
  );

  if (itensError) throw new Error(itensError.message);

  return compra;
}

export async function removeCompra(
  supabase: SupabaseClient,
  lojistaId: string,
  id: string
) {
  const { error } = await supabase
    .from("compras")
    .delete()
    .eq("id", id)
    .eq("lojista_id", lojistaId);

  if (error) throw new Error(error.message);

  return { success: true };
}

export async function listClienteOptions(
  supabase: SupabaseClient,
  lojistaId: string
) {
  const { data, error } = await supabase
    .from("compras")
    .select(`
      cliente_id,
      clientes (
        id,
        nome
      )
    `)
    .eq("lojista_id", lojistaId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const map = new Map<string, { id: string; nome: string }>();

  for (const row of data ?? []) {
    const cliente = Array.isArray(row.clientes) ? row.clientes[0] : row.clientes;
    if (cliente?.id && !map.has(cliente.id)) {
      map.set(cliente.id, { id: cliente.id, nome: cliente.nome });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}