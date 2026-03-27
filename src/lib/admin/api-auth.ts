import type { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function requireAdminApi(request: NextRequest) {
  const supabase = getServerSupabase(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins_plataforma")
    .select("id, auth_user_id, email, nome, ativo")
    .eq("auth_user_id", user.id)
    .eq("ativo", true)
    .maybeSingle();

  if (adminError || !admin) {
    throw new Error("Acesso restrito a administradores.");
  }

  return { supabase, user, admin };
}