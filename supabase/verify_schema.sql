-- ============================================================================
-- VERIFICATION SCRIPT: Check that schema is properly set up
-- Run this in Supabase SQL Editor after applying schema.sql
-- ============================================================================

-- 1. Check if extensions are created
SELECT 'pgcrypto extension' as check_item, 
       EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') as status;

SELECT 'citext extension' as check_item,
       EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') as status;

-- 2. Check if types are created
SELECT 'user_role type' as check_item,
       EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') as status;

SELECT 'transaction_status type' as check_item,
       EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') as status;

-- 3. Check if tables exist
SELECT 'public.users table' as check_item,
       EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'users') as status;

SELECT 'public.payment_transactions table' as check_item,
       EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'payment_transactions') as status;

SELECT 'public.webhook_events table' as check_item,
       EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'webhook_events') as status;

-- 4. Check if functions exist
SELECT 'set_updated_at() function' as check_item,
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' 
               AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) as status;

SELECT 'handle_new_user() function' as check_item,
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user' 
               AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) as status;

-- 5. Check if trigger exists on auth.users
SELECT 'on_auth_user_created trigger' as check_item,
       EXISTS (SELECT 1 FROM information_schema.triggers 
               WHERE trigger_schema = 'auth' AND trigger_name = 'on_auth_user_created') as status;

-- 6. Check RLS is enabled
SELECT 'public.users RLS enabled' as check_item,
       (SELECT relrowsecurity FROM pg_class WHERE relname = 'users' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) as status;

-- 7. Check policies exist
SELECT 'users_service_role_all policy' as check_item,
       COUNT(*) > 0 as status
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' 
AND policyname = 'users_service_role_all';

SELECT 'users_self_select policy' as check_item,
       COUNT(*) > 0 as status
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' 
AND policyname = 'users_self_select';

-- 8. Check if columns in users table are correct
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 9. List all policies on public.users
SELECT policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;

-- 10. Test inserting a user to check for errors
-- (Run this ONLY after schema is applied, and clean up afterward)
-- DO $$
-- BEGIN
--   INSERT INTO public.users (id, email, name, public_key, role, active)
--   VALUES (gen_random_uuid(), 'test@example.com', 'Test User', 'pk_test_12345678', 'USER', true);
--   RAISE NOTICE 'Test insert successful!';
-- EXCEPTION WHEN OTHERS THEN
--   RAISE NOTICE 'Test insert failed: %', sqlerrm;
-- END $$;
