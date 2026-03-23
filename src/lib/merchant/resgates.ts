import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResgateActionInput, ResgateListItem } from "@/lib/types";

export async function listResgates(
  supabase: SupabaseClient,
  lojistaId: string,
  busca?: string
) {
  const { data, error } = await supabase
    .from("resgates")
    .select(`
      id,
      cliente_id,
      lojista_id,
      premio_id,
      pontos_solicitados,
      status,
      solicitado_em,
      decidido_em,
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
    .order("solicitado_em", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  let normalized: ResgateListItem[] = (data ?? []).map((item: any) => ({
    id: item.id,
    cliente_id: item.cliente_id,
    lojista_id: item.lojista_id,
    premio_id: item.premio_id,
    pontos_solicitados: Number(item.pontos_solicitados),
    status: item.status,
    solicitado_em: item.solicitado_em,
    decidido_em: item.decidido_em,
    cliente: Array.isArray(item.clientes)
      ? item.clientes[0] ?? null
      : item.clientes ?? null,
    premio: Array.isArray(item.premios)
      ? item.premios[0] ?? null
      : item.premios ?? null,
  }));

  if (busca?.trim()) {
    const term = busca.trim().toLowerCase();
    normalized = normalized.filter(
      (item) =>
        item.cliente?.nome?.toLowerCase().includes(term) ||
        item.premio?.nome?.toLowerCase().includes(term)
    );
  }

  return normalized;
}

export async function processarResgate(
  supabase: SupabaseClient,
  lojistaId: string,
  input: ResgateActionInput
) {
  const { data: resgate, error: resgateError } = await supabase
    .from("resgates")
    .select(`
      id,
      lojista_id,
      status
    `)
    .eq("id", input.resgateId)
    .eq("lojista_id", lojistaId)
    .single();

  if (resgateError || !resgate) {
    throw new Error(
      resgateError?.message ?? "Resgate não encontrado para este lojista."
    );
  }

  if (resgate.status !== "pendente") {
    throw new Error("Somente resgates pendentes podem ser processados.");
  }

  const { error } = await supabase.rpc("fn_processar_status_resgate", {
    p_resgate_id: input.resgateId,
    p_novo_status: input.status,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data, error: fetchError } = await supabase
    .from("resgates")
    .select(`
      id,
      cliente_id,
      lojista_id,
      premio_id,
      pontos_solicitados,
      status,
      solicitado_em,
      decidido_em
    `)
    .eq("id", input.resgateId)
    .eq("lojista_id", lojistaId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  return data;
}