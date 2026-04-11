"use client";

import { useMemo, useState } from "react";
import {
  Mail,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

type AdminItem = {
  id: string;
  auth_user_id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  created_at: string;
};

type Props = {
  admins: AdminItem[];
  currentUserId: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminsPage({ admins: initialAdmins, currentUserId }: Props) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resumo = useMemo(() => {
    const total = admins.length;
    const ativos = admins.filter((item) => item.ativo).length;
    const cadastradosRecentemente = admins.filter((item) => {
      const createdAt = new Date(item.created_at).getTime();
      const seteDias = 7 * 24 * 60 * 60 * 1000;
      return Date.now() - createdAt <= seteDias;
    }).length;
    const voce = admins.filter((item) => item.auth_user_id === currentUserId).length;

    return {
      total,
      ativos,
      cadastradosRecentemente,
      voce,
    };
  }, [admins, currentUserId]);

  const filteredAdmins = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return admins;

    return admins.filter((item) =>
      [item.nome, item.email]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [admins, query]);

  async function handleCreate() {
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("Email é obrigatório.");
      return;
    }

    setLoadingCreate(true);

    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nome: nome.trim() || null,
          email: email.trim(),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao cadastrar admin.");
      }

      setAdmins((current) => [payload.data, ...current]);
      setNome("");
      setEmail("");
      setSuccess("Administrador cadastrado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar admin.");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setSuccess(null);
    setLoadingDeleteId(id);

    try {
      const response = await fetch(`/api/admin/admins?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao excluir admin.");
      }

      setAdmins((current) => current.filter((item) => item.id !== id));
      setSuccess("Administrador removido com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir admin.");
    } finally {
      setLoadingDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <Shield className="h-6 w-6 text-zinc-300" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-white">Administradores</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Cadastre, acompanhe e remova usuários com acesso ao painel administrativo
              da plataforma, mantendo o controle central do ambiente.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Total de admins</p>
          <p className="mt-2 text-2xl font-semibold text-white">{resumo.total}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Ativos</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            {resumo.ativos}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Criados nos últimos 7 dias</p>
          <p className="mt-2 text-2xl font-semibold text-blue-300">
            {resumo.cadastradosRecentemente}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Seu acesso</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">
            {resumo.voce ? "Ativo" : "-"}
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
        <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[1.2fr_1.8fr]">
          <div>
            <h2 className="text-lg font-semibold text-white">Novo administrador</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Adicione um novo responsável com acesso ao painel da plataforma.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Nome</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-700"
                  placeholder="Nome do administrador"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-700"
                  placeholder="email@dominio.com"
                  type="email"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loadingCreate}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  <UserPlus className="h-4 w-4" />
                  {loadingCreate ? "Cadastrando..." : "Cadastrar admin"}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Admins cadastrados</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Consulte e gerencie os acessos administrativos existentes.
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome ou email"
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-zinc-700"
                />
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-400">
                    <th className="px-3 py-3 font-medium">Administrador</th>
                    <th className="px-3 py-3 font-medium">Contato</th>
                    <th className="px-3 py-3 font-medium">Situação</th>
                    <th className="px-3 py-3 font-medium">Cadastro</th>
                    <th className="px-3 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAdmins.map((admin) => {
                    const isCurrentUser = admin.auth_user_id === currentUserId;

                    return (
                      <tr
                        key={admin.id}
                        className="border-b border-zinc-800/70 align-top"
                      >
                        <td className="px-3 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-100">
                              {admin.nome || "Sem nome informado"}
                            </span>
                            {isCurrentUser ? (
                              <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-zinc-700">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Usuário atual
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2 text-zinc-300">
                            <Mail className="h-4 w-4 text-zinc-500" />
                            <span>{admin.email}</span>
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <span className="rounded-full bg-emerald-950/70 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-900/60">
                            {admin.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>

                        <td className="px-3 py-4 text-zinc-400">
                          {formatDate(admin.created_at)}
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleDelete(admin.id)}
                              disabled={loadingDeleteId === admin.id || isCurrentUser}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isCurrentUser
                                ? "Usuário atual"
                                : loadingDeleteId === admin.id
                                ? "Removendo..."
                                : "Remover"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAdmins.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-10 text-center text-sm text-zinc-500"
                      >
                        Nenhum administrador encontrado para o filtro informado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 p-5">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 text-zinc-400" />
          <div>
            <h3 className="text-sm font-medium text-white">Próximas evoluções</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Depois, você pode adicionar níveis de permissão para admins, trilha de
              auditoria para ações sensíveis e fluxo de convite com ativação inicial,
              no mesmo padrão que começou a aplicar para lojistas.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}