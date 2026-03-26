"use client";

import Link from "next/link";
import { Settings, UploadCloud, Gift } from "lucide-react";

export default function ConfiguracoesPage() {
  const items = [
    {
      title: "Programa de Fidelidade",
      description:
        "Configure regras de pontuação, níveis, prazos e comportamento do programa.",
      href: "/lojista/configuracoes/programa",
      icon: Gift,
    },
    {
      title: "Importação de Produtos",
      description:
        "Importe produtos em lote via CSV para facilitar o cadastro inicial ou atualização.",
      href: "/lojista/configuracoes/importacao",
      icon: UploadCloud,
    },
  ];

  return (
    <div className="flex flex-col gap-6 fundo">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-zinc-600" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Configurações
          </h1>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          Gerencie parâmetros e ferramentas do sistema.
        </p>
      </div>

      {/* Grid de opções */}
      <div className="grid gap-4 md:grid-cols-2 glass-card">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-zinc-800 bg-white p-5 transition-all duration-200 hover:border-zinc-700 hover:bg-blue-900"
            >
              <div className="flex items-start gap-4 ">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition group-hover:border-zinc-700">
                  <Icon className="h-5 w-5 text-white" />
                </div>

                <div className="flex flex-col">
                  <span className="text-base font-semibold text-zinc-900">
                    {item.title}
                  </span>

                  <span className="mt-1 text-sm text-zinc-500">
                    {item.description}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}