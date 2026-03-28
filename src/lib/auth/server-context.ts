import type { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function requireLojistaContext(request: NextRequest) {
  const supabase = getServerSupabase(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: vinculo, error: vinculoError } = await supabase
    .from("lojistas_usuarios")
    .select("lojista_id, papel")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (vinculoError || !vinculo?.lojista_id) {
    throw new Error("Vínculo com lojista não encontrado.");
  }

  const { data: lojista, error: lojistaError } = await supabase
    .from("lojistas")
    .select("id, ativo")
    .eq("id", vinculo.lojista_id)
    .maybeSingle();

  if (lojistaError || !lojista) {
    throw new Error("Lojista não encontrado.");
  }

  if (!lojista.ativo) {
    throw new Error(
      "Este lojista está bloqueado. Entre em contato com o suporte da plataforma."
    );
  }

  return {
    supabase,
    user,
    lojistaId: vinculo.lojista_id,
    papel: vinculo.papel,
  };
}