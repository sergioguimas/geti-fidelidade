import Link from "next/link";
import { Building2, Shield, Users } from "lucide-react";

const items = [
  {
    title: "Lojistas",
    description:
      "Gerencie empresas, cadastro de novos tenants e controle de acesso.",
    href: "/admin/lojistas",
    icon: Building2,
  },
  {
    title: "Clientes",
    description:
      "Gerencie os cadastros globais de clientes e acompanhe bloqueios.",
    href: "/admin/clientes",
    icon: Users,
  },
  {
    title: "Admins",
    description:
      "Cadastre, revise e controle os administradores da plataforma.",
    href: "/admin/admins",
    icon: Shield,
  },
];

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">Visão geral</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Use este painel para acompanhar a operação da plataforma, organizar os
          acessos e manter o ambiente pronto para onboarding de novos lojistas.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 transition group-hover:border-zinc-700">
                  <Icon className="h-5 w-5 text-zinc-400 group-hover:text-white" />
                </div>

                <div>
                  <h3 className="text-base font-medium text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}