"use client";

import { useState } from "react";
import { ClienteFormInitialData } from "@/lib/types";
import { authFetch } from "@/lib/api";

type Props = {
  initialData: ClienteFormInitialData;
  onCancel: () => void;
  onCreated: () => void;
};

export function ClienteForm({ initialData, onCancel, onCreated }: Props) {
  const isEditing = !!initialData;

  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [telefone, setTelefone] = useState(initialData?.telefone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [cnpj, setCnpj] = useState(initialData?.cnpj ?? "");
  const [ativo, setAtivo] = useState(initialData?.ativo ?? true);
  const [podeFazerLogin, setPodeFazerLogin] = useState(
    initialData?.podeFazerLogin ?? false
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }

    if (podeFazerLogin && !email.trim()) {
      setError("Para liberar login, informe um email.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        nome: nome.trim(),
        telefone: telefone?.trim() || null,
        email: email?.trim() || null,
        cnpj: cnpj?.trim() || null,
        ativo,
        podeFazerLogin,
      };

      let response: Response;

      if (isEditing) {
        response = await authFetch("/api/lojista/clientes", {
          method: "PATCH",
          body: JSON.stringify({
            id: initialData!.id,
            ...payload,
          }),
        });
      } else {
        response = await authFetch("/api/lojista/clientes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API não retornou um JSON válido.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar cliente.");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold text-white">
        {isEditing ? "Editar cliente" : "Novo cliente"}
      </h2>
      <div className="grid gap-4 lg:grid-cols-2 md:grid-cols-2">
        <div className="md:col-span-2"></div>
          {/* Nome */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-800">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400"
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-800">Telefone</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-800">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400"
            />
          </div>

          {/* CNPJ */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-800">CNPJ</label>
            <input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400"
            />
          </div>

          {/* Ativo na loja */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
            <span className="text-sm font-medium text-zinc-800">Cliente ativo nesta loja</span>
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
          </div>

          {/* Login */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
            <span className="text-sm font-medium text-zinc-800">Permitir login</span>
            <input
              type="checkbox"
              checked={podeFazerLogin}
              onChange={(e) => setPodeFazerLogin(e.target.checked)}
            />
          </div>

          {/* Aviso */}
          {podeFazerLogin && (
            <p className="text-xs text-zinc-500">
              O cliente receberá acesso ao sistema e poderá definir a senha no
              primeiro login.
            </p>
          )}

          {/* Erro */}
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
    </form>
  );
}