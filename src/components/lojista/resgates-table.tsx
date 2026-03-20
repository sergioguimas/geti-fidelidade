"use client";

import { useState } from "react";
import type { ResgateListItem } from "@/lib/types";
import { TableCard } from "@/components/ui/table-card";
import { TableEmptyState } from "@/components/ui/table-empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { authFetch } from "@/lib/api";

type ResgatesTableProps = {
  resgates: ResgateListItem[];
  onActionDone: () => void | Promise<void>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function mapResgateStatus(status: ResgateListItem["status"]) {
  switch (status) {
    case "pendente":
      return "pendente";
    case "aprovado":
      return "ativo";
    case "recusado":
      return "cancelado";
    case "cancelado":
      return "inativo";
    default:
      return "inativo";
  }
}

export function ResgatesTable({
  resgates,
  onActionDone,
}: ResgatesTableProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(
    resgateId: string,
    status: "aprovado" | "recusado"
  ) {
    setProcessingId(resgateId);
    setError(null);

    try {
      const response = await authFetch("/api/lojista/resgates", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resgateId,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao processar resgate.");
      }

      await onActionDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setProcessingId(null);
    }
  }

  if (!resgates.length) {
    return (
      <TableEmptyState
        title="Nenhum resgate encontrado"
        description="Os pedidos dos clientes aparecerão aqui para aprovação."
      />
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <TableCard>
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Cliente
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Prêmio
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Pontos
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Solicitado em
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Ações
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {resgates.map((resgate, index) => {
              const isProcessing = processingId === resgate.id;
              const canProcess = resgate.status === "pendente";

              return (
                <tr
                  key={resgate.id}
                  className={index % 2 === 0 ? "bg-white hover:bg-zinc-50" : "bg-zinc-50/40 hover:bg-zinc-50"}
                >
                  <td className="px-4 py-4 align-middle">
                    <p className="font-medium text-zinc-900">
                      {resgate.cliente?.nome ?? "Cliente não encontrado"}
                    </p>
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <p className="text-sm text-zinc-800">
                      {resgate.premio?.nome ?? "Prêmio não encontrado"}
                    </p>
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <span className="inline-flex rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">
                      {formatPoints(resgate.pontos_solicitados)} pts
                    </span>
                  </td>

                  <td className="px-4 py-4 align-middle text-sm text-zinc-700">
                    {formatDate(resgate.solicitado_em)}
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <div className="space-y-2">
                      <StatusBadge status={mapResgateStatus(resgate.status)} />

                      {resgate.decidido_em ? (
                        <p className="text-xs text-zinc-500">
                          Decidido em {formatDate(resgate.decidido_em)}
                        </p>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-4 align-middle">
                    {canProcess ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleAction(resgate.id, "aprovado")}
                          disabled={isProcessing}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isProcessing ? "Processando..." : "Aprovar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAction(resgate.id, "recusado")}
                          disabled={isProcessing}
                          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isProcessing ? "Processando..." : "Recusar"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-500">
                        Sem ações disponíveis
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}