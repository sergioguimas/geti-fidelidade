"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ClienteOption, ProdutoOption } from "@/lib/types";
import { authFetch } from "@/lib/api";

export type CompraFormInitialData = {
  id: string;
  clienteId: string;
  produtoId?: string;
  quantidade?: number;
  valorUnitario?: number;
  dataCompra: string;
} | null;



type CompraFormProps = {
  clientes: ClienteOption[];
  produtos: ProdutoOption[];
  initialData?: CompraFormInitialData;
  onCreated: () => void | Promise<void>;
  onCancel?: () => void;
};

export function CompraForm({
  clientes,
  produtos,
  initialData = null,
  onCreated,
  onCancel,
}: CompraFormProps) {
  const [clienteId, setClienteId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [status, setStatus] = useState<
    "pendente" | "aprovada" | "recusada" | "cancelada"
  >("aprovada");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    setClienteId(initialData?.clienteId ?? "");
    setProdutoId(initialData?.produtoId ?? "");
    setQuantidade(
      initialData?.quantidade != null ? String(initialData.quantidade) : "1"
    );
    setValorUnitario(
      initialData?.valorUnitario != null
        ? String(initialData.valorUnitario)
        : ""
    );
    setDataCompra(
      initialData?.dataCompra
        ? initialData.dataCompra.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
  }, [initialData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const quantidadeNumber = Number(quantidade);
      const valorUnitarioNumber = Number(valorUnitario);

      if (!clienteId) {
        throw new Error("Selecione um cliente.");
      }

      if (!produtoId) {
        throw new Error("Selecione um produto.");
      }

      if (!quantidadeNumber || Number.isNaN(quantidadeNumber) || quantidadeNumber <= 0) {
        throw new Error("Informe uma quantidade válida.");
      }

      if (
        !valorUnitarioNumber ||
        Number.isNaN(valorUnitarioNumber) ||
        valorUnitarioNumber <= 0
      ) {
        throw new Error("Informe um valor unitário válido.");
      }

      if (!dataCompra) {
        throw new Error("Informe a data da compra.");
      }

      const payload = isEditing
        ? {
            id: initialData?.id,
            clienteId,
            dataCompra,
            origem: "manual",
            itens: [
              {
                produtoId,
                quantidade: quantidadeNumber,
                valorUnitario: valorUnitarioNumber,
              },
            ],
          }
        : {
            clienteId,
            dataCompra,
            origem: "manual",
            itens: [
              {
                produtoId,
                quantidade: quantidadeNumber,
                valorUnitario: valorUnitarioNumber,
              },
            ],
          };

      const response = await authFetch("/api/lojista/compras", {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      const text = await response.text();

      let result: any;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de vendas não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            (isEditing
              ? "Erro ao atualizar venda."
              : "Erro ao registrar venda.")
        );
      }

      setClienteId("");
      setProdutoId("");
      setQuantidade("1");
      setValorUnitario("");
      setDataCompra(new Date().toISOString().slice(0, 10));
      setStatus("aprovada");

      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

   return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Cliente
          </label>

          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          >
            <option value="">Selecione um cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Produto
          </label>

          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          >
            <option value="">Selecione um produto</option>
            {produtos.map((produto) => (
              <option key={produto.id} value={produto.id}>
                {produto.descricao}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Quantidade
          </label>

          <input
            type="number"
            min="1"
            step="1"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Valor unitário
          </label>

          <input
            type="number"
            step="0.01"
            min="0.01"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
            placeholder="100.00"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Data da compra
          </label>

          <input
            type="date"
            value={dataCompra}
            onChange={(e) => setDataCompra(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700"
          >
            Cancelar
          </button>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? isEditing
              ? "Salvando..."
              : "Registrando..."
            : isEditing
            ? "Salvar alterações"
            : "Registrar venda"}
        </button>
      </div>
    </form>
  );
}