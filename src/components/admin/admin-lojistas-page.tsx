"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  KeyRound,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { NovoLojistaDialog } from "./novo-lojista-dialog";

export type AdminLojistaItem = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  nome_responsavel: string | null;
  telefone: string | null;
  cnpj: string | null;
  endereco: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string | null;

  convite_enviado_em?: string | null;
  convite_expira_em?: string | null;
  ativado_em?: string | null;
  ultimo_envio_status?: "pendente" | "enviado" | "falhou" | null;
};

type Props = {
  initialLojistas: AdminLojistaItem[];
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusConviteLabel(item: AdminLojistaItem) {
  if (item.ativado_em) return "Ativado";
  if (item.ultimo_envio_status === "falhou") return "Falha no envio";
  if (item.convite_enviado_em) return "Convite enviado";
  return "Pendente";
}

function statusConviteClass(item: AdminLojistaItem) {
  if (item.ativado_em) {
    return "bg-emerald-950/70 text-emerald-300 ring-emerald-900/60";
  }

  if (item.ultimo_envio_status === "falhou") {
    return "bg-red-950/40 text-red-300 ring-red-900/60";
  }

  if (item.convite_enviado_em) {
    return "bg-amber-950/50 text-amber-300 ring-amber-900/60";
  }

  return "bg-zinc-800 text-zinc-300 ring-zinc-700";
}

export function AdminLojistasPage({ initialLojistas }: Props) {
  const [lojistas, setLojistas] = useState(initialLojistas);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [inviteLoadingId, setInviteLoadingId] = useState<string | null>(null);
  const [openNovo, setOpenNovo] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resumo = useMemo(() => {
    const total = lojistas.length;
    const ativos = lojistas.filter((item) => item.ativo).length;
    const bloqueados = total - ativos;
    const ativados = lojistas.filter((item) => item.ativado_em).length;

    return { total, ativos, bloqueados, ativados };
  }, [lojistas]);

  const filteredLojistas = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return lojistas;

    return lojistas.filter((item) =>
      [
        item.nome_fantasia,
        item.razao_social,
        item.nome_responsavel,
        item.telefone,
        item.email,
        item.cnpj,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [lojistas, query]);

  async function handleToggleStatus(item: AdminLojistaItem) {
    setError(null);
    setSuccess(null);
    setLoadingId(item.id);

    try {
      const response = await fetch(`/api/admin/lojistas/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ativo: !item.ativo,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar status do lojista.");
      }

      setLojistas((current) =>
        current.map((lojista) =>
          lojista.id === item.id ? { ...lojista, ativo: !lojista.ativo } : lojista
        )
      );

      setSuccess(
        item.ativo
          ? "Lojista bloqueado com sucesso."
          : "Lojista ativado com sucesso."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao atualizar status do lojista."
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReenviarConvite(item: AdminLojistaItem) {
    setError(null);
    setSuccess(null);
    setInviteLoadingId(item.id);

    try {
      const res = await fetch("/api/admin/lojistas/reenviar-convite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lojistaId: item.id }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || "Erro ao reenviar convite.");
      }

      setLojistas((current) =>
        current.map((lojista) =>
          lojista.id === item.id
            ? {
                ...lojista,
                convite_enviado_em: new Date().toISOString(),
                ultimo_envio_status: "enviado",
              }
            : lojista
        )
      );

      setSuccess("Convite reenviado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reenviar convite.");
    } finally {
      setInviteLoadingId(null);
    }
  }

  function handleCreated(lojista: AdminLojistaItem) {
    setLojistas((current) => [lojista, ...current]);
    setOpenNovo(false);
    setError(null);
    setSuccess("Lojista criado com sucesso.");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <Building2 className="h-6 w-6 text-zinc-300" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-white">Lojistas</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                Cadastre novos tenants, acompanhe convites, monitore a ativação dos
                acessos e controle o status operacional dos lojistas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenNovo(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Novo lojista
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Total de lojistas</p>
          <p className="mt-2 text-2xl font-semibold text-white">{resumo.total}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Ativos</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            {resumo.ativos}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Bloqueados</p>
          <p className="mt-2 text-2xl font-semibold text-red-300">
            {resumo.bloqueados}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Ativados</p>
          <p className="mt-2 text-2xl font-semibold text-blue-300">
            {resumo.ativados}
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Gestão de lojistas</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Busque, acompanhe e execute ações operacionais sem sair do painel.
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, CNPJ, email ou telefone"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-zinc-700"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="px-3 py-3 font-medium">Lojista</th>
                <th className="px-3 py-3 font-medium">Responsável</th>
                <th className="px-3 py-3 font-medium">Contato</th>
                <th className="px-3 py-3 font-medium">Operação</th>
                <th className="px-3 py-3 font-medium">Ativação</th>
                <th className="px-3 py-3 font-medium">Convite</th>
                <th className="px-3 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {filteredLojistas.map((lojista) => (
                <tr key={lojista.id} className="border-b border-zinc-800/70 align-top">
                  <td className="px-3 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-100">
                        {lojista.nome_fantasia || lojista.razao_social || "-"}
                      </span>
                      <span className="text-zinc-400">
                        {lojista.razao_social || "-"}
                      </span>
                      <span className="mt-1 text-xs text-zinc-500">
                        CNPJ: {lojista.cnpj || "-"}
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-4 text-zinc-300">
                    {lojista.nome_responsavel || "-"}
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex flex-col text-zinc-300">
                      <span>{lojista.telefone || "-"}</span>
                      <span className="text-zinc-500">{lojista.email || "-"}</span>
                    </div>
                  </td>

                  <td className="px-3 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                        lojista.ativo
                          ? "bg-emerald-950/70 text-emerald-300 ring-emerald-900/60"
                          : "bg-red-950/40 text-red-300 ring-red-900/60"
                      }`}
                    >
                      {lojista.ativo ? "Ativo" : "Bloqueado"}
                    </span>
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusConviteClass(
                          lojista
                        )}`}
                      >
                        {statusConviteLabel(lojista)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        Ativado em: {formatDate(lojista.ativado_em)}
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex flex-col gap-1 text-xs text-zinc-400">
                      <span>Último envio: {formatDate(lojista.convite_enviado_em)}</span>
                      <span>Expira em: {formatDate(lojista.convite_expira_em)}</span>
                    </div>
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex justify-end">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(lojista)}
                          disabled={loadingId === lojista.id}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition disabled:opacity-60 ${
                            lojista.ativo
                              ? "border border-red-900/60 bg-red-950/30 text-red-200 hover:bg-red-950/50"
                              : "border border-emerald-900/60 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-950/50"
                          }`}
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          {loadingId === lojista.id
                            ? "Salvando..."
                            : lojista.ativo
                            ? "Bloquear"
                            : "Ativar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReenviarConvite(lojista)}
                          disabled={inviteLoadingId === lojista.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-blue-900/60 bg-blue-950/30 px-3 py-2 text-xs font-medium text-blue-200 transition hover:bg-blue-950/50 disabled:opacity-60"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          {inviteLoadingId === lojista.id
                            ? "Enviando..."
                            : "Reenviar link"}
                        </button>

                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-500 opacity-60"
                          title="Implementar quando existir rota de redefinição administrativa"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Nova senha
                        </button>

                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-500 opacity-60"
                          title="Implementar acompanhamento detalhado de envio"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Acompanhar envio
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredLojistas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-zinc-500">
                    Nenhum lojista encontrado para o filtro informado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 p-5">
        <div className="flex items-start gap-3">
          <UserCheck className="mt-0.5 h-5 w-5 text-zinc-400" />
          <div>
            <h3 className="text-sm font-medium text-white">Próximas evoluções</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Quando você adicionar os campos de convite e ativação no backend,
              esta tela já está preparada para exibir histórico de envio, expiração
              do link, confirmação de primeiro acesso e ações mais avançadas.
            </p>
          </div>
        </div>
      </section>

      <NovoLojistaDialog
        open={openNovo}
        onOpenChange={setOpenNovo}
        onCreated={handleCreated}
      />
    </div>
  );
}