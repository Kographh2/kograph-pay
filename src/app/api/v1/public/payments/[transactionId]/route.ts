import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { authenticatePublicKey, rateLimit } from "@/lib/api-auth";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";
import type { PaymentTransaction, User } from "@/types/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } },
) {
  const limited = rateLimit(req, `GET /api/v1/public/payments/${params.transactionId}`);
  if (limited) return limited;

  const auth = await authenticatePublicKey(req);
  if (!auth.ok) return auth.response;

  const supabase = getSupabase();
  const { data: owner } = await supabase
    .from("users")
    .select("id")
    .eq("public_key", auth.publicKey)
    .maybeSingle<User>();
  if (!owner) return fail("NOT_FOUND", "Not found.", undefined, 404);

  const { data: a } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("user_id", owner.id)
    .eq("transaction_id", params.transactionId)
    .maybeSingle<PaymentTransaction>();
  const tx =
    a ??
    (await supabase
      .from("payment_transactions")
      .select("*")
      .eq("user_id", owner.id)
      .eq("reference_id", params.transactionId)
      .maybeSingle<PaymentTransaction>()).data;

  if (!tx) return fail("NOT_FOUND", "Not found.", undefined, 404);

  return ok({
    transaction_id: tx.transaction_id,
    reference_id: tx.reference_id,
    amount: tx.amount,
    status: tx.status,
    expires_at: tx.expires_at,
    paid_at: tx.paid_at,
  });
}