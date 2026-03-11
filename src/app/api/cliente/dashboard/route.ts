import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      data: {
        customer: {
          id: "cliente-teste",
          nome: "Cliente Teste",
          pontos_totais: 1280,
        },
        lojas: [
          {
            loja_id: "loja-1",
            loja_nome: "Loja Centro",
            pontos: 540,
            nivel: "Prata",
          },
          {
            loja_id: "loja-2",
            loja_nome: "Loja Norte",
            pontos: 740,
            nivel: "Ouro",
          },
        ],
        ultimas_pontuacoes: [
          {
            id: "pont-1",
            loja_nome: "Loja Centro",
            descricao: "Compra realizada",
            pontos: 80,
            data: "2026-03-10T14:00:00.000Z",
          },
          {
            id: "pont-2",
            loja_nome: "Loja Norte",
            descricao: "Compra realizada",
            pontos: 120,
            data: "2026-03-08T16:30:00.000Z",
          },
        ],
        proximos_a_expirar: [
          {
            id: "exp-1",
            loja_nome: "Loja Centro",
            pontos: 120,
            expira_em: "2026-04-10T00:00:00.000Z",
          },
        ],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro interno.",
      },
      { status: 500 }
    );
  }
}