-- ============================================================
-- REFINER × THE MERCHANT
-- Phase 0: Engagement Events Schema + Metric Views
-- Ready to run in Supabase SQL Editor
-- Generated: 2026-11-27
-- ============================================================

-- 1. Engagement events table (append-only)
create table if not exists public.engagement_events (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid,                          -- optional multi-tenant
  user_id       uuid references auth.users(id) on delete set null,
  event_type    text not null check (event_type in (
                  'session_start', 'session_end',
                  'product_added', 'product_edited',
                  'status_changed',
                  'digest_copied',
                  'camera_opened', 'barcode_success', 'barcode_fail',
                  'team_invite'
                )),
  product_id    uuid,                          -- nullable
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists engagement_events_shop_created_idx
  on public.engagement_events (shop_id, created_at desc);

create index if not exists engagement_events_type_created_idx
  on public.engagement_events (event_type, created_at desc);

create index if not exists engagement_events_user_created_idx
  on public.engagement_events (user_id, created_at desc);

create index if not exists engagement_events_product_idx
  on public.engagement_events (product_id)
  where product_id is not null;

-- RLS (adjust policies to your existing shop/user model)
alter table public.engagement_events enable row level security;

-- Example: authenticated users can insert their own events
-- (tighten to shop membership in production)
create policy "Users can insert own engagement events"
  on public.engagement_events for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own engagement events"
  on public.engagement_events for select
  to authenticated
  using (auth.uid() = user_id);

-- Managers / service role can read all (extend with your role claim)
-- create policy "Managers can read all events" ...

comment on table public.engagement_events is
  'REFINER Phase 0 — append-only engagement events for THE MERCHANT metrics';


-- 2. Helper view: daily active staff (last 30 days)
create or replace view public.v_daily_active_staff as
select
  date_trunc('day', created_at)::date as day,
  shop_id,
  count(distinct user_id) as daily_active_staff
from public.engagement_events
where event_type in ('product_added', 'status_changed', 'product_edited', 'digest_copied')
  and created_at >= now() - interval '30 days'
group by 1, 2
order by 1 desc;

comment on view public.v_daily_active_staff is
  'REFINER metric: Daily Active Staff (DAS)';


-- 3. Helper view: status change velocity & resolution support
create or replace view public.v_status_changes as
select
  e.id,
  e.shop_id,
  e.user_id,
  e.product_id,
  e.created_at,
  e.metadata->>'from_status' as from_status,
  e.metadata->>'to_status'   as to_status,
  (e.metadata->>'days_to_expiry')::numeric as days_to_expiry
from public.engagement_events e
where e.event_type = 'status_changed';


-- 4. Shelf Health Score components (example daily snapshot function)
-- Call with a shop_id (or null for single-tenant). Returns a 0-100 score.
create or replace function public.shelf_health_score(p_shop_id uuid default null)
returns table (
  urgent_ratio       numeric,
  resolution_rate    numeric,
  avg_freshness_days numeric,
  health_score       numeric
)
language sql
stable
as $$
  with products as (
    -- Assumes existing public.products table with status, expiry_date
    select
      id,
      status,
      expiry_date,
      case
        when expiry_date is null then null
        else (expiry_date::date - current_date)
      end as days_left
    from public.products
    where (p_shop_id is null or shop_id = p_shop_id)
      and status = 'in-stock'
  ),
  urgent as (
    select count(*) filter (where days_left <= 0) as urgent_cnt,
           count(*) as total_cnt
    from products
  ),
  recent_closes as (
    select
      count(*) filter (where (metadata->>'days_to_expiry')::numeric <= 0
                       and created_at >= current_date - interval '2 days') as resolved_urgent,
      count(*) filter (where (metadata->>'days_to_expiry')::numeric <= 0
                       and created_at >= current_date - interval '7 days') as urgent_seen
    from public.engagement_events
    where event_type = 'status_changed'
      and (p_shop_id is null or shop_id = p_shop_id)
  )
  select
    coalesce(u.urgent_cnt::numeric / nullif(u.total_cnt, 0), 0) as urgent_ratio,
    coalesce(r.resolved_urgent::numeric / nullif(r.urgent_seen, 0), 1) as resolution_rate,
    coalesce(avg(p.days_left) filter (where p.days_left is not null), 14) as avg_freshness_days,
    -- Composite: (1 - urgent_ratio)*40 + resolution*30 + freshness_factor*30
    least(100, greatest(0,
      round(
        (1 - coalesce(u.urgent_cnt::numeric / nullif(u.total_cnt, 0), 0)) * 40
        + coalesce(r.resolved_urgent::numeric / nullif(r.urgent_seen, 0), 1) * 30
        + least(1, greatest(0, coalesce(avg(p.days_left) filter (where p.days_left is not null), 14) / 14.0)) * 30
      , 1)
    )) as health_score
  from urgent u, recent_closes r, products p
  group by u.urgent_cnt, u.total_cnt, r.resolved_urgent, r.urgent_seen;
$$;

comment on function public.shelf_health_score is
  'REFINER Shelf Health Score (0-100). Components: urgent_ratio, resolution_rate, avg_freshness.';


-- 5. Simple daily digest engagement
create or replace view public.v_digest_engagement as
select
  date_trunc('day', created_at)::date as day,
  shop_id,
  count(*) filter (where event_type = 'digest_copied') as digests_copied,
  count(*) filter (where event_type = 'session_start') as sessions
from public.engagement_events
where created_at >= now() - interval '30 days'
group by 1, 2
order by 1 desc;


-- 6. Camera funnel
create or replace view public.v_camera_funnel as
select
  date_trunc('day', created_at)::date as day,
  shop_id,
  count(*) filter (where event_type = 'camera_opened') as camera_opens,
  count(*) filter (where event_type = 'barcode_success') as barcode_successes,
  count(*) filter (where event_type = 'barcode_fail') as barcode_fails,
  count(*) filter (where event_type = 'product_added') as products_added
from public.engagement_events
where created_at >= now() - interval '30 days'
group by 1, 2
order by 1 desc;

-- ============================================================
-- END Phase 0 schema
-- After running: grant select on the views to authenticated / service_role as needed.
-- Client instrumentation: insert into engagement_events from the React app
-- on the corresponding user actions (see Event Catalog in backlog workbook).
-- ============================================================
