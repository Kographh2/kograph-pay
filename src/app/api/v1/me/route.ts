import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";
import type { User } from "@/types/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const u = await getSessionUser();
  if (!u) return fail("UNAUTHORIZED", "Login required.", undefined, 401);
  const { data: record } = await getSupabase()
    .from("users")
    .select("id, email, name, role, public_key, api_key_hash, api_key_prefix, created_at")
    .eq("id", u.id)
    .maybeSingle<User>();
  if (!record) return fail("NOT_FOUND", "User not found.", undefined, 404);
  return ok({
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    public_key: record.public_key,
    api_key_prefix: record.api_key_prefix,
    has_api_key: !!record.api_key_hash,
    created_at: record.created_at,
  });
}
