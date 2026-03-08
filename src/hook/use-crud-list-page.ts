"use client";

import { useEffect, useMemo, useState } from "react";

type UseCrudListPageParams<TItem> = {
  baseUrl: string;
  searchParamName?: string;
};

export function useCrudListPage<TItem>({
  baseUrl,
  searchParamName = "busca",
}: UseCrudListPageParams<TItem>) {
  const [items, setItems] = useState<TItem[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editingItem, setEditingItem] = useState<TItem | null>(null);

  const queryString = useMemo(() => {
    const separator = baseUrl.includes("?") ? "&" : "?";

    if (!busca.trim()) {
      return baseUrl;
    }

    return `${baseUrl}${separator}${searchParamName}=${encodeURIComponent(
      busca.trim()
    )}`;
  }, [baseUrl, busca, searchParamName]);

  async function loadItems() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(queryString, {
        cache: "no-store",
      });

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar dados.");
      }

      setItems(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, [queryString]);

  function startCreate() {
    setEditingItem(null);
    setOpenForm(true);
  }

  function toggleCreate() {
    if (openForm && !editingItem) {
      setOpenForm(false);
      return;
    }

    startCreate();
  }

  function startEdit(item: TItem) {
    setEditingItem(item);
    setOpenForm(true);
  }

  function closeForm() {
    setEditingItem(null);
    setOpenForm(false);
  }

  async function deleteItem(deleteUrl: string, confirmMessage: string) {
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return false;

    setError(null);

    try {
      const response = await fetch(deleteUrl, {
        method: "DELETE",
      });

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao excluir registro.");
      }

      await loadItems();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      return false;
    }
  }

  return {
    items,
    busca,
    setBusca,
    loading,
    error,
    setError,
    openForm,
    editingItem,
    setEditingItem,
    setOpenForm,
    loadItems,
    startCreate,
    toggleCreate,
    startEdit,
    closeForm,
    deleteItem,
  };
}