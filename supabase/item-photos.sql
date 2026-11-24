-- Point menu items at the owner's photos in public/items/. Safe to run more than once.
-- One statement, so `supabase db query -f` can run it. Items without a photo keep their placeholder.
update items as i
set image_url = p.image_url
from (
  values
    ('Hummingbird Cake', '/items/hummingbird-cake.webp'),
    ('Orange Almond Cake', '/items/orange-almond-cake.webp'),
    ('Honey Pistachio Cake', '/items/honey-pistachio-cake.webp')
) as p(name, image_url)
where i.name = p.name;
