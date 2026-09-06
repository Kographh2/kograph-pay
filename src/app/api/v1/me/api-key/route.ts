import { NextRequest } from "next/server";
import { ok, fail, generateApiKey } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const u = await getSessionUser();
  if (!u) return fail("UNAUTHORIZED", "Login required.", undefined, 401);
  if (u.role !== "USER" && u.role !== "ADMIN") return fail("FORBIDDEN", "Forbidden.", undefined, 403);
  const { raw, hash, prefix } = generateApiKey();
  const { error } = await getSupabase()
    .from("users")
    .update({ api_key_hash: hash, api_key_prefix: prefix })
    .eq("id", u.id);
  if (error) return fail("DB_ERROR", error.message, undefined, 500);
  return ok({ api_key: raw, prefix, note: "Save this now — it will not be shown again." });
}

export async function DELETE(_req: NextRequest) {
  const u = await getSessionUser();
  if (!u) return fail("UNAUTHORIZED", "Login required.", undefined, 401);
  const { error } = await getSupabase()
    .from("users")
    .update({ api_key_hash: null, api_key_prefix: null })
    .eq("id", u.id);
  if (error) return fail("DB_ERROR", error.message, undefined, 500);
  return ok({ revoked: true });
}
