"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import type { ClienteOption, ProdutoOption } from "@/lib/types";
import { authFetch } from "@/lib/api";

export type CompraFormInitialItem = {
  produtoId: string;
  quantidade: number;
  valorUnitario: number;
  desconto?: number;
};

export type CompraFormInitialData = {
  id: string;
  clienteId: string;
  dataCompra: string;
  descontoTotal?: number;
  itens: CompraFormInitialItem[];
} | null;

type CompraFormProps = {
  clientes: ClienteOption[];
  produtos: ProdutoOption[];
  initialData?: CompraFormInitialData;
  onCreated: () => void | Promise<void>;
  onCancel?: () => void;
};

type ItemForm = {
  id: string;
  produtoId: string;
  quantidade: string;
  valorUnitario: string;
  desconto: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getTodaySaoPauloDateInput() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getCompraDateInput(value: string) {
  const dateOnly = value.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly;
  }

  return getTodaySaoPauloDateInput();
}

function createEmptyItem(): ItemForm {
  return {
    id: crypto.randomUUID(),
    produtoId: "",
    quantidade: "1",
    valorUnitario: "",
    desconto: "",
  };
}

function getProdutoPreco(produto: ProdutoOption | undefined) {
  if (!produto) return "";

  const possibleValue =
    (produto as any).valor ??
    (produto as any).preco ??
    (produto as any).valorUnitario ??
    (produto as any).precoVenda;

  if (
    typeof possibleValue === "number" &&
    Number.isFinite(possibleValue) &&
    possibleValue > 0
  ) {
    return String(possibleValue);
  }

  return "";
}

type SearchableSelectProps<T> = {
  label: string;
  placeholder: string;
  emptyMessage: string;
  options: T[];
  value: string;
  onChange: (value: string) => void;
  getOptionValue: (option: T) => string;
  getOptionLabel: (option: T) => string;
  className?: string;
};

