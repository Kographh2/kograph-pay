"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Browser-side Supabase client. Uses the public anon key only, so it
// respects RLS. Used by client components (e.g. login form) to call
// signInWithPassword / signOut directly.
export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  cached = createBrowserClient(url, key);
  return cached;
}