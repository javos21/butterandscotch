-- Orders are written by the server with the service role. The order-number column default calls
-- next_order_number(), which 0002_hardening.sql restricted to nobody but the owner, so the service role
-- lost access on hosted projects and every order failed with 'permission denied'.
grant execute on function public.next_order_number() to service_role;
