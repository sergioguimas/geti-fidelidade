import { NextRequest, NextResponse } from "next/server";
import { requireLojistaContext } from "@/lib/auth/server-context";
import {
  createCliente,
  deactivateCliente,
  listClientes,
  updateCliente,
} from "@/lib/merchant/clientes";

export async function GET(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get("busca") ?? undefined;

    const clientes = await listClientes(supabase, lojistaId, busca);
    return NextResponse.json({ data: clientes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao listar clientes.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (!body.nome?.trim()) {
      return NextResponse.json(
        { error: "nome é obrigatório." },
        { status: 400 }
      );
    }

    const cliente = await createCliente(supabase, lojistaId, {
      nome: body.nome,
      telefone: body.telefone ?? null,
      email: body.email ?? null,
      cnpj: body.cnpj ?? null,
      ativo: body.ativo ?? true,
      podeFazerLogin: body.podeFazerLogin ?? false,
    });

    return NextResponse.json({ data: cliente }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao criar cliente.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (!body.id || !body.nome?.trim()) {
      return NextResponse.json(
        { error: "id e nome são obrigatórios." },
        { status: 400 }
      );
    }

    const cliente = await updateCliente(supabase, lojistaId, {
      id: body.id,
      nome: body.nome,
      telefone: body.telefone ?? null,
      email: body.email ?? null,
      cnpj: body.cnpj ?? null,
      ativo: body.ativo ?? true,
      podeFazerLogin: body.podeFazerLogin ?? false,
    });

    return NextResponse.json({ data: cliente });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao atualizar cliente.",
      },
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

    const cliente = await deactivateCliente(supabase, lojistaId, id);
    return NextResponse.json({ data: cliente });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao desativar cliente.",
      },
      { status: 500 }
    );
  }
}