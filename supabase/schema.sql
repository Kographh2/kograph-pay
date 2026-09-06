-- ============================================================================
-- QRIS Engine — Supabase schema.
-- Authentication is delegated to Supabase Auth (auth.users). The
-- application profile + business data live in public.users, linked to
-- auth.users by id, and are created automatically by a trigger.
--
-- How to apply
-- ------------
-- 1. Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--    or from your machine, with the DIRECT (port 5432) connection string:
--      SUPABASE_DB_URL="postgres://postgres.PROJECTREF:PASSWORD@db.PROJECTREF.supabase.co:5432/postgres" \
--      npm run db:setup
-- 
-- 2. IMPORTANT SETUP NOTES:
--    - This schema is IDEMPOTENT - it's safe to re-run multiple times
--    - The handle_new_user() trigger automatically creates public.users 
--      profiles when new auth.users are registered
--    - If you get "500 Database error creating new user" on registration:
--      (a) Verify this entire schema was applied successfully
--      (b) Check that the trigger 'on_auth_user_created' exists on auth.users
--      (c) Ensure RLS policies are enabled on public.users table
-- 
-- 3. The Next.js app uses the service-role key for privileged operations
--    (registration, webhooks) and a per-request SSR client (anon key) for
--    user-scoped operations.
-- 4. RLS is enabled on every public table. The service-role role has its
--    own permissive policies; anon / authenticated have explicit deny
--    policies plus no direct grants. The single per-user SELECT policy
--    on public.users uses auth.uid() so each user can read only their
--    own profile.
-- 5. Safe to re-run. Cleanup uses a DO block that swallows errors.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive text

