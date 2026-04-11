"use client";

import { useMemo, useState } from "react";
import { Plus, Search, ShieldAlert, Store, Users } from "lucide-react";
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

  pode_fazer_login?: boolean | null;
  ativado_em?: string | null;
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
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resumo = useMemo(() => {
    const total = clientes.length;
    const ativos = clientes.filter((item) => item.ativo).length;
    const bloqueados = total - ativos;
    const comParticipacao = clientes.filter(
      (item) => formatLojas(item).length > 0
    ).length;

    return { total, ativos, bloqueados, comParticipacao };
  }, [clientes]);

  const filteredClientes = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return clientes;

    return clientes.filter((item) => {
      const lojas = formatLojas(item);

      return [
        item.nome,
        item.email,
        item.telefone,
        item.documento,
        item.endereco,
        ...lojas,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    });
  }, [clientes, query]);

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
      <header className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <Users className="h-6 w-6 text-zinc-300" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-white">Clientes</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                Gerencie os cadastros globais de clientes, acompanhe a participação
                em lojas e controle a situação operacional de cada vínculo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenNovo(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Total de clientes</p>
          <p className="mt-2 text-2xl font-semibold text-white">{resumo.total}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Ativos</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            {resumo.ativos}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Bloqueados</p>
          <p className="mt-2 text-2xl font-semibold text-red-300">
            {resumo.bloqueados}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Com participação em lojas</p>
          <p className="mt-2 text-2xl font-semibold text-blue-300">
            {resumo.comParticipacao}
          </p>
        </div>
      </section>

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

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Gestão de clientes</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Busque por cliente, documento, contato ou loja vinculada.
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, documento, email, telefone ou loja"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-zinc-700"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="px-3 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Documento</th>
                <th className="px-3 py-3 font-medium">Contato</th>
                <th className="px-3 py-3 font-medium">Participação</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {filteredClientes.map((cliente) => {
                const lojas = formatLojas(cliente);

                return (
                  <tr key={cliente.id} className="border-b border-zinc-800/70 align-top">
                    <td className="px-3 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-100">{cliente.nome}</span>
                        <span className="text-zinc-500">{cliente.email || "-"}</span>
                      </div>
                    </td>

                    <td className="px-3 py-4 text-zinc-300">
                      {cliente.documento || "-"}
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex flex-col text-zinc-300">
                        <span>{cliente.telefone || "-"}</span>
                        <span className="text-zinc-500">{cliente.endereco || "-"}</span>
                      </div>
                    </td>

                    <td className="px-3 py-4">
                      {lojas.length ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-950/30 px-2.5 py-1 text-xs font-medium text-blue-200 ring-1 ring-blue-900/60">
                            <Store className="h-3.5 w-3.5" />
                            {lojas.length} loja{lojas.length > 1 ? "s" : ""}
                          </span>
                          <span className="text-xs leading-relaxed text-zinc-400">
                            {lojas.join(", ")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-500">Sem participação</span>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                          cliente.ativo
                            ? "bg-emerald-950/70 text-emerald-300 ring-emerald-900/60"
                            : "bg-red-950/40 text-red-300 ring-red-900/60"
                        }`}
                      >
                        {cliente.ativo ? "Ativo" : "Bloqueado"}
                      </span>
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(cliente)}
                          disabled={loadingId === cliente.id}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition disabled:opacity-60 ${
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
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-zinc-500">
                    Nenhum cliente encontrado para o filtro informado.
                  </td>
                </tr>
              ) : null}
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