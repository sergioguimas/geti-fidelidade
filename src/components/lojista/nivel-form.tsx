"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ProgramaNivelConfig } from "@/lib/types";
import { authFetch } from "@/lib/api";

type NivelFormProps = {
  programaId: string;
  initialData?: ProgramaNivelConfig | null;
  onSaved: () => void | Promise<void>;
  onCancel?: () => void;
};

export function NivelForm({
  programaId,
  initialData = null,
  onSaved,
  onCancel,
}: NivelFormProps) {
  const [nome, setNome] = useState("");
  const [streakMin, setStreakMin] = useState("");
  const [streakMax, setStreakMax] = useState("");
  const [percentualConversao, setPercentualConversao] = useState("");
  const [tetoPontosCompra, setTetoPontosCompra] = useState("");
  const [ordem, setOrdem] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    setNome(initialData?.nome ?? "");
    setStreakMin(initialData?.streak_min != null ? String(initialData.streak_min) : "");
    setStreakMax(
      initialData?.streak_max != null ? String(initialData.streak_max) : ""
    );
    setPercentualConversao(
      initialData?.percentual_conversao != null
        ? String(initialData.percentual_conversao)
        : ""
    );
    setTetoPontosCompra(
      initialData?.teto_pontos_compra != null
        ? String(initialData.teto_pontos_compra)
        : ""
    );
    setOrdem(initialData?.ordem != null ? String(initialData.ordem) : "");
  }, [initialData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...(isEditing ? { id: initialData?.id } : { programaId }),
        nome,
        streakMin: Number(streakMin),
        streakMax: streakMax ? Number(streakMax) : null,
        percentualConversao: Number(percentualConversao),
        tetoPontosCompra: Number(tetoPontosCompra),
        ordem: Number(ordem),
      };

      const response = await authFetch("/api/lojista/configuracoes", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nivel",
          payload,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar nível.");
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
            Nome do nível
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
            Streak mínimo
          </label>
          <input
            type="number"
            min="0"
            value={streakMin}
            onChange={(e) => setStreakMin(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Streak máximo
          </label>
          <input
            type="number"
            min="0"
            value={streakMax}
            onChange={(e) => setStreakMax(e.target.value)}
            placeholder="Deixe vazio para ilimitado"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            % de conversão
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={percentualConversao}
            onChange={(e) => setPercentualConversao(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Teto de pontos por compra
          </label>
          <input
            type="number"
            min="0"
            value={tetoPontosCompra}
            onChange={(e) => setTetoPontosCompra(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Ordem
          </label>
          <input
            type="number"
            min="1"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value)}
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
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700"
          >
            Cancelar
          </button>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Salvando..." : isEditing ? "Salvar alterações" : "Adicionar nível"}
        </button>
      </div>
    </form>
  );
}