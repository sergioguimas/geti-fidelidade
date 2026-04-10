import Link from "next/link";
import { Building2, Shield, Users } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { LogoutButton } from "@/components/ui/logout-button";

const items = [
  {
    title: "Lojistas",
    description: "Gerencie empresas, cadastro de novos tenants e bloqueio de acesso.",
    href: "/admin/lojistas",
    icon: Building2,
  },
  {
    title: "Clientes",
    description: "Gerencie os cadastros globais de clientes e bloqueio de acesso.",
    href: "/admin/clientes",
    icon: Users,
  },
  {
    title: "Admins",
    description: "Cadastre ou remova administradores com acesso ao painel da plataforma.",
    href: "/admin/admins",
    icon: Shield,
  },
];

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Painel administrativo
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Gerencie tenants, clientes globais e administradores da plataforma.
          </p>
        </div>

        <LogoutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition group-hover:border-zinc-700">
                  <Icon className="h-5 w-5 text-zinc-400 group-hover:text-white" />
                </div>

                <div>
                  <h2 className="text-base font-medium text-white">{item.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}