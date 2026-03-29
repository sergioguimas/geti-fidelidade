"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { SearchableSelect } from "../ui/searchable-select";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";


type ProdutoImportRow = {
  descricao: string;
  valor: string;
  ativo: boolean;
};

type PreviewNovo = {
  linha: number;
  descricao: string;
  tetoPercentual: number;
  ativo: boolean;
};

type ProdutoExistenteOption = {
  id: string;
  descricao: string;
  tetoPercentual: number;
  ativo: boolean;
};

type PreviewNovoAssociado = PreviewNovo & {
  associado?: ProdutoExistenteOption | null;
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

type ConfirmResult = {
  sucesso: Array<{
    linha: number;
    descricao: string;
    acao: "criar" | "atualizar";
  }>;
  falhas: Array<{
    linha: number;
    descricao?: string;
    motivo: string;
  }>;
  resumo: {
    processados: number;
    sucesso: number;
    falhas: number;
  };
};

const CSV_HEADER = "descricao;tetoPercentual;ativo";

function createEmptyRow(): ProdutoImportRow {
  return {
    descricao: "",
    valor: "",
    ativo: true,
  };
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeBoolean(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) return true;
  if (["1", "true", "sim", "s", "ativo", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "nao", "não", "n", "inativo", "no"].includes(normalized)) {
    return false;
  }

  return true;
}

function normalizeFloatInput(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? String(parsed) : raw;
}

function normalizeDescricaoComparacao(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsvToRows(text: string): ProdutoImportRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [createEmptyRow()];

  const separator = lines[0].includes(";") ? ";" : ",";
  const firstLineColumns = lines[0].split(separator).map((item) => normalizeHeader(item));

  const hasHeader =
    firstLineColumns.includes("descricao") ||
    firstLineColumns.includes("tetopercentual") ||
    firstLineColumns.includes("valor") ||
    firstLineColumns.includes("ativo");

  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows = dataLines
    .map((line) => {
      const [descricao, valor, ativo] = line.split(separator);

      return {
        descricao: String(descricao ?? "").trim(),
        valor: normalizeFloatInput(valor),
        ativo: normalizeBoolean(ativo),
      };
    })
    .filter((row) => row.descricao || row.valor || row.ativo !== true);

  return rows.length ? rows : [createEmptyRow()];
}

function mapSpreadsheetRowsToProdutoRows(rows: unknown[][]): ProdutoImportRow[] {
  if (!rows.length) return [createEmptyRow()];

  const firstRow = rows[0] ?? [];
  const normalizedHeader = firstRow.map((cell) => normalizeHeader(cell));

  const hasHeader =
    normalizedHeader.includes("descricao") ||
    normalizedHeader.includes("tetopercentual") ||
    normalizedHeader.includes("valor") ||
    normalizedHeader.includes("ativo");

  let descricaoIndex = 0;
  let valorIndex = 1;
  let ativoIndex = 2;

  if (hasHeader) {
    const maybeDescricao = normalizedHeader.findIndex((h) => h === "descricao");
    const maybeValor =
      normalizedHeader.findIndex((h) => h === "valor") >= 0
        ? normalizedHeader.findIndex((h) => h === "valor")
        : normalizedHeader.findIndex((h) => h === "tetopercentual");
    const maybeAtivo = normalizedHeader.findIndex((h) => h === "ativo");

    if (maybeDescricao >= 0) descricaoIndex = maybeDescricao;
    if (maybeValor >= 0) valorIndex = maybeValor;
    if (maybeAtivo >= 0) ativoIndex = maybeAtivo;
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;

  const mapped = dataRows
    .map((row) => ({
      descricao: String(row[descricaoIndex] ?? "").trim(),
      valor: normalizeFloatInput(row[valorIndex]),
      ativo: normalizeBoolean(row[ativoIndex]),
    }))
    .filter((row) => row.descricao || row.valor || row.ativo !== true);

  return mapped.length ? mapped : [createEmptyRow()];
}

function buildCsvFromRows(rows: ProdutoImportRow[]) {
  const validRows = rows.filter((row) => row.descricao.trim() || row.valor.trim());

  const lines = validRows.map((row) =>
    [
      row.descricao.trim(),
      row.valor.trim(),
      row.ativo ? "SIM" : "NAO",
    ].join(";")
  );

  return [CSV_HEADER, ...lines].join("\n");
}

function BoolBadge({ value }: { value: boolean }) {
  return (
    <span>
      {value ? (<div>
                      <CheckCircle2 className="rounded-lg border border-red-900/60 bg-emerald-500 p-1 text-zinc shadow-2xs"/>
                    </div>) : (<div>
                      <AlertCircle className="rounded-lg border border-red-900/60 bg-red-500 p-1 text-zinc shadow-2xs"/>
                    </div>) }
    </span>
  );
}

function ImportacaoProdutosPreview({
  preview,
  previewNovosNaoAssociados,
  previewNovosAssociados,
  produtosExistentes,
  novosAssociados,
  onAssociarNovo,
  onRemoverAssociacaoNovo,
  duplicadosSelecionados,
  onToggleDuplicado,
  onMarcarTodosDuplicados,
  onConfirm,
  loadingConfirm = false,
  totalNovosParaCriar,
  totalAtualizados,
}: {
  preview: PreviewResult;
  previewNovosNaoAssociados: PreviewNovo[];
  previewNovosAssociados: Array<
    PreviewNovo & { associado?: ProdutoExistenteOption | null }
  >;
  produtosExistentes: ProdutoExistenteOption[];
  novosAssociados: Record<number, ProdutoExistenteOption | null>;
  onAssociarNovo: (linha: number, produtoId: string) => void;
  onRemoverAssociacaoNovo: (linha: number) => void;
  duplicadosSelecionados: Record<string, boolean>;
  onToggleDuplicado: (id: string) => void;
  onMarcarTodosDuplicados: (value: boolean) => void;
  onConfirm: () => void;
  loadingConfirm?: boolean;
  totalNovosParaCriar: number;
  totalAtualizados: number;
}) {
  const totalDuplicadosSelecionados = Object.values(
    duplicadosSelecionados
  ).filter(Boolean).length;

  const totalAssociadosParaAtualizar = previewNovosAssociados.length;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-base font-semibold text-zinc-900">
          Resumo da análise
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Linhas analisadas
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {preview.resumo.totalLinhas}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/70 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-400/70">
              Novos
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">
              {totalNovosParaCriar}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-900/40 bg-amber-950/70 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-400/70">
              Atualizações
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-300">
              {totalAtualizados}
            </p>
          </div>

          <div className="rounded-2xl border border-red-900/40 bg-red-950/70 p-4">
            <p className="text-xs uppercase tracking-wide text-red-400/70">
              Inválidos
            </p>
            <p className="mt-2 text-2xl font-semibold text-red-300">
              {preview.resumo.invalidos}
            </p>
          </div>
        </div>
      </section>

      {previewNovosNaoAssociados.length ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-emerald-500" />
            <h2 className="text-base font-semibold text-zinc-900">
              Produtos novos
            </h2>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {previewNovosNaoAssociados.map((item) => (
              <div
                key={`novo-mobile-${item.linha}`}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Linha {item.linha}
                  </span>
                  <BoolBadge value={item.ativo} />
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Descrição</p>
                      <p className="mt-1 text-sm text-zinc-700">{item.descricao}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Teto %</p>
                      <p className="mt-1 text-sm text-zinc-700">{item.tetoPercentual}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-3x1 font-semibold uppercase tracking-wide text-zinc-500">
                      Associar a existente <span className="text-xs font-normal text-zinc-400"> (Vazio para novo)</span>
                    </p>

                    <SearchableSelect
                      placeholder="Buscar produto existente..."
                      emptyMessage="Nenhum produto encontrado."
                      options={produtosExistentes}
                      value={novosAssociados[item.linha]?.id ?? ""}
                      onChange={(produtoId) => {
                        if (!produtoId) {
                          onRemoverAssociacaoNovo(item.linha);
                          return;
                        }

                        onAssociarNovo(item.linha, produtoId);
                      }}
                      getOptionValue={(option) => option.id}
                      getOptionLabel={(option) => option.descricao}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-center text-zinc-600">
                  <th className="px-3 py-3 font-medium">Linha</th>
                  <th className="px-3 py-3 font-medium">Descrição</th>
                  <th className="px-3 py-3 font-medium">Valor</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-left font-medium">
                    Associar a existente
                  </th>
                </tr>
              </thead>

              <tbody>
                {previewNovosNaoAssociados.map((item) => (
                  <tr
                    key={`novo-${item.linha}`}
                    className="border-b border-zinc-200 text-center"
                  >
                    <td className="px-3 py-3 text-zinc-600">{item.linha}</td>
                    <td className="px-3 py-3 text-zinc-600">{item.descricao}</td>
                    <td className="px-3 py-3 text-zinc-600">
                      {item.tetoPercentual}
                    </td>
                    <td className="px-3 py-3">
                      <BoolBadge value={item.ativo} />
                    </td>

                    <td className="px-3 py-3 text-left">
                      <div className="space-y-2">
                        <SearchableSelect
                          placeholder="Buscar produto existente..."
                          emptyMessage="Nenhum produto encontrado."
                          options={produtosExistentes}
                          value={novosAssociados[item.linha]?.id ?? ""}
                          onChange={(produtoId) => {
                            if (!produtoId) {
                              onRemoverAssociacaoNovo(item.linha);
                              return;
                            }

                            onAssociarNovo(item.linha, produtoId);
                          }}
                          getOptionValue={(option) => option.id}
                          getOptionLabel={(option) => option.descricao}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {previewNovosAssociados.length ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-semibold text-zinc-900">
              Produtos para atualização
            </h2>
          </div>

          <p className="mt-2 text-sm text-zinc-600">
            Itens que vieram como “novos”, mas foram identificados como um produto já
            existente.
          </p>

          <div className="mt-4 space-y-3 md:hidden">
            {previewNovosAssociados.map((item) => (
              <div
                key={`novo-associado-mobile-${item.linha}-${item.associado?.id}`}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Linha {item.linha}
                  </span>

                  <button
                    type="button"
                    onClick={() => onRemoverAssociacaoNovo(item.linha)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Voltar
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Descrição importada
                      </p>
                      <div className="mt-1 flex flex-col">
                        <span className="text-sm text-zinc-700">{item.descricao}</span>
                        {item.associado?.descricao &&
                        item.associado.descricao !== item.descricao ? (
                          <span className="text-xs text-amber-600">
                            Corrigido para: {item.associado.descricao}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Valor importado
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        {item.tetoPercentual}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="px-3 py-3 font-medium">Linha</th>
                  <th className="px-3 py-3 font-medium">Descrição importada</th>
                  <th className="px-3 py-3 font-medium">Valor importado</th>
                  <th className="px-3 py-3 font-medium">Descrição atual</th>
                  <th className="px-3 py-3 font-medium">Ação</th>
                </tr>
              </thead>

              <tbody>
                {previewNovosAssociados.map((item) => (
                  <tr
                    key={`novo-associado-${item.linha}-${item.associado?.id}`}
                    className="border-b border-zinc-200"
                  >
                    <td className="px-3 py-3 text-zinc-600">{item.linha}</td>

                    <td className="px-3 py-3 text-zinc-600">
                      <div className="flex flex-col">
                        <span>{item.descricao}</span>
                        {item.associado?.descricao &&
                        item.associado.descricao !== item.descricao ? (
                          <span className="text-xs text-amber-600">
                            Corrigido para: {item.associado.descricao}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-zinc-600">
                      {item.tetoPercentual}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {item.associado?.descricao}
                    </td>

                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onRemoverAssociacaoNovo(item.linha)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Voltar para novo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {preview.duplicados.length ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Produtos duplicados
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Marque os itens para atualizar o cadastro existente.
              </p>
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

          <div className="mt-4 space-y-3 md:hidden">
            {preview.duplicados.map((item) => {
              const checked = !!duplicadosSelecionados[item.existente.id];

              return (
                <div
                  key={`dup-mobile-${item.linha}-${item.existente.id}`}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Linha {item.linha}
                    </span>

                    <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleDuplicado(item.existente.id)}
                        className="h-4 w-4 rounded border-zinc-400"
                      />
                      Atualizar
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Novo registro
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-zinc-700">
                        <p>
                          <span className="font-medium">Descrição:</span>{" "}
                          {item.descricao}
                        </p>
                        <p>
                          <span className="font-medium">Teto:</span>{" "}
                          {item.tetoPercentual}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-700">Status:</span>
                          <BoolBadge value={item.ativo} />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Cadastro existente
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-zinc-700">
                        <p>
                          <span className="font-medium">Descrição:</span>{" "}
                          {item.existente.descricao}
                        </p>
                        <p>
                          <span className="font-medium">Teto:</span>{" "}
                          {item.existente.tetoPercentual}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-700">Status:</span>
                          <BoolBadge value={item.existente.ativo} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="px-3 py-3 font-medium">Atualizar</th>
                  <th className="px-3 py-3 font-medium">Nova descrição</th>
                  <th className="px-3 py-3 font-medium">Novo teto</th>
                  <th className="px-3 py-3 font-medium">Nova situação</th>
                  <th className="px-3 py-3 font-medium">Descrição existente</th>
                  <th className="px-3 py-3 font-medium">Teto atual</th>
                  <th className="px-3 py-3 font-medium">Status atual</th>
                </tr>
              </thead>

              <tbody>
                {preview.duplicados.map((item) => {
                  const checked = !!duplicadosSelecionados[item.existente.id];

                  return (
                    <tr
                      key={`dup-${item.linha}-${item.existente.id}`}
                      className="border-b border-zinc-200"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleDuplicado(item.existente.id)}
                          className="h-4 w-4 rounded border-zinc-400"
                        />
                      </td>
                      <td className="px-3 py-3 text-zinc-600">{item.descricao}</td>
                      <td className="px-3 py-3 text-zinc-600">
                        {item.tetoPercentual}
                      </td>
                      <td className="px-3 py-3">
                        <BoolBadge value={item.ativo} />
                      </td>
                      <td className="px-3 py-3 text-zinc-600">
                        {item.existente.descricao}
                      </td>
                      <td className="px-3 py-3 text-zinc-600">
                        {item.existente.tetoPercentual}
                      </td>
                      <td className="px-3 py-3">
                        <BoolBadge value={item.existente.ativo} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-sm text-zinc-500">
            Duplicados selecionados para atualização:{" "}
            <span className="font-medium text-zinc-700">
              {totalDuplicadosSelecionados}
            </span>
          </div>
        </section>
      ) : null}

      {preview.invalidos.length ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className="text-base font-semibold text-zinc-900">
            Linhas inválidas
          </h2>

          <div className="mt-4 space-y-2">
            {preview.invalidos.map((item) => (
              <div
                key={`inv-${item.linha}-${item.motivo}`}
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <span className="font-medium">Linha {item.linha}</span>
                {item.descricaoOriginal ? ` · ${item.descricaoOriginal}` : ""} —{" "}
                {item.motivo}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Confirmar importação
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Serão criados{" "}
              <span className="font-medium text-zinc-700">
                {totalNovosParaCriar}
              </span>{" "}
              produtos novos e atualizados{" "}
              <span className="font-medium text-zinc-700">
                {totalAtualizados}
              </span>{" "}
              produtos existentes.
            </p>

            {totalAssociadosParaAtualizar > 0 ? (
              <p className="mt-1 text-xs text-zinc-400">
                Desses,{" "}
                <span className="font-medium">{totalAssociadosParaAtualizar}</span>{" "}
                vieram de associação manual/automática de itens inicialmente
                classificados como novos.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loadingConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
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

function ImportacaoProdutosTableEditor({
  rows,
  onRowsChange,
  onAnalyze,
  loading = false,
}: {
  rows: ProdutoImportRow[];
  onRowsChange: (rows: ProdutoImportRow[]) => void;
  onAnalyze: () => void;
  loading?: boolean;
}) {
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalPreenchidas = useMemo(() => {
    return rows.filter((row) => row.descricao.trim() || row.valor.trim()).length;
  }, [rows]);

  function updateRow(
    index: number,
    field: keyof ProdutoImportRow,
    value: string | boolean
  ) {
    const next = [...rows];
    next[index] = {
      ...next[index],
      [field]: value,
    };
    onRowsChange(next);
  }

  function addRow() {
    onRowsChange([...rows, createEmptyRow()]);
  }

  function removeRow(index: number) {
    if (rows.length === 1) {
      onRowsChange([createEmptyRow()]);
      return;
    }

    onRowsChange(rows.filter((_, i) => i !== index));
  }

  function replaceRows(nextRows: ProdutoImportRow[]) {
    onRowsChange(nextRows.length ? nextRows : [createEmptyRow()]);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();

      if (extension === "csv") {
        const text = await file.text();
        replaceRows(parseCsvToRows(text));
      } else if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error("A planilha não possui abas válidas.");
        }

        const sheet = workbook.Sheets[firstSheetName];
        const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: false,
          defval: "",
        });

        replaceRows(mapSpreadsheetRowsToProdutoRows(sheetRows));
      } else {
        throw new Error("Formato inválido. Envie um arquivo CSV, XLS ou XLSX.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível processar o arquivo enviado."
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleAnalyzeClick() {
    setError("");

    const hasAtLeastOneRow = rows.some(
      (row) => row.descricao.trim() || row.valor.trim()
    );

    if (!hasAtLeastOneRow) {
      setError("Preencha ao menos uma linha ou envie um arquivo antes de analisar.");
      return;
    }

    onAnalyze();
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 md:text-xl">
            Tabela de importação
          </h2>

          <p className="mt-1 text-sm text-zinc-600">
            Envie um CSV/planilha ou preencha manualmente a tabela. O sistema gera o
            arquivo final automaticamente.
          </p>

          <p className="mt-1 text-sm text-zinc-600 break-all">
            Cabeçalho esperado do arquivo: {CSV_HEADER}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
            id="importacao-produtos-arquivo"
          />

          <label
            htmlFor="importacao-produtos-arquivo"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
          >
            <FileUp className="h-4 w-4" />
            Importar planilha / CSV
          </label>

          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Novo item
          </button>
        </div>
      </div>

      <div className="mt-4 md:hidden">
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div
              key={index}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Item {index + 1}
                </span>

                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Descrição
                  </label>
                  <input
                    value={row.descricao}
                    onChange={(e) => updateRow(index, "descricao", e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-500"
                    placeholder="Descrição"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Teto de pontuação
                  </label>
                  <input
                    value={row.valor}
                    onChange={(e) => updateRow(index, "valor", e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-500"
                    placeholder="Ex.: 10.50"
                    inputMode="decimal"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">Status</p>
                    <p className="text-xs text-zinc-500">
                      Defina se o produto ficará ativo na importação
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.ativo}
                      onChange={(e) => updateRow(index, "ativo", e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-400"
                    />

                    {row.ativo ? (
                      <CheckCircle2 className="h-6 w-6 rounded-lg border border-emerald-200 bg-emerald-500 p-1 text-white shadow-sm" />
                    ) : (
                      <AlertCircle className="h-6 w-6 rounded-lg border border-red-200 bg-red-500 p-1 text-white shadow-sm" />
                    )}
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase text-zinc-500">
                Descrição
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-zinc-500">
                Teto de pontuação
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-zinc-500">
                Ativo
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-zinc-500">
                Ação
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-zinc-200">
                <td className="px-3 py-3">
                  <input
                    value={row.descricao}
                    onChange={(e) => updateRow(index, "descricao", e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 outline-none transition focus:border-zinc-500"
                    placeholder="Descrição"
                  />
                </td>

                <td className="px-3 py-3">
                  <input
                    value={row.valor}
                    onChange={(e) => updateRow(index, "valor", e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 outline-none transition focus:border-zinc-500"
                    placeholder="Ex.: 10.50"
                    inputMode="decimal"
                  />
                </td>

                <td className="px-3 py-3">
                  <label className="inline-flex items-center gap-3 text-zinc-700">
                    <input
                      type="checkbox"
                      checked={row.ativo}
                      onChange={(e) => updateRow(index, "ativo", e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-400"
                    />

                    {row.ativo ? (
                      <div>
                        <CheckCircle2 className="h-6 w-6 rounded-lg border border-emerald-200 bg-emerald-500 p-1 text-white shadow-sm" />
                      </div>
                    ) : (
                      <div>
                        <AlertCircle className="h-6 w-6 rounded-lg border border-red-200 bg-red-500 p-1 text-white shadow-sm" />
                      </div>
                    )}
                  </label>
                </td>

                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-zinc-500">
          Linhas preenchidas:{" "}
          <span className="font-medium text-zinc-900">{totalPreenchidas}</span>
        </p>

        <button
          type="button"
          onClick={handleAnalyzeClick}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Analisar importação
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}

export function ImportacaoProdutosPage() {
  const [rows, setRows] = useState<ProdutoImportRow[]>([createEmptyRow()]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [produtosExistentes, setProdutosExistentes] = useState<ProdutoExistenteOption[]>([]);
  const [novosAssociados, setNovosAssociados] = useState<Record<number, ProdutoExistenteOption | null>>({});

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const carregouProdutosRef = useRef(false);
  
  const [duplicadosSelecionados, setDuplicadosSelecionados] = useState<Record<string, boolean>>(
    {}
  );

  const totalSelecionadosParaAtualizar = useMemo(
    () => Object.values(duplicadosSelecionados).filter(Boolean).length,
    [duplicadosSelecionados]
  );

  async function handlePreview() {
    setError(null);
    setConfirmResult(null);
    setPreview(null);

    const csvContent = buildCsvFromRows(rows);

    if (!csvContent.trim() || csvContent === CSV_HEADER) {
      setError("Preencha ao menos uma linha antes de analisar.");
      return;
    }

    setLoadingPreview(true);

    try {
      const response = await fetch("/api/lojista/produtos/importar/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ csv: csvContent }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao gerar preview da importação.");
      }

      const data = payload.data as PreviewResult;
      setPreview(data);

      const selecionados: Record<string, boolean> = {};
      for (const item of data.duplicados) {
        selecionados[item.existente.id] = false;
      }
      setDuplicadosSelecionados(selecionados);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar preview.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function carregarProdutosExistentes() {
    const response = await fetch("/api/lojista/produtos", {
      method: "GET",
      credentials: "include",
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Erro ao carregar produtos existentes.");
    }

    const produtos = Array.isArray(payload.data) ? payload.data : [];

    setProdutosExistentes(
      produtos.map((item: any) => ({
        id: item.id,
        descricao: item.descricao,
        tetoPercentual: Number(item.tetoPercentual ?? item.teto_percentual ?? 0),
        ativo: Boolean(item.ativo),
      }))
    );
  }

  useEffect(() => {
    if (carregouProdutosRef.current) return;
    carregouProdutosRef.current = true;

    carregarProdutosExistentes().catch((err) => {
      console.error(err);
    });
  }, []);

  function associarNovoAoExistente(linha: number, produtoId: string) {
    const produto = produtosExistentes.find((item) => item.id === produtoId) ?? null;

    setNovosAssociados((current) => ({
      ...current,
      [linha]: produto,
    }));
  }

  function removerAssociacaoNovo(linha: number) {
    setNovosAssociados((current) => ({
      ...current,
      [linha]: null,
    }));
  }

  function toggleDuplicado(id: string) {
    setDuplicadosSelecionados((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function marcarTodosDuplicados(value: boolean) {
    if (!preview) return;

    const next: Record<string, boolean> = {};
    for (const item of preview.duplicados) {
      next[item.existente.id] = value;
    }
    setDuplicadosSelecionados(next);
  }

  async function handleConfirmarImportacao() {
    if (!preview) return;

    setLoadingConfirm(true);
    setError(null);
    setConfirmResult(null);

    const items = [
    ...previewNovosNaoAssociados.map((item) => ({
      linha: item.linha,
      descricao: item.descricao,
      tetoPercentual: item.tetoPercentual,
      ativo: item.ativo,
      acao: "criar" as const,
    })),

    ...previewNovosAssociados.map((item) => ({
      linha: item.linha,
      id: item.associado!.id,
      descricao: item.associado!.descricao,
      tetoPercentual: item.tetoPercentual,
      ativo: item.ativo,
      acao: "atualizar" as const,
    })),

    ...preview.duplicados
      .filter((item) => duplicadosSelecionados[item.existente.id])
      .map((item) => ({
        linha: item.linha,
        id: item.existente.id,
        descricao: item.descricao,
        tetoPercentual: item.tetoPercentual,
        ativo: item.ativo,
        acao: "atualizar" as const,
      })),
  ];

    if (!items.length) {
      setError("Não há itens selecionados para importar.");
      setLoadingConfirm(false);
      return;
    }

    try {
      const response = await fetch("/api/lojista/produtos/importar/confirmar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ items }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao confirmar importação.");
      }

      setConfirmResult(payload.data as ConfirmResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar importação.");
    } finally {
      setLoadingConfirm(false);
    }
  }

  function baixarModeloCsv() {
    const conteudo =
      "descricao;tetoPercentual;ativo\nPerfume Lily;10;SIM\nCreme Hidratante;7.5;SIM\nSabonete Luxo;5;NAO\n";

    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-importacao-produtos.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  useState(() => {
    return undefined;
  });

  useMemo(() => {
    return undefined;
  }, []);

  const previewNovosNaoAssociados = useMemo(() => {
    if (!preview) return [];
    return preview.novos.filter((item) => !novosAssociados[item.linha]);
  }, [preview, novosAssociados]);

  const previewNovosAssociados = useMemo(() => {
    if (!preview) return [];

    return preview.novos
      .filter((item) => !!novosAssociados[item.linha])
      .map((item) => ({
        ...item,
        associado: novosAssociados[item.linha] ?? null,
      }))
      .filter((item) => item.associado);
  }, [preview, novosAssociados]);

  const totalNovosParaCriar = previewNovosNaoAssociados.length;
  const totalAtualizados = previewNovosAssociados.length;

  return (
    <div className="flex flex-col gap-6 fundo">
      <header className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-4">
          <div className="inline-flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-zinc-300 md:h-6 md:w-6" />
            <h1 className="text-xl font-semibold text-white md:text-2xl">
              Importação de produtos
            </h1>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <p className="max-w-3xl text-sm leading-7 text-zinc-700 md:text-[15px]">
              Envie uma planilha ou preencha a tabela manualmente. O sistema valida os
              dados, identifica novos produtos, detecta duplicados pela descrição e
              permite revisar tudo antes de confirmar.
            </p>

            <button
              type="button"
              onClick={baixarModeloCsv}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white md:w-auto md:self-start"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Baixar modelo
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc bg-zinc-800/80 p-2 md:p-5">
          <div className="grid gap-2 text-sm text-zinc-100 md:grid-cols-3 md:gap-6">
            <div className="md:border-r md:border-zinc-300 md:pr-6 text-center md:text-start">
              <p className="inline-block md:border-b border-zinc-200 font-semibold text-white">
                Status
              </p>
              <p className="mt-2 leading-7 text-zinc-100/95">
                A tabela usa a marcação e o sistema converte automaticamente para
                SIM/NÃO.
              </p>
            </div>

            <div className="border-t border-zinc-300 pt-2 md:border-t-0 text-center md:text-start md:border-r md:pr-6">
              <p className="inline-block md:border-b border-zinc-200 pb-1 font-semibold text-white">
                Detecção de duplicidade
              </p>
              <p className="mt-2 leading-7 text-zinc-100/95">
                A comparação é feita pela descrição normalizada dentro da mesma loja.
              </p>
            </div>

            <div className="border-t border-zinc-300 pt-2 md:border-t-0 text-center md:text-start">
              <p className="inline-block md:border-b border-zinc-200 pb-1 font-semibold text-white">
                Planilhas aceitas
              </p>
              <p className="mt-2 leading-7 text-zinc-100/95">CSV, XLS e XLSX</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4">
        <ImportacaoProdutosTableEditor
          rows={rows}
          onRowsChange={setRows}
          onAnalyze={handlePreview}
          loading={loadingPreview}
        />
      </section>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-900/70 bg-red-950/40 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {preview ? (
      <ImportacaoProdutosPreview
        preview={preview}
        previewNovosNaoAssociados={previewNovosNaoAssociados}
        previewNovosAssociados={previewNovosAssociados}
        produtosExistentes={produtosExistentes}
        novosAssociados={novosAssociados}
        onAssociarNovo={associarNovoAoExistente}
        onRemoverAssociacaoNovo={removerAssociacaoNovo}
        duplicadosSelecionados={duplicadosSelecionados}
        onToggleDuplicado={toggleDuplicado}
        onMarcarTodosDuplicados={marcarTodosDuplicados}
        onConfirm={handleConfirmarImportacao}
        loadingConfirm={loadingConfirm}
        totalNovosParaCriar={totalNovosParaCriar}
        totalAtualizados={totalAtualizados}
      />
    ) : null}

      {confirmResult ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Resultado da importação</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Processados: {confirmResult.resumo.processados} · Sucesso:{" "}
                {confirmResult.resumo.sucesso} · Falhas: {confirmResult.resumo.falhas}
              </p>
            </div>
          </div>

          {confirmResult.falhas.length ? (
            <div className="mt-4 rounded-xl border border-amber-900/70 bg-amber-950/30 p-4">
              <h3 className="text-sm font-medium text-amber-100">Itens com falha</h3>
              <div className="mt-3 space-y-2 text-sm text-amber-200">
                {confirmResult.falhas.map((item) => (
                  <div key={`${item.linha}-${item.descricao ?? "sem-descricao"}`}>
                    Linha {item.linha}
                    {item.descricao ? ` · ${item.descricao}` : ""} — {item.motivo}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}