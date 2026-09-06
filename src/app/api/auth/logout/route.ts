import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getSupabaseServer } from "@/lib/db/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to logout.", undefined, 405);
}

export async function POST(_req: NextRequest) {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  return ok({ logged_out: true }, 200);
}
