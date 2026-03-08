"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function PerfilPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email ?? null);
      setCreatedAt(user?.created_at ?? null);
    }

    loadUser();
  }, []);

  return (
    <div className="fundo">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Informações básicas da sessão do lojista.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-sm text-zinc-500">E-mail</p>
            <p className="mt-1 font-medium text-zinc-900">
              {email ?? "Não identificado"}
            </p>
          </div>

          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-sm text-zinc-500">Conta criada em</p>
            <p className="mt-1 font-medium text-zinc-900">
              {createdAt
                ? new Date(createdAt).toLocaleString("pt-BR")
                : "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}