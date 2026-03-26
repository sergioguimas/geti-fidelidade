"use client";

import { ChangeEvent } from "react";
import { Loader2, FileUp, Search } from "lucide-react";

type Props = {
  csv: string;
  onCsvChange: (value: string) => void;
  onAnalyze: (csv?: string) => void;
  loading?: boolean;
};

export function ImportacaoProdutosUploader({
  csv,
  onCsvChange,
  onAnalyze,
  loading = false,
}: Props) {
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    onCsvChange(content);
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2x1 font-semibold uppercase tracking-wide text-zinc">Arquivo ou conteúdo CSV</h2>
          <p className="mt-2 text-sm font-semibold text-zinc-900">
            Selecione um arquivo <span className="font-medium text-zinc-500">.csv</span> ou cole o
            conteúdo abaixo.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white">
          <FileUp className="h-4 w-4" />
          Selecionar CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </div>

      <div className="mt-4">
        <textarea
          value={csv}
          onChange={(e) => onCsvChange(e.target.value)}
          placeholder={`descricao;tetoPercentual;ativo
            Perfume Lily;10;SIM
            Creme Hidratante;7.5;SIM
            Sabonete Luxo;5;NAO`}
          className="min-h-[280px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-zinc-700"
          spellCheck={false}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onAnalyze()}
          disabled={loading}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Analisar CSV
        </button>
      </div>
    </section>
  );
}