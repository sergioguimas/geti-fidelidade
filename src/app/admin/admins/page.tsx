import { requireAdmin } from "@/lib/admin/auth";
import { AdminsPage } from "@/components/admin/admins-page";

export default async function AdminAdminsPage() {
  const { supabase, user } = await requireAdmin();

  const { data, error } = await supabase
    .from("admins_plataforma")
    .select("id, auth_user_id, email, nome, ativo, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao carregar administradores.");
  }

  const admins = data ?? [];

  return <AdminsPage admins={admins} currentUserId={user.id} />;
}