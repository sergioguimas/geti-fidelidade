import { requireAdmin } from "@/lib/admin/auth";
import { AdminLojistasPage } from "@/components/admin/admin-lojistas-page";

export type AdminLojistaItem = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  nome_responsavel: string | null;
  telefone: string | null;
  cnpj: string | null;
  endereco: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string | null;
};

export default async function AdminLojistasRoutePage() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("lojistas")
    .select(
      "id, nome_fantasia, razao_social, nome_responsavel, telefone, cnpj, endereco, email, ativo, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao carregar lojistas.");
  }

  const lojistas: AdminLojistaItem[] = (data ?? []) as AdminLojistaItem[];

  return <AdminLojistasPage initialLojistas={lojistas} />;
}