import { supabase } from "@/lib/supabase/client";

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
  });
}