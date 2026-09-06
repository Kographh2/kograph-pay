import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getSupabaseAdmin, SupabaseMisconfiguredError } from "@/lib/db/admin";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().max(160),
  name: z.string().min(1).max(60),
  password: z.string().min(8).max(120),
});

export const dynamic = "force-dynamic";

// POST /api/auth/register
//
// Flow:
//   1. Validate the body (Zod).
//   2. Create the user in Supabase Auth (auth.users) using the service-role
//      admin client. Email confirmation is auto-confirmed so the user can
//      sign in immediately in this self-hosted gateway. In a production
//      deployment that needs email verification, set the env flag below to
//      false and handle the "check your email" UX on the client.
//   3. A SECURITY DEFINER trigger on auth.users (handle_new_user) creates
//      the corresponding public.users profile with role=USER, active=true.
//   4. The client then POSTs to /api/auth/login to establish a session.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Body must be JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "_"] = issue.message;
    }
    return fail("INVALID_REQUEST", "Validation failed.", fields, 400);
  }

  const { email, name, password } = parsed.data;

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    if (e instanceof SupabaseMisconfiguredError) {
      return fail("AUTH_BACKEND_UNREACHABLE", e.message, { hint: e.hint }, 503);
    }
    throw e;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,                       // self-hosted gateway: skip email verification
    user_metadata: { name },                  // handle_new_user() reads this
  });

  if (error) {
    const code = (error as { code?: string }).code ?? "";
    const status = (error as { status?: number }).status;
    const name  = (error as { name?: string }).name ?? "";

    if (status && status >= 500) {
      console.error("[register] Supabase auth backend error:", status, error.message);
      return fail(
        "AUTH_BACKEND_ERROR",
        `Supabase auth backend error (${status}). The service may be temporarily unavailable or the database trigger is failing.`,
        { hint: "Check Supabase Dashboard -> Logs -> Auth for details. Ensure the schema from supabase/schema.sql is applied.", error_id: (error as { error_id?: string }).error_id ?? "" },
        503,
      );
    }

    if (
      status === 422 ||
      /already.*registered|already.*exists|user.*exists/i.test(error.message)
    ) {
      return fail("EMAIL_TAKEN", "Email is already registered.", undefined, 409);
    }
    if (/password/i.test(error.message) && /short|weak|characters/i.test(error.message)) {
      return fail("WEAK_PASSWORD", "Password is too weak.", undefined, 400);
    }
    if (code === "email_address_invalid" || /invalid.*email/i.test(error.message)) {
      return fail("INVALID_EMAIL", "Email is not valid.", undefined, 400);
    }

    if (name === "AuthRetryableFetchError" || /fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(error.message)) {
      console.error(
        "[register] cannot reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env. Original error:",
        error.message,
      );
      return fail(
        "AUTH_BACKEND_UNREACHABLE",
        "Auth backend is unreachable. The server is missing or has invalid Supabase credentials.",
        { hint: "Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. They must point to a real Supabase project, not the example placeholders." },
        503,
      );
    }

    console.error("[register] auth.admin.createUser failed:", error);
    return fail("REGISTER_FAILED", "Could not create account.", undefined, 500);
  }

  if (!data.user) {
    return fail("REGISTER_FAILED", "Could not create account.", undefined, 500);
  }

  // The trigger on auth.users will create the public.users profile.
  // Wait a moment for the trigger to complete (it is synchronous but the
  // result may not be visible to a follow-up read due to replication).
  // We do a quick retry to confirm the profile exists.
  for (let i = 0; i < 5; i++) {
    const { data: profile } = await admin
      .from("users")
      .select("id, email, name, role")
      .eq("id", data.user.id)
      .maybeSingle<{ id: string; email: string; name: string; role: "USER" | "ADMIN" }>();
    if (profile) {
      return ok({ id: profile.id, email: profile.email, name: profile.name, role: profile.role }, 201);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // Profile not yet visible; the trigger should still create it. Return
  // success anyway — the user is created in auth.users.
  return ok(
    { id: data.user.id, email: data.user.email ?? email, name, role: "USER" as const },
    201,
  );
}
