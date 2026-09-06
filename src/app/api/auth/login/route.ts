import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getSupabaseServer } from "@/lib/db/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function GET() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to login.", undefined, 405);
}

// POST /api/auth/login
//
// Authenticates against Supabase Auth (auth.users) and establishes a
// cookie-based session via @supabase/ssr. The cookies are set on the
// Response by the SSR client, so subsequent requests are authenticated.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Body must be JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("INVALID_REQUEST", "Email and password are required.", undefined, 400);
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    console.error("[login] signInWithPassword failed:", JSON.stringify({
      email: parsed.data.email,
      error_name: (error as { name?: string } | null)?.name,
      error_message: error?.message,
      error_status: (error as { status?: number } | null)?.status,
      error_code: (error as { code?: string } | null)?.code,
    }));
    const status = (error as { status?: number } | null)?.status;
    if (status === 429) {
      return fail("RATE_LIMITED", "Too many login attempts. Try again later.", undefined, 429);
    }
    return fail("INVALID_CREDENTIALS", "Invalid email or password.", undefined, 401);
  }

  // The response returned by signInWithPassword is a JSON body; we want
  // the cookies set by the SSR client to land on the client too, so we
  // re-issue them here via a fresh response.
  const { data: profile } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("id", data.user.id)
    .maybeSingle<{ id: string; email: string; name: string; role: "USER" | "ADMIN" }>();

  if (!profile) {
    // auth.users exists but the profile is missing (e.g. trigger failed
    // historically). Don't leak the internal state.
    return fail("ACCOUNT_NOT_READY", "Account is not fully provisioned.", undefined, 503);
  }

  return ok({ id: profile.id, email: profile.email, name: profile.name, role: profile.role }, 200);
}