function SearchableSelect<T>({
  label,
  placeholder,
  emptyMessage,
  options,
  value,
  onChange,
  getOptionValue,
  getOptionLabel,
  className = "",
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => getOptionValue(option) === value),
    [options, value, getOptionValue]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return options.slice(0, 12);

    return options
      .filter((option) =>
        getOptionLabel(option).toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 12);
  }, [options, query, getOptionLabel]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open && selectedOption) {
      setQuery(getOptionLabel(selectedOption));
    }

    if (!open && !selectedOption) {
      setQuery("");
    }
  }, [open, selectedOption, getOptionLabel]);

  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-zinc-800">
        {label}
      </label>

      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

          <input
            type="text"
            value={open ? query : selectedOption ? getOptionLabel(selectedOption) : query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);

              if (!e.target.value.trim()) {
                onChange("");
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-10 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />

          {(value || query) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onChange("");
                setOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {open ? (
          <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
            {filteredOptions.length ? (
              <div className="space-y-1">
                {filteredOptions.map((option) => {
                  const optionValue = getOptionValue(option);
                  const optionLabel = getOptionLabel(option);
                  const isSelected = value === optionValue;

                  return (
                    <button
                      key={optionValue}
                      type="button"
                      onClick={() => {
                        onChange(optionValue);
                        setQuery(optionLabel);
                        setOpen(false);
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {optionLabel}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl px-3 py-2 text-sm text-zinc-500">
                {emptyMessage}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CompraForm({
  clientes,
  produtos,
  initialData = null,
  onCreated,
  onCancel,
}: CompraFormProps) {
  const [clienteId, setClienteId] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [descontoTotal, setDescontoTotal] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([createEmptyItem()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    setClienteId(initialData?.clienteId ?? "");
    setDataCompra(
      initialData?.dataCompra
        ? getCompraDateInput(initialData.dataCompra)
        : getTodaySaoPauloDateInput()
    );
    
    setDescontoTotal(
      initialData?.descontoTotal != null && Number.isFinite(initialData.descontoTotal)
        ? String(initialData.descontoTotal)
        : ""
    );

    if (initialData?.itens?.length) {
      setItens(
        initialData.itens.map((item) => ({
          id: crypto.randomUUID(),
          produtoId: item.produtoId ?? "",
          quantidade:
            item.quantidade != null && Number.isFinite(item.quantidade)
              ? String(item.quantidade)
              : "1",
          valorUnitario:
            item.valorUnitario != null && Number.isFinite(item.valorUnitario)
              ? String(item.valorUnitario)
              : "",
          desconto:
            item.desconto != null && Number.isFinite(item.desconto)
              ? String(item.desconto)
              : "",
        }))
      );
    } else {
      setItens([createEmptyItem()]);
    }
  }, [initialData]);

  const clienteSelecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteId),
    [clientes, clienteId]
  );

  const totaisCompra = useMemo(() => {
    const subtotalBruto = itens.reduce((acc, item) => {
      const quantidade = Number(item.quantidade);
      const valorUnitario = Number(item.valorUnitario);

      if (
        Number.isNaN(quantidade) ||
        quantidade <= 0 ||
        Number.isNaN(valorUnitario) ||
        valorUnitario <= 0
      ) {
        return acc;
      }

      return acc + quantidade * valorUnitario;
    }, 0);

    const descontoItens = itens.reduce((acc, item) => {
      const desconto = Number(item.desconto || 0);

      if (Number.isNaN(desconto) || desconto < 0) {
        return acc;
      }

      return acc + desconto;
    }, 0);

    const descontoTotalNumber = Number(descontoTotal || 0);

    const valorLiquido = Math.max(
      subtotalBruto - descontoItens - (Number.isNaN(descontoTotalNumber) ? 0 : descontoTotalNumber),
      0
    );

    return {
      subtotalBruto,
      descontoItens,
      descontoTotal: Number.isNaN(descontoTotalNumber) ? 0 : descontoTotalNumber,
      valorLiquido,
    };
  }, [itens, descontoTotal]);

  const totalCompra = totaisCompra.valorLiquido;

  function updateItem(itemId: string, patch: Partial<ItemForm>) {
    setItens((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    );
  }

  function addItem() {
    setItens((current) => [...current, createEmptyItem()]);
  }

  function removeItem(itemId: string) {
    setItens((current) => {
      if (current.length === 1) {
        return [createEmptyItem()];
      }

      return current.filter((item) => item.id !== itemId);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      if (!clienteId) {
        throw new Error("Selecione um cliente.");
      }

      if (!dataCompra) {
        throw new Error("Informe a data da compra.");
      }

      const normalizedItens = itens.map((item, index) => {
        const quantidadeNumber = Number(item.quantidade);
        const valorUnitarioNumber = Number(item.valorUnitario);
        const descontoNumber = Number(item.desconto || 0);

        if (!item.produtoId) {
          throw new Error(`Selecione o produto do item ${index + 1}.`);
        }

        if (
          !quantidadeNumber ||
          Number.isNaN(quantidadeNumber) ||
          quantidadeNumber <= 0
        ) {
          throw new Error(`Informe uma quantidade válida no item ${index + 1}.`);
        }

        if (
          !valorUnitarioNumber ||
          Number.isNaN(valorUnitarioNumber) ||
          valorUnitarioNumber <= 0
        ) {
          throw new Error(
            `Informe um valor unitário válido no item ${index + 1}.`
          );
        }

        const subtotalBruto = quantidadeNumber * valorUnitarioNumber;

        if (
          Number.isNaN(descontoNumber) ||
          descontoNumber < 0 ||
          descontoNumber > subtotalBruto
        ) {
          throw new Error(
            `Informe um desconto válido no item ${index + 1}.`
          );
        }

        return {
          produtoId: item.produtoId,
          quantidade: quantidadeNumber,
          valorUnitario: valorUnitarioNumber,
          desconto: descontoNumber,
        };
      });

      if (!normalizedItens.length) {
        throw new Error("Adicione pelo menos um item.");
      }

      const descontoTotalNumber = Number(descontoTotal || 0);

      if (
        Number.isNaN(descontoTotalNumber) ||
        descontoTotalNumber < 0
      ) {
        throw new Error("Informe um desconto total válido.");
      }

      const temDescontoIndividual = normalizedItens.some(
        (item) => Number(item.desconto ?? 0) > 0
      );

      if (temDescontoIndividual && descontoTotalNumber > 0) {
        throw new Error(
          "Use desconto por item ou desconto total da nota, não os dois ao mesmo tempo."
        );
      }

      const subtotalBrutoCompra = normalizedItens.reduce(
        (sum, item) => sum + item.quantidade * item.valorUnitario,
        0
      );

      if (descontoTotalNumber > subtotalBrutoCompra) {
        throw new Error(
          "O desconto total não pode ser maior que o subtotal da compra."
        );
      }

      const payload = isEditing
        ? {
            id: initialData?.id,
            clienteId,
            dataCompra,
            origem: "lojista",
            status: "aprovada",
            descontoTotal: descontoTotalNumber,
            itens: normalizedItens,
          }
        : {
            clienteId,
            dataCompra,
            origem: "lojista",
            status: "aprovada",
            descontoTotal: descontoTotalNumber,
            itens: normalizedItens,
          };

      const response = await authFetch("/api/lojista/compras", {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      const text = await response.text();

      let result: any;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de vendas não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            (isEditing
              ? "Erro ao atualizar venda."
              : "Erro ao registrar venda.")
        );
      }

      setClienteId("");
      setItens([createEmptyItem()]);
      setDataCompra(getTodaySaoPauloDateInput());
      setDescontoTotal("");

      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">
              {isEditing ? "Editar venda" : "Novo lançamento"}
            </h3>
          </div>

          <div className="min-w-[160px] rounded-2xl bg-zinc-950 px-4 py-3 text-white">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
              Total da compra
            </p>
            <strong className="mt-1 block text-lg font-semibold">
              {formatCurrency(totalCompra)}
            </strong>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_0.7fr_0.7fr]">
          <SearchableSelect
            label="Cliente"
            placeholder="Digite para buscar um cliente"
            emptyMessage="Nenhum cliente encontrado."
            options={clientes}
            value={clienteId}
            onChange={setClienteId}
            getOptionValue={(cliente) => cliente.id}
            getOptionLabel={(cliente) => cliente.nome}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-800">
              Data da compra
            </label>

            <input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-800">
              Desconto total da nota
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              value={descontoTotal}
              onChange={(e) => setDescontoTotal(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
            />

            <p className="mt-1 text-xs text-zinc-500">
              Será dividido igualmente entre os itens.
            </p>
          </div>
        </div>

        {clienteSelecionado ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            Cliente selecionado:{" "}
            <span className="font-medium text-zinc-900">
              {clienteSelecionado.nome}
            </span>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900">
              Itens da compra
            </h4>
            <p className="mt-1 text-sm text-zinc-500">
              Adicione um ou mais produtos ao lançamento.
            </p>
          </div>

          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <Plus className="h-4 w-4" />
            Adicionar item
          </button>
        </div>

        <div className="space-y-4">
          {itens.map((item, index) => {
            const produtoSelecionado = produtos.find(
              (produto) => produto.id === item.produtoId
            );

            const subtotalBruto = Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
            const desconto = Number(item.desconto || 0);
            const subtotal = Math.max(subtotalBruto - desconto, 0);

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      Item {index + 1}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Subtotal: {formatCurrency(Number.isFinite(subtotal) ? subtotal : 0)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-12">
                  <SearchableSelect
                    label="Produto"
                    placeholder="Digite para buscar um produto"
                    emptyMessage="Nenhum produto encontrado."
                    options={produtos}
                    value={item.produtoId}
                    onChange={(produtoId) => {
                      const produto = produtos.find((p) => p.id === produtoId);

                      updateItem(item.id, {
                        produtoId,
                        valorUnitario:
                          item.valorUnitario && item.valorUnitario.trim()
                            ? item.valorUnitario
                            : getProdutoPreco(produto),
                      });
                    }}
                    getOptionValue={(produto) => produto.id}
                    getOptionLabel={(produto) => produto.descricao}
                    className="md:col-span-4"
                  />

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-zinc-800">
                      Quantidade
                    </label>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantidade}
                      onChange={(e) =>
                        updateItem(item.id, { quantidade: e.target.value })
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-zinc-800">
                      Valor unitário
                    </label>

                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={item.valorUnitario}
                      onChange={(e) =>
                        updateItem(item.id, { valorUnitario: e.target.value })
                      }
                      placeholder="0,00"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-zinc-800">
                      Desconto
                    </label>

                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={item.desconto}
                      onChange={(e) =>
                        updateItem(item.id, { desconto: e.target.value })
                      }
                      placeholder="0,00"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-zinc-800">
                      Total
                    </label>

                    <div className="flex h-[42px] items-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900">
                      {formatCurrency(Number.isFinite(subtotal) ? subtotal : 0)}
                    </div>
                  </div>
                </div>

                {produtoSelecionado ? (
                  <div className="mt-3 text-xs text-zinc-500">
                    Produto selecionado:{" "}
                    <span className="font-medium text-zinc-700">
                      {produtoSelecionado.descricao}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">{itens.length}</span>{" "}
          {itens.length === 1 ? "item" : "itens"} na compra
        </div>

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700"
            >
              Cancelar
            </button>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? isEditing
                ? "Salvando..."
                : "Registrando..."
              : isEditing
              ? "Salvar alterações"
              : "Registrar venda"}
          </button>
        </div>
      </div>
    </form>
  );
}