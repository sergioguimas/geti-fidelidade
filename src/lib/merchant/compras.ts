import { supabase } from "@/lib/supabase";
import type {
  ClienteOption,
  CompraCreateInput,
  CompraListItem,
  CompraUpdateInput,
} from "@/lib/types";

export async function listCompras(lojistaId: string, busca?: string) {
  const { data, error } = await supabase
    .from("compras")
    .select(`
      id,
      lojista_id,
      cliente_id,
      valor_total,
      origem,
      status,
      data_compra,
      created_at,
      clientes (
        id,
        nome
      ),
      lotes_pontos (
        id,
        pontos_gerados,
        pontos_disponiveis,
        pontos_pendentes,
        status
      )
    `)
    .eq("lojista_id", lojistaId)
    .order("data_compra", { ascending: false });

  if (error) throw new Error(error.message);

  let normalized: CompraListItem[] = (data ?? []).map((item: any) => ({
    id: item.id,
    lojista_id: item.lojista_id,
    cliente_id: item.cliente_id,
    valor_total: Number(item.valor_total),
    origem: item.origem,
    status: item.status,
    data_compra: item.data_compra,
    created_at: item.created_at,
    cliente: Array.isArray(item.clientes) ? item.clientes[0] ?? null : item.clientes ?? null,
    lote: Array.isArray(item.lotes_pontos) ? item.lotes_pontos[0] ?? null : item.lotes_pontos ?? null,
  }));

  if (busca?.trim()) {
    const term = busca.trim().toLowerCase();
    normalized = normalized.filter((item) =>
      item.cliente?.nome?.toLowerCase().includes(term)
    );
  }

  return normalized;
}

export async function createCompra(input: CompraCreateInput) {
  const { data, error } = await supabase
    .from("compras")
    .insert({
      lojista_id: input.lojistaId,
      cliente_id: input.clienteId,
      valor_total: input.valorTotal,
      data_compra: input.dataCompra,
      origem: input.origem ?? "lojista",
      status: input.status ?? "aprovada",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCompra(input: CompraUpdateInput) {
  const { data, error } = await supabase
    .from("compras")
    .update({
      cliente_id: input.clienteId,
      valor_total: input.valorTotal,
      data_compra: input.dataCompra,
      status: input.status,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function cancelCompra(id: string) {
  const { data, error } = await supabase
    .from("compras")
    .update({ status: "cancelada" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listClienteOptions(lojistaId: string) {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("lojista_id", lojistaId)
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClienteOption[];
}