import { NextRequest } from "next/server";
import { ok, fail, generateTransactionId } from "@/lib/api";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";
import { authenticateApiRequest, rateLimit } from "@/lib/api-auth";
import { getPaymentProvider } from "@/lib/providers";
import { shapeTransaction } from "@/lib/shape";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import type { PaymentTransaction } from "@/types/db";

const createPaymentSchema = z.object({
  amount: z.number().int().positive().max(1_000_000_000),
  reference_id: z.string().min(1).max(120),
  customer_name: z.string().max(120).optional(),
  customer_email: z.string().email().max(160).optional(),
  description: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, `POST /api/v1/payments ${req.headers.get("x-user-id") ?? ""}`);
  if (limited) return limited;

  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;
  const { user } = auth.call;

  const idempotencyKey = req.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return fail("IDEMPOTENCY_REQUIRED", "Idempotency-Key header is required.", undefined, 400);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return fail("INVALID_JSON", "Request body must be valid JSON."); }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_"] = issue.message;
    return fail("INVALID_REQUEST", "Validation failed.", fields, 400);
  }

  const input = parsed.data;
  const env = getEnv();
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("reference_id", input.reference_id)
    .maybeSingle<PaymentTransaction>();
  if (existing) return ok(await shapeTransaction(existing));

  const provider = getPaymentProvider();
  const transactionId = generateTransactionId();
  const expiresAt = new Date(Date.now() + env.PAYMENT_EXPIRATION_MINUTES * 60_000).toISOString();

  let created: PaymentTransaction;
  try {
    const providerResult = await provider.createPayment({
      amount: input.amount,
      expirationMinutes: env.PAYMENT_EXPIRATION_MINUTES,
      referenceId: input.reference_id,
      customerName: input.customer_name,
      customerEmail: input.customer_email,
      description: input.description,
    });

    const { data, error } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: user.id,
        transaction_id: transactionId,
        reference_id: input.reference_id,
        provider: provider.name,
        provider_transaction_id: providerResult.providerTransactionId,
        amount: input.amount,
        currency: "IDR",
        status: "pending",
        customer_name: input.customer_name ?? null,
        customer_email: input.customer_email ?? null,
        description: input.description ?? null,
        qr_data: providerResult.qrString,
        qr_image_url: providerResult.qrImageUrl,
        payment_url: providerResult.paymentUrl,
        expires_at: expiresAt,
        raw_provider_response: JSON.stringify(providerResult.raw ?? {}),
      })
      .select("*")
      .single<PaymentTransaction>();
    if (error || !data) throw new Error(error?.message ?? "Insert failed");
    created = data;
  } catch (err) {
    console.error("[createPayment] error:", err);
    return fail(
      "PROVIDER_ERROR",
      err instanceof Error ? err.message : "Failed to create payment.",
      undefined,
      502,
    );
  }

  if (provider.name === "saweria") {
    const sw = provider as unknown as { setWebhook?: (url: string) => Promise<unknown> };
    if (sw.setWebhook) {
      sw.setWebhook(`${env.APP_URL}/api/v1/webhooks/saweria`)
        .catch((e: unknown) => console.warn("[webhook] auto-register failed:", e));
    }
  }

  return ok(await shapeTransaction(created));
}
