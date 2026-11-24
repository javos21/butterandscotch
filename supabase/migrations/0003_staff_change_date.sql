-- Butter & Scotch: staff moves an order to another fulfilment date.
-- Runs under the same per-date advisory lock as checkout, so a move and a new order cannot
-- both take the last slot. Blocked dates are always refused; a full date needs p_override_cap.

create or replace function public.staff_change_fulfil_date(
  p_order_id uuid,
  p_new_date date,
  p_override_cap boolean
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_old_date date;
  v_cap int;
  v_booked int;
begin
  if not is_staff() then
    raise exception 'not_staff';
  end if;

  perform pg_advisory_xact_lock(hashtext('fulfil:' || p_new_date::text));

  select o.* into v_order
    from orders o
    where o.id = p_order_id
    for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status in ('completed', 'cancelled') then
    raise exception 'order_closed';
  end if;

  if exists (select 1 from blocked_dates b where b.date = p_new_date) then
    raise exception 'date_blocked';
  end if;

  if not p_override_cap then
    select s.daily_order_cap into v_cap from settings s where s.id = 1;
    select count(*) into v_booked
      from orders o
      where o.fulfil_date = p_new_date
        and o.status <> 'cancelled'
        and o.id <> p_order_id;
    if v_booked >= coalesce(v_cap, 0) then
      raise exception 'date_full';
    end if;
  end if;

  v_old_date := v_order.fulfil_date;

  update orders set fulfil_date = p_new_date where id = p_order_id;

  insert into order_events (order_id, kind, detail, staff_id)
  values (
    p_order_id,
    'date_changed',
    jsonb_build_object('from', v_old_date, 'to', p_new_date, 'override', p_override_cap),
    auth.uid()
  );

  return v_old_date;
end;
$$;

revoke execute on function public.staff_change_fulfil_date(uuid, date, boolean) from public, anon;
grant execute on function public.staff_change_fulfil_date(uuid, date, boolean) to authenticated;
