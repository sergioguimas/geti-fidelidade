import { supabase } from "@/lib/supabase";
import type {
  ClienteCreateInput,
  ClienteListItem,
  ClienteUpdateInput,
} from "@/lib/types";

export async function listClientes(lojistaId: string, busca?: string) {
  let query = supabase
    .from("clientes")
    .select(`
      id,
      lojista_id,
      nome,
      telefone,
      email,
      cnpj,
      ativo,
      created_at,
      updated_at,
      clientes_fidelidade (
        streak_atual,
        saldo_disponivel,
        saldo_pendente,
        saldo_negativo,
        ultima_compra_valida_em
      )
    `)
    .eq("lojista_id", lojistaId)
    .order("created_at", { ascending: false });

  if (busca?.trim()) {
    query = query.ilike("nome", `%${busca.trim()}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data ?? []).map((item: any) => ({
    id: item.id,
    lojista_id: item.lojista_id,
    nome: item.nome,
    telefone: item.telefone,
    email: item.email,
    cnpj: item.cnpj,
    ativo: item.ativo,
    created_at: item.created_at,
    updated_at: item.updated_at,
    fidelidade: Array.isArray(item.clientes_fidelidade)
      ? item.clientes_fidelidade[0] ?? null
      : item.clientes_fidelidade ?? null,
  })) as ClienteListItem[];
}

export async function createCliente(input: ClienteCreateInput) {
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      lojista_id: input.lojistaId,
      nome: input.nome.trim(),
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      cnpj: input.cnpj?.trim() || null,
      ativo: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCliente(input: ClienteUpdateInput) {
  const { data, error } = await supabase
    .from("clientes")
    .update({
      nome: input.nome.trim(),
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      cnpj: input.cnpj?.trim() || null,
      ativo: input.ativo ?? true,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deactivateCliente(id: string) {
  const { data, error } = await supabase
    .from("clientes")
    .update({ ativo: false })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}