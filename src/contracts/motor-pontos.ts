import { z } from "zod";
import { inteiroNaoNegativo, percentualSchema, uuidSchema } from "./comum";

/** Regra em português: docs/contratos/motor-de-pontos.md */

// ------------------------------------------------------------------ domínio

export const loteStatusSchema = z.enum([
  "pendente",
  "disponivel",
  "expirado",
  "cancelado",
]);

/**
 * Tipos do ledger. `quitacao_saldo_negativo` é NOVO — precisa entrar no enum
 * pontos_movimentacao_tipo por migration. É ele que fecha a conta da dívida:
 *
 *   divida = Σ 'saldo_negativo' − Σ 'quitacao_saldo_negativo'
 *
 * A tabela ajustes_pontos é dropada; o ledger vira a fonte única (D8).
 */
export const movimentacaoTipoSchema = z.enum([
  "geracao",
  "resgate",
  "compensacao_cancelamento",
  "expiracao",
  "ajuste_manual",
  "saldo_negativo",
  "quitacao_saldo_negativo",
]);

export type LoteStatus = z.infer<typeof loteStatusSchema>;
export type MovimentacaoTipo = z.infer<typeof movimentacaoTipoSchema>;

/**
 * Os quatro saldos do cliente num lojista.
 * `a_liberar` e `reservado` hoje vivem no mesmo campo com sinais opostos (S8).
 */
export const saldosSchema = z.object({
  saldo_disponivel: inteiroNaoNegativo,
  /** Compra lançada e ainda não aprovada — promessa ao cliente. */
  saldo_a_liberar: inteiroNaoNegativo,
  /** Comprometido com resgate pendente — compromisso do cliente. */
  saldo_reservado: inteiroNaoNegativo,
  /** Dívida por cancelamento sem lastro. Derivada do ledger, nunca escrita à mão. */
  saldo_negativo: inteiroNaoNegativo,
});

export type Saldos = z.infer<typeof saldosSchema>;

// ---------------------------------------------------------------- simulação

/**
 * Entrada de fn_simular_pontos. Mesmo caminho de código da pontuação real —
 * não é uma segunda implementação da fórmula (D5, Q1).
 */
export const simularPontosRequest = z.object({
  clienteId: uuidSchema,
  itens: z
    .array(
      z.object({
        produtoId: uuidSchema,
        quantidade: z.number().positive("Quantidade deve ser maior que zero."),
        valorUnitario: z.number().min(0, "Valor unitário não pode ser negativo."),
        desconto: z.number().min(0).optional(),
      })
    )
    .min(1, "Informe ao menos um item."),
  descontoTotal: z.number().min(0).optional(),
});

export const simularPontosResponse = z.object({
  /** Percentual do nível vigente do cliente, para a tela explicar o cálculo. */
  percentualNivel: percentualSchema,
  nivelNome: z.string(),
  itens: z.array(
    z.object({
      produtoId: uuidSchema,
      descricao: z.string(),
      subtotal: z.number(),
      percentualAplicado: percentualSchema,
      /** Contribuição EXATA do item, sem truncar. Auditoria, não é ponto. */
      contribuicao: z.number(),
    })
  ),
  /** floor(Σ contribuicao) — o truncamento acontece uma vez só (N4). */
  pontosBrutos: inteiroNaoNegativo,
  /** Teto do nível, 0 quando não há. */
  tetoNivel: inteiroNaoNegativo,
  /** Depois do teto. É o que vai para o lote. */
  pontosFinais: inteiroNaoNegativo,
  /** Quanto destes pontos será consumido para quitar dívida (R5). */
  abatimentoDivida: inteiroNaoNegativo,
  /** Data de expiração do lote: data_compra + dias. Null = não expira (N2). */
  expiraEm: z.string().nullable(),
});

export type SimularPontosRequest = z.infer<typeof simularPontosRequest>;
export type SimularPontosResponse = z.infer<typeof simularPontosResponse>;

// ------------------------------------------- regra do percentual do item

/**
 * A regra do teto por produto, escrita uma vez para servir de referência ao
 * implementar em PL/pgSQL e de base para o teste de equivalência.
 *
 * NÃO usar em runtime para calcular pontos: o cálculo mora só no Postgres (D5).
 * Está aqui como especificação executável, não como implementação.
 *
 *   null -> sem teto próprio, segue o nível
 *   0    -> não bonifica
 *   n>0  -> least(n, percentual do nível)
 *
 * Hoje o motor trata 0 como "percentual cheio", que é o oposto do que o lojista
 * quis dizer (S11) e contraria a promessa 4 do plano de negócio.
 */
export function percentualDoItem(
  tetoProduto: number | null,
  percentualNivel: number
): number {
  if (tetoProduto === null) return percentualNivel;
  if (tetoProduto === 0) return 0;
  return Math.min(tetoProduto, percentualNivel);
}
