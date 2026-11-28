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
  ('00000000-0000-0000-0000-0000000000c1', 'Cupcakes & Cookies', 1),
  ('00000000-0000-0000-0000-0000000000c2', 'Cakes, Loaves & Shortbread', 2)
on conflict (id) do nothing;

-- Menu items (Christmas menu). Prices are in cents. Photos are placeholders.

insert into items (
  id, section_id, name, description, unit_label, price_cents, image_url,
  allergen_note, seasonal, flavours, max_qty, active, sort
) values
  (
    '00000000-0000-0000-0000-000000000a01',
    '00000000-0000-0000-0000-0000000000c1',
    'Lemon Blueberry Cupcakes', null, 'per dozen', 30000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Lemon+Blueberry+Cupcakes',
    null, false, '{}', 10, true, 1
  ),
  (
    '00000000-0000-0000-0000-000000000a02',
    '00000000-0000-0000-0000-0000000000c1',
    'Red Velvet Cupcakes', null, 'per dozen', 30000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Red+Velvet+Cupcakes',
    null, false, '{}', 10, true, 2
  ),
  (
    '00000000-0000-0000-0000-000000000a03',
    '00000000-0000-0000-0000-0000000000c1',
    'Mini Cookie Bag', null, 'each', 5000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Mini+Cookie+Bag',
    null, false,
    '{"Coconut Butterscotch","Dark Chocolate & Toffee","Half & Half"}',
    10, true, 3
  ),
  (
    '00000000-0000-0000-0000-000000000a04',
    '00000000-0000-0000-0000-0000000000c1',
    'Cookie Jar', null, 'each', 9000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Cookie+Jar',
    null, false,
    '{"Coconut Butterscotch","Dark Chocolate & Toffee","Half & Half"}',
    2, true, 4
  ),
  (
    '00000000-0000-0000-0000-000000000a05',
    '00000000-0000-0000-0000-0000000000c2',
    'Sorrel Cranberry Shortbread', null, 'per dozen', 30000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Sorrel+Cranberry+Shortbread',
    null, true, '{}', 10, true, 1
  ),
  (
    '00000000-0000-0000-0000-000000000a06',
    '00000000-0000-0000-0000-0000000000c2',
    'Hummingbird Cake', 'Double-layer 8-inch', 'each', 60000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Hummingbird+Cake',
    'Contains nuts', false, '{}', 5, true, 2
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
    'Contains nuts', false, '{}', 5, true, 4
  ),
  (
    '00000000-0000-0000-0000-000000000a09',
    '00000000-0000-0000-0000-0000000000c2',
    'Glazed Lemon Loaf', null, 'each', 25000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Glazed+Lemon+Loaf',
    null, false, '{}', 5, true, 5
  ),
  (
    '00000000-0000-0000-0000-000000000a10',
    '00000000-0000-0000-0000-0000000000c2',
    'Chocolate Cranberry Loaf', null, 'each', 30000,
    'https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=Chocolate+Cranberry+Loaf',
    null, true, '{}', 5, true, 6
  )
on conflict (id) do nothing;

-- Delivery areas. Fees in cents (). A null fee is "Other area": staff quote it.

insert into delivery_areas (id, name, fee_cents, active, sort) values
  ('00000000-0000-0000-0000-000000000d01', 'Port of Spain', 3000, true, 1),
  ('00000000-0000-0000-0000-000000000d02', 'Diego Martin', 3000, true, 2),
  ('00000000-0000-0000-0000-000000000d03', 'Westmoorings', 3000, true, 3),
  ('00000000-0000-0000-0000-000000000d04', 'St. James', 3000, true, 4),
  ('00000000-0000-0000-0000-000000000d05', 'Maraval', 3000, true, 5),
  ('00000000-0000-0000-0000-000000000d06', 'San Juan', 3000, true, 6),
  ('00000000-0000-0000-0000-000000000d07', 'Barataria', 3000, true, 7),
  ('00000000-0000-0000-0000-000000000d08', 'St. Augustine', 3000, true, 8),
  ('00000000-0000-0000-0000-000000000d09', 'Tunapuna', 3000, true, 9),
  ('00000000-0000-0000-0000-000000000d10', 'Curepe', 3000, true, 10),
  ('00000000-0000-0000-0000-000000000d11', 'Chaguanas', 3000, true, 11),
  ('00000000-0000-0000-0000-000000000d12', 'San Fernando', 3000, true, 12),
  ('00000000-0000-0000-0000-000000000d13', 'Arima', 4000, true, 13),
  ('00000000-0000-0000-0000-000000000d14', 'Couva', 4000, true, 14),
  ('00000000-0000-0000-0000-000000000d15', 'Princes Town', 4000, true, 15),
  ('00000000-0000-0000-0000-000000000d16', 'Marabella', 4000, true, 16),
  ('00000000-0000-0000-0000-000000000d17', 'Gasparillo', 4000, true, 17),
  ('00000000-0000-0000-0000-000000000d18', 'Sangre Grande', 5000, true, 18),
  ('00000000-0000-0000-0000-000000000d19', 'Point Fortin', 5000, true, 19),
  ('00000000-0000-0000-0000-000000000d20', 'Penal', 5000, true, 20),
  ('00000000-0000-0000-0000-000000000d21', 'Siparia', 5000, true, 21),
  ('00000000-0000-0000-0000-000000000d22', 'Mayaro', 6000, true, 22),
  ('00000000-0000-0000-0000-000000000d23', 'Rio Claro', 6000, true, 23),
  ('00000000-0000-0000-0000-000000000d24', 'Toco', 6000, true, 24),
  ('00000000-0000-0000-0000-000000000d25', 'Tobago', 9000, true, 25),
  ('00000000-0000-0000-0000-000000000d26', 'Other area (we''ll contact you)', null, true, 26)
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
