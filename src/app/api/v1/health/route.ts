import { ok } from "@/lib/api";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = true;
  try {
    const { error } = await getSupabase().from("users").select("id", { count: "exact", head: true }).limit(0);
    if (error) dbOk = false;
  } catch {
    dbOk = false;
  }
  return ok({ status: dbOk ? "healthy" : "degraded", database: dbOk ? "ok" : "down" });
}
