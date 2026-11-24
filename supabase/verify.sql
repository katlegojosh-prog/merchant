-- THE MERCHANT — database guarantees under test
--
-- Proves the RLS policies, grant narrowing and the products_guard_update
-- trigger in supabase/schema.sql still do what they claim, so a change to the
-- schema cannot quietly reopen the holes closed in #2 and #3.
--
--   psql -v ON_ERROR_STOP=1 -f supabase/verify.sql
--
-- Run it against a THROWAWAY database only: it creates the anon /
-- authenticated / service_role roles, an auth.users stand-in and a little demo
-- data, and leaves them behind. Every failing check raises an exception and
-- stops the run, so exit status 0 means all 30 checks passed.

\set ON_ERROR_STOP on

-- ── Supabase stand-ins ──────────────────────────────────────────────────────
-- The schema depends on these existing in the hosted project, so recreate the
-- parts it touches. Roles already present (a real Supabase database) are kept.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

-- Same contract as Supabase's auth.uid(): the JWT subject, or null for
-- key/service connections and the SQL editor.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase hands every client role full access to newly created public objects
-- by default; schema.sql then narrows it. Reproduce that or the revokes under
-- test would be no-ops.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ── Apply the schema exactly as written ─────────────────────────────────────
\ir schema.sql

-- ── Check helpers ───────────────────────────────────────────────────────────
-- The counter is a sequence because sequences (unlike tables) survive the
-- rollbacks the behavioural checks run inside.
drop schema if exists verify cascade;
create schema verify;
grant usage on schema verify to public;

create sequence verify.checks;
grant usage, select on sequence verify.checks to public;

create function verify.check(label text, ok boolean) returns void
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('verify.checks');
  if ok is not true then
    raise exception 'CHECK % FAILED — %', n, label;
  end if;
  raise notice 'ok % — %', n, label;
end
$$;

-- Runs statement and expects it to be rejected. want_sqlstate / want_message
-- pin down *why* it was rejected, so a check can't pass on the wrong error.
create function verify.expect_error(
  label text,
  statement text,
  want_sqlstate text,
  want_message text default null
) returns void
language plpgsql
as $$
declare
  n bigint;
begin
  begin
    execute statement;
  exception when others then
    n := nextval('verify.checks');
    if sqlstate is distinct from want_sqlstate then
      raise exception 'CHECK % FAILED — % (SQLSTATE % instead of %: %)',
        n, label, sqlstate, want_sqlstate, sqlerrm;
    end if;
    if want_message is not null and position(want_message in sqlerrm) = 0 then
      raise exception 'CHECK % FAILED — % (message was "%")', n, label, sqlerrm;
    end if;
    raise notice 'ok % — %', n, label;
    return;
  end;

  n := nextval('verify.checks');
  raise exception 'CHECK % FAILED — % (statement should have been rejected)', n, label;
end
$$;

grant execute on all functions in schema verify to public;

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'manager@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'staff@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'staff2@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'newcomer@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'outsider@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, name, full_name, email, role, plan) values
  ('11111111-1111-4111-8111-111111111111', 'Manager',    'Store Manager', 'manager@example.test', 'Manager', 'free'),
  ('22222222-2222-4222-8222-222222222222', 'Staff',      'Staff Member',  'staff@example.test',   'Staff',   'free'),
  ('33333333-3333-4333-8333-333333333333', 'Staff Two',  'Staff Two',     'staff2@example.test',  'Staff',   'free')
on conflict (id) do nothing;

insert into public.products (id, name, size, barcode, quantity, expiry_date, status, created_by) values
  ('5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a', 'Milk', '1L', '9300000000017', 1, current_date + 7, 'in-stock',
   '22222222-2222-4222-8222-222222222222')
on conflict (id) do nothing;

-- ══ Structural guarantees ═══════════════════════════════════════════════════
select verify.check(
  'the three tables exist',
  to_regclass('public.profiles') is not null
  and to_regclass('public.products') is not null
  and to_regclass('public.product_events') is not null
);

select verify.check(
  'row level security is on for products',
  (select relrowsecurity from pg_class where oid = 'public.products'::regclass)
);

select verify.check(
  'row level security is on for profiles',
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass)
);

select verify.check(
  'row level security is on for product_events',
  (select relrowsecurity from pg_class where oid = 'public.product_events'::regclass)
);

select verify.check(
  'products_guard_update is a BEFORE UPDATE, FOR EACH ROW trigger',
  -- tgtype 19 = ROW (1) | BEFORE (2) | UPDATE (16)
  (select tgtype = 19
          and tgfoid = 'public.products_guard_update()'::regprocedure
     from pg_trigger
    where tgrelid = 'public.products'::regclass
      and tgname = 'products_guard_update'
      and not tgisinternal)
);

-- ══ Privileges ══════════════════════════════════════════════════════════════
select verify.check(
  'authenticated has no table-wide UPDATE on products',
  not has_table_privilege('authenticated', 'public.products', 'UPDATE')
);

select verify.check(
  'authenticated may UPDATE exactly the nine detail/close-out columns',
  (select bool_and(has_column_privilege('authenticated', 'public.products', c, 'UPDATE'))
     from unnest(array['name', 'size', 'barcode', 'quantity', 'expiry_date',
                       'status', 'updated_by', 'closed_at', 'closed_by']) as c)
);

select verify.check(
  'products.id and products.created_by cannot be rewritten',
  not has_column_privilege('authenticated', 'public.products', 'id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.products', 'created_by', 'UPDATE')
);

select verify.check(
  'profiles.role and profiles.plan cannot be rewritten',
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'plan', 'UPDATE')
);

