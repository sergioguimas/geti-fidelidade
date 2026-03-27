import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { gerarPreviewImportacaoProdutos } from "@/lib/merchant/produtos-importacao";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const { data: vinculo, error: vinculoError } = await supabase
      .from("lojistas_usuarios")
      .select("lojista_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (vinculoError || !vinculo?.lojista_id) {
      return NextResponse.json(
        { error: "Lojista não encontrado." },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.csv?.trim()) {
      return NextResponse.json(
        { error: "csv é obrigatório." },
        { status: 400 }
      );
    }

    const preview = await gerarPreviewImportacaoProdutos(
      supabase,
      vinculo.lojista_id,
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