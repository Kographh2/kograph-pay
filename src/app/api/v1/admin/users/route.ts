import { NextRequest } from "next/server";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";
import { fail, ok } from "@/lib/api";
import { getSessionUserFromRequest, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function adminGuard(req: NextRequest): Promise<Response | null> {
  const u = await getSessionUserFromRequest(req) ?? (await requireAdmin());
  if (!u) return fail("UNAUTHORIZED", "Admin session required.", undefined, 401);
  if (u.role !== "ADMIN") return fail("FORBIDDEN", "Admin role required.", undefined, 403);
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const { data: users } = await getSupabase()
    .from("users")
    .select("id, email, name, role, active, api_key_prefix, public_key, last_login_at, created_at")
    .order("created_at", { ascending: false });
  // Pull transaction counts per user with a single query.
  const { data: counts } = await getSupabase().from("payment_transactions").select("user_id");
  const tally: Record<string, number> = {};
  for (const r of counts ?? []) tally[r.user_id] = (tally[r.user_id] ?? 0) + 1;
  return ok((users ?? []).map((u) => ({ ...u, tx_count: tally[u.id] ?? 0 })));
}
