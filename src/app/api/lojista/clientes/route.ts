import { NextRequest, NextResponse } from "next/server";
import {
  createCliente,
  deactivateCliente,
  listClientes,
  updateCliente,
} from "@/lib/merchant/clientes";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lojistaId = searchParams.get("lojistaId");
    const busca = searchParams.get("busca") ?? undefined;

    if (!lojistaId) {
      return NextResponse.json({ error: "lojistaId é obrigatório." }, { status: 400 });
    }

    const clientes = await listClientes(lojistaId, busca);
    return NextResponse.json({ data: clientes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar clientes." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.lojistaId || !body.nome?.trim()) {
      return NextResponse.json(
        { error: "lojistaId e nome são obrigatórios." },
        { status: 400 }
      );
    }

    const cliente = await createCliente(body);
    return NextResponse.json({ data: cliente }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar cliente." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || !body.nome?.trim()) {
      return NextResponse.json(
        { error: "id e nome são obrigatórios." },
        { status: 400 }
      );
    }

    const cliente = await updateCliente(body);
    return NextResponse.json({ data: cliente });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar cliente." },
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

    const cliente = await deactivateCliente(id);
    return NextResponse.json({ data: cliente });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao desativar cliente." },
      { status: 500 }
    );
  }
}