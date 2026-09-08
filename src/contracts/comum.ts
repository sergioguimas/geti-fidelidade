import { z } from "zod";

/**
 * Primitivos e convenções compartilhadas por todos os contratos.
 * Regra em português: docs/contratos/README.md
 */

// ---------------------------------------------------------------- primitivos

export const uuidSchema = z.uuid({ message: "Identificador inválido." });

/** Texto obrigatório, com trim e limite. Rejeita string só de espaços. */
export function textoObrigatorio(max: number, campo: string) {
  return z
    .string()
    .trim()
    .min(1, `${campo} é obrigatório.`)
    .max(max, `${campo} deve ter no máximo ${max} caracteres.`);
}

/** Texto opcional: trim, e string vazia vira null (é assim que o banco guarda). */
export function textoOpcional(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length ? v : null))
    .nullish()
    .transform((v) => v ?? null);
}

/** Percentual de 0 a 100 com duas casas — espelha numeric(5,2). */
export const percentualSchema = z
  .number({ message: "Percentual deve ser um número." })
  .min(0, "Percentual não pode ser negativo.")
  .max(100, "Percentual não pode passar de 100.");

/** Inteiro não negativo. */
export const inteiroNaoNegativo = z
  .number({ message: "Deve ser um número." })
  .int("Deve ser um número inteiro.")
  .min(0, "Não pode ser negativo.");

/** Inteiro positivo (maior que zero). */
export const inteiroPositivo = z
  .number({ message: "Deve ser um número." })
  .int("Deve ser um número inteiro.")
  .positive("Deve ser maior que zero.");

/** CNPJ: aceita formatado, normaliza para 14 dígitos. Não valida dígito verificador. */
export const cnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 14, "CNPJ deve ter 14 dígitos.");

/** Telefone: normaliza para dígitos. Vazio vira null. */
export const telefoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .transform((v) => (v.length ? v : null))
  .nullish()
  .transform((v) => v ?? null);

export const emailSchema = z
  .email({ message: "E-mail inválido." })
  .transform((v) => v.trim().toLowerCase());

/** Busca textual usada nas listagens. */
export const buscaSchema = z.string().trim().max(200).optional();

// ------------------------------------------------------------------ envelope

/**
 * Códigos de erro de negócio. A mensagem que o usuário vê nasce aqui, não do
 * texto cru do Postgres (ver S9 em docs/03-defeitos-e-riscos.md).
 */
export const CODIGOS_ERRO = {
  NAO_AUTENTICADO: { http: 401, mensagem: "Sessão expirada. Entre novamente." },
  NAO_AUTORIZADO: { http: 403, mensagem: "Você não tem permissão para esta ação." },

  PRODUTO_INVALIDO: { http: 422, mensagem: "Dados do produto inválidos." },
  PRODUTO_NAO_ENCONTRADO: { http: 404, mensagem: "Produto não encontrado." },
  PRODUTO_EM_USO: {
    http: 409,
    mensagem:
      "Este produto já foi usado em uma compra e não pode ser excluído. Desative-o.",
  },
  IMPORTACAO_CABECALHO_INVALIDO: {
    http: 422,
    mensagem:
      "O arquivo deve ter as colunas obrigatórias: descricao e tetoPercentual.",
  },
  IMPORTACAO_VAZIA: { http: 422, mensagem: "O arquivo não tem nenhuma linha." },

  PREMIO_INVALIDO: { http: 422, mensagem: "Dados do prêmio inválidos." },
  PREMIO_NAO_ENCONTRADO: { http: 404, mensagem: "Prêmio não encontrado." },
  NIVEL_MINIMO_INVALIDO: {
    http: 422,
    mensagem: "O nível mínimo escolhido não pertence ao seu programa.",
  },

  PROGRAMA_NAO_ENCONTRADO: { http: 404, mensagem: "Programa não encontrado." },
  PROGRAMA_ATIVO_DUPLICADO: {
    http: 409,
    mensagem: "Já existe um programa ativo para este lojista.",
  },
  NIVEIS_COBERTURA_INVALIDA: {
    http: 422,
    mensagem:
      "As faixas de nível precisam começar em 1 e cobrir todos os valores, sem buraco e sem sobreposição.",
  },
  NIVEIS_TOPO_INVALIDO: {
    http: 422,
    mensagem: "Exatamente um nível deve ser o último, sem limite superior.",
  },
  NIVEL_EM_USO: {
    http: 409,
    mensagem: "Este nível está em uso e não pode ser excluído.",
  },

  LOJISTA_CNPJ_DUPLICADO: {
    http: 409,
    mensagem: "Já existe um lojista com este CNPJ.",
  },
  CNPJ_INVALIDO: { http: 422, mensagem: "CNPJ inválido. Informe os 14 dígitos." },
  USUARIO_AUTH_INEXISTENTE: {
    http: 422,
    mensagem:
      "Não existe usuário com esse e-mail. Crie o usuário antes de promovê-lo a admin.",
  },
  AUTO_REMOCAO_PROIBIDA: {
    http: 409,
    mensagem: "Você não pode remover o próprio acesso de admin.",
  },

  ERRO_INTERNO: { http: 500, mensagem: "Erro inesperado. Tente novamente." },
} as const;

export type CodigoErro = keyof typeof CODIGOS_ERRO;

export type RespostaErro = {
  error: {
    codigo: CodigoErro;
    mensagem: string;
    campos?: Record<string, string>;
  };
};

export type RespostaSucesso<T> = { data: T };

/** Monta o corpo de erro e o status HTTP a partir do código. */
export function erro(
  codigo: CodigoErro,
  campos?: Record<string, string>
): { body: RespostaErro; status: number } {
  const { http, mensagem } = CODIGOS_ERRO[codigo];
  return {
    body: { error: { codigo, mensagem, ...(campos ? { campos } : {}) } },
    status: http,
  };
}

/** Achata os erros do Zod em { campo: mensagem } para a resposta 422. */
export function camposDoZod(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of erro.issues) {
    const chave = issue.path.join(".") || "_";
    if (!campos[chave]) campos[chave] = issue.message;
  }
  return campos;
}
