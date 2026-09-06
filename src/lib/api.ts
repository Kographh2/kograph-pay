import crypto from "crypto";

export type ApiError = {
  success: false;
  error: { code: string; message: string; fields?: Record<string, string> };
};

export type ApiSuccess<T> = { success: true; data: T };

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

type ExtraHeaders = Record<string, string>;

function withHeaders(extra: ExtraHeaders | undefined, base: Record<string, string>): Record<string, string> {
  if (!extra) return base;
  // base values win for content-type; everything else merges
  for (const [k, v] of Object.entries(extra)) base[k] = v;
  return base;
}

export const ok = <T>(data: T, code = 200, headers?: ExtraHeaders): Response =>
  new Response(JSON.stringify({ success: true, data }), {
    status: code,
    headers: withHeaders(headers, { "Content-Type": "application/json" }),
  });

export const fail = (
  code: string,
  message: string,
  fields?: Record<string, string>,
  status = 400,
  headers?: ExtraHeaders,
): Response => {
  return new Response(
    JSON.stringify({ success: false, error: { code, message, fields } }),
    {
      status,
      headers: withHeaders(headers, { "Content-Type": "application/json" }),
    },
  );
};

export function generateTransactionId(): string {
  return "trx_" + crypto.randomBytes(8).toString("hex");
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = "sk_live_" + crypto.randomBytes(24).toString("hex");
  const prefix = raw.slice(0, 11);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function formatIDR(amount: number): string {
  return "Rp" + amount.toLocaleString("id-ID");
}