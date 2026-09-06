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
  const { data: events } = await getSupabase()
    .from("webhook_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return ok(events ?? []);
}
