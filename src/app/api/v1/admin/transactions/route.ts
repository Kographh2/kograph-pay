import { NextRequest } from "next/server";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";
import { fail, ok } from "@/lib/api";
import { getSessionUserFromRequest, requireAdmin } from "@/lib/auth";
import { shapeTransaction } from "@/lib/shape";
import type { PaymentTransaction, User } from "@/types/db";

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
  const supabase = getSupabase();
  const { data: txs } = await supabase
    .from("payment_transactions")
    .select("*, user:users(id, email, name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (txs ?? []) as Array<PaymentTransaction & { user: { id: string; email: string; name: string } | null }>;
  return ok(await Promise.all(rows.map(async (t) => ({ ...(await shapeTransaction(t)), owner_email: t.user?.email, owner_id: t.user_id }))));
}
