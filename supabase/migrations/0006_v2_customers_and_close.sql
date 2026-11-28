-- V2 client revisions: customers, order close dates and pickup locations.
--
-- Delivery removal is deferred. orders.delivery_area_id, delivery_area_name, delivery_fee_cents, the
-- delivery_areas table, and the awaiting_quote status are still read and written by live checkout
-- (the create_order_with_items RPC) and the admin and customer order pages. Dropping them here would
-- break checkout, so the later task that removes that code drops them in a follow-up migration.

-- Customers ----------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  phone text,
  broadcast_opt_in boolean not null default false,
  broadcast_opt_in_at timestamptz,
  community_opt_in boolean not null default false,
  community_opt_in_at timestamptz,
  first_order_at timestamptz,
  last_order_at timestamptz,
  created_at timestamptz default now()
);

alter table customers enable row level security;

create policy customers_staff_all on customers
  for all using (is_staff()) with check (is_staff());

-- Same rules as 0004_grants.sql: staff and the server reach the table through RLS, anon never does.
grant select, insert, update, delete on table public.customers to authenticated, service_role;

-- Orders -------------------------------------------------------------------

alter table orders add column customer_id uuid references customers (id);

-- Settings -----------------------------------------------------------------

alter table settings
  add column order_close_date date not null default '2026-12-16',
  add column last_fulfilment_date date not null default '2026-12-23',
  add column pickup_locations text[] not null default '{West,Chaguanas}',
  add constraint settings_last_fulfilment_after_close
    check (last_fulfilment_date >= order_close_date);

-- The customer site needs the close dates and pickup locations, so the public view carries them.
create or replace view public_settings as
  select
    store_open,
    lead_time_days,
    daily_order_cap,
    pickup_info,
    policy_text,
    policy_version,
    whatsapp_number,
    order_close_date,
    last_fulfilment_date,
    pickup_locations
  from settings
  where id = 1;
