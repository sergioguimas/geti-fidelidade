import { NextRequest, NextResponse } from "next/server";
import { requireLojistaContext } from "@/lib/auth/server-context";
import { respostaDeErro } from "@/lib/erros";
import {
  createNivel,
  deleteNivel,
  getConfiguracoes,
  updateNivel,
  updatePrograma,
} from "@/lib/merchant/configuracoes";

export async function GET(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);

    const data = await getConfiguracoes(supabase, lojistaId);

    return NextResponse.json({ data });
  } catch (error) {
    return respostaDeErro(error, "Erro ao carregar configurações.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (body.type === "programa") {
      const data = await updatePrograma(supabase, lojistaId, body.payload);
      return NextResponse.json({ data });
    }

    if (body.type === "nivel") {
      const data = await updateNivel(supabase, lojistaId, body.payload);
      return NextResponse.json({ data });
    }

    return NextResponse.json(
      { error: "Tipo de atualização inválido." },
      { status: 400 }
    );
  } catch (error) {
    return respostaDeErro(error, "Erro ao atualizar configurações.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const body = await request.json();

    if (body.type !== "nivel") {
      return NextResponse.json(
        { error: "Tipo de criação inválido." },
        { status: 400 }
      );
    }

    const data = await createNivel(supabase, lojistaId, body.payload);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return respostaDeErro(error, "Erro ao criar nível.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const data = await deleteNivel(supabase, lojistaId, id);
    return NextResponse.json({ data });
  } catch (error) {
    return respostaDeErro(error, "Erro ao excluir nível.");
  }
}
