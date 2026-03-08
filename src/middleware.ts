import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
          res.cookies.set(name, "", options);
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthPage = req.nextUrl.pathname.startsWith("/login");
  const isProtected = req.nextUrl.pathname.startsWith("/lojista");

  if (!session && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/lojista", req.url));
  }

  if (!session && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/", "/login", "/lojista/:path*"],
};