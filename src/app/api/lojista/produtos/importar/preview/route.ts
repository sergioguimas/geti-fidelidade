import { NextRequest, NextResponse } from "next/server";
import { requireLojistaContext } from "@/lib/auth/server-context";
import { gerarPreviewImportacaoProdutos } from "@/lib/merchant/produtos-importacao";

export async function POST(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (!body.csv?.trim()) {
      return NextResponse.json(
        { error: "csv é obrigatório." },
        { status: 400 }
      );
    }

    const preview = await gerarPreviewImportacaoProdutos(
      supabase,
      lojistaId,
      body.csv
    );

    return NextResponse.json({ data: preview });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao gerar preview da importação.",
      },
      { status: 500 }
    );
  }
}