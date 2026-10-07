import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarConvite } from "@/lib/admin/convite";

export async function POST(request: NextRequest) {
  try {
    await requireAdminApi(request);
    const supabaseAdmin = createAdminClient();

    const body = await request.json();
    const lojistaId = String(body.lojistaId ?? "").trim();

    if (!lojistaId) {
      return NextResponse.json(
        { error: "lojistaId é obrigatório." },
        { status: 400 }
      );
    }

    const { data: lojista, error: lojistaError } = await supabaseAdmin
      .from("lojistas")
      .select("id, nome_fantasia, nome_responsavel, telefone, email")
      .eq("id", lojistaId)
      .single();

    if (lojistaError || !lojista) {
      return NextResponse.json(
        { error: "Lojista não encontrado." },
        { status: 404 }
      );
    }

    const { data: vinculo, error: vinculoError } = await supabaseAdmin
      .from("lojistas_usuarios")
      .select("auth_user_id")
      .eq("lojista_id", lojistaId)
      .eq("papel", "owner")
      .single();

    if (vinculoError || !vinculo?.auth_user_id) {
      return NextResponse.json(
        { error: "Usuário do lojista não encontrado." },
        { status: 404 }
      );
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(vinculo.auth_user_id);

    const loginEmail = userData?.user?.email?.trim().toLowerCase();

    if (userError || !loginEmail) {
      return NextResponse.json(
        { error: "Email de login do lojista não encontrado." },
        { status: 404 }
      );
    }

    const conviteEnviadoPor = await enviarConvite(supabaseAdmin, {
      loginEmail,
      telefone: lojista.telefone,
      nomeDestinatario: lojista.nome_responsavel ?? lojista.nome_fantasia,
      tipo: "reenvio",
    });

    if (conviteEnviadoPor === "nenhum") {
      return NextResponse.json(
        {
          error:
            "Não foi possível enviar o convite por WhatsApp nem por e-mail. Tente novamente em alguns minutos.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        lojistaId: lojista.id,
        loginEmail,
        conviteEnviadoPor,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao reenviar convite.",
      },
      { status: 500 }
    );
  }
}