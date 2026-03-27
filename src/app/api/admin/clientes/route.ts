import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeDocumento(value: string) {
  return value.replace(/\D/g, "");
}

function isDocumentoValido(documento: string) {
  return documento.length === 11 || documento.length === 14;
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdminApi(request);

    const { data, error } = await supabase
      .from("clientes")
      .select(`
        id,
        nome,
        email,
        telefone,
        documento,
        endereco,
        ativo,
        created_at,
        clientes_fidelidade (
          lojista_id,
          lojistas (
            id,
            nome_fantasia,
            razao_social
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Erro ao listar clientes." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar clientes." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApi(request);
    const supabaseAdmin = createAdminClient();
    const body = await request.json();

    const nome = String(body.nome ?? "").trim();
    const documento = normalizeDocumento(String(body.documento ?? "").trim());
    const telefone = String(body.telefone ?? "").trim() || null;
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    const endereco = String(body.endereco ?? "").trim() || null;

    if (!nome) {
      return NextResponse.json(
        { error: "nome é obrigatório." },
        { status: 400 }
      );
    }

    if (!documento) {
      return NextResponse.json(
        { error: "documento é obrigatório." },
        { status: 400 }
      );
    }

    if (!isDocumentoValido(documento)) {
      return NextResponse.json(
        { error: "Documento inválido. Informe um CPF ou CNPJ válido." },
        { status: 400 }
      );
    }

    const { data: existente, error: documentoError } = await supabaseAdmin
      .from("clientes")
      .select("id, nome, documento")
      .eq("documento", documento)
      .maybeSingle();

    if (documentoError) {
      return NextResponse.json(
        { error: "Erro ao validar documento do cliente." },
        { status: 500 }
      );
    }

    if (existente) {
      return NextResponse.json(
        {
          error:
            "Já existe um cliente cadastrado com este documento. Revise o cadastro existente e, se necessário, edite-o em vez de criar outro.",
          code: "CLIENTE_DOCUMENTO_DUPLICADO",
          data: {
            id: existente.id,
            nome: existente.nome,
            documento: existente.documento,
          },
        },
        { status: 409 }
      );
    }

    const { data: cliente, error } = await supabaseAdmin
      .from("clientes")
      .insert({
        nome,
        documento,
        telefone,
        email,
        endereco,
        ativo: true,
        lojista_id: null,
      })
      .select(`
        id,
        nome,
        email,
        telefone,
        documento,
        endereco,
        ativo,
        created_at,
        clientes_fidelidade (
          lojista_id,
          lojistas (
            id,
            nome_fantasia,
            razao_social
          )
        )
      `)
      .single();

    if (error || !cliente) {
      const message =
        error?.message?.toLowerCase().includes("duplicate key")
          ? "Já existe um cliente cadastrado com este documento. Revise o cadastro existente e, se necessário, edite-o em vez de criar outro."
          : error?.message || "Erro ao criar cliente.";

      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ data: { cliente } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar cliente." },
      { status: 500 }
    );
  }
}