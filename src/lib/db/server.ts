import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

// Per-request server Supabase client wired to the caller's cookies.
// The user's auth.uid() flows through to PostgREST, so RLS policies can
// scope rows by `auth.uid() = id`.
//
// Use this for any server-side query that should run in the *user's*
// security context, not the service-role's.
//
// DO NOT import this module from a client component.
export async function getSupabaseServer(): Promise<SupabaseClient> {
  const env = getEnv();
  const cookieStore = cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options as CookieOptions);
          }
        } catch {
          // setAll is called from a Server Component (read-only context).
          // It's safe to ignore — the middleware will refresh the cookie.
        }
      },
    },
  });
}