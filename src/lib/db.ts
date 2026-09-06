// Backward-compatible alias. The codebase has many `import { getSupabase } from "@/lib/db"`
// call sites. We re-route them to the service-role admin client.
// New code should import from "@/lib/db/admin", "@/lib/db/server", or
// "@/lib/db/browser" explicitly.
export { getSupabaseAdmin as getSupabase } from "./db/admin";