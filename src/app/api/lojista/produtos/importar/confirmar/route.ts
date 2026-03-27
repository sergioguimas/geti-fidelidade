import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { createProduto, updateProduto } from "@/lib/merchant/produtos";

type ConfirmItem = {
  linha: number;
  id?: string;
  descricao: string;
  tetoPercentual: number;
  ativo: boolean;
  acao: "criar" | "atualizar";
};

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

    const items = Array.isArray(body.items) ? (body.items as ConfirmItem[]) : [];

    if (!items.length) {
      return NextResponse.json(
        { error: "items é obrigatório e deve conter ao menos um registro." },
        { status: 400 }
      );
    }

    const sucesso: Array<{ linha: number; descricao: string; acao: "criar" | "atualizar" }> = [];
    const falhas: Array<{ linha: number; descricao?: string; motivo: string }> = [];

    for (const item of items) {
      try {
        if (!item.descricao?.trim()) {
          throw new Error("Descrição obrigatória.");
        }

        if (item.tetoPercentual == null || item.tetoPercentual < 0 || item.tetoPercentual > 100) {
          throw new Error("tetoPercentual inválido.");
        }

        if (item.acao === "criar") {
          await createProduto(supabase, vinculo.lojista_id, {
            descricao: item.descricao,
            tetoPercentual: item.tetoPercentual,
            ativo: item.ativo,
          });

          sucesso.push({
            linha: item.linha,
            descricao: item.descricao,
            acao: "criar",
          });
          continue;
        }

        if (item.acao === "atualizar") {
          if (!item.id) {
            throw new Error("id obrigatório para atualização.");
          }

          await updateProduto(supabase, vinculo.lojista_id, {
            id: item.id,
            descricao: item.descricao,
            tetoPercentual: item.tetoPercentual,
            ativo: item.ativo,
          });

          sucesso.push({
            linha: item.linha,
            descricao: item.descricao,
            acao: "atualizar",
          });
          continue;
        }

        throw new Error("Ação inválida.");
      } catch (error) {
        falhas.push({
          linha: item.linha,
          descricao: item.descricao,
          motivo: error instanceof Error ? error.message : "Falha ao processar item.",
        });
      }
    }

    return NextResponse.json({
      data: {
        sucesso,
        falhas,
        resumo: {
          processados: items.length,
          sucesso: sucesso.length,
          falhas: falhas.length,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao confirmar importação.",
      },
      { status: 500 }
    );
  }
}