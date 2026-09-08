import { NextResponse } from "next/server";
import { CODIGOS_ERRO, type CodigoErro } from "@/contracts/comum";

/**
 * Erro de regra de negócio, com o código e o status HTTP vindos do contrato
 * (docs/contratos/README.md, convenção 6).
 *
 * O envelope de resposta continua sendo `{ error: string }` — trocá-lo por
 * `{ error: { codigo, mensagem } }` é um TO-BE coordenado que quebra todo
 * componente que hoje lê `result.error` como string. O que muda aqui é só o
 * status: erro de negócio deixa de ser 500.
 */
export class ErroDeNegocio extends Error {
  readonly codigo: CodigoErro;

  constructor(codigo: CodigoErro, mensagem?: string) {
    super(mensagem ?? CODIGOS_ERRO[codigo].mensagem);
    this.name = "ErroDeNegocio";
    this.codigo = codigo;
  }

  get status(): number {
    return CODIGOS_ERRO[this.codigo].http;
  }
}

/**
 * Converte qualquer exceção na resposta da rota. Erro de negócio vira o status
 * do contrato; o resto continua 500 com a mensagem de fallback.
 */
export function respostaDeErro(erro: unknown, fallback: string) {
  if (erro instanceof ErroDeNegocio) {
    return NextResponse.json({ error: erro.message }, { status: erro.status });
  }

  return NextResponse.json(
    { error: erro instanceof Error ? erro.message : fallback },
    { status: 500 }
  );
}
