import { z } from "zod";
import { emailSchema, percentualSchema, inteiroNaoNegativo } from "./comum";

/** Regra em português: docs/contratos/provisionamento-e-acesso.md */

// ------------------------------------------------------------------- senha

/**
 * Mínimo de 8. Sem exigência de símbolo ou maiúscula: regra de composição
 * empurra o usuário para senha pior e anotada — comprimento é o que importa.
 * Validar dos DOIS lados; hoje só existe um `length < 6` no cliente.
 */
export const senhaSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.");

/** A confirmação é validação de formulário e não vai para a API. */
export const definirSenhaFormSchema = z
  .object({ senha: senhaSchema, confirmacao: z.string() })
  .refine((v) => v.senha === v.confirmacao, {
    message: "A confirmação de senha não confere.",
    path: ["confirmacao"],
  });

export const definirSenhaRequest = z.object({ senha: senhaSchema });

// -------------------------------------------------------- link de acesso

export const tipoVerificacaoSchema = z.enum(["recovery", "invite", "email"]);

/**
 * Caminho interno para redirecionar depois de confirmar o link.
 * Precisa começar com "/" e não pode ser "//" nem URL absoluta, senão vira
 * redirecionamento aberto.
 */
export const caminhoInternoSchema = z
  .string()
  .refine(
    (v) => v.startsWith("/") && !v.startsWith("//") && !v.includes("://"),
    "Redirecionamento inválido."
  );

/**
 * Query de GET /auth/confirmar — rota que ainda não existe.
 *
 * Usa token_hash + verifyOtp em vez de ?code= porque o link do convite é
 * gerado no SERVIDOR e enviado para outra pessoa: no PKCE não existe
 * code_verifier no navegador de quem recebe, então exchangeCodeForSession
 * nunca funcionaria para esse caso.
 */
export const confirmarLinkQuery = z.object({
  token_hash: z.string().min(1, "Link inválido."),
  type: tipoVerificacaoSchema.default("recovery"),
  next: caminhoInternoSchema.default("/primeiro-acesso"),
});

export type ConfirmarLinkQuery = z.infer<typeof confirmarLinkQuery>;

// ------------------------------------------------- recuperação de senha

export const recuperarSenhaRequest = z.object({ email: emailSchema });

/**
 * Resposta SEMPRE igual, exista ou não a conta. Revelar a existência
 * transformaria a tela num oráculo de quais e-mails são clientes de quais
 * lojistas, o que colide com o isolamento entre lojistas (D3.1).
 */
export const MENSAGEM_RECUPERACAO_UNIFORME =
  "Se houver uma conta com esse e-mail, você receberá as instruções em instantes.";

export type RecuperarSenhaRequest = z.infer<typeof recuperarSenhaRequest>;

// --------------------------------------------- provisionamento do tenant

/**
 * Programa e nível criados junto com o lojista.
 *
 * Existe porque HOJE nada no sistema cria um programa: nem a rota de admin,
 * nem a tela de configurações. O tenant nasce sem programa, a tela de
 * configuração abre vazia e sem saída, e a primeira venda falha em
 * fn_programa_ativo. Ver provisionamento-e-acesso.md, seção 1.
 *
 * Valores confirmados pelo Sérgio em 08/set/2026.
 */
export const PROGRAMA_INICIAL = {
  nome: "Programa de Fidelidade",
  dias_expiracao_pontos: 180,
  dias_para_perder_streak: 45,
} as const;

export const NIVEL_INICIAL = {
  nome: "Padrão",
  streak_min: 1,
  /** Faixa ABERTA: é o que garante a invariante de cobertura desde o dia zero (S12). */
  streak_max: null,
  percentual_conversao: 1.0,
  /** 0 = sem teto por compra. */
  teto_pontos_compra: 0,
  ordem: 1,
} as const;

export const programaInicialSchema = z.object({
  nome: z.string().min(1),
  dias_expiracao_pontos: inteiroNaoNegativo,
  dias_para_perder_streak: z.number().int().positive(),
});

export const nivelInicialSchema = z.object({
  nome: z.string().min(1),
  streak_min: z.literal(1),
  streak_max: z.null(),
  percentual_conversao: percentualSchema,
  teto_pontos_compra: inteiroNaoNegativo,
  ordem: z.number().int(),
});
