import { NextRequest } from "next/server";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";
import { authenticatePublicKey, rateLimit } from "@/lib/api-auth";
import QRCode from "qrcode";
import type { PaymentTransaction, User } from "@/types/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } },
) {
  const limited = rateLimit(req, `GET /api/v1/payments/${params.transactionId}/qr`);
  if (limited) return limited;

  const auth = await authenticatePublicKey(req);
  if (!auth.ok) return auth.response;

  const supabase = getSupabase();
  const { data: owner } = await supabase
    .from("users")
    .select("id")
    .eq("public_key", auth.publicKey)
    .maybeSingle<User>();
  if (!owner) return new Response("Not found", { status: 404 });

  const { data: a } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("user_id", owner.id)
    .eq("transaction_id", params.transactionId)
    .maybeSingle<PaymentTransaction>();
  const record =
    a ??
    (await supabase
      .from("payment_transactions")
      .select("*")
      .eq("user_id", owner.id)
      .eq("reference_id", params.transactionId)
      .maybeSingle<PaymentTransaction>()).data;

  if (!record) return new Response("Transaction not found", { status: 404 });
  if (record.qr_image_url?.startsWith("data:image/")) {
    const base64 = record.qr_image_url.split(",")[1] ?? "";
    const png = Buffer.from(base64, "base64");
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  }
  if (record.qr_image_url) return Response.redirect(record.qr_image_url, 302);
  if (record.qr_data) {
    const png = await QRCode.toBuffer(record.qr_data, {
      type: "png",
      errorCorrectionLevel: "H",
      margin: 1,
      width: 512,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  }
  return new Response("No QR data available", { status: 404 });
}