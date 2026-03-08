"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Gift,
  UserCircle2,
  Users,
  X,
  Settings,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type MerchantShellProps = {
  children: ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/lojista",
    icon: LayoutDashboard,
  },
  {
    label: "Clientes",
    href: "/lojista/clientes",
    icon: Users,
  },
  {
    label: "Vendas",
    href: "/lojista/compras",
    icon: Receipt,
  },
  {
    label: "Prêmios",
    href: "/lojista/premios",
    icon: Gift,
  },
  {
    label: "Resgates",
    href: "/lojista/resgates",
    icon: Bell,
  },
  {
    label: "Configurações",
    href: "/lojista/configuracoes",
    icon: Settings,
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getPageTitle(pathname: string) {
  if (pathname === "/lojista") return "Dashboard";
  if (pathname.startsWith("/lojista/clientes")) return "Clientes";
  if (pathname.startsWith("/lojista/compras")) return "Compras";
  if (pathname.startsWith("/lojista/premios")) return "Prêmios";
  if (pathname.startsWith("/lojista/resgates")) return "Resgates";
  if (pathname.startsWith("/lojista/perfil")) return "Perfil";
  if (pathname.startsWith("/lojista/configuracoes")) return "Configurações";
  return "Painel";
}

function isActivePath(itemHref: string, pathname: string) {
  if (itemHref === "/lojista") return pathname === itemHref;
  return pathname.startsWith(itemHref);
}

function getInitials(email: string | null) {
  if (!email) return "LG";
  return email.slice(0, 2).toUpperCase();
}

function Sidebar({
  pathname,
  userEmail,
  onNavigate,
  onLogout,
  loggingOut,
}: {
  pathname: string;
  userEmail: string | null;
  onNavigate?: () => void;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
}) {
  return (
    <aside className="flex h-full flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-16 items-center border-b border-zinc-200 px-4">
        <Link
          href="/lojista"
          className="flex items-center gap-3"
          onClick={onNavigate}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white">
            G
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">
              Geti Fidelidade
            </p>
            <p className="truncate text-xs text-zinc-500">Painel do lojista</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href, pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-3 py-3 text-sm transition",
                  active
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </span>

                <ChevronRight
                  className={cn(
                    "h-4 w-4",
                    active ? "text-white/80" : "text-zinc-400"
                  )}
                />
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-3">
        <Link
          href="/lojista/perfil"
          onClick={onNavigate}
          className="mb-3 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 transition hover:bg-zinc-100"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white">
            {getInitials(userEmail)}
          </div>

          <div className="min-w-0">
            <p className="text-xs text-zinc-500">Sessão ativa</p>
            <p className="truncate text-sm font-medium text-zinc-900">
              {userEmail ?? "Usuário lojista"}
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </aside>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden">
      <div className="grid h-16 grid-cols-5">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
                active ? "text-zinc-900" : "text-zinc-500"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-zinc-900")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MerchantShell({ children }: MerchantShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserEmail(user?.email ?? null);
    }

    loadUser();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();

    setLoggingOut(false);
  }

  return (
    <div className="min-h-screen text-zinc-950">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <Sidebar
            pathname={pathname}
            userEmail={userEmail}
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </div>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Geti Fidelidade
                </p>
                <h1 className="truncate text-base font-semibold text-zinc-900">
                  {pageTitle}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/lojista/perfil"
                  className="hidden items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 sm:flex"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-xs font-semibold text-white">
                    {getInitials(userEmail)}
                  </div>
                  <div className="max-w-[180px]">
                    <p className="truncate text-xs text-zinc-500">Perfil</p>
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {userEmail ?? "Usuário lojista"}
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {loggingOut ? "Saindo..." : "Sair"}
                  </span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-6 sm:pb-24 lg:pb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-white/40 backdrop-blur-sm -z-10"></div>
              {children}
            </div>
          </main>
        </div>
      </div>

      <MobileBottomNav pathname={pathname} />

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />

          <div className="absolute left-0 top-0 h-full w-[88%] max-w-[320px] bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  Menu do lojista
                </p>
                <p className="text-xs text-zinc-500">Navegação principal</p>
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <Sidebar
              pathname={pathname}
              userEmail={userEmail}
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
              loggingOut={loggingOut}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}