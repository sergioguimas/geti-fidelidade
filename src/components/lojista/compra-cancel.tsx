"use client";

import type { CompraCancelamentoPreview } from "@/lib/types";

type CancelCompraModalProps = {
  open: boolean;
  preview: CompraCancelamentoPreview | null;
  compraLabel?: string;
  loadingPreview?: boolean;
  loadingConfirm?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function CancelCompraModal({
  open,
  preview,
  compraLabel,
  loadingPreview = false,
  loadingConfirm = false,
  onClose,
  onConfirm,
}: CancelCompraModalProps) {
  if (!open) return null;

  const isBusy = loadingPreview || loadingConfirm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white shadow-2xl">
        <div className="border-b border-zinc-200 px-6 py-5">
          <h3 className="text-lg font-semibold text-zinc-900">
            Confirmar cancelamento da compra
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            {compraLabel || "Revise o impacto antes de confirmar."}
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {loadingPreview || !preview ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
              Carregando análise do cancelamento...
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Pontos gerados
                  </p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900">
                    {formatPoints(preview.pontosGerados)}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Pontos já usados
                  </p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900">
                    {formatPoints(preview.pontosJaUsados)}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Saldo no lote desta compra
                  </p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900">
                    {formatPoints(preview.pontosDisponiveisNoLote)}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Outros lotes disponíveis
                  </p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900">
                    {formatPoints(preview.saldoDisponivelEmOutrosLotes)}
                  </p>
                </div>
              </div>

              {preview.precisaConfirmacaoEspecial ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-amber-900">
                    Esta compra já teve pontos utilizados.
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    Os pontos consumidos serão compensados nos próximos lotes
                    disponíveis em ordem FIFO.
                  </p>

                  {preview.saldoNegativoResultante > 0 ? (
                    <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm font-medium text-red-700">
                      Após a compensação,{" "}
                      {formatPoints(preview.saldoNegativoResultante)} ponto(s)
                      ficarão como saldo negativo do cliente.
                    </p>
                  ) : (
                    <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm font-medium text-emerald-700">
                      Há saldo suficiente em outros lotes para compensar o uso
                      anterior sem gerar saldo negativo.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-700">
                  Esta compra ainda não teve pontos consumidos. O cancelamento
                  apenas invalidará o lote vinculado.
                </div>
              )}

              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                O histórico da compra será mantido. Apenas o status e os efeitos
                sobre os pontos serão revertidos.
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-60"
          >
            Voltar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy || !preview}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loadingConfirm ? "Cancelando..." : "Cancelar compra e compensar"}
          </button>
        </div>
      </div>
    </div>
  );
}