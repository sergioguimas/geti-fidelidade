import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NIVEL_INICIAL, PROGRAMA_INICIAL } from "@/contracts/acesso";

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

    // ================= PROGRAMA INICIAL =================
    //
    // Sem isto o tenant nasce inoperante: a tela de configuração abre vazia e
    // sem saída, e a primeira venda falha em fn_programa_ativo (S13).
    // Valores em src/contracts/acesso.ts, aprovados em 08/set/2026.
    //
    // A compensação abaixo é manual porque a criação atravessa Auth + 4 tabelas.
    // Trocar por uma fn_provisionar_lojista transacional é o passo 5 do
    // contrato de provisionamento.

    async function desfazerCriacao() {
      await supabaseAdmin.from("lojistas_usuarios").delete().eq("lojista_id", lojista.id);
      await supabaseAdmin.from("lojistas").delete().eq("id", lojista.id);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }

    const { data: programa, error: programaError } = await supabaseAdmin
      .from("programas_fidelidade")
      .insert({
        lojista_id: lojista.id,
        nome: PROGRAMA_INICIAL.nome,
        dias_expiracao_pontos: PROGRAMA_INICIAL.dias_expiracao_pontos,
        dias_para_perder_streak: PROGRAMA_INICIAL.dias_para_perder_streak,
        ativo: true,
      })
      .select("id")
      .single();

    if (programaError || !programa) {
      await desfazerCriacao();

      return NextResponse.json(
        { error: "Erro ao criar o programa de fidelidade inicial do lojista." },
        { status: 500 }
      );
    }

    // streak_max nulo: a faixa nasce ABERTA, para o tenant já satisfazer a
    // invariante de cobertura desde o primeiro segundo (S12).
    const { error: nivelError } = await supabaseAdmin
      .from("programa_niveis")
      .insert({
        programa_id: programa.id,
        nome: NIVEL_INICIAL.nome,
        streak_min: NIVEL_INICIAL.streak_min,
        streak_max: NIVEL_INICIAL.streak_max,
        percentual_conversao: NIVEL_INICIAL.percentual_conversao,
        teto_pontos_compra: NIVEL_INICIAL.teto_pontos_compra,
        ordem: NIVEL_INICIAL.ordem,
      });

    if (nivelError) {
      // programa_niveis tem FK ON DELETE CASCADE, então apagar o programa basta.
      await supabaseAdmin.from("programas_fidelidade").delete().eq("id", programa.id);
      await desfazerCriacao();

      return NextResponse.json(
        { error: "Erro ao criar o nível inicial do lojista." },
        { status: 500 }
      );
    }

    // ================= LINK DE PRIMEIRO ACESSO =================
    //
    // O GoTrue guarda UM token de recuperação por usuário. O código anterior
    // gerava o link, mandava no WhatsApp e logo depois chamava
    // resetPasswordForEmail — o que emitia um segundo token e matava o link
    // recém-enviado. Agora só existe um emissor por vez.

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/primeiro-acesso`;
    const podeWhatsapp = Boolean(
      telefoneNormalizado && process.env.N8N_WEBHOOK_WHATSAPP
    );

    let conviteEnviadoPor: "whatsapp" | "email" | "nenhum" = "nenhum";

    if (podeWhatsapp) {
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: loginEmail,
          options: { redirectTo },
        });

      const actionLink = linkData?.properties?.action_link;

      if (linkError || !actionLink) {
        console.error("Erro ao gerar link de primeiro acesso:", linkError);
      } else {
        const mensagem = `Olá ${nomeResponsavel ?? nomeFantasia}! 👋

Sua conta foi criada no sistema de fidelidade.

Para acessar pela primeira vez e definir sua senha:
👉 ${actionLink}

Se não foi você, ignore esta mensagem.`;

        try {
          await fetch(process.env.N8N_WEBHOOK_WHATSAPP!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              telefone: telefoneNormalizado,
              mensagem,
              // Para o fluxo do N8N poder mandar o MESMO link por e-mail.
              // Enquanto ele não tratar estes campos, o e-mail não sai — e é
              // por isso que o caminho sem telefone abaixo continua existindo.
              email: loginEmail,
              assunto: "Seu acesso ao sistema de fidelidade",
            }),
          });

          conviteEnviadoPor = "whatsapp";
        } catch (err) {
          console.warn("Falha ao enviar WhatsApp via N8N:", err);
        }
      }
    }

    // Sem WhatsApp disponível, ou com falha no envio: o e-mail do Supabase é o
    // único canal. Chamar aqui é seguro porque nenhum link foi entregue —
    // invalidar o token anterior não tira nada de ninguém.
    if (conviteEnviadoPor !== "whatsapp") {
      try {
        await supabaseAdmin.auth.resetPasswordForEmail(loginEmail, {
          redirectTo,
        });

        conviteEnviadoPor = "email";
      } catch (err) {
        console.warn("Falha ao enviar email de primeiro acesso:", err);
      }
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
          programaId: programa.id,
          // "nenhum" significa lojista criado sem convite entregue: o admin
          // precisa usar o reenvio. Não é motivo para desfazer a criação.
          conviteEnviadoPor,
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