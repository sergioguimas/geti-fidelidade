import { z } from "zod";
import {
  buscaSchema,
  inteiroPositivo,
  textoObrigatorio,
  textoOpcional,
  uuidSchema,
} from "./comum";

/** Regra em português: docs/contratos/premios.md */

export const premioSchema = z.object({
  id: uuidSchema,
  lojista_id: uuidSchema,
  nome: z.string(),
  descricao: z.string().nullable(),
  pontos_necessarios: z.number().int(),
  nivel_minimo_id: uuidSchema.nullable(),
  ativo: z.boolean(),
  created_at: z.string(),
  nivel_minimo: z
    .object({ id: uuidSchema, nome: z.string(), ordem: z.number().int() })
    .nullable()
    .optional(),
});

export type Premio = z.infer<typeof premioSchema>;

export const listarPremiosQuery = z.object({
  busca: buscaSchema,
  mode: z.literal("niveis").optional(),
});

const premioCampos = {
  nome: textoObrigatorio(150, "Nome do prêmio"),
  descricao: textoOpcional(2000),
  /**
   * Maior que zero: prêmio de 0 ponto é resgate infinito de graça.
   * A coluna no banco não tem CHECK — a migration precisa acrescentar.
   */
  pontosNecessarios: inteiroPositivo,
  /**
   * Precisa pertencer ao programa ativo DO PRÓPRIO lojista. A FK só garante
   * que o uuid existe em programa_niveis, e FK não consulta RLS — sem esta
   * validação no servidor dá para apontar para o nível de outro lojista.
   */
  nivelMinimoId: uuidSchema.nullish().transform((v) => v ?? null),
  ativo: z.boolean().optional(),
};

export const criarPremioRequest = z.object(premioCampos);

export const atualizarPremioRequest = z.object({
  id: uuidSchema,
  ...premioCampos,
});

export const desativarPremioQuery = z.object({ id: uuidSchema });

export type CriarPremioRequest = z.infer<typeof criarPremioRequest>;
export type AtualizarPremioRequest = z.infer<typeof atualizarPremioRequest>;

export const nivelOptionSchema = z.object({
  id: uuidSchema,
  nome: z.string(),
  ordem: z.number().int(),
});

export type NivelOption = z.infer<typeof nivelOptionSchema>;
