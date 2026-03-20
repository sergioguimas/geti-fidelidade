"use client";

import { FormEvent, useEffect, useState } from "react";
import type { NivelOption } from "@/lib/types";
import { authFetch } from "@/lib/api";

type PremioFormInitialData = {
  id: string;
  nome: string;
  descricao: string;
  pontosNecessarios: number;
  nivelMinimoId: string | null;
  ativo?: boolean;
} | null;

type PremioFormProps = {
  lojistaId: string;
  niveis: NivelOption[];
  initialData?: PremioFormInitialData;
  onCreated: () => void | Promise<void>;
  onCancel?: () => void;
};

export function PremioForm({
  lojistaId,
  niveis,
  initialData = null,
  onCreated,
  onCancel,
}: PremioFormProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pontosNecessarios, setPontosNecessarios] = useState("");
  const [nivelMinimoId, setNivelMinimoId] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    setNome(initialData?.nome ?? "");
    setDescricao(initialData?.descricao ?? "");
    setPontosNecessarios(
      initialData?.pontosNecessarios != null
        ? String(initialData.pontosNecessarios)
        : ""
    );
    setNivelMinimoId(initialData?.nivelMinimoId ?? "");
    setAtivo(initialData?.ativo ?? true);
  }, [initialData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const pontos = Number(pontosNecessarios);

      if (!nome.trim()) {
        throw new Error("Informe o nome do prêmio.");
      }

      if (!pontos || Number.isNaN(pontos) || pontos <= 0) {
        throw new Error("Informe uma pontuação válida.");
      }

      const response = await authFetch("/api/lojista/premios", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEditing
            ? {
                id: initialData?.id,
                nome,
                descricao,
                pontosNecessarios: pontos,
                nivelMinimoId: nivelMinimoId || null,
                ativo,
              }
            : {
                lojistaId,
                nome,
                descricao,
                pontosNecessarios: pontos,
                nivelMinimoId: nivelMinimoId || null,
                ativo: true,
              }
        ),
      });

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de prêmios não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            (isEditing
              ? "Erro ao atualizar prêmio."
              : "Erro ao cadastrar prêmio.")
        );
      }

      setNome("");
      setDescricao("");
      setPontosNecessarios("");
      setNivelMinimoId("");
      setAtivo(true);

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
            Nome do prêmio
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Desconto de R$ 50"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Descrição
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o prêmio"
            rows={3}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Pontos necessários
          </label>
          <input
            type="number"
            min="1"
            value={pontosNecessarios}
            onChange={(e) => setPontosNecessarios(e.target.value)}
            placeholder="1000"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Nível mínimo
          </label>
          <select
            value={nivelMinimoId}
            onChange={(e) => setNivelMinimoId(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
          >
            <option value="">Sem exigência de nível</option>
            {niveis.map((nivel) => (
              <option key={nivel.id} value={nivel.id}>
                {nivel.nome}
              </option>
            ))}
          </select>
        </div>

        {isEditing ? (
          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              Prêmio ativo
            </label>
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
              : "Cadastrando..."
            : isEditing
            ? "Salvar alterações"
            : "Cadastrar prêmio"}
        </button>
      </div>
    </form>
  );
}