-- ============================================================
-- REFINER × THE MERCHANT — Advanced Analytics Objects
-- Run AFTER REFINER_Merchant_Event_Schema.sql
-- ============================================================

-- 1. Daily Health Score snapshots (for trends)
create table if not exists public.health_score_snapshots (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid,
  snapshot_date date not null,
  urgent_ratio  numeric,
  resolution_rate numeric,
  avg_freshness_days numeric,
  health_score  numeric,
  created_at    timestamptz default now(),
  unique (shop_id, snapshot_date)
);

create index if not exists health_score_snapshots_date_idx
  on public.health_score_snapshots (snapshot_date desc);

-- Helper to insert today's snapshot (call from Edge Function / cron)
create or replace function public.snapshot_health_score(p_shop_id uuid default null)
returns void
language plpgsql
as $$
begin
  insert into public.health_score_snapshots (
    shop_id, snapshot_date, urgent_ratio, resolution_rate, avg_freshness_days, health_score
  )
  select
    p_shop_id,
    current_date,
    urgent_ratio,
    resolution_rate,
    avg_freshness_days,
    health_score
  from public.shelf_health_score(p_shop_id)
  on conflict (shop_id, snapshot_date) do update set
    urgent_ratio = excluded.urgent_ratio,
    resolution_rate = excluded.resolution_rate,
    avg_freshness_days = excluded.avg_freshness_days,
    health_score = excluded.health_score,
    created_at = now();
end;
$$;

-- 2. Health Score trend view (last 30 days)
create or replace view public.v_health_score_trend as
select
  snapshot_date,
  shop_id,
  health_score,
  urgent_ratio,
  resolution_rate,
  avg_freshness_days,
  health_score - lag(health_score) over (partition by shop_id order by snapshot_date) as delta
from public.health_score_snapshots
where snapshot_date >= current_date - interval '30 days'
order by snapshot_date desc;

-- 3. Camera funnel (daily)
create or replace view public.v_camera_funnel_daily as
select
  date_trunc('day', created_at)::date as day,
  shop_id,
  count(*) filter (where event_type = 'camera_opened')   as opens,
  count(*) filter (where event_type = 'barcode_success') as successes,
  count(*) filter (where event_type = 'barcode_fail')    as fails,
  count(*) filter (where event_type = 'product_added')   as products_added,
  case when count(*) filter (where event_type = 'camera_opened') > 0
       then round(
         100.0 * count(*) filter (where event_type = 'barcode_success')
         / count(*) filter (where event_type = 'camera_opened'), 1)
       else null end as open_to_success_pct,
  case when count(*) filter (where event_type = 'barcode_success') > 0
       then round(
         100.0 * count(*) filter (where event_type = 'product_added')
         / count(*) filter (where event_type = 'barcode_success'), 1)
       else null end as success_to_add_pct
from public.engagement_events
where created_at >= now() - interval '30 days'
group by 1, 2
order by 1 desc;

-- 4. Staff activity summary (manager only)
create or replace view public.v_staff_activity_summary as
select
  user_id,
  shop_id,
  count(*) filter (where event_type = 'status_changed') as closes,
  count(*) filter (where event_type = 'product_added')  as adds,
  count(distinct date_trunc('day', created_at))         as active_days,
  min(created_at) as first_seen,
  max(created_at) as last_seen
from public.engagement_events
where created_at >= now() - interval '30 days'
  and event_type in ('status_changed', 'product_added', 'digest_copied')
group by 1, 2;

-- 5. Urgent items by day-of-week and hour (heatmap source)
create or replace view public.v_urgent_by_dow_hour as
select
  extract(dow from created_at)  as day_of_week,
  extract(hour from created_at) as hour_of_day,
  shop_id,
  count(*) as event_count
from public.engagement_events
where event_type = 'status_changed'
  and (metadata->>'days_to_expiry')::numeric <= 0
  and created_at >= now() - interval '60 days'
group by 1, 2, 3
order by 1, 2;

-- 6. Simple SKU risk score (predictive sketch)
create or replace function public.sku_risk_score(p_product_id uuid)
returns numeric
language sql
stable
as $$
  select
    least(100, greatest(0,
      case
        when p.status != 'in-stock' then 0
        when p.expiry_date is null then 20
        when (p.expiry_date::date - current_date) <= 0 then 95
        when (p.expiry_date::date - current_date) <= 2 then 70
        when (p.expiry_date::date - current_date) <= 5 then 40
        else 15
      end
      + least(20, coalesce(p.quantity, 1) * 2)
    ))
  from public.products p
  where p.id = p_product_id;
$$;

-- 7. Priority Close List (prescriptive)
create or replace function public.priority_close_list(p_shop_id uuid default null, p_limit int default 10)
returns table (
  product_id uuid,
  name text,
  days_left int,
  quantity int,
  risk_score numeric,
  reason text
)
language sql
stable
as $$
  select
    p.id,
    p.name,
    (p.expiry_date::date - current_date)::int as days_left,
    p.quantity,
    public.sku_risk_score(p.id) as risk_score,
    case
      when (p.expiry_date::date - current_date) <= 0 then 'Already expired — close to clear urgent'
      when (p.expiry_date::date - current_date) <= 2 then 'Expires within 2 days — high priority'
      else 'Approaching window'
    end as reason
  from public.products p
  where p.status = 'in-stock'
    and (p_shop_id is null or p.shop_id = p_shop_id)
    and p.expiry_date is not null
  order by public.sku_risk_score(p.id) desc, p.expiry_date asc
  limit p_limit;
$$;

comment on function public.priority_close_list is
  'REFINER prescriptive: ranked list of products whose close-out most improves Shelf Health Score';

-- 8. Digest-to-action lag (diagnostic)
create or replace view public.v_digest_to_action_lag as
with digests as (
  select user_id, shop_id, created_at as digest_at
  from public.engagement_events
  where event_type = 'digest_copied'
    and created_at >= now() - interval '30 days'
),
next_actions as (
  select
    d.user_id,
    d.shop_id,
    d.digest_at,
    min(e.created_at) as first_action_at
  from digests d
  left join public.engagement_events e
    on e.user_id = d.user_id
   and e.event_type = 'status_changed'
   and e.created_at > d.digest_at
   and e.created_at < d.digest_at + interval '24 hours'
  group by 1, 2, 3
)
select
  user_id,
  shop_id,
  digest_at,
  first_action_at,
  extract(epoch from (first_action_at - digest_at)) / 60 as lag_minutes
from next_actions
where first_action_at is not null;

-- ============================================================
-- END Advanced Analytics objects
-- Schedule snapshot_health_score() daily via Edge Function or pg_cron
-- ============================================================
