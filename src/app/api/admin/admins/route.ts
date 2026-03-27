import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    await requireAdminApi(request);

    const supabaseAdmin = createAdminClient();
    const body = await request.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const nome = body.nome ? String(body.nome).trim() : null;

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório." }, { status: 400 });
    }

    const { data: authUsers, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      return NextResponse.json(
        { error: "Erro ao consultar usuários do Auth." },
        { status: 500 }
      );
    }

    const authUser = authUsers.users.find(
      (user) => user.email?.toLowerCase() === email
    );

    if (!authUser) {
      return NextResponse.json(
        { error: "Não existe usuário Auth com esse email. Crie o usuário antes de promovê-lo a admin." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admins_plataforma")
      .insert({
        auth_user_id: authUser.id,
        email,
        nome,
        ativo: true,
      })
      .select("id, auth_user_id, email, nome, ativo, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Erro ao cadastrar admin." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao cadastrar admin.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAdminApi(request);
    const supabaseAdmin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("admins_plataforma")
      .select("id, auth_user_id")
      .eq("id", id)
      .maybeSingle();

    if (targetError || !target) {
      return NextResponse.json({ error: "Admin não encontrado." }, { status: 404 });
    }

    if (target.auth_user_id === user.id) {
      return NextResponse.json(
        { error: "Você não pode remover seu próprio acesso admin." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("admins_plataforma")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Erro ao excluir admin." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao excluir admin.",
      },
      { status: 500 }
    );
  }
}