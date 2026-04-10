import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApi(request);
    const supabaseAdmin = createAdminClient();

    const body = await request.json();

    const lojistaId = body.lojistaId;

    if (!lojistaId) {
      return NextResponse.json(
        { error: "lojistaId é obrigatório." },
        { status: 400 }
      );
    }

    // ================= BUSCAR LOJISTA =================

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

    // ================= BUSCAR USUÁRIO AUTH =================

    const { data: vinculo, error: vinculoError } = await supabaseAdmin
      .from("lojistas_usuarios")
      .select("auth_user_id")
      .eq("lojista_id", lojistaId)
      .eq("papel", "owner")
      .single();

    if (vinculoError || !vinculo) {
      return NextResponse.json(
        { error: "Usuário do lojista não encontrado." },
        { status: 404 }
      );
    }

    const authUserId = vinculo.auth_user_id;

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(authUserId);

    if (userError || !userData?.user?.email) {
      return NextResponse.json(
        { error: "Email do usuário não encontrado." },
        { status: 404 }
      );
    }

    const loginEmail = userData.user.email;

    // ================= GERAR LINK =================

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/primeiro-acesso`;

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: loginEmail,
        options: {
          redirectTo,
        },
      });

    if (linkError) {
      console.error(linkError);
      return NextResponse.json(
        { error: "Erro ao gerar link de acesso." },
        { status: 500 }
      );
    }

    const actionLink = linkData?.properties?.action_link;

    // ================= WHATSAPP =================

    if (lojista.telefone && actionLink) {
      const telefone = normalizePhone(lojista.telefone);

      const mensagem = `Olá ${
        lojista.nome_responsavel ?? lojista.nome_fantasia
      }! 👋

    Reenvio de acesso ao sistema de fidelidade.

    Para definir sua senha e acessar:
    👉 ${actionLink}

    Se não foi você, ignore esta mensagem.`;

      try {
        await fetch(process.env.N8N_WEBHOOK_WHATSAPP!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            telefone,
            mensagem,
          }),
        });
      } catch (err) {
        console.warn("Falha ao enviar WhatsApp:", err);
      }
    }

    // ================= EMAIL =================

    try {
      await supabaseAdmin.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/primeiro-acesso`,
      });
    } catch (err) {
      console.warn("Falha ao enviar email:", err);
    }

    return NextResponse.json({ success: true });
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