"use client";

import { useState } from "react";
import { Shield, Trash2, UserPlus } from "lucide-react";

type AdminItem = {
  id: string;
  auth_user_id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  created_at: string;
};

type Props = {
  admins: AdminItem[];
  currentUserId: string;
};

export function AdminsPage({ admins: initialAdmins, currentUserId }: Props) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("Email é obrigatório.");
      return;
    }

    setLoadingCreate(true);

    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nome: nome.trim() || null,
          email: email.trim(),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao cadastrar admin.");
      }

      setAdmins((current) => [payload.data, ...current]);
      setNome("");
      setEmail("");
      setSuccess("Administrador cadastrado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar admin.");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setSuccess(null);
    setLoadingDeleteId(id);

    try {
      const response = await fetch(`/api/admin/admins?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao excluir admin.");
      }

      setAdmins((current) => current.filter((item) => item.id !== id));
      setSuccess("Administrador removido com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir admin.");
    } finally {
      setLoadingDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <Shield className="h-6 w-6 text-zinc-300" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-white">Administradores</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Cadastre e remova usuários com acesso ao painel administrativo da plataforma.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-base font-semibold text-white">Novo administrador</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-700"
              placeholder="Nome do admin"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-700"
              placeholder="email@dominio.com"
              type="email"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={loadingCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {loadingCreate ? "Cadastrando..." : "Cadastrar admin"}
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-emerald-400">{success}</p> : null}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-base font-semibold text-white">Admins cadastrados</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="px-3 py-3 font-medium">Nome</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const isCurrentUser = admin.auth_user_id === currentUserId;

                return (
                  <tr key={admin.id} className="border-b border-zinc-800/70">
                    <td className="px-3 py-3 text-zinc-100">{admin.nome || "-"}</td>
                    <td className="px-3 py-3 text-zinc-300">{admin.email}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-emerald-950/70 px-2 py-1 text-xs text-emerald-300 ring-1 ring-emerald-900/60">
                        Ativo
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(admin.id)}
                        disabled={loadingDeleteId === admin.id || isCurrentUser}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {isCurrentUser ? "Usuário atual" : "Excluir"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}