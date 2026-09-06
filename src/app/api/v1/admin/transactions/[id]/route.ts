import { NextRequest } from "next/server";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";
import { fail, ok } from "@/lib/api";
import { getSessionUserFromRequest, requireAdmin } from "@/lib/auth";
import { shapeTransaction } from "@/lib/shape";
import type { PaymentTransaction } from "@/types/db";

export const dynamic = "force-dynamic";

async function adminGuard(req: NextRequest): Promise<Response | null> {
  const u = await getSessionUserFromRequest(req) ?? (await requireAdmin());
  if (!u) return fail("UNAUTHORIZED", "Admin session required.", undefined, 401);
  if (u.role !== "ADMIN") return fail("FORBIDDEN", "Admin role required.", undefined, 403);
  return null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const supabase = getSupabase();
  const { data: byId } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<PaymentTransaction>();
  const tx =
    byId ??
    (await supabase
      .from("payment_transactions")
      .select("*")
      .eq("transaction_id", params.id)
      .maybeSingle<PaymentTransaction>()).data;
  if (!tx) return fail("NOT_FOUND", "Transaction not found.", undefined, 404);
  return ok({ ...(await shapeTransaction(tx)), owner_id: tx.user_id });
}