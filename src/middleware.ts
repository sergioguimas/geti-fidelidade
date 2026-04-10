import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { buildMiddlewareAuthState } from "@/lib/auth/access";
import type {
  AdminAuthRow,
  ClienteAuthRow,
  LojistaVinculoRow,
} from "@/lib/auth/types";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set(name, value, options);
        },
        remove(name, options) {
          res.cookies.set(name, "", {
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  const isRootPage = pathname === "/";
  const isAuthPage = pathname.startsWith("/login");
  const isAdminRoute = pathname.startsWith("/admin");
  const isLojistaRoute = pathname.startsWith("/lojista");
  const isClienteRoute = pathname.startsWith("/cliente");
  const isPrimeiroAcessoRoute = pathname.startsWith("/primeiro-acesso");

  if (userError || !user) {
    if (isRootPage || isAdminRoute || isLojistaRoute || isClienteRoute || isPrimeiroAcessoRoute) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return res;
  }

  const userId = user.id;

  const [adminResult, lojistaResult, clienteResult] = await Promise.all([
    supabase
      .from("admins_plataforma")
      .select("id")
      .eq("auth_user_id", userId)
      .eq("ativo", true)
      .maybeSingle(),

    supabase
      .from("lojistas_usuarios")
      .select(`
        id,
        lojista_id,
        lojistas (
          id,
          ativo
        )
      `)
      .eq("auth_user_id", userId)
      .maybeSingle(),

    supabase
      .from("clientes")
      .select("id, ativo, pode_fazer_login, auth_user_id")
      .eq("auth_user_id", userId)
      .eq("ativo", true)
      .eq("pode_fazer_login", true)
      .maybeSingle(),
  ]);

  const admin = (adminResult.data ?? null) as AdminAuthRow | null;
  const vinculoLojista = (lojistaResult.data ?? null) as LojistaVinculoRow | null;
  const cliente = (clienteResult.data ?? null) as ClienteAuthRow | null;

  const { isAdmin, isLojista, isCliente, defaultRedirect } =
    buildMiddlewareAuthState({
      admin,
      vinculoLojista,
      cliente,
    });

  const hasKnownProfile = isAdmin || isLojista || isCliente;

  // usuário autenticado, mas sem perfil válido reconhecido
  if (!hasKnownProfile) {
    if (isAuthPage || isPrimeiroAcessoRoute) {
      return res;
    }

    return NextResponse.redirect(new URL("/login?unauthorized=1", req.url));
  }

  const unauthorized = req.nextUrl.searchParams.get("unauthorized");
  const blocked = req.nextUrl.searchParams.get("blocked");

  if (isRootPage) {
    return NextResponse.redirect(new URL(defaultRedirect, req.url));
  }

  if (isAuthPage) {
    if (unauthorized === "1" || blocked === "1") {
      return res;
    }

    return NextResponse.redirect(new URL(defaultRedirect, req.url));
  }
  
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL(defaultRedirect, req.url));
  }

  if (isLojistaRoute && !isLojista) {
    return NextResponse.redirect(new URL(defaultRedirect, req.url));
  }

  if (isClienteRoute && !isCliente) {
    return NextResponse.redirect(new URL(defaultRedirect, req.url));
  }

  if (isAdmin && (isLojistaRoute || isClienteRoute)) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  if (isLojista && (isAdminRoute || isClienteRoute)) {
    return NextResponse.redirect(new URL("/lojista", req.url));
  }

  if (isCliente && (isAdminRoute || isLojistaRoute)) {
    return NextResponse.redirect(new URL("/cliente", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/primeiro-acesso",
    "/admin/:path*",
    "/lojista/:path*",
    "/cliente/:path*",
  ],
};