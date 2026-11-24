-- THE MERCHANT — products expiry tracker schema
-- Run in Supabase → SQL Editor (or apply as a migration).

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  email text,
  role text default 'Staff',
  plan text default 'free'
);

-- Existing projects: reconcile column names without dropping anything.
-- Some deployments created this table with full_name instead of name.
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text default 'Staff';
alter table public.profiles add column if not exists plan text default 'free';

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size text,
  barcode text,
  quantity int default 1,
  expiry_date date not null,
  -- in-stock | active            → on the shelf
  -- sold | trashed | stock-out    → closed out (history)
  status text default 'in-stock',
  created_by uuid references auth.users on delete set null,
  updated_by text  -- email of whoever last edited / closed the product
);

-- Add size column if missing (for existing deployments)
alter table public.products add column if not exists size text;

-- Older databases used 'active' as the default.
alter table public.products alter column status set default 'in-stock';

-- Close-out attribution (who closed it and when), for History + undo.
alter table public.products add column if not exists closed_at timestamptz;
alter table public.products add column if not exists closed_by text;

create index if not exists products_expiry_idx on public.products (expiry_date);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_closed_idx on public.products (closed_at desc);

-- Audit trail: one row per add / edit / close-out / undo.
create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products on delete set null,
  product_name text,
  action text not null,          -- created | updated | sold | trashed | stock-out | reopened
  from_status text,
  to_status text,
  actor_id uuid,
  actor_email text,
  created_at timestamptz default now()
);

create index if not exists product_events_created_idx on public.product_events (created_at desc);
create index if not exists product_events_product_idx on public.product_events (product_id);

alter table public.product_events enable row level security;

alter table public.products enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Logged-in users can read products" on public.products;
create policy "Logged-in users can read products"
  on public.products for select to authenticated using (true);

drop policy if exists "Logged-in users can insert products" on public.products;
create policy "Logged-in users can insert products"
  on public.products for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "Logged-in users can update products" on public.products;
create policy "Logged-in users can update products"
  on public.products for update to authenticated using (true) with check (true);

-- Managers read the whole trail; staff read their own actions.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'Manager'
  )
$$;

revoke all on function public.is_manager() from anon;
grant execute on function public.is_manager() to authenticated;

drop policy if exists "Logged-in users can read events" on public.product_events;
drop policy if exists "Read events: own or manager" on public.product_events;
create policy "Read events: own or manager"
  on public.product_events for select to authenticated
  using (actor_id = auth.uid() or public.is_manager());

drop policy if exists "Logged-in users can write own events" on public.product_events;
create policy "Logged-in users can write own events"
  on public.product_events for insert to authenticated with check (auth.uid() = actor_id);

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- First manager bootstrap: after creating the first auth user, add their row.
--   insert into public.profiles (id, full_name, role)
--   values ('<auth-user-id>', 'Store Manager', 'Manager');

-- Migrate legacy statuses once (safe to re-run).
update public.products set status = 'in-stock' where status is null or status = 'active';
