"use client";

import { FormEvent, useEffect, useState } from "react";

type ClienteFormInitialData = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  cnpj: string;
  ativo?: boolean;
} | null;

type ClienteFormProps = {
  lojistaId: string;
  initialData?: ClienteFormInitialData;
  onCreated: () => void | Promise<void>;
  onCancel?: () => void;
};

export function ClienteForm({
  lojistaId,
  initialData = null,
  onCreated,
  onCancel,
}: ClienteFormProps) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    setNome(initialData?.nome ?? "");
    setTelefone(initialData?.telefone ?? "");
    setEmail(initialData?.email ?? "");
    setCnpj(initialData?.cnpj ?? "");
    setAtivo(initialData?.ativo ?? true);
  }, [initialData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = "/api/lojista/clientes";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEditing
            ? {
                id: initialData?.id,
                nome,
                telefone,
                email,
                cnpj,
                ativo,
              }
            : {
                lojistaId,
                nome,
                telefone,
                email,
                cnpj,
              }
        ),
      });

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API de clientes não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            (isEditing
              ? "Erro ao atualizar cliente."
              : "Erro ao cadastrar cliente.")
        );
      }

      setNome("");
      setTelefone("");
      setEmail("");
      setCnpj("");
      setAtivo(true);

      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Nome
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do cliente"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            Telefone
          </label>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(00) 00000-0000"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            CNPJ
          </label>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-zinc-800">
            E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>

        {isEditing ? (
          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              Cliente ativo
            </label>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

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
              : "Cadastrando..."
            : isEditing
            ? "Salvar alterações"
            : "Cadastrar cliente"}
        </button>
      </div>
    </form>
  );
}