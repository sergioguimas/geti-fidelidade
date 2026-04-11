"use client";

import { useEffect, useState } from "react";
import { Building2, Mail, Phone, User, X } from "lucide-react";
import type { AdminLojistaItem } from "./admin-lojistas-page";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (lojista: AdminLojistaItem) => void;
};

export function NovoLojistaDialog({ open, onOpenChange, onCreated }: Props) {
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [email, setEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");

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

    if (!razaoSocial.trim()) {
      setError("Razão social é obrigatória.");
      return;
    }

    if (!cnpj.trim()) {
      setError("CNPJ é obrigatório.");
      return;
    }

    if (!loginEmail.trim()) {
      setError("Email de login é obrigatório.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/lojistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nomeFantasia,
          razaoSocial,
          nomeResponsavel,
          telefone,
          cnpj,
          endereco,
          email,
          loginEmail,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao criar lojista.");
      }

      onCreated(payload.data.lojista);

      setNomeFantasia("");
      setRazaoSocial("");
      setNomeResponsavel("");
      setTelefone("");
      setCnpj("");
      setEndereco("");
      setEmail("");
      setLoginEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar lojista.");
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
      <div className="w-full max-w-4xl rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <Building2 className="h-5 w-5 text-zinc-300" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Novo lojista</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Crie o tenant, registre o responsável inicial e dispare o fluxo de
                definição de senha para o primeiro acesso.
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
            <Field label="Razão Social *">
              <input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                className="admin-input"
                placeholder="Empresa Exemplo LTDA"
              />
            </Field>

            <Field label="Nome Fantasia">
              <input
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                className="admin-input"
                placeholder="Se vazio, usará a razão social"
              />
            </Field>

            <Field label="CNPJ *">
              <input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="admin-input"
                placeholder="00.000.000/0001-00"
              />
            </Field>

            <Field label="Nome do responsável" icon={<User className="h-4 w-4" />}>
              <input
                value={nomeResponsavel}
                onChange={(e) => setNomeResponsavel(e.target.value)}
                className="admin-input"
                placeholder="Nome do responsável"
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

            <Field
              label="Email do responsável"
              icon={<Mail className="h-4 w-4" />}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="admin-input"
                placeholder="responsavel@empresa.com"
              />
            </Field>

            <div className="md:col-span-2">
              <Field
                label="Email de login *"
                description="Será o email usado para receber o convite e definir a senha."
              >
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="admin-input"
                  placeholder="login@empresa.com"
                />
              </Field>
            </div>

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
              Após o cadastro, o sistema poderá enviar o convite por WhatsApp e email.
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
                {loading ? "Criando..." : "Criar lojista"}
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