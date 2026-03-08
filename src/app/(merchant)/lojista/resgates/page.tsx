"use client";

import { useEffect } from "react";
import { useCrudListPage } from "@/hook/use-crud-list-page";
import { PageToolbar } from "@/components/crud/page-toolbar";
import { PageSearch } from "@/components/crud/page-search";
import { PageFeedback } from "@/components/crud/page-feedback";
import { ResgatesTable } from "@/components/lojista/resgates-table";
import type { ResgateListItem } from "@/lib/types";

const LOJISTA_ID = "9f2a1cb4-f2cc-41be-b4ae-3af0d61863c2";

export default function ResgatesPage() {
  const {
    items: resgates,
    busca,
    setBusca,
    loading,
    error,
    loadItems,
  } = useCrudListPage<ResgateListItem>({
    baseUrl: `/api/lojista/resgates?lojistaId=${LOJISTA_ID}`,
  });

  useEffect(() => {
    loadItems();
  }, []);

  return (
    <div className="fundo">
      <PageToolbar
        title="Resgates"
        description="Aprove ou recuse as solicitações de resgate dos clientes."
        action={null}
      />

      <PageSearch
        value={busca}
        onChange={setBusca}
        placeholder="Buscar por cliente ou prêmio"
      />

      <PageFeedback error={error} />

      <section>
        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm">
            Carregando resgates...
          </div>
        ) : (
          <ResgatesTable resgates={resgates} onActionDone={loadItems} />
        )}
      </section>
    </div>
  );
}