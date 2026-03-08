import { NextRequest, NextResponse } from "next/server";
import {
  cancelCompra,
  createCompra,
  listClienteOptions,
  listCompras,
  updateCompra,
} from "@/lib/merchant/compras";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lojistaId = searchParams.get("lojistaId");
    const busca = searchParams.get("busca") ?? undefined;
    const mode = searchParams.get("mode");

    if (!lojistaId) {
      return NextResponse.json({ error: "lojistaId é obrigatório." }, { status: 400 });
    }

    if (mode === "clientes") {
      const clientes = await listClienteOptions(lojistaId);
      return NextResponse.json({ data: clientes });
    }

    const compras = await listCompras(lojistaId, busca);
    return NextResponse.json({ data: compras });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar compras." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.lojistaId || !body.clienteId || !body.valorTotal || !body.dataCompra) {
      return NextResponse.json(
        { error: "lojistaId, clienteId, valorTotal e dataCompra são obrigatórios." },
        { status: 400 }
      );
    }

    const compra = await createCompra({
      lojistaId: body.lojistaId,
      clienteId: body.clienteId,
      valorTotal: Number(body.valorTotal),
      dataCompra: body.dataCompra,
      origem: body.origem ?? "lojista",
      status: body.status ?? "aprovada",
    });

    return NextResponse.json({ data: compra }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar compra." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || !body.clienteId || !body.valorTotal || !body.dataCompra || !body.status) {
      return NextResponse.json(
        { error: "id, clienteId, valorTotal, dataCompra e status são obrigatórios." },
        { status: 400 }
      );
    }

    const compra = await updateCompra({
      id: body.id,
      clienteId: body.clienteId,
      valorTotal: Number(body.valorTotal),
      dataCompra: body.dataCompra,
      status: body.status,
    });

    return NextResponse.json({ data: compra });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar compra." },
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

    const compra = await cancelCompra(id);
    return NextResponse.json({ data: compra });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao cancelar compra." },
      { status: 500 }
    );
  }
}