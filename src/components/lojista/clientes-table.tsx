import type { ClienteListItem } from "@/lib/types";
import { StatusBadge } from "../ui/status-badge";
import { RowActions } from "@/components/ui/row-actions";

type ClientesTableProps = {
  clientes: ClienteListItem[];
  onEdit: (cliente: ClienteListItem) => void;
  onDelete: (id: string) => void;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function ClientesTable({ clientes, onEdit, onDelete }: ClientesTableProps) {
  if (!clientes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-zinc-800">
          Nenhum cliente encontrado
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Cadastre o primeiro cliente para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Cliente
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Contato
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Streak
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Saldo
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Última compra
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Ações
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {clientes.map((cliente) => {
              const saldoDisponivel = cliente.fidelidade?.saldo_disponivel ?? 0;
              const saldoPendente = cliente.fidelidade?.saldo_pendente ?? 0;
              const saldoNegativo = cliente.fidelidade?.saldo_negativo ?? 0;

              return (
                <tr key={cliente.id} className="hover:bg-zinc-50/80">
                  <td className="px-4 py-4 align-middle">
                    <StatusBadge status={cliente.fidelidade?.ativo ? "ativo" : "inativo"} />
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div>
                      <p className="font-medium text-zinc-900">{cliente.nome}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {cliente.cnpj || "cnpj não informado"}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <div className="text-sm text-zinc-700">
                      <p>{cliente.telefone || "Sem telefone"}</p>
                      <p className="mt-1 text-zinc-500">
                        {cliente.email || "Sem e-mail"}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-800">
                      {cliente.fidelidade?.streak_atual ?? 0}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-middle">
                    <div className="space-y-2">
                      <div className="inline-flex rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        {formatPoints(saldoDisponivel)} disponíveis
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        {saldoPendente > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">
                            {formatPoints(saldoPendente)} pendentes
                          </span>
                        ) : null }

                        {saldoNegativo > 0 ? (
                          <span className="rounded-full bg-red-50 px-2 py-1 font-medium text-red-700">
                            {formatPoints(saldoNegativo)} negativos
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-middle text-sm text-zinc-700">
                    {formatDate(cliente.fidelidade?.ultima_compra_valida_em)}
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <RowActions
                      onEdit={() => onEdit(cliente)}
                      onDelete={() => onDelete(cliente.id)}
                      deleteLabel="Desativar"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}