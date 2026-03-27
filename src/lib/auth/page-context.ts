import { redirect } from "next/navigation";
import { getPageSupabase } from "@/lib/supabase/server";

export async function requireLojistaPageContext() {
  const supabase = await getPageSupabase();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: vinculo, error: vinculoError } = await supabase
    .from("lojistas_usuarios")
    .select(`
      lojista_id,
      papel,
      lojistas (
        id,
        ativo
      )
    `)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (vinculoError || !vinculo?.lojista_id) {
    redirect("/login");
  }

  const lojista = Array.isArray(vinculo.lojistas)
    ? vinculo.lojistas[0]
    : vinculo.lojistas;

  if (!lojista?.ativo) {
    redirect("/login?blocked=1");
  }

  return {
    supabase,
    user,
    lojistaId: vinculo.lojista_id,
    papel: vinculo.papel,
  };
}