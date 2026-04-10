import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdminApi(request);

    const { data, error } = await supabase
      .from("lojistas")
      .select(
        "id, nome_fantasia, razao_social, nome_responsavel, telefone, cnpj, endereco, email, ativo, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Erro ao listar lojistas." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar lojistas." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApi(request);
    const supabaseAdmin = createAdminClient();
    const body = await request.json();

    const razaoSocial = String(body.razaoSocial ?? "").trim();
    const nomeFantasiaInput = String(body.nomeFantasia ?? "").trim();
    const nomeFantasia = nomeFantasiaInput || razaoSocial;
    const nomeResponsavel = String(body.nomeResponsavel ?? "").trim() || null;
    const telefone = String(body.telefone ?? "").trim() || null;
    const telefoneNormalizado = telefone ? normalizePhone(telefone) : null;
    const cnpj = normalizeCnpj(String(body.cnpj ?? "").trim());
    const endereco = String(body.endereco ?? "").trim() || null;
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    const loginEmail = String(body.loginEmail ?? "").trim().toLowerCase();

    // ================= VALIDAÇÕES =================

    if (!razaoSocial) {
      return NextResponse.json(
        { error: "razaoSocial é obrigatório." },
        { status: 400 }
      );
    }

    if (!cnpj) {
      return NextResponse.json(
        { error: "cnpj é obrigatório." },
        { status: 400 }
      );
    }

    if (cnpj.length !== 14) {
      return NextResponse.json(
        { error: "CNPJ inválido. Informe os 14 dígitos." },
        { status: 400 }
      );
    }

    if (!loginEmail) {
      return NextResponse.json(
        { error: "loginEmail é obrigatório." },
        { status: 400 }
      );
    }

    // ================= DUPLICIDADE =================

    const { data: existentePorCnpj, error: cnpjError } = await supabaseAdmin
      .from("lojistas")
      .select("id, razao_social, nome_fantasia, cnpj")
      .eq("cnpj", cnpj)
      .maybeSingle();

    if (cnpjError) {
      return NextResponse.json(
        { error: "Erro ao validar CNPJ do lojista." },
        { status: 500 }
      );
    }

    if (existentePorCnpj) {
      return NextResponse.json(
        {
          error:
            "Já existe um lojista cadastrado com este CNPJ.",
          code: "LOJISTA_CNPJ_DUPLICADO",
          data: existentePorCnpj,
        },
        { status: 409 }
      );
    }

    // ================= CRIAR USUÁRIO =================

    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
        user_metadata: {
          tipo: "lojista_owner",
          nome: nomeResponsavel ?? razaoSocial,
        },
      });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        {
          error:
            createUserError?.message ||
            "Erro ao criar usuário de autenticação.",
        },
        { status: 500 }
      );
    }

    const authUserId = createdUser.user.id;

    // ================= CRIAR LOJISTA =================

    const { data: lojista, error: lojistaError } = await supabaseAdmin
      .from("lojistas")
      .insert({
        nome_fantasia: nomeFantasia,
        razao_social: razaoSocial,
        nome_responsavel: nomeResponsavel,
        telefone,
        cnpj,
        endereco,
        email,
        ativo: true,
      })
      .select("*")
      .single();

    if (lojistaError || !lojista) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      return NextResponse.json(
        { error: lojistaError?.message || "Erro ao criar lojista." },
        { status: 500 }
      );
    }

    // ================= VÍNCULO =================

    const { error: vinculoError } = await supabaseAdmin
      .from("lojistas_usuarios")
      .insert({
        lojista_id: lojista.id,
        auth_user_id: authUserId,
        papel: "owner",
      });

    if (vinculoError) {
      await supabaseAdmin.from("lojistas").delete().eq("id", lojista.id);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      return NextResponse.json(
        { error: vinculoError.message },
        { status: 500 }
      );
    }

    // ================= LINK PRIMEIRO ACESSO =================

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: loginEmail,
      });

    if (linkError) {
      console.error("Erro ao gerar link:", linkError);
    }

    const actionLink = linkData?.properties?.action_link;

    // ================= WHATSAPP (N8N) =================

    if (telefoneNormalizado && actionLink) {
      const mensagem = `Olá ${nomeResponsavel ?? nomeFantasia}! 👋

      Sua conta foi criada no sistema de fidelidade.

      Para acessar pela primeira vez e definir sua senha:
      👉 ${actionLink}

      Se não foi você, ignore esta mensagem.`;

      try {
        await fetch(process.env.N8N_WEBHOOK_WHATSAPP!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            telefone: telefoneNormalizado,
            mensagem,
          }),
        });
      } catch (err) {
        console.warn("Falha ao enviar WhatsApp via N8N:", err);
      }
    }

    // ================= EMAIL (fallback opcional) =================

    try {
      await supabaseAdmin.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/primeiro-acesso`,
      });
    } catch (err) {
      console.warn("Falha ao enviar email:", err);
    }

    // ================= RESPONSE =================

    return NextResponse.json(
      {
        data: {
          lojista,
          owner: {
            authUserId,
            loginEmail,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao criar lojista.",
      },
      { status: 500 }
    );
  }
}