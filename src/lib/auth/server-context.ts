import type { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export type LojistaContext = {
  supabase: ReturnType<typeof getServerSupabase>;
  lojistaId: string;
  papel: string;
};

export async function requireLojistaContext(
  request: NextRequest
): Promise<LojistaContext> {
  const supabase = getServerSupabase(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await supabase
    .from("lojistas_usuarios")
    .select("lojista_id, papel")
    .single();

  if (error || !data) {
    throw new Error("Usuário não vinculado a um lojista.");
  }

  return {
    supabase,
    lojistaId: data.lojista_id,
    papel: data.papel,
  };
}