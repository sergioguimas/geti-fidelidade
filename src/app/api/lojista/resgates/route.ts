import { NextRequest, NextResponse } from "next/server";
import { requireLojistaContext } from "@/lib/auth/server-context";
import { listResgates, processarResgate } from "@/lib/merchant/resgates";

export async function GET(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get("busca") ?? undefined;

    const resgates = await listResgates(supabase, lojistaId, busca);
    return NextResponse.json({ data: resgates });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao listar resgates.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (!body.resgateId || !body.status) {
      return NextResponse.json(
        { error: "resgateId e status são obrigatórios." },
        { status: 400 }
      );
    }

    if (!["aprovado", "recusado"].includes(body.status)) {
      return NextResponse.json(
        { error: "Status inválido para processamento." },
        { status: 400 }
      );
    }

    const result = await processarResgate(supabase, lojistaId, {
      resgateId: body.resgateId,
      status: body.status,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao processar resgate.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}