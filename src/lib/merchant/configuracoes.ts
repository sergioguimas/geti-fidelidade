import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConfiguracoesData,
  CreateNivelInput,
  UpdateNivelInput,
  UpdateProgramaInput,
} from "@/lib/types";
import {
  validarCoberturaDeFaixas,
  type FaixaDeStreak,
} from "@/contracts/programa-niveis";
import { ErroDeNegocio } from "@/lib/erros";

export async function getConfiguracoes(
  supabase: SupabaseClient,
  lojistaId: string
): Promise<ConfiguracoesData> {
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

export async function updatePrograma(
  supabase: SupabaseClient,
  lojistaId: string,
  input: UpdateProgramaInput
) {
  const { data, error } = await supabase
    .from("programas_fidelidade")
    .update({
      nome: input.nome.trim(),
      dias_para_perder_streak: input.dias_para_perder_streak,
      dias_expiracao_pontos: input.dias_expiracao_pontos,
      ativo: input.ativo,
    })
    .eq("id", input.id)
    .eq("lojista_id", lojistaId) // 🔐 importante
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// ------------------------------------------------ invariante de cobertura
//
// Contrato: docs/contratos/programa-e-niveis.md, desvio 2.
// A validação é do CONJUNTO de faixas do programa, nunca da linha isolada —
// salvar um nível que sozinho parece válido pode abrir um buraco na cobertura,
// e é o buraco que derruba a venda (S12).

type NivelDb = {
  id: string;
  programa_id: string;
  streak_min: number;
  streak_max: number | null;
  ordem: number;
};

/** Garante que o programa é do lojista da sessão. `programa_niveis` não tem
 *  `lojista_id`: o vínculo passa pelo programa. */
async function exigirProgramaDoLojista(
  supabase: SupabaseClient,
  lojistaId: string,
  programaId: string
) {
  const { data, error } = await supabase
    .from("programas_fidelidade")
    .select("id")
    .eq("id", programaId)
    .eq("lojista_id", lojistaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new ErroDeNegocio("PROGRAMA_NAO_ENCONTRADO");

  return data.id as string;
}

/** Carrega o nível e confirma que ele pertence a um programa do lojista. */
async function exigirNivelDoLojista(
  supabase: SupabaseClient,
  lojistaId: string,
  nivelId: string
): Promise<NivelDb> {
  const { data, error } = await supabase
    .from("programa_niveis")
    .select("id, programa_id, streak_min, streak_max, ordem")
    .eq("id", nivelId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new ErroDeNegocio("PROGRAMA_NAO_ENCONTRADO", "Nível não encontrado.");

  await exigirProgramaDoLojista(supabase, lojistaId, data.programa_id);

  return data as NivelDb;
}

async function carregarFaixas(
  supabase: SupabaseClient,
  programaId: string
): Promise<(FaixaDeStreak & { id: string })[]> {
  const { data, error } = await supabase
    .from("programa_niveis")
    .select("id, streak_min, streak_max, ordem")
    .eq("programa_id", programaId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((n) => ({
    id: n.id as string,
    streakMin: Number(n.streak_min),
    streakMax: n.streak_max === null ? null : Number(n.streak_max),
    ordem: Number(n.ordem),
  }));
}

/** Roda a invariante sobre o conjunto já com a alteração aplicada. */
function exigirCobertura(faixas: FaixaDeStreak[]) {
  const resultado = validarCoberturaDeFaixas(faixas);

  if (!resultado.valido) {
    throw new ErroDeNegocio(resultado.codigo, resultado.detalhe);
  }
}

export async function createNivel(
  supabase: SupabaseClient,
  lojistaId: string,
  input: CreateNivelInput
) {
  await exigirProgramaDoLojista(supabase, lojistaId, input.programaId);

  const atuais = await carregarFaixas(supabase, input.programaId);

  exigirCobertura([
    ...atuais,
    {
      streakMin: input.streakMin,
      streakMax: input.streakMax,
      ordem: input.ordem,
    },
  ]);

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

export async function updateNivel(
  supabase: SupabaseClient,
  lojistaId: string,
  input: UpdateNivelInput
) {
  const nivel = await exigirNivelDoLojista(supabase, lojistaId, input.id);

  const atuais = await carregarFaixas(supabase, nivel.programa_id);

  exigirCobertura(
    atuais.map((faixa) =>
      faixa.id === input.id
        ? {
            streakMin: input.streakMin,
            streakMax: input.streakMax,
            ordem: input.ordem,
          }
        : faixa
    )
  );

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
    .eq("programa_id", nivel.programa_id) // 🔐 fecha o escopo do tenant
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteNivel(
  supabase: SupabaseClient,
  lojistaId: string,
  id: string
) {
  const nivel = await exigirNivelDoLojista(supabase, lojistaId, id);

  // As FKs de premios.nivel_minimo_id e clientes_fidelidade.nivel_atual_id são
  // RESTRICT: sem esta checagem o delete estoura no banco e sobe como 500 com
  // texto do Postgres.
  const [premios, clientes] = await Promise.all([
    supabase
      .from("premios")
      .select("id", { count: "exact", head: true })
      .eq("nivel_minimo_id", id),
    supabase
      .from("clientes_fidelidade")
      .select("id", { count: "exact", head: true })
      .eq("nivel_atual_id", id),
  ]);

  if (premios.error) throw new Error(premios.error.message);
  if (clientes.error) throw new Error(clientes.error.message);

  const emPremios = premios.count ?? 0;
  const emClientes = clientes.count ?? 0;

  if (emPremios > 0 || emClientes > 0) {
    const partes: string[] = [];
    if (emClientes > 0)
      partes.push(`${emClientes} cliente(s) estão neste nível`);
    if (emPremios > 0) partes.push(`${emPremios} prêmio(s) exigem este nível`);

    throw new ErroDeNegocio(
      "NIVEL_EM_USO",
      `Não é possível excluir: ${partes.join(" e ")}.`
    );
  }

  const atuais = await carregarFaixas(supabase, nivel.programa_id);

  exigirCobertura(atuais.filter((faixa) => faixa.id !== id));

  const { error } = await supabase
    .from("programa_niveis")
    .delete()
    .eq("id", id)
    .eq("programa_id", nivel.programa_id); // 🔐 fecha o escopo do tenant

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}
