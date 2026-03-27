"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Plus, Search, Import, Link } from "lucide-react";
import { authFetch } from "@/lib/api";
import type { ProdutoFormInitialData, ProdutoListItem } from "@/lib/types";
import { ProdutoForm } from "@/components/lojista/produto-form";
import { ProdutosTable } from "@/components/lojista/produtos-table";

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<ProdutoListItem[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editingProduto, setEditingProduto] = useState<ProdutoListItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (busca.trim()) {
      params.set("busca", busca.trim());
    }

    return params.toString();
  }, [busca]);

  async function loadProdutos() {
    setLoading(true);
    setError(null);

    try {
      const url = queryString
        ? `/api/lojista/produtos?${queryString}`
        : "/api/lojista/produtos";

      const response = await authFetch(url, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar produtos.");
      }

      setProdutos(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProdutos();
  }, [queryString]);

  function handleNewProduto() {
    if (openForm && !editingProduto) {
      setOpenForm(false);
      return;
    }

    setEditingProduto(null);
    setOpenForm(true);
  }

  function handleEditProduto(produto: ProdutoListItem) {
    setEditingProduto(produto);
    setOpenForm(true);
  }

  function handleCancelForm() {
    setEditingProduto(null);
    setOpenForm(false);
  }

  async function handleDeleteProduto(id: string) {
    const confirmed = window.confirm("Deseja excluir este produto?");
    if (!confirmed) return;

    setError(null);

    try {
      const response = await authFetch(`/api/lojista/produtos?id=${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao excluir produto.");
      }

      if (editingProduto?.id === id) {
        setEditingProduto(null);
        setOpenForm(false);
      }

      await loadProdutos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  const initialData: ProdutoFormInitialData = editingProduto
    ? {
        id: editingProduto.id,
        descricao: editingProduto.descricao,
        tetoPercentual: editingProduto.teto_percentual,
        ativo: editingProduto.ativo,
      }
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Box className="h-5 w-5 text-zinc-700" />
              <h1 className="text-xl font-semibold text-zinc-900">Produtos</h1>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Cadastre os produtos usados nas vendas para controlar o teto de pontos.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleNewProduto}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
              {openForm && !editingProduto ? "Fechar formulário" : "Novo produto"}
            </button>
            <a href="/lojista/configuracoes/importacao">
              <div
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800">
                <Import className="h-4 2-4"/>
                Importar Planilha
              </div>
            </a>
          </div>
        </div>
      </section>

      {openForm ? (
        <ProdutoForm
          initialData={initialData}
          onCancel={handleCancelForm}
          onCreated={async () => {
            setEditingProduto(null);
            setOpenForm(false);
            await loadProdutos();
          }}
        />
      ) : null}
      
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="w-full max-w-md">
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Buscar produto
            </label>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por descrição"
                className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
              />
            </div>
          </div>
        </div>
      </section>


      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
          Carregando produtos...
        </div>
      ) : (
        <ProdutosTable
          produtos={produtos}
          onEdit={handleEditProduto}
          onDelete={handleDeleteProduto}
        />
      )}
    </div>
  );
}