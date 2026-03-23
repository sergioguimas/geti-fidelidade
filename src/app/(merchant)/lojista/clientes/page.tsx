"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { ClienteForm } from "@/components/lojista/cliente-form";
import { ClientesTable } from "@/components/lojista/clientes-table";
import type { ClienteListItem } from "@/lib/types";
import { authFetch } from "@/lib/api";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editingCliente, setEditingCliente] =
    useState<ClienteListItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
    });

    if (busca.trim()) {
      params.set("busca", busca.trim());
    }

    return params.toString();
  }, [busca]);

  async function loadClientes() {
    setLoading(true);
    setError(null);

    try {
      const url = queryString
        ? `/api/lojista/clientes?${queryString}`
        : `/api/lojista/clientes`;

      const response = await authFetch(url, {
        cache: "no-store",
      });

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de clientes não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar clientes.");
      }

      setClientes(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClientes();
  }, [queryString]);

  function handleNewCliente() {
    if (openForm && !editingCliente) {
      setOpenForm(false);
      return;
    }

    setEditingCliente(null);
    setOpenForm(true);
  }

  function handleEditCliente(cliente: ClienteListItem) {
    setEditingCliente(cliente);
    setOpenForm(true);
  }

  function handleCancelForm() {
    setEditingCliente(null);
    setOpenForm(false);
  }

  async function handleDeactivateCliente(id: string) {
    const confirmed = window.confirm(
      "Tem certeza que deseja desativar este cliente?"
    );

    if (!confirmed) return;

    setError(null);

    try {
      const response = await fetch(`/api/lojista/clientes?id=${id}`, {
        method: "DELETE",
      });

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de clientes não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao desativar cliente.");
      }

      if (editingCliente?.id === id) {
        setEditingCliente(null);
        setOpenForm(false);
      }

      await loadClientes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  return (
    <div className="fundo">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Cadastre, edite e acompanhe o estado atual da fidelidade dos
            clientes.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNewCliente}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          <UserPlus className="h-4 w-4" />
          {openForm && !editingCliente ? "Fechar cadastro" : "Novo cliente"}
        </button>
      </section>

      {openForm ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-zinc-900">
              {editingCliente ? "Editar cliente" : "Cadastro manual"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {editingCliente
                ? "Atualize os dados do cliente selecionado."
                : "Adicione clientes para começar a registrar compras reais."}
            </p>
          </div>

          <ClienteForm
            initialData={
              editingCliente 
                ? {
                    id: editingCliente.id,
                    nome: editingCliente.nome,
                    telefone: editingCliente.telefone,
                    email: editingCliente.email,
                    cnpj: editingCliente.cnpj,
                    ativo: editingCliente.fidelidade?.ativo ?? true,
                    podeFazerLogin: editingCliente.pode_fazer_login,
                  }
                : null
            }
            onCancel={handleCancelForm}
            onCreated={async () => {
              setEditingCliente(null);
              setOpenForm(false);
              await loadClientes();
            }}
          />
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      <section>
        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm">
            Carregando clientes...
          </div>
        ) : (
          <ClientesTable
            clientes={clientes}
            onEdit={handleEditCliente}
            onDelete={handleDeactivateCliente}
          />
        )}
      </section>
    </div>
  );
}