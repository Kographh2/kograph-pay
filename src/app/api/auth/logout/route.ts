import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { getSupabaseServer } from "@/lib/db/server";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  return ok({ logged_out: true }, 200);
}
