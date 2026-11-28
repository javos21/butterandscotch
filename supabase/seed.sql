-- Local development seed. Runs after migrations on `supabase db reset`.
-- Staff logins (dev only, match SEED_* in .env.example):
--   owner@example.test and dev@example.test, password BsStaff-Local-2026.
-- All bank details and contact values below are placeholders. Never put real numbers here.

-- Settings ---------------------------------------------------------------

update settings set
  store_open = true,
  lead_time_days = 5,
  daily_order_cap = 10,
  bank_details = '{
    "bank": "Scotiabank",
    "account_name": "Sample Name",
    "account_type": "Chequings",
    "transit": "00000",
    "account_no_same_bank": "0000000",
    "account_no_other_bank": "000000000000"
  }'::jsonb,
  pickup_info = 'Placeholder pickup location and hours.',
  policy_text = 'Placeholder order policy.',
  policy_version = 1,
  whatsapp_number = '+1-868-000-0000',
  notify_email = 'orders@example.test',
  order_close_date = '2026-12-16',
  last_fulfilment_date = '2026-12-23',
  pickup_locations = '{West,Chaguanas}'
where id = 1;

-- Menu sections ---------------------------------------------------------

insert into sections (id, name, sort) values
  ('00000000-0000-0000-0000-0000000000c1', 'Cookies & Shortbread', 1),
  ('00000000-0000-0000-0000-0000000000c2', 'Cakes, Cupcakes & Loaves', 2)
on conflict (id) do nothing;

-- Menu items (Christmas menu). Prices are in cents. Photos are placeholders.
-- Limits are per item and count across all of its flavour lines.

insert into items (
  id, section_id, name, description, unit_label, price_cents, image_url,
  allergen_note, seasonal, flavours, max_qty, active, sort
) values
  (
    '00000000-0000-0000-0000-000000000a01',
    '00000000-0000-0000-0000-0000000000c2',
    'Lemon Blueberry Cupcakes', null, 'per dozen', 30000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Lemon+Blueberry+Cupcakes',
    null, false, '{"Christmas Themed Icing","Standard"}', 10, true, 5
  ),
  (
    '00000000-0000-0000-0000-000000000a02',
    '00000000-0000-0000-0000-0000000000c2',
    'Red Velvet Cupcakes', null, 'per dozen', 30000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Red+Velvet+Cupcakes',
    null, false, '{"Christmas Themed Icing","Standard"}', 10, true, 4
  ),
  (
    '00000000-0000-0000-0000-000000000a03',
    '00000000-0000-0000-0000-0000000000c1',
    'Mini Cookie Bag', null, 'each', 5000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Mini+Cookie+Bag',
    null, false,
    '{"Dark Chocolate & Toffee","Coconut Butterscotch","Red Velvet","Mix of all 3 flavours"}',
    10, true, 2
  ),
  (
    '00000000-0000-0000-0000-000000000a04',
    '00000000-0000-0000-0000-0000000000c1',
    'Cookie Jar', null, 'each', 9000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Cookie+Jar',
    null, false,
    '{"Dark Chocolate & Toffee","Coconut Butterscotch","Red Velvet","Mix of all 3 flavours"}',
    10, true, 1
  ),
  (
    '00000000-0000-0000-0000-000000000a05',
    '00000000-0000-0000-0000-0000000000c1',
    'Sorrel Cranberry Shortbread', null, 'per dozen', 30000,
    '/menu/Sorrel%20Cranberry%20Shortbread.webp',
    'Egg Free', false, '{}', 10, true, 3
  ),
  (
    '00000000-0000-0000-0000-000000000a06',
    '00000000-0000-0000-0000-0000000000c2',
    'Hummingbird Cake', 'Double-layer 8-inch', 'each', 60000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Hummingbird+Cake',
    'Contains nuts', true, '{}', 5, true, 1
  ),
  (
    '00000000-0000-0000-0000-000000000a07',
    '00000000-0000-0000-0000-0000000000c2',
    'Orange Almond Cake', '9-inch', 'each', 40000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Orange+Almond+Cake',
    'Contains nuts', false, '{}', 5, true, 3
  ),
  (
    '00000000-0000-0000-0000-000000000a08',
    '00000000-0000-0000-0000-0000000000c2',
    'Honey Pistachio Cake', 'Double-layer 8-inch', 'each', 60000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Honey+Pistachio+Cake',
    'Contains nuts', false, '{}', 5, true, 2
  ),
  (
    '00000000-0000-0000-0000-000000000a09',
    '00000000-0000-0000-0000-0000000000c2',
    'Glazed Lemon Loaf', null, 'each', 25000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Glazed+Lemon+Loaf',
    null, false, '{}', 10, true, 6
  ),
  (
    '00000000-0000-0000-0000-000000000a10',
    '00000000-0000-0000-0000-0000000000c2',
    'Chocolate Cranberry Loaf', null, 'each', 30000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Chocolate+Cranberry+Loaf',
    null, false, '{}', 10, true, 7
  )
on conflict (id) do nothing;

-- Staff auth users ---------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-00000000005a',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner@example.test',
    extensions.crypt('BsStaff-Local-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Owner"}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-00000000005b',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dev@example.test',
    extensions.crypt('BsStaff-Local-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Developer"}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-00000000001a',
    '00000000-0000-0000-0000-00000000005a',
    '00000000-0000-0000-0000-00000000005a',
    jsonb_build_object(
      'sub', '00000000-0000-0000-0000-00000000005a',
      'email', 'owner@example.test',
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-00000000001b',
    '00000000-0000-0000-0000-00000000005b',
    '00000000-0000-0000-0000-00000000005b',
    jsonb_build_object(
      'sub', '00000000-0000-0000-0000-00000000005b',
      'email', 'dev@example.test',
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  )
on conflict do nothing;

insert into staff (user_id, name) values
  ('00000000-0000-0000-0000-00000000005a', 'Owner'),
  ('00000000-0000-0000-0000-00000000005b', 'Developer')
on conflict (user_id) do nothing;

-- Owner photos (public/items/).
update items set image_url = '/items/hummingbird-cake.webp' where name = 'Hummingbird Cake';
update items set image_url = '/items/orange-almond-cake.webp' where name = 'Orange Almond Cake';
update items set image_url = '/items/honey-pistachio-cake.webp' where name = 'Honey Pistachio Cake';
