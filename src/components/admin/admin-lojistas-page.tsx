"use client";

import { useState } from "react";
import { Building2, Plus, ShieldAlert } from "lucide-react";
import { NovoLojistaDialog } from "./novo-lojista-dialog";

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

type Props = {
  initialLojistas: AdminLojistaItem[];
};

export function AdminLojistasPage({ initialLojistas }: Props) {
  const [lojistas, setLojistas] = useState(initialLojistas);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [openNovo, setOpenNovo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleToggleStatus(item: AdminLojistaItem) {
    setError(null);
    setSuccess(null);
    setLoadingId(item.id);

    try {
      const response = await fetch(`/api/admin/lojistas/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ativo: !item.ativo,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar status do lojista.");
      }

      setLojistas((current) =>
        current.map((lojista) =>
          lojista.id === item.id ? { ...lojista, ativo: !lojista.ativo } : lojista
        )
      );

      setSuccess(
        item.ativo
          ? "Lojista bloqueado com sucesso."
          : "Lojista ativado com sucesso."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao atualizar status do lojista."
      );
    } finally {
      setLoadingId(null);
    }
  }
  
  async function handleReenviarConvite(lojistaId: string) {
    try {
      const res = await fetch("/api/admin/lojistas/reenviar-convite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lojistaId }),
      });

      if (!res.ok) throw new Error();

      alert("Convite reenviado com sucesso!");
    } catch {
      alert("Erro ao reenviar convite.");
    }
  }

  function handleCreated(lojista: AdminLojistaItem) {
    setLojistas((current) => [lojista, ...current]);
    setOpenNovo(false);
    setError(null);
    setSuccess("Lojista criado com sucesso.");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <Building2 className="h-6 w-6 text-zinc-300" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-white">Lojistas</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Cadastre novos tenants, acompanhe os lojistas ativos e bloqueie acesso quando necessário.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenNovo(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Novo lojista
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="px-3 py-3 font-medium">Razão Social</th>
                <th className="px-3 py-3 font-medium">Responsável</th>
                <th className="px-3 py-3 font-medium">Telefone</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {lojistas.map((lojista) => (
                <tr key={lojista.id} className="border-b border-zinc-800/70">
                  <td className="px-3 py-3 text-zinc-100">
                    {lojista.razao_social}
                  </td>
                  <td className="px-3 py-3 text-zinc-300">
                    {lojista.nome_responsavel || "-"}
                  </td>
                  <td className="px-3 py-3 text-zinc-300">{lojista.telefone || "-"}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ${
                        lojista.ativo
                          ? "bg-emerald-950/70 text-emerald-300 ring-emerald-900/60"
                          : "bg-red-950/40 text-red-300 ring-red-900/60"
                      }`}
                    >
                      {lojista.ativo ? "Ativo" : "Bloqueado"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(lojista)}
                      disabled={loadingId === lojista.id}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                        lojista.ativo
                          ? "border border-red-900/60 bg-red-950/30 text-red-200 hover:bg-red-950/50"
                          : "border border-emerald-900/60 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-950/50"
                      }`}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {loadingId === lojista.id
                        ? "Salvando..."
                        : lojista.ativo
                        ? "Bloquear"
                        : "Ativar"}
                    </button>
                    <button
                      onClick={() => handleReenviarConvite(lojista.id)}
                      className="text-sm text-blue-500 hover:underline"
                    >
                      Reenviar convite
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <NovoLojistaDialog
        open={openNovo}
        onOpenChange={setOpenNovo}
        onCreated={handleCreated}
      />
    </div>
  );
}