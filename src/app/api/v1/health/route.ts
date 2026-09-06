import { ok, fail } from "@/lib/api";
import { getSupabaseAdmin as getSupabase } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = true;
  let schemaOk = true;
  try {
    const { error } = await getSupabase().from("users").select("id", { count: "exact", head: true }).limit(0);
    if (error) dbOk = false;
  } catch {
    dbOk = false;
  }

  try {
    const { error } = await getSupabase().from("users").select("email, name, role").limit(0);
    if (error) schemaOk = false;
  } catch {
    schemaOk = false;
  }

  const status = dbOk && schemaOk ? "healthy" : "degraded";
  return ok({
    status,
    database: dbOk ? "ok" : "down",
    schema: schemaOk ? "ok" : "missing_or_incomplete",
    hint: !schemaOk ? "Apply supabase/schema.sql in Supabase SQL Editor" : undefined,
  });
}
