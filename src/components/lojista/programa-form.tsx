"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ProgramaFidelidadeConfig } from "@/lib/types";

type ProgramaFormProps = {
  initialData: ProgramaFidelidadeConfig | null;
  onSaved: () => void | Promise<void>;
};

export function ProgramaForm({ initialData, onSaved }: ProgramaFormProps) {
  const [nome, setNome] = useState("");
  const [diasParaPerderStreak, setDiasParaPerderStreak] = useState("");
  const [diasExpiracaoPontos, setDiasExpiracaoPontos] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNome(initialData?.nome ?? "");
    setDiasParaPerderStreak(
      initialData?.dias_para_perder_streak != null
        ? String(initialData.dias_para_perder_streak)
        : ""
    );
    setDiasExpiracaoPontos(
      initialData?.dias_expiracao_pontos != null
        ? String(initialData.dias_expiracao_pontos)
        : ""
    );
    setAtivo(initialData?.ativo ?? true);
  }, [initialData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!initialData?.id) {
      setError("Programa ativo não encontrado.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/lojista/configuracoes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "programa",
          payload: {
            id: initialData.id,
            nome,
            dias_para_perder_streak: Number(diasParaPerderStreak),
            dias_expiracao_pontos: Number(diasExpiracaoPontos),
            ativo,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar programa.");
      }

      await onSaved();
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
            Nome do programa
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Dias para perder streak
          </label>
          <input
            type="number"
            min="1"
            value={diasParaPerderStreak}
            onChange={(e) => setDiasParaPerderStreak(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Dias para expiração dos pontos
          </label>
          <input
            type="number"
            min="1"
            value={diasExpiracaoPontos}
            onChange={(e) => setDiasExpiracaoPontos(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Programa ativo
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar programa"}
        </button>
      </div>
    </form>
  );
}