import { NextRequest, NextResponse } from "next/server";
import {
  createNivel,
  deleteNivel,
  getConfiguracoes,
  updateNivel,
  updatePrograma,
} from "@/lib/merchant/configuracoes";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lojistaId = searchParams.get("lojistaId");

    if (!lojistaId) {
      return NextResponse.json(
        { error: "lojistaId é obrigatório." },
        { status: 400 }
      );
    }

    const data = await getConfiguracoes(lojistaId);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar configurações.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.type === "programa") {
      const data = await updatePrograma(body.payload);
      return NextResponse.json({ data });
    }

    if (body.type === "nivel") {
      const data = await updateNivel(body.payload);
      return NextResponse.json({ data });
    }

    return NextResponse.json(
      { error: "Tipo de atualização inválido." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar configurações.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.type !== "nivel") {
      return NextResponse.json(
        { error: "Tipo de criação inválido." },
        { status: 400 }
      );
    }

    const data = await createNivel(body.payload);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao criar nível.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id é obrigatório." },
        { status: 400 }
      );
    }

    const data = await deleteNivel(id);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao excluir nível.",
      },
      { status: 500 }
    );
  }
}