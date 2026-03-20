import { NextRequest, NextResponse } from "next/server";
import { requireLojistaContext } from "@/lib/auth/server-context";
import {
  createProduto,
  deleteProduto,
  listProdutos,
  updateProduto,
} from "@/lib/merchant/produtos";

export async function GET(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get("busca") ?? undefined;

    const produtos = await listProdutos(supabase, lojistaId, busca);
    return NextResponse.json({ data: produtos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar produtos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (!body.descricao?.trim() || body.tetoPercentual == null) {
      return NextResponse.json(
        { error: "descricao e tetoPercentual são obrigatórios." },
        { status: 400 }
      );
    }

    const produto = await createProduto(supabase, lojistaId, body);
    return NextResponse.json({ data: produto }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar produto." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (!body.id || !body.descricao?.trim() || body.tetoPercentual == null) {
      return NextResponse.json(
        { error: "id, descricao e tetoPercentual são obrigatórios." },
        { status: 400 }
      );
    }

    const produto = await updateProduto(supabase, lojistaId, body);
    return NextResponse.json({ data: produto });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar produto." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const data = await deleteProduto(supabase, lojistaId, id);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir produto." },
      { status: 500 }
    );
  }
}