"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Search } from "lucide-react";
import { useCrudListPage } from "@/hook/use-crud-list-page";
import { PremioForm } from "@/components/lojista/premio-form";
import { PremiosTable } from "@/components/lojista/premios-table";
import { PageToolbar } from "@/components/crud/page-toolbar";
import { PageSearch } from "@/components/crud/page-search";
import { PageFeedback } from "@/components/crud/page-feedback";
import type { NivelOption, PremioListItem } from "@/lib/types";

const LOJISTA_ID = "9f2a1cb4-f2cc-41be-b4ae-3af0d61863c2";

export default function PremiosPage() {
  const [niveis, setNiveis] = useState<NivelOption[]>([]);
  const [loadingNiveis, setLoadingNiveis] = useState(true);
  const [editingPremio, setEditingPremio] = useState<PremioListItem | null>(null);

  const {
    items: premios,
    busca,
    setBusca,
    loading,
    error,
    setError,
    openForm,
    editingItem,
    toggleCreate,
    startEdit,
    closeForm,
    loadItems,
    deleteItem,
  } = useCrudListPage<PremioListItem>({
    baseUrl: `/api/lojista/premios?lojistaId=${LOJISTA_ID}`,
  });

  async function loadNiveis() {
    setLoadingNiveis(true);

    try {
      const response = await fetch(
        `/api/lojista/premios?lojistaId=${LOJISTA_ID}&mode=niveis`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar níveis.");
      }

      setNiveis(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingNiveis(false);
    }
  }

  useEffect(() => {
    loadNiveis();
  }, []);

  return (
    <div className="fundo">
      <PageToolbar
        title="Prêmios"
        description="Configure o catálogo de recompensas e os níveis mínimos exigidos."
        action={
          <button
            type="button"
            onClick={toggleCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            <Gift className="h-4 w-4" />
            {openForm && !editingItem ? "Fechar cadastro" : "Novo prêmio"}
          </button>
        }
      />

      {openForm ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-zinc-900">
              {editingItem ? "Editar prêmio" : "Cadastro de prêmio"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {editingItem
                ? "Atualize os dados do prêmio selecionado."
                : "Defina quantos pontos são necessários e qual o nível mínimo para resgate."}
            </p>
          </div>

          {loadingNiveis ? (
            <div className="text-sm text-zinc-500">Carregando níveis...</div>
          ) : (
            <PremioForm
              lojistaId={LOJISTA_ID}
              niveis={niveis}
              initialData={
                editingItem
                  ? {
                      id: editingItem.id,
                      nome: editingItem.nome,
                      descricao: editingItem.descricao ?? "",
                      pontosNecessarios: editingItem.pontos_necessarios,
                      nivelMinimoId: editingItem.nivel_minimo_id,
                      ativo: editingItem.ativo,
                    }
                  : null
              }
              onCancel={closeForm}
              onCreated={async () => {
                closeForm();
                await loadItems();
              }}
            />
          )}
        </section>
      ) : null}

      <PageSearch
        value={busca}
        onChange={setBusca}
        placeholder="Buscar prêmio por nome"
      />

      <PageFeedback error={error} />

      <section>
        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm">
            Carregando prêmios...
          </div>
        ) : (
          <PremiosTable
            premios={premios}
            onEdit={startEdit}
            onDelete={(id) =>
              deleteItem(
                `/api/lojista/premios?id=${id}`,
                "Deseja inativar este prêmio?"
              )
            }
          />
        )}
      </section>
    </div>
  );
}