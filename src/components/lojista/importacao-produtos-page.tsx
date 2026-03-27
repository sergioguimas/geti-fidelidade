"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";
import { ImportacaoProdutosUploader } from "./importacao-produtos-uploader";
import { ImportacaoProdutosPreview } from "./importacao-produtos-preview";

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

export function ImportacaoProdutosPage() {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [duplicadosSelecionados, setDuplicadosSelecionados] = useState<Record<string, boolean>>({});

  const totalSelecionadosParaAtualizar = useMemo(
    () => Object.values(duplicadosSelecionados).filter(Boolean).length,
    [duplicadosSelecionados]
  );

  async function handlePreview(nextCsv?: string) {
    const csvContent = (nextCsv ?? csv).trim();

    setError(null);
    setConfirmResult(null);
    setPreview(null);

    if (!csvContent) {
      setError("Cole o conteúdo do CSV ou selecione um arquivo antes de analisar.");
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
      ...preview.novos.map((item) => ({
        linha: item.linha,
        descricao: item.descricao,
        tetoPercentual: item.tetoPercentual,
        ativo: item.ativo,
        acao: "criar" as const,
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

  return (
    <div className="flex flex-col gap-6 fundo">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 glass-card">
        <div className="flex items-center gap-4 ">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <UploadCloud className="h-6 w-6 text-zinc-300" />
          </div>

          <div className="flex-1 ">
            <h1 className="text-3x1 font-semibold text-zinc-500">Importação de produtos</h1>
            <p className="text-sm font-semibold tracking-tight mt-2">
              Importe produtos em lote via CSV. O sistema valida os dados, identifica produtos
              novos, detecta duplicados pela descrição e permite revisar tudo antes de confirmar.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={baixarModeloCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Baixar modelo CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <ImportacaoProdutosUploader
          csv={csv}
          onCsvChange={setCsv}
          onAnalyze={handlePreview}
          loading={loadingPreview}
        />

        <div className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-2x1 font-semibold uppercase tracking-wide text-zinc">
            Regras do arquivo
          </h2>

          <div className="mt-4 space-y-4 text-sm text-zinc-400">
            <div>
              <p className="text-sm text-zinc-500">Colunas obrigatórias</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900">descricao; tetoPercentual; ativo</p>
            </div>

            <div>
              <p className="text-sm text-zinc-500">Separador recomendado</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900">
                Use <span className="text-lg font-bold text-black">;</span> para evitar conflito com
                vírgula decimal.
              </p>
            </div>

            <div>
              <p className="text-sm text-zinc-500">Valores aceitos em ativo</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900">SIM, S, TRUE, 1, ATIVO / NAO, N, FALSE, 0, INATIVO</p>
            </div>

            <div>
              <p className="text-sm text-zinc-500">Detecção de duplicidade</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900">
                A comparação é feita pela descrição normalizada dentro da mesma loja.
              </p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-900/70 bg-red-950/40 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {preview? (<hr></hr>) : null}

      {preview ? (
        <ImportacaoProdutosPreview
          preview={preview}
          duplicadosSelecionados={duplicadosSelecionados}
          onToggleDuplicado={toggleDuplicado}
          onMarcarTodosDuplicados={marcarTodosDuplicados}
          onConfirm={handleConfirmarImportacao}
          loadingConfirm={loadingConfirm}
          totalSelecionadosParaAtualizar={totalSelecionadosParaAtualizar}
        />
      ) : null}

      {confirmResult? (<hr></hr>) : null}

      {confirmResult ? (
        <section className="rounded-2xl p-5 glass-card">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-zinc">Resultado da importação</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Processados: {confirmResult.resumo.processados} - Sucesso:{" "}
                {confirmResult.resumo.sucesso} / Falhas: {confirmResult.resumo.falhas}
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