import type { SupabaseClient } from "@supabase/supabase-js";

export type CanalConvite = "whatsapp" | "email" | "nenhum";

type EnviarConviteInput = {
  loginEmail: string;
  telefone: string | null;
  nomeDestinatario: string;
  tipo: "criacao" | "reenvio";
};

const TIMEOUT_N8N_MS = 8000;

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function montarMensagem(
  tipo: EnviarConviteInput["tipo"],
  nome: string,
  link: string
) {
  const corpo =
    tipo === "criacao"
      ? `Sua conta foi criada no sistema de fidelidade.

Para acessar pela primeira vez e definir sua senha:`
      : `Reenvio de acesso ao sistema de fidelidade.

Para definir sua senha e acessar:`;

  return `Olá ${nome}! 👋

${corpo}
👉 ${link}

Se não foi você, ignore esta mensagem.`;
}

/**
 * Envia o link de primeiro acesso por UM canal e devolve qual canal de fato
 * entregou.
 *
 * O GoTrue guarda um token de recuperação por usuário: gerar o link, mandar no
 * WhatsApp e depois chamar resetPasswordForEmail mata o link enviado. Por isso
 * o e-mail só é usado quando o WhatsApp não está disponível ou falhou — aí
 * invalidar o token anterior não tira nada de ninguém.
 *
 * "Entregou" aqui significa que o N8N respondeu 2xx e que o Supabase aceitou o
 * e-mail. Se o fluxo do N8N responder antes de enviar, falha posterior no
 * WhatsApp não aparece aqui.
 */
export async function enviarConvite(
  supabaseAdmin: SupabaseClient,
  input: EnviarConviteInput
): Promise<CanalConvite> {
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/primeiro-acesso`;
  const webhook = process.env.N8N_WEBHOOK_WHATSAPP;
  const telefone = input.telefone ? normalizePhone(input.telefone) : null;

  if (telefone && webhook) {
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: input.loginEmail,
        options: { redirectTo },
      });

    const actionLink = linkData?.properties?.action_link;

    if (linkError || !actionLink) {
      console.error("Erro ao gerar link de primeiro acesso:", linkError);
    } else {
      try {
        // fetch só lança em erro de rede: 404 de webhook desativado ou 500 do
        // fluxo chegam como resposta normal e precisam ser checados.
        const response = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telefone,
            mensagem: montarMensagem(
              input.tipo,
              input.nomeDestinatario,
              actionLink
            ),
            // Para o fluxo do N8N poder mandar o MESMO link por e-mail.
            email: input.loginEmail,
            assunto: "Seu acesso ao sistema de fidelidade",
          }),
          signal: AbortSignal.timeout(TIMEOUT_N8N_MS),
        });

        if (response.ok) {
          return "whatsapp";
        }

        console.warn(
          `N8N respondeu ${response.status} ao enviar convite por WhatsApp.`
        );
      } catch (err) {
        console.warn("Falha ao enviar WhatsApp via N8N:", err);
      }
    }
  }

  // resetPasswordForEmail não lança: devolve { error } em rate limit, SMTP
  // recusado ou redirectTo fora da allow-list.
  const { error: emailError } = await supabaseAdmin.auth.resetPasswordForEmail(
    input.loginEmail,
    { redirectTo }
  );

  if (emailError) {
    console.warn("Falha ao enviar email de primeiro acesso:", emailError);
    return "nenhum";
  }

  return "email";
}
