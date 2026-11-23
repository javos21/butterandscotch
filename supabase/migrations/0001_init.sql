-- Butter & Scotch: schema, order functions, row-level security, storage buckets.

create extension if not exists pgcrypto with schema extensions;

-- Helpers ------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Settings (single row, id = 1) --------------------------------------------

create table settings (
  id int primary key default 1 check (id = 1),
  store_open boolean not null default false,
  lead_time_days int not null default 5 check (lead_time_days between 1 and 60),
  daily_order_cap int not null default 10 check (daily_order_cap >= 1),
  bank_details jsonb not null default '{}'::jsonb,
  pickup_info text not null default '',
  policy_text text not null default '',
  policy_version int not null default 1,
  whatsapp_number text not null default '',
  notify_email text,
  updated_at timestamptz not null default now()
);

create trigger settings_updated_at
  before update on settings
  for each row execute function set_updated_at();

insert into settings (id) values (1);

-- Menu ---------------------------------------------------------------------

create table sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort int not null default 0
);

create table items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections (id) on delete restrict,
  name text not null,
  description text,
  unit_label text not null,
  price_cents int not null check (price_cents >= 0),
  image_url text,
  allergen_note text,
  seasonal boolean not null default false,
  flavours text[] not null default '{}',
  max_qty int not null default 10 check (max_qty between 1 and 100),
  active boolean not null default true,
  sort int not null default 0
);

create index items_section_id_idx on items (section_id);

-- Delivery areas. A null fee means "Other area": the order waits for a staff quote.

create table delivery_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee_cents int check (fee_cents is null or fee_cents >= 0),
  active boolean not null default true,
  sort int not null default 0
);

-- Dates the shop does not take orders for. Customers see these only as unavailable.

create table blocked_dates (
  date date primary key,
  note text
);

-- Orders -------------------------------------------------------------------

create sequence order_seq;

create function next_order_number()
returns text
language sql
volatile
as $$
  select 'BS-' || lpad(nextval('order_seq')::text, 4, '0');
$$;

-- Only the column default calls this, from inside service-role inserts. Customers must not
-- call it (it would leak the order count and burn sequence values).
revoke execute on function public.next_order_number() from public, anon, authenticated;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default next_order_number(),
  access_token text not null unique,
  idempotency_key text not null unique,
  customer_name text not null,
  email text not null,
  phone text not null,
  fulfilment text not null check (fulfilment in ('pickup', 'delivery')),
  delivery_area_id uuid references delivery_areas (id) on delete set null,
  delivery_area_name text,
  delivery_address text,
  delivery_fee_cents int,
  fulfil_date date not null,
  allergies text not null,
  notes text,
  marketing_opt_in boolean not null default false,
  subtotal_cents int not null check (subtotal_cents >= 0),
  adjustments_cents int not null default 0,
  total_cents int not null check (total_cents >= 0),
  status text not null default 'awaiting_payment' check (
    status in (
      'awaiting_quote',
      'awaiting_payment',
      'proof_submitted',
      'confirmed',
      'ready',
      'completed',
      'cancelled'
    )
  ),
  payment_window_started_at timestamptz,
  reminder_sent_at timestamptz,
  policy_version int not null,
  policy_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

create index orders_fulfil_date_active_idx on orders (fulfil_date) where status <> 'cancelled';
create index orders_status_idx on orders (status);
create index orders_email_idx on orders (email);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  item_id uuid references items (id) on delete set null,
  item_name text not null,
  flavour text,
  unit_label text not null,
  unit_price_cents int not null check (unit_price_cents >= 0),
  quantity int not null check (quantity between 1 and 100)
);

create index order_items_order_id_idx on order_items (order_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  amount_cents int not null check (amount_cents >= 0),
  reference text check (reference is null or char_length(reference) between 3 and 64),
  receipt_path text,
  status text not null default 'submitted' check (status in ('submitted', 'confirmed', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);

-- At most one open proof per order. A concurrent second submit fails with 23505.
create unique index payments_one_submitted_per_order
  on payments (order_id)
  where status = 'submitted';

create table order_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  amount_cents int not null,
  reason text not null,
  after_payment boolean not null default false,
  staff_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  refunded_on date not null,
  note text,
  staff_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  body text not null,
  staff_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  staff_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_events_order_id_idx on order_events (order_id);

create table email_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders (id) on delete cascade,
  template text not null,
  to_email text not null,
  provider_id text,
  error text,
  sent_at timestamptz not null default now()
);

-- Staff --------------------------------------------------------------------

create table staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null
);

create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;

-- Public settings view: everything the customer site needs, without notify_email.

create view public_settings as
  select
    store_open,
    lead_time_days,
    daily_order_cap,
    pickup_info,
    policy_text,
    policy_version,
    whatsapp_number
  from settings
  where id = 1;

-- Order writes -------------------------------------------------------------

