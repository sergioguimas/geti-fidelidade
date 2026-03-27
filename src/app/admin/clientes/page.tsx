import { requireAdmin } from "@/lib/admin/auth";
import { AdminClientesPage } from "@/components/admin/admin-clientes-page";

export type AdminClienteItem = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  endereco: string | null;
  ativo: boolean;
  created_at: string | null;
  clientes_fidelidade: Array<{
    lojista_id: string | null;
    lojistas: Array<{
      id: string;
      nome_fantasia: string | null;
      razao_social: string | null;
    }>;
  }>;
};

export default async function AdminClientesRoutePage() {
  const { supabase } = await requireAdmin();

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
    throw new Error("Erro ao carregar clientes.");
  }

  const clientes = (data ?? []) as AdminClienteItem[];

  return <AdminClientesPage initialClientes={clientes} />;
}