select verify.check(
  'product_events is append-only for clients',
  not has_table_privilege('authenticated', 'public.product_events', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.product_events', 'DELETE')
  and not has_table_privilege('authenticated', 'public.product_events', 'TRUNCATE')
);

select verify.check(
  'anon has no write grant on products or profiles',
  not has_table_privilege('anon', 'public.products', 'INSERT')
  and not has_table_privilege('anon', 'public.products', 'UPDATE')
  and not has_table_privilege('anon', 'public.products', 'DELETE')
  and not has_table_privilege('anon', 'public.profiles', 'INSERT')
  and not has_table_privilege('anon', 'public.profiles', 'UPDATE')
  and not has_table_privilege('anon', 'public.profiles', 'DELETE')
);

select verify.check(
  'anon cannot execute is_manager()',
  not has_function_privilege('anon', 'public.is_manager()', 'EXECUTE')
);

-- ══ Profiles: the manager hole from #3 ══════════════════════════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);

select verify.expect_error(
  'a user cannot create themselves as a Manager',
  $stmt$insert into public.profiles (id, full_name, role)
        values ('44444444-4444-4444-8444-444444444444', 'Newcomer', 'Manager')$stmt$,
  '42501'
);

insert into public.profiles (id, full_name)
values ('44444444-4444-4444-8444-444444444444', 'Newcomer');

select verify.check(
  'a new profile falls back to role Staff and plan free',
  (select role = 'Staff' and plan = 'free'
     from public.profiles
    where id = '44444444-4444-4444-8444-444444444444')
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

select verify.expect_error(
  'a user cannot create a profile for someone else',
  $stmt$insert into public.profiles (id, full_name)
        values ('55555555-5555-4555-8555-555555555555', 'Outsider')$stmt$,
  '42501'
);

select verify.expect_error(
  'a user cannot promote themselves to Manager',
  $stmt$update public.profiles set role = 'Manager'
         where id = '22222222-2222-4222-8222-222222222222'$stmt$,
  '42501'
);
rollback;

-- ══ Products: staff close out, managers edit ════════════════════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

select verify.expect_error(
  'staff cannot rewrite a product''s details',
  $stmt$update public.products set name = 'Oat milk'
         where id = '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a'$stmt$,
  '42501',
  'Only a manager can change product details.'
);

select verify.expect_error(
  'staff cannot quietly adjust stock levels',
  $stmt$update public.products set quantity = 3
         where id = '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a'$stmt$,
  '42501',
  'Only a manager can change product details.'
);
with closed as (
  update public.products
     set status = 'sold',
         closed_at = now(),
         closed_by = 'staff@example.test',
         updated_by = 'staff@example.test'
   where id = '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a'
  returning 1
)
select verify.check(
  'staff can close a product out',
  (select count(*) from closed) = 1
);

select verify.expect_error(
  'staff cannot reassign a product''s owner',
  $stmt$update public.products set created_by = '11111111-1111-4111-8111-111111111111'
         where id = '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a'$stmt$,
  '42501'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

with edited as (
  update public.products
     set name = 'Whole milk', size = '2L'
   where id = '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a'
  returning 1
)
select verify.check(
  'a manager can edit product details',
  (select count(*) from edited) = 1
);
rollback;

-- Service role / SQL editor: no JWT, so the guard stays out of the way.
begin;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);

with maintained as (
  update public.products set name = 'Milk (renamed in bulk)'
   where id = '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a'
  returning 1
)
select verify.check(
  'the service-role path can still run maintenance updates',
  (select count(*) from maintained) = 1
);
rollback;

-- ══ Product inserts ═════════════════════════════════════════════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

select verify.expect_error(
  'staff cannot add a product under someone else''s name',
  $stmt$insert into public.products (name, expiry_date, created_by)
        values ('Butter', current_date + 30, '11111111-1111-4111-8111-111111111111')$stmt$,
  '42501'
);
rollback;

-- Unreachable statuses are rejected before the app has to render them.
select verify.expect_error(
  'the status constraint rejects values the app cannot render',
  $stmt$insert into public.products (name, expiry_date, status)
        values ('Yoghurt', current_date + 3, 'expired')$stmt$,
  '23514'
);

-- ══ Product events: append-only, own-or-manager reads ═══════════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

insert into public.product_events
  (product_id, product_name, action, from_status, to_status, actor_id, actor_email)
values
  ('5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a', 'Milk', 'sold', 'in-stock', 'sold',
   '22222222-2222-4222-8222-222222222222', 'staff@example.test');

select verify.check(
  'staff can append their own event',
  (select count(*) from public.product_events
    where actor_id = '22222222-2222-4222-8222-222222222222') = 1
);

select verify.expect_error(
  'staff cannot write an event as someone else',
  $stmt$insert into public.product_events (action, actor_id)
        values ('trashed', '33333333-3333-4333-8333-333333333333')$stmt$,
  '42501'
);

select verify.expect_error(
  'history cannot be rewritten',
  $stmt$update public.product_events set action = 'trashed'$stmt$,
  '42501'
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

select verify.check(
  'a teammate cannot read another user''s events',
  (select count(*) from public.product_events) = 0
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select verify.check(
  'a manager reads the whole trail',
  (select count(*) from public.product_events) = 1
);
rollback;

-- ══ Anonymous visitors ══════════════════════════════════════════════════════
begin;
set local role anon;

select verify.check(
  'anonymous visitors see no products',
  (select count(*) from public.products) = 0
);
rollback;

-- ══ Summary ═════════════════════════════════════════════════════════════════
do $$
declare
  ran bigint;
begin
  select case when is_called then last_value else 0 end into ran from verify.checks;
  if ran is distinct from 30 then
    raise exception 'expected 30 checks, ran %', coalesce(ran, 0);
  end if;
  raise notice 'PASS — %/% checks passed', ran, ran;
end
$$;

drop schema verify cascade;
