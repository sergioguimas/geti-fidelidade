import { z } from "zod";
import {
  cnpjSchema,
  emailSchema,
  telefoneSchema,
  textoObrigatorio,
  textoOpcional,
  uuidSchema,
} from "./comum";

/** Regra em português: docs/contratos/admin.md */

// -------------------------------------------------------------------- lojista

export const criarLojistaRequest = z
  .object({
    razaoSocial: textoObrigatorio(150, "Razão social"),
    /** Quando vazio, cai para a razão social — comportamento AS-IS, preservar. */
    nomeFantasia: z.string().trim().max(150).optional(),
    nomeResponsavel: textoOpcional(150),
    telefone: telefoneSchema,
    cnpj: cnpjSchema,
    endereco: textoOpcional(500),
    /** E-mail institucional do lojista; pode ser diferente do e-mail de login. */
    email: emailSchema.nullish().transform((v) => v ?? null),
    /** E-mail que vira o usuário no Auth. Obrigatório. */
    loginEmail: emailSchema,
  })
  .transform((v) => ({
    ...v,
    nomeFantasia: v.nomeFantasia?.length ? v.nomeFantasia : v.razaoSocial,
  }));

export const reenviarConviteRequest = z.object({ lojistaId: uuidSchema });

export type CriarLojistaRequest = z.infer<typeof criarLojistaRequest>;

// -------------------------------------------------------------------- cliente

export const criarClienteAdminRequest = z.object({
  nome: textoObrigatorio(150, "Nome"),
  documento: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11 || v.length === 14, "Documento inválido."),
  email: emailSchema.nullish().transform((v) => v ?? null),
  telefone: telefoneSchema,
  endereco: textoOpcional(500),
});

export const alterarStatusClienteRequest = z.object({ ativo: z.boolean() });

// ---------------------------------------------------------------------- admin

export const promoverAdminRequest = z.object({
  /**
   * O usuário precisa JÁ existir no Auth — esta rota não cria usuário.
   * Atenção ao buscar: `listUsers()` devolve só a primeira página (50), então
   * a busca precisa paginar ou usar getUserByEmail. Ver admin.md.
   */
  email: emailSchema,
  nome: textoOpcional(150),
});

export const removerAdminQuery = z.object({ id: uuidSchema });

export type PromoverAdminRequest = z.infer<typeof promoverAdminRequest>;
