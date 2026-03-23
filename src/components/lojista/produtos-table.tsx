"use client";

import type { ProdutoListItem } from "@/lib/types";
import { TableCard } from "@/components/ui/table-card";
import { TableEmptyState } from "@/components/ui/table-empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

type ProdutosTableProps = {
  produtos: ProdutoListItem[];
  onEdit: (produto: ProdutoListItem) => void;
  onDelete: (id: string) => void | Promise<void>;
};

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function ProdutosTable({
  produtos,
  onEdit,
  onDelete,
}: ProdutosTableProps) {
  if (!produtos.length) {
    return (
      <TableEmptyState
        title="Nenhum produto cadastrado"
        description="Cadastre os produtos usados nas vendas para liberar o lançamento correto de compras."
      />
    );
  }

  return (
    <TableCard>
      <table className="min-w-full divide-y divide-zinc-200">
        <thead className="bg-zinc-50">
          <tr className="text-left">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Produto
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Teto percentual
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
          {produtos.map((produto, index) => (
            <tr
              key={produto.id}
              className={
                index % 2 === 0
                  ? "bg-white hover:bg-zinc-50"
                  : "bg-zinc-50/40 hover:bg-zinc-50"
              }
            >
              <td className="px-4 py-4 align-middle">
                <div>
                  <p className="font-medium text-zinc-900">{produto.descricao}</p>
                  <p className="text-xs text-zinc-500">
                    Criado em{" "}
                    {new Date(produto.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </td>

              <td className="px-4 py-4 align-middle">
                <span className="inline-flex rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">
                  {formatPercent(produto.teto_percentual)}
                </span>
              </td>

              <td className="px-4 py-4 align-middle">
                <StatusBadge status={produto.ativo ? "ativo" : "inativo"} />
              </td>

              <td className="px-4 py-4 align-middle">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(produto)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(produto.id)}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}