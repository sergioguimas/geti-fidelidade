"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { AdminClienteItem } from "./admin-clientes-page";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (cliente: AdminClienteItem) => void;
};

export function NovoClienteDialog({ open, onOpenChange, onCreated }: Props) {
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    setError(null);

    if (!nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }

    if (!documento.trim()) {
      setError("Documento é obrigatório.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nome,
          documento,
          telefone,
          email,
          endereco,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao criar cliente.");
      }

      onCreated(payload.data.cliente);

      setNome("");
      setDocumento("");
      setTelefone("");
      setEmail("");
      setEndereco("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cliente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Novo cliente</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Crie um novo cadastro global de cliente com CPF ou CNPJ.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <Field label="Nome *">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input-admin"
              placeholder="Nome do cliente"
            />
          </Field>

          <Field label="Documento (CPF ou CNPJ) *">
            <input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              className="input-admin"
              placeholder="Somente um cadastro por documento"
            />
          </Field>

          <Field label="Telefone">
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="input-admin"
              placeholder="(00) 00000-0000"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-admin"
              placeholder="cliente@email.com"
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Endereço">
              <input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="input-admin"
                placeholder="Rua, número, bairro, cidade..."
              />
            </Field>
          </div>
        </div>

        {error ? <div className="px-6 pb-2 text-sm text-red-400">{error}</div> : null}

        <div className="flex justify-end gap-3 border-t border-zinc-800 px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {loading ? "Criando..." : "Criar cliente"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .input-admin {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(39 39 42);
          background: rgb(9 9 11);
          padding: 0.65rem 0.9rem;
          font-size: 0.875rem;
          color: white;
          outline: none;
        }
        .input-admin:focus {
          border-color: rgb(63 63 70);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-300">{label}</span>
      {children}
    </label>
  );
}