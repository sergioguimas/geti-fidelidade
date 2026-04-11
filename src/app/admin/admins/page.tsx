import { requireAdmin } from "@/lib/admin/auth";
import { AdminsPage } from "@/components/admin/admins-page";

export type AdminItem = {
  id: string;
  auth_user_id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  created_at: string;
};

export default async function AdminAdminsPage() {
  const { supabase, user } = await requireAdmin();

  const { data, error } = await supabase
    .from("admins_plataforma")
    .select("id, auth_user_id, email, nome, ativo, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Erro ao carregar administradores.");
  }

  const admins = (data ?? []) as AdminItem[];

  return <AdminsPage admins={admins} currentUserId={user.id} />;
}