import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { authenticateApiRequest, rateLimit } from "@/lib/api-auth";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";
import { shapeTransaction } from "@/lib/shape";
import type { PaymentTransaction } from "@/types/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } },
) {
  const limited = rateLimit(req, `GET /api/v1/payments/${params.transactionId}`);
  if (limited) return limited;

  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;
  const { user } = auth.call;

  const supabase = getSupabase();
  let q = supabase.from("payment_transactions").select("*").eq("transaction_id", params.transactionId);
  if (user.role !== "ADMIN") q = q.eq("user_id", user.id);
  const { data: tx } = await q.maybeSingle<PaymentTransaction>();
  if (!tx) return fail("NOT_FOUND", "Transaction not found.", undefined, 404);
  return ok(await shapeTransaction(tx));
}