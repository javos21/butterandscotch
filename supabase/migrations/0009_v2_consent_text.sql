-- V2 client revisions: store the consent text shown with each opt-in, and the pickup location.
--
-- Each opt-in keeps the exact text the customer was shown, next to the time it was given, so the
-- record shows what they agreed to. The text is set only when the opt-in turns on, from false to
-- true, with the same rule as broadcast_opt_in_at. Community consent text is set by its own
-- action in a later task; the column exists now so the customer record has both.
--
-- Orders also keep the pickup location the customer chose (null for delivery).

alter table public.customers
  add column broadcast_consent_text text,
  add column community_consent_text text;

alter table public.orders
  add column pickup_location text;

-- create_order_with_items: the 0008 function with the consent text and pickup location added.
-- Column references are qualified because the OUT parameters share names with table columns.
create or replace function public.create_order_with_items(order_data jsonb, items jsonb)
returns table (id uuid, order_number text, access_token text)
language plpgsql
set search_path = public
as $$
declare
  v_date date := (order_data->>'fulfil_date')::date;
  v_email text := lower(trim(order_data->>'email'));
  v_optin boolean := coalesce((order_data->>'broadcast_opt_in')::boolean, false);
  v_cap int;
  v_booked int;
  v_customer_id uuid;
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

  -- The customer row is locked by the upsert, so two orders from one email cannot race each other.
  insert into customers (
    email,
    name,
    phone,
    broadcast_opt_in,
    broadcast_opt_in_at,
    broadcast_consent_text,
    first_order_at,
    last_order_at
  )
  values (
    v_email,
    order_data->>'customer_name',
    order_data->>'phone',
    v_optin,
    case when v_optin then now() end,
    case when v_optin then order_data->>'broadcastConsentText' end,
    now(),
    now()
  )
  on conflict (email) do update set
    name = excluded.name,
    phone = excluded.phone,
    broadcast_opt_in = customers.broadcast_opt_in or excluded.broadcast_opt_in,
    broadcast_opt_in_at = case
      when excluded.broadcast_opt_in and not customers.broadcast_opt_in then now()
      else customers.broadcast_opt_in_at
    end,
    broadcast_consent_text = case
      when excluded.broadcast_opt_in and not customers.broadcast_opt_in then excluded.broadcast_consent_text
      else customers.broadcast_consent_text
    end,
    first_order_at = coalesce(customers.first_order_at, excluded.first_order_at),
    last_order_at = excluded.last_order_at
  returning customers.id into v_customer_id;

  insert into orders (
    access_token,
    idempotency_key,
    customer_id,
    customer_name,
    email,
    phone,
    fulfilment,
    delivery_address,
    pickup_location,
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
    v_customer_id,
    order_data->>'customer_name',
    v_email,
    order_data->>'phone',
    order_data->>'fulfilment',
    order_data->>'delivery_address',
    order_data->>'pickup_location',
    v_date,
    order_data->>'allergies',
    order_data->>'notes',
    v_optin,
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

-- Same grants as 0008: only the server, never anon or signed-in users, may place an order.
revoke execute on function public.create_order_with_items(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order_with_items(jsonb, jsonb) to service_role;
