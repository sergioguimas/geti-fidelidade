"use client";

import { useEffect, useState } from "react";
import {
  Trophy,
  Store,
  History,
  Clock3,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type CustomerDashboardData = {
  customer: {
    id: string;
    nome: string;
    pontos_totais: number;
  };
  lojas: Array<{
    loja_id: string;
    loja_nome: string;
    pontos: number;
    nivel: string;
  }>;
  ultimas_pontuacoes: Array<{
    id: string;
    loja_nome: string;
    descricao: string;
    pontos: number;
    data: string;
  }>;
  proximos_a_expirar: Array<{
    id: string;
    loja_nome: string;
    pontos: number;
    expira_em: string;
  }>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function SummaryCardSkeleton() {
  return (
    <div className="glass-card">
      <div className="space-y-2">
        <div className="skeleton h-3 w-28 rounded-full" />
        <div className="skeleton h-10 w-32 rounded-xl" />
        <div className="skeleton h-4 w-40 rounded-full" />
      </div>
    </div>
  );
}

function SectionListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-zinc-200 bg-white/70 p-4"
        >
          <div className="space-y-2">
            <div className="skeleton h-4 w-32 rounded-full" />
            <div className="skeleton h-3 w-48 rounded-full" />
            <div className="skeleton h-3 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LojaCard({
  loja,
}: {
  loja: CustomerDashboardData["lojas"][number];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-zinc-900">
            {loja.loja_nome}
          </p>
          <p className="mt-1 text-sm text-zinc-500">Nível {loja.nivel}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
          <Store className="h-5 w-5 text-zinc-700" />
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="text-sm text-zinc-500">Pontos nesta loja</p>
          <p className="text-2xl font-semibold tracking-tight text-zinc-900">
            {formatNumber(loja.pontos)}
          </p>
        </div>

        <a
          href="/cliente/compras"
          className="flex items-center gap-1 text-sm font-medium text-zinc-700 transition hover:text-zinc-900"
        >
          Ver detalhes
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function UltimasPontuacoesList({
  items,
}: {
  items: CustomerDashboardData["ultimas_pontuacoes"];
}) {
  if (!items.length) {
    return (
      <div className="text-sm text-zinc-500">
        Ainda não há pontuações recentes.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white/70 p-4"
        >
          <div className="min-w-0">
            <p className="font-medium text-zinc-900">{item.loja_nome}</p>
            <p className="truncate text-sm text-zinc-600">{item.descricao}</p>
            <p className="mt-1 text-xs text-zinc-500">{formatDate(item.data)}</p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm text-zinc-500">Pontuado</p>
            <p className="text-base font-semibold text-zinc-900">
              +{formatNumber(item.pontos)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PontosExpirandoList({
  items,
}: {
  items: CustomerDashboardData["proximos_a_expirar"];
}) {
  if (!items.length) {
    return (
      <div className="text-sm text-zinc-500">
        Você não tem pontos próximos de expirar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white/70 p-4"
        >
          <div className="min-w-0">
            <p className="font-medium text-zinc-900">{item.loja_nome}</p>
            <p className="text-sm text-zinc-600">
              Expira em {formatDate(item.expira_em)}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm text-zinc-500">Quantidade</p>
            <p className="text-base font-semibold text-zinc-900">
              {formatNumber(item.pontos)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ClienteDashboardPage() {
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      const response = await fetch(`/api/cliente/dashboard`, {
        cache: "no-store",
      });

      const text = await response.text();

      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("A API da dashboard não retornou JSON válido.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar dashboard.");
      }

      setData(result.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="fundo space-y-4">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {loading || !data ? "Olá!" : `Olá, ${data.customer.nome}`}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Aqui está uma visão rápida da sua pontuação e da sua relação com as lojas participantes.
          </p>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {loading || !data ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <div className="glass-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-500">
                    Pontuação total
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
                    {formatNumber(data.customer.pontos_totais)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Total consolidado entre todas as lojas em que você participa.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white/70 p-3">
                  <Trophy className="h-6 w-6 text-zinc-800" />
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-500">
                    Lojas participantes
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
                    {formatNumber(data.lojas.length)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Programas de fidelidade em que sua conta está ativa atualmente.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white/70 p-3">
                  <Store className="h-6 w-6 text-zinc-800" />
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-zinc-900">
            Suas lojas
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Veja rapidamente seus pontos e seu nível em cada loja participante.
          </p>
        </div>

        {loading || !data ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </div>
        ) : data.lojas.length === 0 ? (
          <div className="text-sm text-zinc-500">
            Você ainda não participa de nenhuma loja.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.lojas.map((loja) => (
              <LojaCard key={loja.loja_id} loja={loja} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Últimas pontuações
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Seus lançamentos de pontos mais recentes.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              <History className="h-5 w-5 text-zinc-700" />
            </div>
          </div>

          {loading || !data ? (
            <SectionListSkeleton />
          ) : (
            <UltimasPontuacoesList items={data.ultimas_pontuacoes} />
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Pontos próximos de expirar
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Acompanhe os pontos que merecem mais atenção.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              <Clock3 className="h-5 w-5 text-zinc-700" />
            </div>
          </div>

          {loading || !data ? (
            <SectionListSkeleton />
          ) : (
            <PontosExpirandoList items={data.proximos_a_expirar} />
          )}
        </div>
      </section>
    </div>
  );
}