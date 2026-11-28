-- ============================================================
-- REFINER × THE MERCHANT — Phase 2+ Supporting Objects
-- (Optional — run after Phase 0 schema)
-- ============================================================

create table if not exists public.shop_settings (
  shop_id       uuid primary key,
  urgent_days   int not null default 0,
  warn_days     int not null default 2,
  digest_hour   int not null default 7,
  digest_enabled boolean not null default true,
  unit_cost_enabled boolean not null default false,
  updated_at    timestamptz default now()
);

-- Optional columns on products (uncomment when ready)
-- alter table public.products add column if not exists unit_cost numeric(10,2);
-- alter table public.products add column if not exists category text;
-- alter table public.products add column if not exists supplier_notes text;
-- alter table public.products add column if not exists photo_url text;

comment on table public.shop_settings is 'REFINER Phase 2 — per-shop urgency & digest configuration';
