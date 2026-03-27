import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

function extractAccessTokenFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7);
  }

  return (
    request.cookies.get("sb-access-token")?.value ??
    request.cookies.get("sb-access-token.0")?.value ??
    null
  );
}

async function extractAccessTokenFromCookies() {
  const cookieStore = await cookies();

  return (
    cookieStore.get("sb-access-token")?.value ??
    cookieStore.get("sb-access-token.0")?.value ??
    null
  );
}

function createServerSupabaseWithToken(accessToken: string | null): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Para route handlers e APIs que recebem NextRequest
 */
export function getServerSupabase(request: NextRequest): SupabaseClient {
  const accessToken = extractAccessTokenFromRequest(request);
  return createServerSupabaseWithToken(accessToken);
}

/**
 * Para pages/layouts/server components do App Router
 */
export async function getPageSupabase(): Promise<SupabaseClient> {
  const accessToken = await extractAccessTokenFromCookies();
  return createServerSupabaseWithToken(accessToken);
}