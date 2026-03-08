"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ClienteOption } from "@/lib/types";

type CompraFormInitialData = {
  id: string;
  clienteId: string;
  valorTotal: number;
  dataCompra: string;
  status: "pendente" | "aprovada" | "recusada" | "cancelada";
} | null;

type CompraFormProps = {
  lojistaId: string;
  clientes: ClienteOption[];
  initialData?: CompraFormInitialData;
  onCreated: () => void | Promise<void>;
  onCancel?: () => void;
};

export function CompraForm({
  lojistaId,
  clientes,
  initialData = null,
  onCreated,
  onCancel,
}: CompraFormProps) {
  const [clienteId, setClienteId] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [status, setStatus] = useState<
    "pendente" | "aprovada" | "recusada" | "cancelada"
  >("aprovada");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    setClienteId(initialData?.clienteId ?? "");
    setValorTotal(
      initialData?.valorTotal != null ? String(initialData.valorTotal) : ""
    );
    setDataCompra(
      initialData?.dataCompra
        ? initialData.dataCompra.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setStatus(initialData?.status ?? "aprovada");
  }, [initialData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const valor = Number(valorTotal);

      if (!clienteId) {
        throw new Error("Selecione um cliente.");
      }

      if (!valor || Number.isNaN(valor) || valor <= 0) {
        throw new Error("Informe um valor válido para a compra.");
      }

      if (!dataCompra) {
        throw new Error("Informe a data da compra.");
      }

      const response = await fetch("/api/lojista/compras", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEditing
            ? {
                id: initialData?.id,
                clienteId,
                valorTotal: valor,
                dataCompra,
                status,
              }
            : {
                lojistaId,
                clienteId,
                valorTotal: valor,
                dataCompra,
                status: "aprovada",
                origem: "lojista",
              }
        ),
      });

      const text = await response.text();

      let result: any;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de compras não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            (isEditing
              ? "Erro ao atualizar compra."
              : "Erro ao registrar compra.")
        );
      }

      setClienteId("");
      setValorTotal("");
      setDataCompra("");
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

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Valor da compra
          </label>

          <input
            type="number"
            step="0.01"
            min="0.01"
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
            placeholder="100.00"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            required
          />
        </div>

        <div>
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

        {isEditing ? (
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-zinc-800">
              Status
            </label>

            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value as
                    | "pendente"
                    | "aprovada"
                    | "recusada"
                    | "cancelada"
                )
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            >
              <option value="pendente">Pendente</option>
              <option value="aprovada">Aprovada</option>
              <option value="recusada">Recusada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        ) : null}
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
            : "Registrar compra"}
        </button>
      </div>
    </form>
  );
}