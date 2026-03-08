import type { ProgramaNivelConfig } from "@/lib/types";
import { RowActions } from "@/components/ui/row-actions";
import { TableCard } from "@/components/ui/table-card";
import { TableEmptyState } from "@/components/ui/table-empty-state";

type NiveisTableProps = {
  niveis: ProgramaNivelConfig[];
  onEdit: (nivel: ProgramaNivelConfig) => void;
  onDelete: (id: string) => void;
};

export function NiveisTable({
  niveis,
  onEdit,
  onDelete,
}: NiveisTableProps) {
  if (!niveis.length) {
    return (
      <TableEmptyState
        title="Nenhum nível configurado"
        description="Adicione o primeiro nível do programa."
      />
    );
  }

  return (
    <TableCard>
      <table className="min-w-full divide-y divide-zinc-200">
        <thead className="bg-zinc-50">
          <tr className="text-left">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Nome
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Streak
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Conversão
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Teto
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Ordem
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Ações
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-zinc-100">
          {niveis.map((nivel, index) => (
            <tr
              key={nivel.id}
              className={
                index % 2 === 0
                  ? "bg-white hover:bg-zinc-50"
                  : "bg-zinc-50/40 hover:bg-zinc-50"
              }
            >
              <td className="px-4 py-4 align-top font-medium text-zinc-900">
                {nivel.nome}
              </td>
              <td className="px-4 py-4 align-top text-sm text-zinc-700">
                {nivel.streak_min} até {nivel.streak_max ?? "∞"}
              </td>
              <td className="px-4 py-4 align-top text-sm text-zinc-700">
                {nivel.percentual_conversao}%
              </td>
              <td className="px-4 py-4 align-top text-sm text-zinc-700">
                {nivel.teto_pontos_compra} pts
              </td>
              <td className="px-4 py-4 align-top text-sm text-zinc-700">
                {nivel.ordem}
              </td>
              <td className="px-4 py-4 align-top">
                <RowActions
                  onEdit={() => onEdit(nivel)}
                  onDelete={() => onDelete(nivel.id)}
                  deleteLabel="Excluir"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}