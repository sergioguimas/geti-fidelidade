import type { SupabaseClient } from "@supabase/supabase-js";

export async function listProdutos(
  supabase: SupabaseClient,
  lojistaId: string,
  busca?: string
) {
  let query = supabase
    .from("produtos")
    .select("id, lojista_id, descricao, teto_percentual, ativo, created_at, updated_at")
    .eq("lojista_id", lojistaId)
    .order("descricao", { ascending: true });

  if (busca?.trim()) {
    query = query.ilike("descricao", `%${busca.trim()}%`);
  }

  const { data, error } = await query;
  console.log("listProdutos debug", { lojistaId, data, error });

  if (error) throw new Error(error.message);

  return (data ?? []).map((item) => ({
    ...item,
    teto_percentual: Number(item.teto_percentual),
  }));
}

export async function createProduto(
  supabase: SupabaseClient,
  lojistaId: string,
  input: { descricao: string; tetoPercentual: number; ativo?: boolean }
) {
  const { data, error } = await supabase
    .from("produtos")
    .insert({
      lojista_id: lojistaId,
      descricao: input.descricao.trim(),
      teto_percentual: input.tetoPercentual,
      ativo: input.ativo ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    ...data,
    teto_percentual: Number(data.teto_percentual),
  };
}

export async function updateProduto(
  supabase: SupabaseClient,
  lojistaId: string,
  input: { id: string; descricao: string; tetoPercentual: number; ativo?: boolean }
) {
  const { data, error } = await supabase
    .from("produtos")
    .update({
      descricao: input.descricao.trim(),
      teto_percentual: input.tetoPercentual,
      ativo: input.ativo ?? true,
    })
    .eq("id", input.id)
    .eq("lojista_id", lojistaId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    ...data,
    teto_percentual: Number(data.teto_percentual),
  };
}

export async function deleteProduto(
  supabase: SupabaseClient,
  lojistaId: string,
  id: string
) {
  const { error } = await supabase
    .from("produtos")
    .delete()
    .eq("id", id)
    .eq("lojista_id", lojistaId);

  if (error) throw new Error(error.message);

  return { success: true };
}