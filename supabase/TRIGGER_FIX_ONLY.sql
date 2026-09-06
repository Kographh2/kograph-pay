-- ============================================================================
-- SUPABASE TRIGGER FIX - handle_new_user() Function Update
-- ============================================================================
-- Use this ONLY if your schema is already partially applied and you just need
-- to fix the trigger function with better error handling.
-- 
-- Safe to run multiple times. Will not affect existing data.
-- ============================================================================

-- Step 1: Create the improved handle_new_user() function
-- This version includes better error handling and validation
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_name      TEXT;
  v_pubkey    TEXT;
  v_name_ok   TEXT;
BEGIN
  -- Defensive coding: ensure email is provided
  IF new.email IS NULL OR new.email = '' THEN
    RAISE EXCEPTION 'Email cannot be null or empty for new user';
  END IF;

  v_name := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
    SPLIT_PART(new.email, '@', 1)
  );
  v_name_ok := SUBSTR(v_name, 1, 60);
  IF CHAR_LENGTH(v_name_ok) < 1 THEN
    v_name_ok := 'User';
  END IF;

  -- Stable, per-user public key. Derived from the user id so it's
  -- deterministic and we don't need a second secret source.
  v_pubkey := 'pk_live_' || ENCODE(DIGEST(new.id::TEXT || ':' || new.email, 'sha256'), 'hex');

  -- Wrapped in exception handler so it doesn't crash the entire registration
  BEGIN
    INSERT INTO public.users (id, email, name, role, public_key, active)
    VALUES (new.id, new.email, v_name_ok, 'USER', v_pubkey, true)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the trigger - auth.users is already created
    RAISE NOTICE 'Failed to create public.users profile for %: %', new.id, SQLERRM;
  END;

  RETURN new;
END $$;

-- Step 2: Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Verify the trigger was created
SELECT trigger_name, event_object_schema, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Step 4: Verify the function exists
SELECT proname, prosecdef, prosrc
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
LIMIT 1;

-- ============================================================================
-- If you see results above:
-- ✅ Trigger: on_auth_user_created exists on auth.users
-- ✅ Function: handle_new_user() exists and is marked as SECURITY DEFINER
--
-- Your registration should now work! Try posting to /api/auth/register
-- ============================================================================
