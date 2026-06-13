import type { CompraListItem } from "@/lib/types";
import { TableCard } from "@/components/ui/table-card";
import { TableEmptyState } from "@/components/ui/table-empty-state";
import { RowActions } from "@/components/ui/row-actions";
import { StatusBadge } from "@/components/ui/status-badge";

type ComprasTableProps = {
  compras: CompraListItem[];
  onEdit: (compra: CompraListItem) => void;
  onDelete: (compra: CompraListItem) => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string) {
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");

  if (!year || !month || !day) {
    return "Data inválida";
  }

  return `${day}/${month}/${year}`;
}

function mapCompraStatus(status: CompraListItem["status"]) {
  switch (status) {
    case "aprovada":
      return "ativo";
    case "pendente":
      return "pendente";
    case "recusada":
      return "inativo";
    case "cancelada":
      return "cancelado";
    default:
      return "inativo";
  }
}

export function ComprasTable({
  compras,
  onEdit,
  onDelete,
}: ComprasTableProps) {
  if (!compras.length) {
    return (
      <TableEmptyState
        title="Nenhuma venda encontrada"
        description="Registre a primeira venda para começar a pontuar clientes."
      />
    );
  }

  return (
    <TableCard>
      <table className="min-w-full divide-y divide-zinc-200">
        <thead className="bg-zinc-50">
          <tr className="text-left">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Cliente
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Valor
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Pontos
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Data da Venda
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Origem
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
          {compras.map((compra, index) => {
            const canCancel = compra.status !== "cancelada";

            return (
              <tr
                key={compra.id}
                className={
                  index % 2 === 0
                    ? "bg-white hover:bg-zinc-50"
                    : "bg-zinc-50/40 hover:bg-zinc-50"
                }
              >
                <td className="px-4 py-4 align-middle">
                  <p className="font-medium text-zinc-900">
                    {compra.cliente?.nome ?? "Cliente não encontrado"}
                  </p>
                </td>

                <td className="px-4 py-4 align-middle text-sm font-medium text-zinc-900">
                  {formatCurrency(compra.valor_total)}
                </td>

                <td className="px-4 py-4 align-middle">
                  {compra.lote ? (
                    <div
                      className={`inline-flex rounded-xl px-3 py-1 text-sm font-semibold text-white ${
                        compra.lote.pontos_disponiveis === 0
                          ? "bg-red-500"
                          : compra.lote.pontos_disponiveis <
                            compra.lote.pontos_gerados
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    >
                      {compra.lote.pontos_disponiveis} /{" "}
                      {compra.lote.pontos_gerados} pts
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-500">
                      Sem lote gerado
                    </span>
                  )}
                </td>

                <td className="px-4 py-4 align-middle text-sm text-zinc-700">
                  {formatDate(compra.data_compra)}
                </td>

                <td className="px-4 py-4 align-middle text-sm text-zinc-700">
                  {compra.origem === "lojista"
                    ? "Lojista"
                    : compra.origem === "cliente"
                    ? "Cliente"
                    : "Sistema"}
                </td>

                <td className="px-4 py-4 align-middle">
                  <StatusBadge status={mapCompraStatus(compra.status)} />
                </td>

                <td className="px-4 py-4 align-middle">
                  <RowActions
                    onEdit={() => onEdit(compra)}
                    onDelete={() => canCancel && onDelete(compra)}
                    deleteLabel={canCancel ? "Cancelar" : "Cancelada"}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}