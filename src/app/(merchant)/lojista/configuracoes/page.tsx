"use client";

import { useEffect, useState } from "react";
import { Settings, Plus } from "lucide-react";
import { ProgramaForm } from "@/components/lojista/programa-form";
import { NivelForm } from "@/components/lojista/nivel-form";
import { NiveisTable } from "@/components/lojista/niveis-table";
import { authFetch } from "@/lib/api";
import type {
  ConfiguracoesData,
  ProgramaNivelConfig,
} from "@/lib/types";

export default function ConfiguracoesPage() {
  const [data, setData] = useState<ConfiguracoesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openNivelForm, setOpenNivelForm] = useState(false);
  const [editingNivel, setEditingNivel] = useState<ProgramaNivelConfig | null>(null);

  async function loadConfiguracoes() {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/lojista/configuracoes`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar configurações.");
      }

      console.log("configuracoes result", result);
      setData(result.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfiguracoes();
  }, []);

  function handleNewNivel() {
    if (openNivelForm && !editingNivel) {
      setOpenNivelForm(false);
      return;
    }

    setEditingNivel(null);
    setOpenNivelForm(true);
  }

  function handleEditNivel(nivel: ProgramaNivelConfig) {
    setEditingNivel(nivel);
    setOpenNivelForm(true);
  }

  function handleCancelNivelForm() {
    setEditingNivel(null);
    setOpenNivelForm(false);
  }

  async function handleDeleteNivel(id: string) {
    const confirmed = window.confirm("Deseja excluir este nível?");
    if (!confirmed) return;

    try {
      const response = await authFetch(`/api/lojista/configuracoes?id=${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao excluir nível.");
      }

      if (editingNivel?.id === id) {
        setEditingNivel(null);
        setOpenNivelForm(false);
      }

      await loadConfiguracoes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  return (
    <div className="fundo">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Ajuste os parâmetros do programa de fidelidade e dos níveis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNewNivel}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          {openNivelForm && !editingNivel ? "Fechar nível" : "Novo nível"}
        </button>
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm">
          Carregando configurações...
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-zinc-700" />
              <h2 className="text-base font-semibold text-zinc-900">
                Programa de fidelidade
              </h2>
            </div>

            <ProgramaForm
              initialData={data?.programa ?? null}
              onSaved={loadConfiguracoes}
            />
          </section>

          {openNivelForm && data?.programa ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-zinc-900">
                  {editingNivel ? "Editar nível" : "Adicionar nível"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Configure a conversão, streak e teto de pontuação do nível.
                </p>
              </div>

              <NivelForm
                programaId={data.programa.id}
                initialData={editingNivel}
                onCancel={handleCancelNivelForm}
                onSaved={async () => {
                  setEditingNivel(null);
                  setOpenNivelForm(false);
                  await loadConfiguracoes();
                }}
              />
            </section>
          ) : null}

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-zinc-900">Níveis</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Faixas de streak, conversão percentual e teto por compra.
              </p>
            </div>

            <NiveisTable
              niveis={data?.niveis ?? []}
              onEdit={handleEditNivel}
              onDelete={handleDeleteNivel}
            />
          </section>
        </>
      )}
    </div>
  );
}