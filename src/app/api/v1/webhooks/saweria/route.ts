import { NextRequest } from "next/server";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";
import { getPaymentProvider } from "@/lib/providers";
import { sendPaymentTelegram } from "@/lib/telegram";
import { fail, ok } from "@/lib/api";
import type { PaymentTransaction } from "@/types/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return fail("INVALID_JSON", "Webhook body must be valid JSON.", undefined, 400); }

  const provider = getPaymentProvider();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));
  const normalized = provider.parseWebhook(headers, body);

  const supabase = getSupabase();

  // 1. Record webhook event (unique constraint on provider+event_id provides idempotency)
  const { error: insertErr } = await supabase.from("webhook_events").insert({
    provider: normalized.provider,
    event_id: normalized.eventId,
    event_type: normalized.eventType,
    payload: JSON.stringify(normalized.payload ?? {}),
  });
  if (insertErr) {
    // 23505 = unique_violation in Postgres. We treat any unique violation as a duplicate.
    if (insertErr.code === "23505" || /duplicate key|unique constraint/i.test(insertErr.message)) {
      return ok({ duplicate: true });
    }
    throw insertErr;
  }

  // 2. Find matching transaction
  const providerTxId = normalized.providerTransactionId;
  const refId = normalized.referenceId;

  let tx: PaymentTransaction | null = null;
  if (providerTxId) {
    const { data } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("provider_transaction_id", providerTxId)
      .maybeSingle<PaymentTransaction>();
    tx = data ?? null;
  }
  if (!tx && refId) {
    const { data } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("reference_id", refId)
      .maybeSingle<PaymentTransaction>();
    tx = data ?? null;
  }

  if (!tx) {
    await supabase
      .from("webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: "Matching transaction not found",
      })
      .eq("provider", normalized.provider)
      .eq("event_id", normalized.eventId);
    return ok({ matched: false });
  }

  // 3. Validate amount
  const reported = normalized.amount ?? 0;
  if (reported + 1 < tx.amount) {
    await supabase
      .from("webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: `Amount mismatch: expected >= ${tx.amount}, got ${reported}`,
      })
      .eq("provider", normalized.provider)
      .eq("event_id", normalized.eventId);
    return fail(
      "AMOUNT_MISMATCH",
      `Reported amount ${reported} does not match expected ${tx.amount}.`,
      undefined,
      400,
    );
  }

  // 4. Mark paid
  if (tx.status !== "paid") {
    await supabase
      .from("payment_transactions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", tx.id);
  }

  await supabase
    .from("webhook_events")
    .update({ processed: true, processed_at: new Date().toISOString(), error_message: null })
    .eq("provider", normalized.provider)
    .eq("event_id", normalized.eventId);

  // 5. Telegram (best-effort)
  void sendPaymentTelegram({
    transactionId: tx.transaction_id,
    referenceId: tx.reference_id,
    amount: tx.amount,
    customerName: tx.customer_name,
    customerEmail: tx.customer_email,
    description: tx.description,
    paidAt: new Date(),
  });

  return ok({ matched: true, transaction_id: tx.transaction_id, status: "paid" });
}

export async function GET() {
  return ok({ status: "ready", provider: getPaymentProvider().name });
}
