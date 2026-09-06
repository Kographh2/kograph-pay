import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/db/server";
import { getSupabaseAdmin } from "@/lib/db/admin";

export type Role = "USER" | "ADMIN";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  active: boolean;
};

// Get the currently signed-in user using the request's auth cookies.
// Returns null if no valid session exists.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return loadProfile(user.id, user.email ?? "");
}

export async function getSessionUserFromRequest(req: Request): Promise<SessionUser | null> {
  // For non-cookie contexts (e.g. raw Webhooks) we accept the JWT in the
  // Authorization header as `Bearer <access_token>`.
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return getSessionUser();
  const token = m[1].trim();
  const { createClient } = await import("@supabase/supabase-js");
  const env = process.env as Record<string, string | undefined>;
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await c.auth.getUser(token);
  if (!user) return null;
  return loadProfile(user.id, user.email ?? "");
}

async function loadProfile(userId: string, emailFromAuth: string): Promise<SessionUser | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, role, active")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (error || !data) return null;
  if (!data.active) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/admin");
  if (u.role !== "ADMIN") redirect("/dashboard");
  return u;
}

// Bootstrap: ensure the INITIAL_ADMIN_EMAIL account is an ADMIN.
// Uses the service-role admin client to call Supabase Auth's createUser
// (creating auth.users if it doesn't exist) so the trigger creates the
// profile, then promotes the profile row to ADMIN.
export async function ensureInitialAdmin(): Promise<void> {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  const admin = getSupabaseAdmin();

  // Does an auth.users row exist?
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1, page: 1 });
  // listUsers doesn't filter; we have to look up by email another way.
  // Use the canonical trick: getUserByEmail is not exposed; instead rely on
  // idempotent createUser (with email_confirm: true) — if the user already
  // exists, Supabase returns a 422 with a "user already exists" message.
  // We swallow that specific case and continue.

  // Try to create the auth user (no-op if it already exists).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Admin" },
  });

  let userId: string | null = created?.user?.id ?? null;
  if (!userId) {
    // Fall back: list & find by email.
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const found = users?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    userId = found?.id ?? null;
    if (!userId) {
      console.warn("[ensureInitialAdmin] could not create or find user:", createErr?.message);
      return;
    }
  }

  // Promote the profile to ADMIN.
  await admin.from("users").update({ role: "ADMIN" }).eq("id", userId);
}