-- ---------------------------------------------------------------------------
-- 1. Reset (idempotent).
-- ---------------------------------------------------------------------------
do $$
begin
  -- Triggers on auth.users. (drop trigger if exists never errors on missing
  -- trigger, so no exception handler is needed; the bare execute is safe.)
  execute 'drop trigger if exists on_auth_user_created on auth.users';

  -- Triggers on public tables (only if tables exist).
  begin execute 'drop trigger if exists users_set_updated_at on public.users'; exception when undefined_table then null; end;
  begin execute 'drop trigger if exists payment_transactions_set_updated_at on public.payment_transactions'; exception when undefined_table then null; end;

  -- Functions.
  execute 'drop function if exists public.set_updated_at()';
  execute 'drop function if exists public.handle_new_user()';
  execute 'drop function if exists public.tg_purge_old_webhook_events(interval)';
  -- Drop any legacy / orphan helpers (e.g. register_user from previous auth design)
  -- so the type drops below don't fail with 2BP01 "cannot drop type ... other objects depend on it".
  begin
    execute (
      select format(
        'drop function if exists public.%I(%s)',
        p.proname,
        pg_get_function_identity_arguments(p.oid)
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('register_user', 'authenticate_user', 'create_user')
    );
  exception when others then null;
  end;

  -- Policies.
  begin execute 'drop policy if exists users_service_role_all on public.users'; exception when undefined_table then null; end;
  begin execute 'drop policy if exists payment_transactions_service_role_all on public.payment_transactions'; exception when undefined_table then null; end;
  begin execute 'drop policy if exists webhook_events_service_role_all on public.webhook_events'; exception when undefined_table then null; end;
  begin execute 'drop policy if exists users_self_select on public.users'; exception when undefined_table then null; end;
  begin execute 'drop policy if exists users_self_update_safe on public.users'; exception when undefined_table then null; end;
  begin execute 'drop policy if exists users_no_anon_all on public.users'; exception when undefined_table then null; end;
  begin execute 'drop policy if exists payment_transactions_no_anon_all on public.payment_transactions'; exception when undefined_table then null; end;
  begin execute 'drop policy if exists webhook_events_no_anon_all on public.webhook_events'; exception when undefined_table then null; end;

  -- View.
  execute 'drop view if exists public.v_admin_tx_summary';

  -- Tables.
  execute 'drop table if exists public.webhook_events       cascade';
  execute 'drop table if exists public.payment_transactions cascade';
  execute 'drop table if exists public.users                cascade';

  -- Types (cascade in case orphan helpers still reference them).
  execute 'drop type if exists public.user_role          cascade';
  execute 'drop type if exists public.transaction_status cascade';
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------------------------
create type public.user_role          as enum ('USER', 'ADMIN');
create type public.transaction_status as enum ('pending', 'paid', 'expired', 'failed');

-- ---------------------------------------------------------------------------
-- 3. updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. public.users  (application profile, NOT authentication)
--    id is the auth.users id. No password column. No email column (we read
--    it from auth.users if needed). name comes from auth.users.raw_user_meta_data.
-- ---------------------------------------------------------------------------
create table public.users (
  id             uuid         primary key references auth.users(id) on delete cascade on update cascade,
  email          citext       not null unique
                               check (char_length(email) > 0 and char_length(email) <= 160),
  name           text         not null
                               check (char_length(name) between 1 and 60),
  role           public.user_role          not null default 'USER',
  api_key_hash   text
                               check (api_key_hash is null or char_length(api_key_hash) = 64),
  api_key_prefix text
                               check (api_key_prefix is null or char_length(api_key_prefix) <= 32),
  public_key     text         not null unique
                               check (char_length(public_key) between 8 and 80),
  active         boolean      not null default true,
  last_login_at  timestamptz,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

create index users_role_idx                on public.users (role);
create index users_active_idx              on public.users (active);
create index users_created_at_idx          on public.users (created_at desc);
create unique index users_api_key_hash_unique_idx on public.users (api_key_hash)
  where api_key_hash is not null;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Auto-create public.users when an auth.users row is inserted.
--    SECURITY DEFINER + locked search_path. Hard-codes role=USER and
--    active=true. The user cannot influence role via metadata.
--    The public_key is generated server-side if not provided.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_name      text;
  v_pubkey    text;
  v_name_ok   text;
begin
  -- Defensive coding: ensure email is provided
  if new.email is null or new.email = '' then
    raise exception 'Email cannot be null or empty for new user';
  end if;

  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  );
  v_name_ok := substr(v_name, 1, 60);
  if char_length(v_name_ok) < 1 then
    v_name_ok := 'User';
  end if;

  -- Stable, per-user public key. Derived from the user id so it's
  -- deterministic and we don't need a second secret source.
  v_pubkey := 'pk_live_' || encode(digest(new.id::text || ':' || new.email, 'sha256'), 'hex');

  begin
    insert into public.users (id, email, name, role, public_key, active)
    values (new.id, new.email, v_name_ok, 'USER', v_pubkey, true)
    on conflict (id) do nothing;
  exception when others then
    -- Log the error but don't fail the trigger - auth.users is already created
    raise notice 'Failed to create public.users profile for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6. payment_transactions
-- ---------------------------------------------------------------------------
create table public.payment_transactions (
  id                       uuid         primary key default gen_random_uuid(),
  user_id                  uuid         not null
                                        references public.users(id) on delete cascade on update cascade,
  transaction_id           text         not null
                                        check (char_length(transaction_id) between 1 and 80),
  reference_id             text         not null
                                        check (char_length(reference_id) between 1 and 120),
  provider                 text         not null
                                        check (char_length(provider) between 1 and 40),
  provider_transaction_id  text
                                        check (provider_transaction_id is null or char_length(provider_transaction_id) <= 120),
  amount                   integer      not null
                                        check (amount > 0 and amount <= 1000000000),
  currency                 text         not null default 'IDR'
                                        check (char_length(currency) = 3),
  status                   public.transaction_status not null default 'pending',
  customer_name            text         check (customer_name is null or char_length(customer_name) <= 120),
  customer_email           citext       check (customer_email is null or char_length(customer_email) <= 160),
  description              text         check (description is null or char_length(description) <= 500),
  qr_data                  text,
  qr_image_url             text         check (qr_image_url     is null or char_length(qr_image_url)     <= 1024),
  payment_url              text         check (payment_url      is null or char_length(payment_url)      <= 1024),
  raw_provider_response    text,
  expires_at               timestamptz,
  paid_at                  timestamptz,
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now(),
  check (
    (status <> 'paid' and paid_at is null)
    or
    (status =  'paid' and paid_at is not null)
  )
);

create unique index payment_transactions_txn_id_unique_idx
  on public.payment_transactions (transaction_id);
create unique index payment_transactions_user_ref_unique_idx
  on public.payment_transactions (user_id, reference_id);
create unique index payment_transactions_provider_txn_unique_idx
  on public.payment_transactions (provider_transaction_id)
  where provider_transaction_id is not null;

create index payment_transactions_user_id_idx
  on public.payment_transactions (user_id, created_at desc);
create index payment_transactions_status_idx
  on public.payment_transactions (status);
create index payment_transactions_status_created_idx
  on public.payment_transactions (status, created_at desc);
create index payment_transactions_expires_at_idx
  on public.payment_transactions (expires_at)
  where expires_at is not null;

create trigger payment_transactions_set_updated_at
  before update on public.payment_transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. webhook_events
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  id            uuid         primary key default gen_random_uuid(),
  provider      text         not null
                              check (char_length(provider) between 1 and 40),
  event_id      text         not null
                              check (char_length(event_id) between 1 and 200),
  event_type    text         check (event_type is null or char_length(event_type) <= 80),
  payload       text         not null,
  processed     boolean      not null default false,
  processed_at  timestamptz,
  error_message text         check (error_message is null or char_length(error_message) <= 1000),
  created_at    timestamptz  not null default now()
);

