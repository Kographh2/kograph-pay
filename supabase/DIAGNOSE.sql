-- ============================================================================
-- Supabase QRIS Schema — Diagnostic Queries
-- Run these in Supabase Dashboard -> SQL Editor to check current state.
-- ============================================================================

-- 1. Check if public.users table exists and its structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Check if the handle_new_user function exists
SELECT 
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'handle_new_user';

-- 3. Check if the trigger exists on auth.users
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_orientation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

-- 4. Check RLS status on public.users
SELECT 
  tablename,
  rowsecurity AS rls_enabled,
  forcerowsecurity AS force_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'users';

-- 5. Check RLS policies on public.users
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users';

-- 6. Check if the user_role enum exists
SELECT 
  t.typname AS enum_name,
  e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'user_role'
ORDER BY e.enumsortorder;

-- 7. Check if pgcrypto extension exists
SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';

-- 8. Check if citext extension exists
SELECT extname, extversion FROM pg_extension WHERE extname = 'citext';

-- 9. Try inserting a test row into public.users (will fail due to FK but shows if table exists)
-- (commented out to avoid errors, uncomment if needed)
-- INSERT INTO public.users (id, email, name, role, public_key, active)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com', 'Test', 'USER', 'pk_test', true)
-- ON CONFLICT (id) DO NOTHING;
