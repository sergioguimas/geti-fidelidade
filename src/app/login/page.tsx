"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/lojista");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Login do lojista</h1>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-zinc-600">Email</label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-zinc-600">Senha</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-2 text-white"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}