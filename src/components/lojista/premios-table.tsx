import type { PremioListItem } from "@/lib/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableCard } from "@/components/ui/table-card";
import { TableEmptyState } from "@/components/ui/table-empty-state";
import { RowActions } from "@/components/ui/row-actions";

type PremiosTableProps = {
  premios: PremioListItem[];
  onEdit: (premio: PremioListItem) => void;
  onDelete: (id: string) => void;
};

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function PremiosTable({
  premios,
  onEdit,
  onDelete,
}: PremiosTableProps) {
  if (!premios.length) {
    return (
      <TableEmptyState
        title="Nenhum prêmio cadastrado"
        description="Cadastre o primeiro prêmio para abrir o fluxo de resgate."
      />
    );
  }

  return (
    <TableCard>
      <table className="min-w-full divide-y divide-zinc-200">
        <thead className="bg-zinc-50">
          <tr className="text-left">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Prêmio
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Pontos
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Nível mínimo
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
          {premios.map((premio, index) => (
            <tr
              key={premio.id}
              className={index % 2 === 0 ? "bg-white hover:bg-zinc-50" : "bg-zinc-50/40 hover:bg-zinc-50"}
            >
              <td className="px-4 py-4 align-middle">
                <div>
                  <p className="font-medium text-zinc-900">{premio.nome}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {premio.descricao || "Sem descrição"}
                  </p>
                </div>
              </td>

              <td className="px-4 py-4 align-middle">
                <span className="inline-flex rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">
                  {formatPoints(premio.pontos_necessarios)} pts
                </span>
              </td>

              <td className="px-4 py-4 align-middle text-sm text-zinc-700">
                {premio.nivel_minimo?.nome ?? "Sem exigência"}
              </td>

              <td className="px-4 py-4 align-middle">
                <StatusBadge status={premio.ativo ? "ativo" : "inativo"} />
              </td>

              <td className="px-4 py-4 align-middle">
                <RowActions
                  onEdit={() => onEdit(premio)}
                  onDelete={() => onDelete(premio.id)}
                  deleteLabel="Inativar"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}