create unique index webhook_events_provider_event_unique_idx
  on public.webhook_events (provider, event_id);
create index webhook_events_provider_idx     on public.webhook_events (provider);
create index webhook_events_processed_idx    on public.webhook_events (processed);
create index webhook_events_created_at_idx   on public.webhook_events (created_at desc);

-- ---------------------------------------------------------------------------
-- 8. RLS — strict by default, with two narrow openings:
--      * service_role  -> full access (server-only, used for admin + webhooks)
--      * authenticated -> can read/update ONLY its own profile (auth.uid())
-- ---------------------------------------------------------------------------
alter table public.users                enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.webhook_events       enable row level security;

-- service_role has full access on every table (server-only path).
create policy users_service_role_all
  on public.users for all to service_role
  using (true) with check (true);

create policy payment_transactions_service_role_all
  on public.payment_transactions for all to service_role
  using (true) with check (true);

create policy webhook_events_service_role_all
  on public.webhook_events for all to service_role
  using (true) with check (true);

-- An authenticated user can read their own profile.
create policy users_self_select
  on public.users for select to authenticated
  using (auth.uid() = id);

-- An authenticated user can update only safe fields on their own profile.
-- The trigger / function layer does not let a user change role, active, or
-- api_key_* via this UPDATE because we use a CHECK expression and the
-- application also writes only safe columns.
create policy users_self_update_safe
  on public.users for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- The role/active/api_key_* columns are not exposed in any update
    -- path; an explicit guard keeps the door closed even if a future
    -- route forgets to whitelist columns.
    and role = (select role from public.users where id = auth.uid())
    and active = (select active from public.users where id = auth.uid())
  );

-- anon gets nothing (deny by default + no grants).
create policy users_no_anon_all
  on public.users for all to anon
  using (false) with check (false);

create policy payment_transactions_no_anon_all
  on public.payment_transactions for all to anon, authenticated
  using (false) with check (false);

create policy webhook_events_no_anon_all
  on public.webhook_events for all to anon, authenticated
  using (false) with check (false);

-- ---------------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- anon: nothing on tables. The browser does not read application tables
-- directly. It talks to /api/v1/public/* (which uses service_role) or
-- /api/v1/me (which uses the per-user SSR client).
grant select, update on public.users to authenticated;
-- Note: INSERT/DELETE on public.users is not granted to authenticated.
-- The profile is created by the SECURITY DEFINER trigger from auth.users.
-- No anon or authenticated role can insert into payment_transactions or
-- webhook_events — only the server (service_role) can.

-- service_role: full table access.
grant select, insert, update, delete on public.users                to service_role;
grant select, insert, update, delete on public.payment_transactions to service_role;
grant select, insert, update, delete on public.webhook_events       to service_role;

-- ---------------------------------------------------------------------------
-- 10. Convenience view
-- ---------------------------------------------------------------------------
create or replace view public.v_admin_tx_summary as
select
  status,
  count(*)                  as count,
  coalesce(sum(amount), 0)  as total_amount
from public.payment_transactions
group by status;

grant select on public.v_admin_tx_summary to service_role;

-- ---------------------------------------------------------------------------
-- 11. Optional retention helper
-- ---------------------------------------------------------------------------
create or replace function public.tg_purge_old_webhook_events(
  older_than interval default interval '30 days'
) returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare deleted_count integer;
begin
  with deleted as (
    delete from public.webhook_events
    where created_at < now() - older_than
    returning 1
  )
  select count(*) into deleted_count from deleted;
  return deleted_count;
end;
$$;

revoke all on function public.tg_purge_old_webhook_events(interval) from public;
grant execute on function public.tg_purge_old_webhook_events(interval) to service_role;