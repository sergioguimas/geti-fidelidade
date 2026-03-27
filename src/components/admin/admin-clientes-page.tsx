"use client";

import { useState } from "react";
import { Plus, ShieldAlert, Users } from "lucide-react";
import { NovoClienteDialog } from "./novo-cliente-dialog";

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

type Props = {
  initialClientes: AdminClienteItem[];
};

function formatLojas(cliente: AdminClienteItem) {
  const nomes = (cliente.clientes_fidelidade ?? [])
    .flatMap((item) =>
      (item.lojistas ?? []).map(
        (lojista) => lojista.nome_fantasia || lojista.razao_social
      )
    )
    .filter(Boolean) as string[];

  return Array.from(new Set(nomes));
}

export function AdminClientesPage({ initialClientes }: Props) {
  const [clientes, setClientes] = useState(initialClientes);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [openNovo, setOpenNovo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleToggleStatus(item: AdminClienteItem) {
    setError(null);
    setSuccess(null);
    setLoadingId(item.id);

    try {
      const response = await fetch(`/api/admin/clientes/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ativo: !item.ativo,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar status do cliente.");
      }

      setClientes((current) =>
        current.map((cliente) =>
          cliente.id === item.id ? { ...cliente, ativo: !cliente.ativo } : cliente
        )
      );

      setSuccess(
        item.ativo
          ? "Cliente bloqueado com sucesso."
          : "Cliente ativado com sucesso."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao atualizar status do cliente."
      );
    } finally {
      setLoadingId(null);
    }
  }

  function handleCreated(cliente: AdminClienteItem) {
    setClientes((current) => [cliente, ...current]);
    setOpenNovo(false);
    setError(null);
    setSuccess("Cliente criado com sucesso.");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <Users className="h-6 w-6 text-zinc-300" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-white">Clientes</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Gerencie os cadastros globais de clientes e visualize em quais lojas participam do programa.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenNovo(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Novo cliente
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
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="px-3 py-3 font-medium">Nome</th>
                <th className="px-3 py-3 font-medium">Documento</th>
                <th className="px-3 py-3 font-medium">Telefone</th>
                <th className="px-3 py-3 font-medium">Lojas</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => {
                const lojas = formatLojas(cliente);

                return (
                  <tr key={cliente.id} className="border-b border-zinc-800/70">
                    <td className="px-3 py-3 text-zinc-100">{cliente.nome}</td>
                    <td className="px-3 py-3 text-zinc-300">{cliente.documento || "-"}</td>
                    <td className="px-3 py-3 text-zinc-300">{cliente.telefone || "-"}</td>
                    <td className="px-3 py-3 text-zinc-300">
                      {lojas.length ? lojas.join(", ") : "-"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ${
                          cliente.ativo
                            ? "bg-emerald-950/70 text-emerald-300 ring-emerald-900/60"
                            : "bg-red-950/40 text-red-300 ring-red-900/60"
                        }`}
                      >
                        {cliente.ativo ? "Ativo" : "Bloqueado"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(cliente)}
                        disabled={loadingId === cliente.id}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                          cliente.ativo
                            ? "border border-red-900/60 bg-red-950/30 text-red-200 hover:bg-red-950/50"
                            : "border border-emerald-900/60 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-950/50"
                        }`}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {loadingId === cliente.id
                          ? "Salvando..."
                          : cliente.ativo
                          ? "Bloquear"
                          : "Ativar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <NovoClienteDialog
        open={openNovo}
        onOpenChange={setOpenNovo}
        onCreated={handleCreated}
      />
    </div>
  );
}