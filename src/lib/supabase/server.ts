import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

function getAccessToken(request: NextRequest) {
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

export function getServerSupabase(request: NextRequest): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const accessToken = getAccessToken(request);

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