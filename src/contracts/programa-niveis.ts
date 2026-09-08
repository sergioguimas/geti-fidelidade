import { z } from "zod";
import {
  inteiroNaoNegativo,
  inteiroPositivo,
  percentualSchema,
  textoObrigatorio,
  uuidSchema,
} from "./comum";

/** Regra em português: docs/contratos/programa-e-niveis.md */

// ------------------------------------------------------------------- entidade

export const programaSchema = z.object({
  id: uuidSchema,
  lojista_id: uuidSchema,
  nome: z.string(),
  /** Fonte da verdade da validade dos pontos (D2). 0 = não expira. */
  dias_expiracao_pontos: z.number().int(),
  /** Fonte da verdade da janela de frequência (D2). Promessa 2 do plano. */
  dias_para_perder_streak: z.number().int(),
  ativo: z.boolean(),
});

export const nivelSchema = z.object({
  id: uuidSchema,
  programa_id: uuidSchema,
  nome: z.string(),
  streak_min: z.number().int(),
  streak_max: z.number().int().nullable(),
  percentual_conversao: z.number(),
  teto_pontos_compra: z.number().int(),
  ordem: z.number().int(),
});

export type Programa = z.infer<typeof programaSchema>;
export type Nivel = z.infer<typeof nivelSchema>;

// ------------------------------------------------------------------ requests

export const atualizarProgramaRequest = z.object({
  id: uuidSchema,
  nome: textoObrigatorio(120, "Nome do programa"),
  dias_expiracao_pontos: inteiroNaoNegativo,
  dias_para_perder_streak: inteiroPositivo,
  ativo: z.boolean(),
});

const nivelCampos = {
  nome: textoObrigatorio(120, "Nome do nível"),
  streakMin: inteiroPositivo,
  streakMax: z.number().int().positive().nullable(),
  percentualConversao: percentualSchema,
  tetoPontosCompra: inteiroNaoNegativo,
  ordem: inteiroNaoNegativo,
};

const faixaCoerente = (v: {
  streakMin: number;
  streakMax?: number | null;
}) => v.streakMax == null || v.streakMax >= v.streakMin;

export const criarNivelRequest = z
  .object({ programaId: uuidSchema, ...nivelCampos })
  .refine(faixaCoerente, {
    message: "O fim da faixa não pode ser menor que o início.",
    path: ["streakMax"],
  });

export const atualizarNivelRequest = z
  .object({ id: uuidSchema, ...nivelCampos })
  .refine(faixaCoerente, {
    message: "O fim da faixa não pode ser menor que o início.",
    path: ["streakMax"],
  });

export const excluirNivelQuery = z.object({ id: uuidSchema });

export type AtualizarProgramaRequest = z.infer<typeof atualizarProgramaRequest>;
export type CriarNivelRequest = z.infer<typeof criarNivelRequest>;
export type AtualizarNivelRequest = z.infer<typeof atualizarNivelRequest>;

// ------------------------------------------------- invariante de cobertura

export type FaixaDeStreak = {
  streakMin: number;
  streakMax: number | null;
  ordem: number;
};

export type ResultadoCobertura =
  | { valido: true }
  | { valido: false; codigo: "NIVEIS_COBERTURA_INVALIDA" | "NIVEIS_TOPO_INVALIDO"; detalhe: string };

/**
 * Invariante 2 do contrato: as faixas de um programa cobrem [1, ∞) sem buraco
 * e sem sobreposição, e exatamente uma faixa é aberta no topo.
 *
 * Existe porque hoje nada impede o lojista de configurar "Bronze de 1 a 3" e
 * parar por aí — e o cliente que chega ao streak 4 derruba a venda inteira,
 * já que fn_nivel_por_streak lança exceção e roda dentro de
 * fn_processar_compra (S12).
 *
 * Chamar com o conjunto COMPLETO do programa já com a alteração aplicada:
 * na criação, faixas existentes + a nova; na edição, com a editada
 * substituída; na exclusão, sem a removida.
 */
export function validarCoberturaDeFaixas(
  faixas: FaixaDeStreak[]
): ResultadoCobertura {
  if (faixas.length === 0) {
    return {
      valido: false,
      codigo: "NIVEIS_COBERTURA_INVALIDA",
      detalhe: "O programa precisa de pelo menos um nível.",
    };
  }

  const abertas = faixas.filter((f) => f.streakMax === null);

  if (abertas.length !== 1) {
    return {
      valido: false,
      codigo: "NIVEIS_TOPO_INVALIDO",
      detalhe:
        abertas.length === 0
          ? "Nenhum nível está sem limite superior: o cliente que passar da última faixa fica sem nível."
          : `${abertas.length} níveis estão sem limite superior; só o último pode estar.`,
    };
  }

  const ordenadas = [...faixas].sort((a, b) => a.streakMin - b.streakMin);

  if (ordenadas[0].streakMin !== 1) {
    return {
      valido: false,
      codigo: "NIVEIS_COBERTURA_INVALIDA",
      detalhe: `A primeira faixa precisa começar em 1, e começa em ${ordenadas[0].streakMin}.`,
    };
  }

  if (ordenadas[ordenadas.length - 1].streakMax !== null) {
    return {
      valido: false,
      codigo: "NIVEIS_TOPO_INVALIDO",
      detalhe: "O nível sem limite superior precisa ser o de maior faixa.",
    };
  }

  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1];
    const atual = ordenadas[i];

    if (anterior.streakMax === null) {
      return {
        valido: false,
        codigo: "NIVEIS_TOPO_INVALIDO",
        detalhe: "Há faixa depois do nível sem limite superior.",
      };
    }

    if (atual.streakMin <= anterior.streakMax) {
      return {
        valido: false,
        codigo: "NIVEIS_COBERTURA_INVALIDA",
        detalhe: `As faixas ${anterior.streakMin}–${anterior.streakMax} e ${atual.streakMin}–${atual.streakMax ?? "∞"} se sobrepõem.`,
      };
    }

    if (atual.streakMin > anterior.streakMax + 1) {
      return {
        valido: false,
        codigo: "NIVEIS_COBERTURA_INVALIDA",
        detalhe: `Falta cobrir o streak ${anterior.streakMax + 1} até ${atual.streakMin - 1}.`,
      };
    }
  }

  return { valido: true };
}
