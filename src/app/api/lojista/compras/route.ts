import { NextRequest, NextResponse } from "next/server";
import { requireLojistaContext } from "@/lib/auth/server-context";
import {
  createCompra,
  listClienteOptions,
  listCompras,
  previewCancelCompra,
  cancelCompra,
  updateCompra,
} from "@/lib/merchant/compras";

export async function GET(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get("busca") ?? undefined;
    const mode = searchParams.get("mode");
    const id = searchParams.get("id");

    if (mode === "clientes") {
      const clientes = await listClienteOptions(supabase, lojistaId);
      return NextResponse.json({ data: clientes });
    }

    if (mode === "cancel-preview") {
      if (!id) {
        return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
      }

      const preview = await previewCancelCompra(supabase, lojistaId, id);
      return NextResponse.json({ data: preview });
    }

    const compras = await listCompras(supabase, lojistaId, busca);
    return NextResponse.json({ data: compras });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao listar compras.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (!body.clienteId || !body.dataCompra || !Array.isArray(body.itens)) {
      return NextResponse.json(
        { error: "clienteId, dataCompra e itens são obrigatórios." },
        { status: 400 }
      );
    }

    const compra = await createCompra(supabase, lojistaId, {
      clienteId: body.clienteId,
      dataCompra: body.dataCompra,
      origem: body.origem ?? "lojista",
      status: body.status ?? "aprovada",
      itens: body.itens,
    });

    return NextResponse.json({ data: compra }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao criar compra.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (!body.id || !body.clienteId || !body.dataCompra || !Array.isArray(body.itens)) {
      return NextResponse.json(
        { error: "id, clienteId, dataCompra e itens são obrigatórios." },
        { status: 400 }
      );
    }

    const compra = await updateCompra(supabase, lojistaId, {
      id: body.id,
      lojistaId,
      clienteId: body.clienteId,
      dataCompra: body.dataCompra,
      origem: body.origem ?? "lojista",
      status: body.status ?? "aprovada",
      itens: body.itens,
    });

    return NextResponse.json({ data: compra });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao atualizar compra.",
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

    const result = await cancelCompra(supabase, lojistaId, id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao cancelar compra.",
      },
      { status: 500 }
    );
  }
}