import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminApi(request);
    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const { id } = await params;

    if (typeof body.ativo !== "boolean") {
      return NextResponse.json(
        { error: "ativo deve ser boolean." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("clientes")
      .update({ ativo: body.ativo })
      .eq("id", id)
      .select("id, ativo")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Cliente não encontrado." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao atualizar status do cliente.",
      },
      { status: 500 }
    );
  }
}