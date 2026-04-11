"use client";

import { useEffect, useState } from "react";
import { FileText, Mail, Phone, User, Users, X } from "lucide-react";
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

  useEffect(() => {
    if (!open) {
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

  function handleClose() {
    if (loading) return;
    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <Users className="h-5 w-5 text-zinc-300" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Novo cliente</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Crie um novo cadastro global de cliente usando CPF ou CNPJ como
                identificador principal.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 p-6 md:grid-cols-2">
            <Field label="Nome *" icon={<User className="h-4 w-4" />}>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="admin-input"
                placeholder="Nome do cliente"
              />
            </Field>

            <Field
              label="Documento (CPF ou CNPJ) *"
              icon={<FileText className="h-4 w-4" />}
              description="O sistema mantém um único cadastro por documento."
            >
              <input
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                className="admin-input"
                placeholder="Somente um cadastro por documento"
              />
            </Field>

            <Field label="Telefone" icon={<Phone className="h-4 w-4" />}>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="admin-input"
                placeholder="(00) 00000-0000"
              />
            </Field>

            <Field label="Email" icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="admin-input"
                placeholder="cliente@email.com"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Endereço">
                <input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="admin-input"
                  placeholder="Rua, número, bairro, cidade..."
                />
              </Field>
            </div>
          </div>

          {error ? (
            <div className="px-6 pb-2">
              <div className="rounded-2xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-zinc-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              Depois do cadastro, o cliente poderá ser vinculado a uma ou mais lojas.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60"
              >
                {loading ? "Criando..." : "Criar cliente"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  description,
  icon,
  children,
}: {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
        {icon ? <span className="text-zinc-500">{icon}</span> : null}
        {label}
      </span>
      {children}
      {description ? (
        <span className="mt-2 block text-xs text-zinc-500">{description}</span>
      ) : null}
    </label>
  );
}