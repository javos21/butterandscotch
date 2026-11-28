-- Production seed: the Christmas menu only.
-- Safe to run more than once (fixed ids, on conflict do nothing).
-- No staff logins, no bank details, no settings: the owner enters those in /admin/settings.
-- Item photos are placeholders until the owner's real photos are uploaded.

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

-- Owner photos (public/items/).
update items set image_url = '/items/hummingbird-cake.webp' where name = 'Hummingbird Cake';
update items set image_url = '/items/orange-almond-cake.webp' where name = 'Orange Almond Cake';
update items set image_url = '/items/honey-pistachio-cake.webp' where name = 'Honey Pistachio Cake';

-- Order close dates and pickup locations (the owner can change these in /admin/settings).
update settings set
  order_close_date = '2026-12-16',
  last_fulfilment_date = '2026-12-23',
  pickup_locations = '{West,Chaguanas}'
where id = 1;
