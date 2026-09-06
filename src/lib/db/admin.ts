import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv, EnvConfigError } from "@/lib/env";

let cached: SupabaseClient | null = null;
let lastConfigError: string | null = null;

export class SupabaseMisconfiguredError extends Error {
  readonly code = "SUPABASE_MISCONFIGURED";
  readonly status = 503;
  readonly hint: string;
  constructor(hint: string) {
    super("Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.");
    this.hint = hint;
  }
}

// Server-only Supabase admin client (service-role key).
// Bypasses RLS. Used for:
//   - admin operations (list users, manage API keys)
//   - webhooks (no user context)
//   - the registration flow (Supabase Auth signUp, since the visitor has
//     no session yet and we still need to write the profile)
//
// DO NOT import this module from a client component. The `server-only`
// import above will fail the build if you do.
//
// Throws SupabaseMisconfiguredError if env is missing/placeholder so the
// caller can map it to a 503 with an actionable hint for the client.
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  let env;
  try {
    env = getEnv();
  } catch (e) {
    if (e instanceof EnvConfigError) {
      lastConfigError = e.issues.join("; ");
      throw new SupabaseMisconfiguredError(
        lastConfigError + " | Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env to a real Supabase project.",
      );
    }
    throw e;
  }
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function getSupabaseMisconfigHint(): string | null {
  return lastConfigError;
}