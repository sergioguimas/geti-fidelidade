import { supabase } from "@/lib/supabase";
import type {
  NivelOption,
  PremioCreateInput,
  PremioListItem,
  PremioUpdateInput,
} from "@/lib/types";

export async function listPremios(lojistaId: string, busca?: string) {
  let query = supabase
    .from("premios")
    .select(`
      id,
      lojista_id,
      nome,
      descricao,
      pontos_necessarios,
      nivel_minimo_id,
      ativo,
      created_at,
      programa_niveis (
        id,
        nome,
        ordem
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
    descricao: item.descricao,
    pontos_necessarios: item.pontos_necessarios,
    nivel_minimo_id: item.nivel_minimo_id,
    ativo: item.ativo,
    created_at: item.created_at,
    nivel_minimo: Array.isArray(item.programa_niveis)
      ? item.programa_niveis[0] ?? null
      : item.programa_niveis ?? null,
  })) as PremioListItem[];
}

export async function createPremio(input: PremioCreateInput) {
  const { data, error } = await supabase
    .from("premios")
    .insert({
      lojista_id: input.lojistaId,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      pontos_necessarios: input.pontosNecessarios,
      nivel_minimo_id: input.nivelMinimoId ?? null,
      ativo: input.ativo ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updatePremio(input: PremioUpdateInput) {
  const { data, error } = await supabase
    .from("premios")
    .update({
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      pontos_necessarios: input.pontosNecessarios,
      nivel_minimo_id: input.nivelMinimoId ?? null,
      ativo: input.ativo ?? true,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deactivatePremio(id: string) {
  const { data, error } = await supabase
    .from("premios")
    .update({ ativo: false })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listNivelOptions(lojistaId: string) {
  const { data: programa, error: programaError } = await supabase
    .from("programas_fidelidade")
    .select("id")
    .eq("lojista_id", lojistaId)
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (programaError) throw new Error(programaError.message);
  if (!programa?.id) return [];

  const { data, error } = await supabase
    .from("programa_niveis")
    .select("id, nome, ordem")
    .eq("programa_id", programa.id)
    .order("ordem", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as NivelOption[];
}