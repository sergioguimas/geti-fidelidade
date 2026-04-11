import Link from "next/link";
import { Building2, LayoutGrid, Shield, Users } from "lucide-react";
import { LogoutButton } from "@/components/ui/logout-button";

const navItems = [
  {
    label: "Visão geral",
    href: "/admin",
    icon: LayoutGrid,
  },
  {
    label: "Lojistas",
    href: "/admin/lojistas",
    icon: Building2,
  },
  {
    label: "Clientes",
    href: "/admin/clientes",
    icon: Users,
  },
  {
    label: "Admins",
    href: "/admin/admins",
    icon: Shield,
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                Painel da plataforma
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                Administração Fidelidade
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                Gerencie lojistas, clientes globais e acessos administrativos.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <LogoutButton />
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}