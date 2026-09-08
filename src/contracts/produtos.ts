import { z } from "zod";
import {
  buscaSchema,
  inteiroPositivo,
  percentualSchema,
  textoObrigatorio,
  uuidSchema,
} from "./comum";

/** Regra em português: docs/contratos/produtos.md */

// ------------------------------------------------------------------- entidade

/**
 * Teto percentual do produto.
 *
 * AS-IS: coluna NOT NULL, e o motor trata 0 como "usa o percentual cheio do
 * nível" — o oposto do que o lojista quis dizer (S11).
 *
 * TO-BE: null = sem teto próprio (segue o nível) · 0 = não bonifica ·
 * n > 0 = teto próprio. Só ligar `tetoPercentualToBe` junto com a migration
 * que torna a coluna nullable e ajusta fn_processar_compra.
 */
export const tetoPercentualAsIs = percentualSchema;
export const tetoPercentualToBe = percentualSchema.nullable();

export const produtoSchema = z.object({
  id: uuidSchema,
  lojista_id: uuidSchema,
  descricao: z.string(),
  teto_percentual: z.number(),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export type Produto = z.infer<typeof produtoSchema>;

// ------------------------------------------------------------------ requests

export const listarProdutosQuery = z.object({ busca: buscaSchema });

export const criarProdutoRequest = z.object({
  descricao: textoObrigatorio(200, "Descrição"),
  tetoPercentual: tetoPercentualAsIs,
  ativo: z.boolean().optional(),
});

/**
 * `ativo` omitido PRESERVA o valor atual — não reativa.
 * O código atual faz `input.ativo ?? true`, que é o contrário; ver produtos.md.
 */
export const atualizarProdutoRequest = z.object({
  id: uuidSchema,
  descricao: textoObrigatorio(200, "Descrição"),
  tetoPercentual: tetoPercentualAsIs,
  ativo: z.boolean().optional(),
});

export const excluirProdutoQuery = z.object({ id: uuidSchema });

export type CriarProdutoRequest = z.infer<typeof criarProdutoRequest>;
export type AtualizarProdutoRequest = z.infer<typeof atualizarProdutoRequest>;

// ---------------------------------------------------------------- importação

export const CABECALHO_IMPORTACAO = ["descricao", "tetoPercentual", "ativo"] as const;

export const importarPreviewRequest = z.object({
  csv: z.string().trim().min(1, "Arquivo vazio."),
});

export const produtoImportNovoSchema = z.object({
  linha: inteiroPositivo,
  descricao: z.string(),
  tetoPercentual: percentualSchema,
  ativo: z.boolean(),
});

export const produtoImportDuplicadoSchema = produtoImportNovoSchema.extend({
  existente: z.object({
    id: uuidSchema,
    descricao: z.string(),
    tetoPercentual: percentualSchema,
    ativo: z.boolean(),
  }),
});

export const produtoImportInvalidoSchema = z.object({
  linha: inteiroPositivo,
  descricaoOriginal: z.string().optional(),
  motivo: z.string(),
});

export const importarPreviewResponse = z.object({
  novos: z.array(produtoImportNovoSchema),
  duplicados: z.array(produtoImportDuplicadoSchema),
  invalidos: z.array(produtoImportInvalidoSchema),
  resumo: z.object({
    totalLinhas: z.number().int(),
    novos: z.number().int(),
    duplicados: z.number().int(),
    invalidos: z.number().int(),
  }),
});

export const importarConfirmarRequest = z.object({
  itens: z
    .array(
      z.object({
        linha: inteiroPositivo,
        id: uuidSchema.optional(),
        descricao: textoObrigatorio(200, "Descrição"),
        tetoPercentual: percentualSchema,
        ativo: z.boolean(),
        acao: z.enum(["criar", "atualizar"]),
      })
    )
    .min(1, "Nada para importar."),
});

/**
 * Chave de deduplicação da importação. Não é persistida: serve só para comparar.
 * Precisa ser idêntica à usada em produtos-importacao.ts, senão o preview e a
 * confirmação divergem.
 */
export function normalizarDescricao(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toLowerCase();
}

export type ImportarPreviewResponse = z.infer<typeof importarPreviewResponse>;
export type ImportarConfirmarRequest = z.infer<typeof importarConfirmarRequest>;
