import { NextRequest } from "next/server";
import { fail, hashApiKey } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { getSupabaseServer } from "@/lib/db/server";
import type { SessionUser } from "@/lib/auth";

const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 60;

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimit(req: NextRequest, key = getClientIp(req)): Response | null {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  bucket.count++;
  if (bucket.count > LIMIT) {
    return fail(
      "RATE_LIMITED",
      `Too many requests. Try again in ${Math.ceil((bucket.resetAt - now) / 1000)}s.`,
      undefined,
      429,
    );
  }
  return null;
}

export type AuthedCall = { user: SessionUser; record: { id: string; userId: string; apiKeyPrefix: string } };

// Production auth: every payment request must carry an API key (Bearer)
// AND the matching X-User-Id header. The pair must resolve to a user
// whose stored API key hash matches.
export async function authenticateApiRequest(req: NextRequest): Promise<
  { ok: true; call: AuthedCall } | { ok: false; response: Response }
> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    console.error("[auth] missing authorization header");
    return { ok: false, response: fail("UNAUTHORIZED", "Missing Authorization: Bearer header.", undefined, 401) };
  }
  const token = m[1].trim();
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    console.error("[auth] missing x-user-id header");
    return { ok: false, response: fail("UNAUTHORIZED", "Missing X-User-Id header.", undefined, 401) };
  }
  const hash = hashApiKey(token);
  const admin = getSupabaseAdmin();
  const { data: user } = await admin
    .from("users")
    .select("id, email, name, role, active, api_key_hash, api_key_prefix")
    .eq("id", userId)
    .maybeSingle<{
      id: string; email: string; name: string; role: "USER" | "ADMIN";
      active: boolean; api_key_hash: string | null; api_key_prefix: string | null;
    }>();
  if (!user || !user.active) {
    console.error("[auth] unknown or disabled user:", { userId, found: !!user, active: user?.active });
    return { ok: false, response: fail("UNAUTHORIZED", "Unknown or disabled user.", undefined, 401) };
  }
  if (!user.api_key_hash || user.api_key_hash !== hash) {
    console.error("[auth] invalid api key:", { userId, hasHash: !!user.api_key_hash, prefix: user.api_key_prefix });
    return { ok: false, response: fail("UNAUTHORIZED", "Invalid API key for this user.", undefined, 401) };
  }
  return {
    ok: true,
    call: {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      record: { id: user.id, userId: user.id, apiKeyPrefix: user.api_key_prefix ?? "" },
    },
  };
}

// Public-key auth for the customer-facing payment page (/pay/:id) and the
// status probe. This key is exposed to the browser; it only permits read of a
// single transaction by id and never exposes credentials.
export async function authenticatePublicKey(req: NextRequest): Promise<
  { ok: true; publicKey: string } | { ok: false; response: Response }
> {
  const key = req.headers.get("x-public-key") ?? req.nextUrl.searchParams.get("public_key") ?? "";
  if (!key) {
    return { ok: false, response: fail("UNAUTHORIZED", "Missing public key.", undefined, 401) };
  }
  const admin = getSupabaseAdmin();
  const { data: user } = await admin
    .from("users")
    .select("id, public_key, active")
    .eq("public_key", key)
    .maybeSingle<{ id: string; public_key: string; active: boolean }>();
  if (!user || !user.active) {
    return { ok: false, response: fail("UNAUTHORIZED", "Invalid public key.", undefined, 401) };
  }
  return { ok: true, publicKey: user.public_key };
}

// Re-export the SSR session user getter for route handlers that don't
// want to import from "@/lib/auth" directly.
export async function getUserScopedClient() {
  return getSupabaseServer();
}