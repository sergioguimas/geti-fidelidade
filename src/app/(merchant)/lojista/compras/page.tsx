"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt, Search } from "lucide-react";
import { CompraForm } from "@/components/lojista/compra-form";
import { ComprasTable } from "@/components/lojista/compras-table";
import { CancelCompraModal } from "@/components/lojista/compra-cancel";
import type {
  ClienteOption,
  CompraCancelamentoPreview,
  CompraListItem,
  ProdutoOption,
} from "@/lib/types";
import { authFetch } from "@/lib/api";

export default function ComprasPage() {
  const [compras, setCompras] = useState<CompraListItem[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editingCompra, setEditingCompra] = useState<CompraListItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [cancelActionLoading, setCancelActionLoading] = useState(false);
  const [selectedCompra, setSelectedCompra] = useState<CompraListItem | null>(null);
  const [cancelPreview, setCancelPreview] =
    useState<CompraCancelamentoPreview | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (busca.trim()) {
      params.set("busca", busca.trim());
    }

    return params.toString();
  }, [busca]);

  async function loadCompras() {
    setLoading(true);
    setError(null);

    try {
      const url = queryString
        ? `/api/lojista/compras?${queryString}`
        : `/api/lojista/compras`;

      const response = await authFetch(url, {
        cache: "no-store",
      });

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de compras não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar compras.");
      }

      setCompras(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function loadClientes() {
    setLoadingClientes(true);

    try {
      const params = new URLSearchParams({
        mode: "clientes",
      });

      const response = await authFetch(
        `/api/lojista/compras?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          "A API de clientes para compras não retornou JSON válido."
        );
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar clientes.");
      }

      setClientes(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingClientes(false);
    }
  }

  async function loadProdutos() {
    setLoadingProdutos(true);

    try {
      const response = await authFetch("/api/lojista/produtos", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar produtos.");
      }

      setProdutos((result.data ?? []).filter((produto: any) => produto.ativo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingProdutos(false);
    }
  }

  useEffect(() => {
    loadCompras();
  }, [queryString]);

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    loadProdutos();
  }, []);

  function handleNewCompra() {
    if (openForm && !editingCompra) {
      setOpenForm(false);
      return;
    }

    setEditingCompra(null);
    setOpenForm(true);
  }

  function handleEditCompra(compra: CompraListItem) {
    setEditingCompra(compra);
    setOpenForm(true);
  }

  function handleCancelForm() {
    setEditingCompra(null);
    setOpenForm(false);
  }

  async function handleRequestCancelCompra(compra: CompraListItem) {
    setError(null);
    setSelectedCompra(compra);
    setCancelPreview(null);
    setCancelModalOpen(true);
    setCancelPreviewLoading(true);

    try {
      const response = await authFetch(
        `/api/lojista/compras?mode=cancel-preview&id=${compra.id}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de preview de cancelamento não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar prévia do cancelamento.");
      }

      setCancelPreview(result.data ?? null);
    } catch (err) {
      setCancelModalOpen(false);
      setSelectedCompra(null);
      setCancelPreview(null);
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setCancelPreviewLoading(false);
    }
  }

  async function handleConfirmCancelCompra() {
    if (!selectedCompra) return;

    setError(null);
    setCancelActionLoading(true);

    try {
      const response = await authFetch(
        `/api/lojista/compras?id=${selectedCompra.id}`,
        {
          method: "DELETE",
        }
      );

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de compras não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao cancelar compra.");
      }

      if (editingCompra?.id === selectedCompra.id) {
        setEditingCompra(null);
        setOpenForm(false);
      }

      setCancelModalOpen(false);
      setSelectedCompra(null);
      setCancelPreview(null);

      await loadCompras();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setCancelActionLoading(false);
    }
  }

  function handleCloseCancelModal() {
    if (cancelActionLoading) return;

    setCancelModalOpen(false);
    setSelectedCompra(null);
    setCancelPreview(null);
  }

  return (
    <div className="fundo">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Registre, edite e acompanhe vendas que alimentam a pontuação real dos
            clientes.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNewCompra}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          <Receipt className="h-4 w-4" />
          {openForm && !editingCompra ? "Fechar lançamento" : "Nova venda"}
        </button>
      </section>

      {openForm ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-zinc-900">
              {editingCompra ? "Editar compra" : "Lançamento manual"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {editingCompra
                ? "Atualize os dados da compra selecionada."
                : "Vendas lançadas pelo lojista entram como aprovadas e já processam a fidelidade."}
            </p>
          </div>

          {loadingClientes || loadingProdutos ? (
            <div className="text-sm text-zinc-500">
              Carregando clientes e produtos...
            </div>
          ) : (
            <CompraForm
              clientes={clientes}
              produtos={produtos}
              initialData={
                editingCompra
                  ? {
                      id: editingCompra.id,
                      clienteId: editingCompra.cliente_id,
                      dataCompra: editingCompra.data_compra,
                      itens: editingCompra.compra_itens.map((item) => ({
                        produtoId: item.produto_id,
                        quantidade: item.quantidade,
                        valorUnitario: item.valor_unitario,
                        desconto: item.desconto ?? 0,
                      })),
                    }
                  : null
              }
              onCancel={handleCancelForm}
              onCreated={async () => {
                setEditingCompra(null);
                setOpenForm(false);
                await loadCompras();
              }}
            />
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar compra por nome do cliente"
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
            Carregando compras...
          </div>
        ) : (
          <ComprasTable
            compras={compras}
            onEdit={handleEditCompra}
            onDelete={handleRequestCancelCompra}
          />
        )}
      </section>

      <CancelCompraModal
        open={cancelModalOpen}
        preview={cancelPreview}
        compraLabel={
          selectedCompra
            ? `Cliente: ${
                selectedCompra.cliente?.nome ?? "Cliente"
              } • Compra em ${selectedCompra.data_compra}`
            : undefined
        }
        loadingPreview={cancelPreviewLoading}
        loadingConfirm={cancelActionLoading}
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancelCompra}
      />
    </div>
  );
}