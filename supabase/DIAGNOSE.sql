-- ============================================================================
-- Check triggers on public.users and column definitions
-- ============================================================================

-- 1. Show all triggers on public.users (including BEFORE INSERT)
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'users';

-- 2. Show columns in public.users
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 3. Show ALL constraints on public.users
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
ORDER BY contype, conname;

-- 4. Test insert directly into public.users with a fake auth UUID
DO $$
DECLARE
  test_uuid uuid := gen_random_uuid();
  test_email text := 'test-diag-' || extract(epoch FROM now()) || '@example.com';
  test_name text := 'Diag User';
  v_pubkey text;
  v_name_ok text;
BEGIN
  v_name_ok := substr(test_name, 1, 60);
  v_pubkey := 'pk_live_' || encode(digest(test_uuid::text || ':' || test_email, 'sha256'), 'hex');
  
  RAISE NOTICE 'Testing insert into public.users...';
  
  INSERT INTO public.users (id, email, name, role, public_key, active)
  VALUES (test_uuid, test_email, v_name_ok, 'USER', v_pubkey, true);
  
  RAISE NOTICE 'Insert succeeded! Cleaning up...';
  DELETE FROM public.users WHERE id = test_uuid;
  RAISE NOTICE 'Done.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAILED: %', SQLERRM;
  RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
END $$;
