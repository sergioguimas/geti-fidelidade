"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
    >
      <LogOut className="h-4 w-4" />
      Sair
    </button>
  );
}