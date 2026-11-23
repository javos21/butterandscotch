-- Butter & Scotch: hardening after the foundation review. 0001 is unchanged; this file
-- replaces the pieces that need tightening.

-- The trigger runs as the caller, so pin its search path like the other functions.
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Staff may read and change the single settings row, but never create or delete it. A missing
-- row would take the shop down, so the row is only ever changed, never removed.
drop policy if exists settings_staff_all on settings;

create policy settings_staff_select on settings
  for select to authenticated
  using (is_staff());

create policy settings_staff_update on settings
  for update to authenticated
  using (is_staff()) with check (is_staff());

-- Writes an order and its items in one transaction. Called from the server with the
-- service role. Serialises per fulfilment date, so two checkouts for the last slot cannot both pass.
-- A missing or NULL daily cap counts as zero, so the day is refused rather than left unlimited.
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
