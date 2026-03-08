"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Receipt,
  Gift,
  Bell,
  UsersRound,
} from "lucide-react";
import type {
  DashboardData,
  DashboardRange,
  DashboardSolicitacao,
  DashboardTopCliente,
} from "@/lib/types";
import { StatusBadge } from "@/components/ui/status-badge";

const LOJISTA_ID = "9f2a1cb4-f2cc-41be-b4ae-3af0d61863c2";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapSolicitacaoStatus(status: string) {
  switch (status) {
    case "pendente":
      return "pendente";
    case "aprovado":
      return "ativo";
    case "recusado":
      return "cancelado";
    case "cancelado":
      return "inativo";
    default:
      return "inativo";
  }
}

function RangeButton({
  value,
  current,
  onClick,
  children,
}: {
  value: DashboardRange;
  current: DashboardRange;
  onClick: (value: DashboardRange) => void;
  children: React.ReactNode;
}) {
  const active = value === current;

  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-zinc-900 text-white"
          : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function TopClientesList({ items }: { items: DashboardTopCliente[] }) {
  if (!items.length) {
    return (
      <div className="text-sm text-zinc-500">
        Ainda não há clientes com compras no período.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.cliente_id}
          className="flex items-center justify-between rounded-xl p-3"
        >
          <div className="min-w-0">
            <p className="text-sm text-zinc-500">#{index + 1}</p>
            <p className="truncate font-medium text-zinc-900">{item.nome}</p>
            <p className="text-sm text-zinc-500">
              {item.compras} compra{item.compras > 1 ? "s" : ""}
            </p>
          </div>

          <div className="text-right">
            <p className="font-semibold text-zinc-900">
              {formatCurrency(item.total_gasto)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return <div className={`skeleton ${className}`} />;
}

function SummaryCardSkeleton() {
  return (
    <div className="glass-card">
      <div className="flex w-full items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton h-3 w-24 rounded-full" />
          <div className="skeleton h-8 w-16 rounded-xl" />
        </div>

        <div className="skeleton h-10 w-10 rounded-xl" />
      </div>

      <div className="mt-5 w-full">
        <div className="skeleton h-11 w-32 rounded-xl" />
      </div>
    </div>
  );
}

function MiniStatSkeleton() {
  return (
    <div className="rounded-2xl border border-white/30 bg-white/40 p-5 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col items-center">
        <SkeletonBlock className="skeleton-line w-24" />
        <div className="mt-3">
          <SkeletonBlock className="h-8 w-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function DonutChartSkeleton({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/30 bg-white/25 p-5 shadow-sm backdrop-blur-xl">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
        <div className="flex justify-center">
          <div className="skeleton relative h-44 w-44 rounded-full">
            <div className="absolute inset-[18px] rounded-full bg-white/60" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="skeleton h-14 rounded-xl" />
          <div className="skeleton h-14 rounded-xl" />
          <div className="skeleton h-14 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function SolicitacoesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex items-start justify-between gap-4 rounded-xl bg-white/20 p-3 backdrop-blur"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="skeleton-line w-32" />
            <SkeletonBlock className="skeleton-line-sm w-40" />
            <SkeletonBlock className="skeleton-line-sm w-24" />
          </div>

          <SkeletonBlock className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function NiveisList({
  items,
  total,
}: {
  items: DashboardData["niveis"];
  total: number;
}) {
  if (!items.length) {
    return (
      <div className="text-sm text-zinc-500">
        Ainda não há clientes distribuídos em níveis.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const percent = total > 0 ? (item.quantidade / total) * 100 : 0;

        return (
          <div key={item.nivel} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-900">{item.nivel}</span>
              <span className="text-zinc-500">
                {item.quantidade} ({formatPercent(percent)})
              </span>
            </div>

            <div className="h-2 rounded-full bg-zinc-100">
              <div
                className="h-2 rounded-full bg-zinc-900 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SolicitacoesList({ items }: { items: DashboardSolicitacao[] }) {
  if (!items.length) {
    return (
      <div className="text-sm text-zinc-500">
        Ainda não há solicitações recentes.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-4 rounded-xl p-3"
        >
          <div className="min-w-0">
            <p className="font-medium text-zinc-900">{item.cliente_nome}</p>
            <p className="truncate text-sm text-zinc-600">{item.titulo}</p>
            <p className="mt-1 text-xs text-zinc-500">{formatDate(item.data)}</p>
          </div>

          <StatusBadge status={mapSolicitacaoStatus(item.status)} />
        </div>
      ))}
    </div>
  );
}

function getChartColors(index: number) {
  const colors = [
    "#8b5cf6", // violet-500
    "#18181b", // zinc-900
    "#3f3f46", // zinc-700
    "#71717a", // zinc-500
    "#a1a1aa", // zinc-400
    "#d4d4d8", // zinc-300
    "#22c55e", // green-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#3b82f6", // blue-500
  ];

  return colors[index % colors.length];
}

function DonutChartCard({
  title,
  description,
  items,
  total,
  valueFormatter,
}: {
  title: string;
  description: string;
  items: { label: string; value: number }[];
  total: number;
  valueFormatter?: (value: number) => string;
}) {
  const safeTotal = total > 0 ? total : 0;

  const segments = items
    .filter((item) => item.value > 0)
    .map((item, index) => ({
      ...item,
      color: getChartColors(index),
    }));

  let current = 0;
  const gradientParts = segments.map((item) => {
    const start = current;
    const angle = safeTotal > 0 ? (item.value / safeTotal) * 360 : 0;
    current += angle;
    return `${item.color} ${start}deg ${current}deg`;
  });

  const background =
    gradientParts.length > 0
      ? `conic-gradient(${gradientParts.join(", ")})`
      : "conic-gradient(#e4e4e7 0deg 360deg)";

  return (
    <div className="glass-card">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      {segments.length === 0 ? (
        <div className="rounded-xl p-6 text-sm text-zinc-500">
          Ainda não há dados suficientes para exibir este gráfico.
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-[220px_1fr] lg:items-center">
          <div className="flex justify-center">
            <div
              className="relative h-44 w-44 rounded-full"
              style={{ background }}
            >
              <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Total
                  </p>
                  <p className="mt-1 text-1xl font-semibold text-zinc-900">
                    {valueFormatter ? valueFormatter(safeTotal) : safeTotal}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {segments.map((item) => {
              const percent = safeTotal > 0 ? (item.value / safeTotal) * 100 : 0;

              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 rounded-xl bg-blue-100 px-3 py-3 border"
                >
                  <div className="flex min-w-0 items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-sm font-medium text-zinc-900">
                      {item.label}
                    </span>
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-semibold text-zinc-900">
                      {valueFormatter ? valueFormatter(item.value) : item.value}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {percent.toFixed(1).replace(".", ",")}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LojistaDashboardPage() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      lojistaId: LOJISTA_ID,
      range,
    });

    return params.toString();
  }, [range]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/lojista/dashboard?${queryString}`, {
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
  }, [queryString]);

  const summary = data?.summary;

  return (
    <div className="fundo">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between " >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Visão geral do desempenho do programa de fidelidade.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
            <RangeButton value="7d" current={range} onClick={setRange}>
              7 dias
            </RangeButton>
            <RangeButton value="30d" current={range} onClick={setRange}>
              30 dias
            </RangeButton>
            <RangeButton value="90d" current={range} onClick={setRange}>
              90 dias
            </RangeButton>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !summary ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <div className="glass-card">
              <div className="flex items-center gap-4">
                <p className="text-sm font-semibold text-zinc-500">Clientes Ativos</p>
                <p className="text-3xl font-semibold tracking-tight">
                  {formatNumber(summary.clientes_ativos_programa)}
                </p>
              </div>
              <br></br>
              <a href="/lojista/clientes" className="btn-spring-pro">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                  <UsersRound className="h-5 w-5 text-zinc-700" />
                  <p className="text-sm text-zinc-500">
                    Total:{" "}
                    {formatNumber(summary.clientes_total)}
                  </p>
                </div>
              </a>
            </div>

            <div className="glass-card">
              <div className="flex items-center gap-4">
                  <p className="text-sm font-semibold text-zinc-500">Total Vendas</p>
                  <p className="text-2xl font-semibold tracking-tight">
                    R${formatNumber(summary.vendas_periodo)}
                  </p>
              </div>
              <br></br>
              <a href="/lojista/compras" className="btn-spring-pro">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                  <Receipt className="h-5 w-5 text-zinc-700" />
                  <p className="text-sm text-zinc-500">
                    Vendas:{" "}
                    {formatNumber(summary.compras_periodo)}
                  </p>
                </div>
              </a>
            </div>

            <div className="glass-card">
              <div className="flex items-center gap-4">
                  <p className="text-sm font-semibold text-zinc-500">Pontos em Circulação</p>
                  <p className="text-3xl font-semibold tracking-tight">
                    {formatNumber(summary.pontos_disponiveis)}
                  </p>
              </div>
              <br></br>
              <a href="/lojista/premios" className="btn-spring-pro">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                  <Gift className="h-5 w-5 text-zinc-700" />
                  <p className="text-sm text-zinc-500">
                    Prêmios
                  </p>
                </div>
              </a>
            </div>

            <div className="glass-card">
              <div className="flex items-center gap-4">
                  <p className="text-sm font-semibold text-zinc-500">Resgates pendentes</p>
                  <p className="text-3xl font-semibold tracking-tight">
                    {formatNumber(summary.resgates_pendentes)}
                  </p>
              </div>
              <br></br>
              <a href="/lojista/resgates" className="btn-spring-pro">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                <Bell className="h-5 w-5 text-zinc-700" />
                <p className="text-sm text-zinc-500">
                  Resgates
                </p>
              </div>
              </a>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !summary ? (
          <>
            <MiniStatSkeleton />
            <MiniStatSkeleton />
            <MiniStatSkeleton />
            <MiniStatSkeleton />
          </>
        ) : (
          <>
              <div className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-zinc-500">Ticket médio</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">
                  {formatCurrency(summary.ticket_medio)}
                </p>
              </div>

              <div className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-zinc-500">Taxa de recorrência</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">
                  {formatPercent(summary.taxa_recorrencia)}
                </p>
              </div>

              <div className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-zinc-500">Compras no período</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">
                  {formatNumber(summary.compras_periodo)}
                </p>
              </div>

              <div className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-zinc-500">Prêmios ativos</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">
                  {formatNumber(summary.premios_ativos)}
                </p>
              </div>
              </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <DonutChartSkeleton
              title="Maiores clientes no período"
              description="Participação dos clientes com maior volume de compras."
            />
            <DonutChartSkeleton
              title="Distribuição de níveis"
              description="Como os clientes estão distribuídos entre os níveis atuais."
            />
          </>
        ) : (
          <>
            <DonutChartCard
              title="Maiores clientes no período"
              description="Participação dos clientes com maior volume de compras."
              items={(data?.top_clientes ?? []).map((item) => ({
                label: item.nome,
                value: item.total_gasto,
              }))}
              total={(data?.top_clientes ?? []).reduce(
                (sum, item) => sum + item.total_gasto,
                0
              )}
              valueFormatter={formatCurrency}
            />

            <DonutChartCard
              title="Distribuição de níveis"
              description="Como os clientes estão distribuídos entre os níveis atuais."
              items={(data?.niveis ?? []).map((item) => ({
                label: item.nivel,
                value: item.quantidade,
              }))}
              total={(data?.niveis ?? []).reduce(
                (sum, item) => sum + item.quantidade,
                0
              )}
              valueFormatter={(value) => formatNumber(value)}
            />
          </>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 p-5 bg-white shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">
          Últimas solicitações
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Últimos resgates enviados pelos clientes.
        </p>

        <div className="mt-5">
          {loading ? (
            <SolicitacoesSkeleton />
          ) : (
            <SolicitacoesList items={data?.solicitacoes ?? []} />
          )}
        </div>
      </section>
    </div>
  );
}