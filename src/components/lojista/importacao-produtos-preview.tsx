"use client";

import { Loader2, AlertTriangle, CheckCircle2, RefreshCcw, PlusCircle } from "lucide-react";

type PreviewNovo = {
  linha: number;
  descricao: string;
  tetoPercentual: number;
  ativo: boolean;
};

type PreviewDuplicado = {
  linha: number;
  descricao: string;
  tetoPercentual: number;
  ativo: boolean;
  existente: {
    id: string;
    descricao: string;
    tetoPercentual: number;
    ativo: boolean;
  };
};

type PreviewInvalido = {
  linha: number;
  descricaoOriginal?: string;
  motivo: string;
};

type PreviewResult = {
  novos: PreviewNovo[];
  duplicados: PreviewDuplicado[];
  invalidos: PreviewInvalido[];
  resumo: {
    totalLinhas: number;
    novos: number;
    duplicados: number;
    invalidos: number;
  };
};

type Props = {
  preview: PreviewResult;
  duplicadosSelecionados: Record<string, boolean>;
  onToggleDuplicado: (id: string) => void;
  onMarcarTodosDuplicados: (value: boolean) => void;
  onConfirm: () => void;
  loadingConfirm?: boolean;
  totalSelecionadosParaAtualizar: number;
};

function BoolBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        value
          ? "bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-900/60"
          : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700"
      }`}
    >
      {value ? "Ativo" : "Inativo"}
    </span>
  );
}

export function ImportacaoProdutosPreview({
  preview,
  duplicadosSelecionados,
  onToggleDuplicado,
  onMarcarTodosDuplicados,
  onConfirm,
  loadingConfirm = false,
  totalSelecionadosParaAtualizar,
}: Props) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-base font-semibold text-white">Resumo da análise</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Linhas analisadas</p>
            <p className="mt-2 text-2xl font-semibold text-white">{preview.resumo.totalLinhas}</p>
          </div>

          <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-400/70">Novos</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">{preview.resumo.novos}</p>
          </div>

          <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-400/70">Duplicados</p>
            <p className="mt-2 text-2xl font-semibold text-amber-300">
              {preview.resumo.duplicados}
            </p>
          </div>

          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-4">
            <p className="text-xs uppercase tracking-wide text-red-400/70">Inválidos</p>
            <p className="mt-2 text-2xl font-semibold text-red-300">
              {preview.resumo.invalidos}
            </p>
          </div>
        </div>
      </section>

      {preview.novos.length ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-3">
            <PlusCircle className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Produtos novos</h2>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="px-3 py-3 font-medium">Linha</th>
                  <th className="px-3 py-3 font-medium">Descrição</th>
                  <th className="px-3 py-3 font-medium">Teto %</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.novos.map((item) => (
                  <tr key={`novo-${item.linha}`} className="border-b border-zinc-800/70">
                    <td className="px-3 py-3 text-zinc-400">{item.linha}</td>
                    <td className="px-3 py-3 text-zinc-100">{item.descricao}</td>
                    <td className="px-3 py-3 text-zinc-200">{item.tetoPercentual}</td>
                    <td className="px-3 py-3">
                      <BoolBadge value={item.ativo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {preview.duplicados.length ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <RefreshCcw className="h-5 w-5 text-amber-400" />
              <div>
                <h2 className="text-base font-semibold text-white">Produtos duplicados</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Marque os itens que devem atualizar o cadastro existente.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onMarcarTodosDuplicados(true)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-white"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={() => onMarcarTodosDuplicados(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-white"
              >
                Desmarcar todos
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="px-3 py-3 font-medium">Atualizar</th>
                  <th className="px-3 py-3 font-medium">Linha</th>
                  <th className="px-3 py-3 font-medium">Descrição CSV</th>
                  <th className="px-3 py-3 font-medium">Teto CSV</th>
                  <th className="px-3 py-3 font-medium">Ativo CSV</th>
                  <th className="px-3 py-3 font-medium">Produto existente</th>
                  <th className="px-3 py-3 font-medium">Teto atual</th>
                  <th className="px-3 py-3 font-medium">Status atual</th>
                </tr>
              </thead>
              <tbody>
                {preview.duplicados.map((item) => {
                  const checked = !!duplicadosSelecionados[item.existente.id];

                  return (
                    <tr key={`dup-${item.linha}-${item.existente.id}`} className="border-b border-zinc-800/70">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleDuplicado(item.existente.id)}
                          className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-white"
                        />
                      </td>
                      <td className="px-3 py-3 text-zinc-400">{item.linha}</td>
                      <td className="px-3 py-3 text-zinc-100">{item.descricao}</td>
                      <td className="px-3 py-3 text-zinc-200">{item.tetoPercentual}</td>
                      <td className="px-3 py-3">
                        <BoolBadge value={item.ativo} />
                      </td>
                      <td className="px-3 py-3 text-zinc-100">{item.existente.descricao}</td>
                      <td className="px-3 py-3 text-zinc-300">{item.existente.tetoPercentual}</td>
                      <td className="px-3 py-3">
                        <BoolBadge value={item.existente.ativo} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {preview.invalidos.length ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h2 className="text-base font-semibold text-white">Linhas inválidas</h2>
          </div>

          <div className="mt-4 space-y-2">
            {preview.invalidos.map((item) => (
              <div
                key={`inv-${item.linha}-${item.motivo}`}
                className="rounded-xl border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-200"
              >
                <span className="font-medium">Linha {item.linha}</span>
                {item.descricaoOriginal ? ` · ${item.descricaoOriginal}` : ""} — {item.motivo}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Confirmar importação</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Serão criados <span className="font-medium text-zinc-200">{preview.novos.length}</span>{" "}
              produtos novos e atualizados{" "}
              <span className="font-medium text-zinc-200">{totalSelecionadosParaAtualizar}</span>{" "}
              duplicados selecionados.
            </p>
          </div>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loadingConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingConfirm ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirmar importação
          </button>
        </div>
      </section>
    </div>
  );
}