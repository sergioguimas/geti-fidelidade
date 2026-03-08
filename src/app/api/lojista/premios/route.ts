import { NextRequest, NextResponse } from "next/server";
import {
  createPremio,
  deactivatePremio,
  listNivelOptions,
  listPremios,
  updatePremio,
} from "@/lib/merchant/premios";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lojistaId = searchParams.get("lojistaId");
    const busca = searchParams.get("busca") ?? undefined;
    const mode = searchParams.get("mode");

    if (!lojistaId) {
      return NextResponse.json({ error: "lojistaId é obrigatório." }, { status: 400 });
    }

    if (mode === "niveis") {
      const niveis = await listNivelOptions(lojistaId);
      return NextResponse.json({ data: niveis });
    }

    const premios = await listPremios(lojistaId, busca);
    return NextResponse.json({ data: premios });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar prêmios." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.lojistaId || !body.nome?.trim() || !body.pontosNecessarios) {
      return NextResponse.json(
        { error: "lojistaId, nome e pontosNecessarios são obrigatórios." },
        { status: 400 }
      );
    }

    const premio = await createPremio(body);
    return NextResponse.json({ data: premio }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar prêmio." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || !body.nome?.trim() || !body.pontosNecessarios) {
      return NextResponse.json(
        { error: "id, nome e pontosNecessarios são obrigatórios." },
        { status: 400 }
      );
    }

    const premio = await updatePremio(body);
    return NextResponse.json({ data: premio });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar prêmio." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const premio = await deactivatePremio(id);
    return NextResponse.json({ data: premio });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao desativar prêmio." },
      { status: 500 }
    );
  }
}