-- V2 client revisions: remove delivery fee estimation and the quote flow.
--
-- Delivery is now charged separately, on delivery, so checkout no longer looks up an area or a fee.
-- Order of work matters: checkout stops writing the delivery columns first, then the columns, the
-- table and the awaiting_quote status are removed.

-- 1. create_order_with_items no longer writes delivery_area_id, delivery_area_name or
--    delivery_fee_cents, and every new order starts at awaiting_payment.
--    Column references are qualified because the OUT parameters share names with table columns.
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

  select coalesce(s.daily_order_cap, 0) into v_cap from settings s where s.id = 1;
  select count(*) into v_booked
    from orders o
    where o.fulfil_date = v_date and o.status <> 'cancelled';
  if v_booked >= coalesce(v_cap, 0) then
    raise exception 'date_unavailable';
  end if;

  insert into orders (
    access_token,
    idempotency_key,
    customer_name,
    email,
    phone,
    fulfilment,
    delivery_address,
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
    order_data->>'delivery_address',
    v_date,
    order_data->>'allergies',
    order_data->>'notes',
    coalesce((order_data->>'marketing_opt_in')::boolean, false),
    (order_data->>'subtotal_cents')::int,
    coalesce((order_data->>'adjustments_cents')::int, 0),
    (order_data->>'total_cents')::int,
    'awaiting_payment',
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

-- 2. Drop the delivery columns from orders. The foreign key on delivery_area_id goes with it.
--    Guard: refuse to run while an order still waits for a quote, since that state is being removed.
do $$
begin
  if exists (select 1 from orders where status = 'awaiting_quote') then
    raise exception 'orders still awaiting a delivery quote; settle them before running migration 0007';
  end if;
end;
$$;

alter table orders
  drop column delivery_area_id,
  drop column delivery_area_name,
  drop column delivery_fee_cents;

-- 3. Drop the delivery_areas table (its policies and grants go with it).
drop table delivery_areas;

-- 4. Replace the orders status check so awaiting_quote is refused.
alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check check (
  status in (
    'awaiting_payment',
    'proof_submitted',
    'confirmed',
    'ready',
    'completed',
    'cancelled'
  )
);