-- Writes an order and its items in one transaction. Called from the server with the
-- service role. Serialises per fulfilment date, so two checkouts for the last slot cannot both pass.
-- Column references are qualified because the OUT parameters share names with table columns.
create or replace function public.create_order_with_items(order_data jsonb, items jsonb)
returns table (id uuid, order_number text, access_token text)
language plpgsql
set search_path = public
as $$
declare
  v_date date := (order_data->>'fulfil_date')::date;
  v_cap int;
  v_booked int;
  new_order_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('fulfil:' || (order_data->>'fulfil_date')));

  if exists (select 1 from blocked_dates b where b.date = v_date) then
    raise exception 'date_unavailable';
  end if;

  select s.daily_order_cap into v_cap from settings s where s.id = 1;
  select count(*) into v_booked
    from orders o
    where o.fulfil_date = v_date and o.status <> 'cancelled';
  if v_booked >= v_cap then
    raise exception 'date_unavailable';
  end if;

  insert into orders (
    access_token,
    idempotency_key,
    customer_name,
    email,
    phone,
    fulfilment,
    delivery_area_id,
    delivery_area_name,
    delivery_address,
    delivery_fee_cents,
    fulfil_date,
    allergies,
    notes,
    marketing_opt_in,
    subtotal_cents,
    adjustments_cents,
    total_cents,
    status,
    payment_window_started_at,
    policy_version,
    policy_accepted_at
  )
  values (
    order_data->>'access_token',
    order_data->>'idempotency_key',
    order_data->>'customer_name',
    order_data->>'email',
    order_data->>'phone',
    order_data->>'fulfilment',
    nullif(order_data->>'delivery_area_id', '')::uuid,
    order_data->>'delivery_area_name',
    order_data->>'delivery_address',
    nullif(order_data->>'delivery_fee_cents', '')::int,
    v_date,
    order_data->>'allergies',
    order_data->>'notes',
    coalesce((order_data->>'marketing_opt_in')::boolean, false),
    (order_data->>'subtotal_cents')::int,
    coalesce((order_data->>'adjustments_cents')::int, 0),
    (order_data->>'total_cents')::int,
    coalesce(order_data->>'status', 'awaiting_payment'),
    nullif(order_data->>'payment_window_started_at', '')::timestamptz,
    (order_data->>'policy_version')::int,
    (order_data->>'policy_accepted_at')::timestamptz
  )
  returning orders.id into new_order_id;

  insert into order_items (
    order_id,
    item_id,
    item_name,
    flavour,
    unit_label,
    unit_price_cents,
    quantity
  )
  select
    new_order_id,
    nullif(item->>'item_id', '')::uuid,
    item->>'item_name',
    item->>'flavour',
    item->>'unit_label',
    (item->>'unit_price_cents')::int,
    (item->>'quantity')::int
  from jsonb_array_elements(items) as item;

  return query
    select o.id, o.order_number, o.access_token
    from orders o
    where o.id = new_order_id;
end;
$$;

revoke execute on function public.create_order_with_items(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order_with_items(jsonb, jsonb) to service_role;

-- Public availability: blocked dates plus dates at or over the cap. Nothing else leaks.

create or replace function public.public_unavailable_dates(from_date date, to_date date)
returns setof date
language sql
stable
security definer
set search_path = public
as $$
  select b.date
  from blocked_dates b
  where b.date between from_date and to_date
  union
  select o.fulfil_date
  from orders o
  cross join settings s
  where s.id = 1
    and o.fulfil_date between from_date and to_date
    and o.status <> 'cancelled'
  group by o.fulfil_date, s.daily_order_cap
  having count(*) >= s.daily_order_cap;
$$;

revoke execute on function public.public_unavailable_dates(date, date) from public;
grant execute on function public.public_unavailable_dates(date, date) to anon, authenticated;

-- Row-level security -------------------------------------------------------

alter table settings enable row level security;
alter table sections enable row level security;
alter table items enable row level security;
alter table delivery_areas enable row level security;
alter table blocked_dates enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table order_adjustments enable row level security;
alter table refunds enable row level security;
alter table order_notes enable row level security;
alter table order_events enable row level security;
alter table email_log enable row level security;
alter table staff enable row level security;

-- Anonymous and signed-in visitors: the menu and delivery areas (active rows only).
-- Settings are read through public_settings, which has no anon policy on the base table.
create policy sections_public_read on sections
  for select to anon, authenticated
  using (true);

create policy items_public_read on items
  for select to anon, authenticated
  using (active);

create policy delivery_areas_public_read on delivery_areas
  for select to anon, authenticated
  using (active);

grant select on public_settings to anon, authenticated;

-- Staff: full access to every table.
create policy settings_staff_all on settings
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy sections_staff_all on sections
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy items_staff_all on items
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy delivery_areas_staff_all on delivery_areas
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy blocked_dates_staff_all on blocked_dates
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy orders_staff_all on orders
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy order_items_staff_all on order_items
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy payments_staff_all on payments
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy order_adjustments_staff_all on order_adjustments
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy refunds_staff_all on refunds
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy order_notes_staff_all on order_notes
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy order_events_staff_all on order_events
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy email_log_staff_all on email_log
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy staff_staff_all on staff
  for all to authenticated
  using (is_staff()) with check (is_staff());

-- Storage ------------------------------------------------------------------

-- receipts: private. Only staff may read; customers upload via the service role.
-- items: public read. Only staff may write.
insert into storage.buckets (id, name, public)
values
  ('receipts', 'receipts', false),
  ('items', 'items', true)
on conflict (id) do nothing;

create policy receipts_staff_select on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and is_staff());

create policy items_public_read_objects on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'items');

create policy items_staff_write_objects on storage.objects
  for all to authenticated
  using (bucket_id = 'items' and is_staff())
  with check (bucket_id = 'items' and is_staff());
