import { redirect } from "next/navigation";
import { getPageSupabase } from "@/lib/supabase/server";

export async function getAdminContext() {
  const supabase = await getPageSupabase();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, user: null, admin: null };
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins_plataforma")
    .select("id, auth_user_id, email, nome, ativo")
    .eq("auth_user_id", user.id)
    .eq("ativo", true)
    .maybeSingle();

  if (adminError || !admin) {
    return { supabase, user, admin: null };
  }

  return { supabase, user, admin };
}

export async function requireAdmin() {
  const context = await getAdminContext();

  if (!context.user) {
    redirect("/login");
  }

  if (!context.admin) {
    redirect("/lojista");
  }

  return context;
}