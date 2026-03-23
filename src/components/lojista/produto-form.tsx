"use client";

import { useState } from "react";
import { authFetch } from "@/lib/api";
import type { ProdutoFormInitialData } from "@/lib/types";

type ProdutoFormProps = {
  initialData: ProdutoFormInitialData;
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
};

export function ProdutoForm({
  initialData,
  onCancel,
  onCreated,
}: ProdutoFormProps) {
  const isEditing = Boolean(initialData?.id);

  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [tetoPercentual, setTetoPercentual] = useState(
    initialData?.tetoPercentual != null ? String(initialData.tetoPercentual) : ""
  );
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const descricaoNormalizada = descricao.trim();
    const tetoPercentualNumber = Number(tetoPercentual);

    if (!descricaoNormalizada) {
      setError("Descrição é obrigatória.");
      return;
    }

    if (
      Number.isNaN(tetoPercentualNumber) ||
      tetoPercentualNumber < 0 ||
      tetoPercentualNumber > 100
    ) {
      setError("Informe um teto percentual válido entre 0 e 100.");
      return;
    }

    setLoading(true);

    try {
      const payload = isEditing
        ? {
            id: initialData!.id,
            descricao: descricaoNormalizada,
            tetoPercentual: tetoPercentualNumber,
            ativo,
          }
        : {
            descricao: descricaoNormalizada,
            tetoPercentual: tetoPercentualNumber,
            ativo,
          };

      const response = await authFetch("/api/lojista/produtos", {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar produto.");
      }

      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-base font-semibold text-zinc-900">
          {isEditing ? "Editar produto" : "Novo produto"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Defina o produto e o teto percentual usado no cálculo de pontos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Descrição
          </label>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Perfume, Hidratante, Serviço Premium"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Teto percentual
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={tetoPercentual}
            onChange={(e) => setTetoPercentual(e.target.value)}
            placeholder="10"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Produto ativo
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? isEditing
              ? "Salvando..."
              : "Criando..."
            : isEditing
            ? "Salvar alterações"
            : "Criar produto"}
        </button>
      </div>
    </form>
  );
}