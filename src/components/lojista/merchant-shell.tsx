"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Boxes,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Users,
  X,
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
  { label: "Dashboard", href: "/lojista", icon: LayoutDashboard },
  { label: "Clientes", href: "/lojista/clientes", icon: Users },
  { label: "Produtos", href: "/lojista/produtos", icon: Boxes },
  { label: "Vendas", href: "/lojista/compras", icon: Receipt },
  { label: "Prêmios", href: "/lojista/premios", icon: Gift },
  { label: "Resgates", href: "/lojista/resgates", icon: Bell },
  { label: "Configurações", href: "/lojista/configuracoes", icon: Settings },
];

const mobilePrimaryNav = [
  "/lojista",
  "/lojista/clientes",
  "/lojista/compras",
  "/lojista/premios",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getPageTitle(pathname: string) {
  if (pathname === "/lojista") return "Dashboard";
  if (pathname.startsWith("/lojista/clientes")) return "Clientes";
  if (pathname.startsWith("/lojista/produtos")) return "Produtos";
  if (pathname.startsWith("/lojista/compras")) return "Vendas";
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
  collapsed = false,
  mobile = false,
  onNavigate,
  onLogout,
  onToggleCollapse,
  loggingOut,
}: {
  pathname: string;
  userEmail: string | null;
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  onLogout: () => Promise<void>;
  onToggleCollapse?: () => void;
  loggingOut: boolean;
}) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-zinc-200 bg-white/95 backdrop-blur transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        mobile ? "w-full" : collapsed ? "w-[72px]" : "w-[200px]"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-zinc-200",
          collapsed && !mobile ? "justify-center px-3" : "justify-between px-4"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center",
            collapsed && !mobile ? "justify-center" : "gap-3"
          )}
        >
          {!mobile ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100"
              aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </button>
          ) : null}

          <Link
            href="/lojista"
            className={cn(
              "flex min-w-0 items-center",
              collapsed && !mobile ? "justify-center" : "gap-3"
            )}
            onClick={onNavigate}
            title={collapsed && !mobile ? "Geti Fidelidade" : undefined}
          >
            <div
              className={cn(
                "min-w-0 overflow-hidden transition-all duration-200",
                collapsed && !mobile
                  ? "w-0 -translate-x-2 opacity-0"
                  : "w-auto translate-x-0 opacity-100 delay-100"
              )}
            >
              <p className="truncate text-sm font-semibold text-zinc-900">
                Geti Fidelidade
              </p>
              <p className="truncate text-xs text-zinc-500">Painel do lojista</p>
            </div>
          </Link>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <div className="space-y-1.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href, pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed && !mobile ? item.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-2xl text-sm transition-all duration-200",
                  collapsed && !mobile
                    ? "justify-center px-2 py-3.5"
                    : "justify-between px-3 py-3.5",
                  active
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <span
                  className={cn(
                    "flex min-w-0 items-center",
                    collapsed && !mobile ? "justify-center" : "gap-3"
                  )}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap transition-all duration-200",
                      collapsed && !mobile
                        ? "w-0 -translate-x-2 opacity-0"
                        : "w-auto translate-x-0 opacity-100 delay-100"
                    )}
                  >
                    {item.label}
                  </span>
                </span>

                {!collapsed || mobile ? (
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5",
                      active ? "text-white/75" : "text-zinc-400"
                    )}
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-3">
        <Link
          href="/lojista/perfil"
          onClick={onNavigate}
          title={collapsed && !mobile ? userEmail ?? "Usuário lojista" : undefined}
          className={cn(
            "mb-3 flex items-center rounded-2xl border border-zinc-200 bg-zinc-50 transition hover:bg-zinc-100",
            collapsed && !mobile ? "justify-center p-2.5" : "gap-3 p-3"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white">
            {getInitials(userEmail)}
          </div>

          <div
            className={cn(
              "min-w-0 overflow-hidden transition-all duration-200",
              collapsed && !mobile
                ? "w-0 -translate-x-2 opacity-0"
                : "w-auto translate-x-0 opacity-100 delay-100"
            )}
          >
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
          title={collapsed && !mobile ? "Sair" : undefined}
          className={cn(
            "flex w-full items-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60",
            collapsed && !mobile
              ? "justify-center px-2 py-3.5"
              : "justify-center gap-2 px-3 py-3.5"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-all duration-200",
              collapsed && !mobile
                ? "w-0 -translate-x-2 opacity-0"
                : "w-auto translate-x-0 opacity-100 delay-100"
            )}
          >
            {loggingOut ? "Saindo..." : "Sair"}
          </span>
        </button>
      </div>
    </aside>
  );
}

function MobileBottomNav({
  pathname,
  onOpenMenu,
}: {
  pathname: string;
  onOpenMenu: () => void;
}) {
  const items = navigation.filter((item) => mobilePrimaryNav.includes(item.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden">
      <div className="grid h-16 grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition",
                active ? "text-zinc-900" : "text-zinc-500"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active && "text-zinc-900")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          <Menu className="h-5 w-5 shrink-0" />
          <span className="truncate">Mais</span>
        </button>
      </div>
    </nav>
  );
}

export function MerchantShell({ children }: MerchantShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => {
    setMounted(true);

    const saved = window.localStorage.getItem("merchant-sidebar-collapsed");
    setDesktopCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(
      "merchant-sidebar-collapsed",
      String(desktopCollapsed)
    );
  }, [desktopCollapsed, mounted]);

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_100%)] text-zinc-950">
      <div className="lg:flex lg:min-h-screen">
        <div
          className="hidden shrink-0 lg:block"
          style={{ width: desktopCollapsed ? 84 : 200 }}
        >
          <Sidebar
            pathname={pathname}
            userEmail={userEmail}
            collapsed={desktopCollapsed}
            onLogout={handleLogout}
            onToggleCollapse={() => setDesktopCollapsed((prev) => !prev)}
            loggingOut={loggingOut}
          />
        </div>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 lg:hidden"
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
            <div className="min-w-0">{children}</div>
          </main>
        </div>
      </div>

      <MobileBottomNav pathname={pathname} onOpenMenu={() => setMobileOpen(true)} />

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />

        <div
          className={cn(
            "absolute left-0 top-0 h-full w-[88%] max-w-[320px] border-r border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Menu do lojista</p>
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
            mobile
            onNavigate={() => setMobileOpen(false)}
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </div>
      </div>
    </div>
  );
}