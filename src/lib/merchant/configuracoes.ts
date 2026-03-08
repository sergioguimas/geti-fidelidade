import { supabase } from "@/lib/supabase";
import type {
  ConfiguracoesData,
  CreateNivelInput,
  UpdateNivelInput,
  UpdateProgramaInput,
} from "@/lib/types";

export async function getConfiguracoes(lojistaId: string): Promise<ConfiguracoesData> {
  const { data: programa, error: programaError } = await supabase
    .from("programas_fidelidade")
    .select("*")
    .eq("lojista_id", lojistaId)
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (programaError) {
    throw new Error(programaError.message);
  }

  if (!programa) {
    return {
      programa: null,
      niveis: [],
    };
  }

  const { data: niveis, error: niveisError } = await supabase
    .from("programa_niveis")
    .select("*")
    .eq("programa_id", programa.id)
    .order("ordem", { ascending: true });

  if (niveisError) {
    throw new Error(niveisError.message);
  }

  return {
    programa,
    niveis: niveis ?? [],
  };
}

export async function updatePrograma(input: UpdateProgramaInput) {
  const { data, error } = await supabase
    .from("programas_fidelidade")
    .update({
      nome: input.nome.trim(),
      dias_para_perder_streak: input.dias_para_perder_streak,
      dias_expiracao_pontos: input.dias_expiracao_pontos,
      ativo: input.ativo,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createNivel(input: CreateNivelInput) {
  const { data, error } = await supabase
    .from("programa_niveis")
    .insert({
      programa_id: input.programaId,
      nome: input.nome.trim(),
      streak_min: input.streakMin,
      streak_max: input.streakMax,
      percentual_conversao: input.percentualConversao,
      teto_pontos_compra: input.tetoPontosCompra,
      ordem: input.ordem,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateNivel(input: UpdateNivelInput) {
  const { data, error } = await supabase
    .from("programa_niveis")
    .update({
      nome: input.nome.trim(),
      streak_min: input.streakMin,
      streak_max: input.streakMax,
      percentual_conversao: input.percentualConversao,
      teto_pontos_compra: input.tetoPontosCompra,
      ordem: input.ordem,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteNivel(id: string) {
  const { error } = await supabase.from("programa_niveis").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}