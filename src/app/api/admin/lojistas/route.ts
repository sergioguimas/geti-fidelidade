import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function gerarSenhaTemporaria(length = 14) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function normalizeCnpj(value: string) {
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
    const cnpj = normalizeCnpj(String(body.cnpj ?? "").trim());
    const endereco = String(body.endereco ?? "").trim() || null;
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    const loginEmail = String(body.loginEmail ?? "").trim().toLowerCase();

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
            "Já existe um lojista cadastrado com este CNPJ. Revise o cadastro existente e, se necessário, edite-o em vez de criar outro.",
          code: "LOJISTA_CNPJ_DUPLICADO",
          data: {
            id: existentePorCnpj.id,
            razaoSocial: existentePorCnpj.razao_social,
            nomeFantasia: existentePorCnpj.nome_fantasia,
            cnpj: existentePorCnpj.cnpj,
          },
        },
        { status: 409 }
      );
    }

    const senhaTemporaria = gerarSenhaTemporaria();

    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: loginEmail,
        password: senhaTemporaria,
        email_confirm: false,
        user_metadata: {
          tipo: "lojista_owner",
          nome: nomeResponsavel ?? razaoSocial,
        },
      });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        {
          error:
            createUserError?.message || "Erro ao criar usuário de autenticação do lojista.",
        },
        { status: 500 }
      );
    }

    const authUserId = createdUser.user.id;

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
      .select(
        "id, nome_fantasia, razao_social, nome_responsavel, telefone, cnpj, endereco, email, ativo, created_at"
      )
      .single();

    if (lojistaError || !lojista) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      const message =
        lojistaError?.message?.toLowerCase().includes("uq_lojistas_cnpj") ||
        lojistaError?.message?.toLowerCase().includes("duplicate key")
          ? "Já existe um lojista cadastrado com este CNPJ. Revise o cadastro existente e, se necessário, edite-o em vez de criar outro."
          : lojistaError?.message || "Erro ao criar lojista.";

      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }

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
        { error: vinculoError.message || "Erro ao vincular owner ao lojista." },
        { status: 500 }
      );
    }

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`;

    await supabaseAdmin.auth.resetPasswordForEmail(loginEmail, {
      redirectTo,
    });

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
      { error: error instanceof Error ? error.message : "Erro ao criar lojista." },
      { status: 500 }
    );
  }
}