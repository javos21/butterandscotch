# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Customers:** mostly on phones, arriving from Instagram or WhatsApp links. They want a gift, a party or a potluck bake, usually for the Christmas season. They order without an account.
- **Staff:** two people, the owner (a home baker in Trinidad) and the developer. Staff use the admin panel on their phones. This design pass covers the customer storefront only.

## Product Purpose

Butter & Scotch is a made-to-order home bakery in Trinidad. The site replaces a Google Form. Customers pick items and a date, see the full total including delivery up front, and pay once, in full, by bank transfer. An order is not confirmed until the owner checks the payment proof.

Success: a customer can go from an Instagram or WhatsApp link to a placed order in a couple of minutes on a phone, without messaging the owner.

## Positioning

A made-to-order home bakery that makes the order itself the easy part: the total, the delivery fee and the date are known before checkout, with no back-and-forth on WhatsApp.

## Operating Context

- Customers pay by bank transfer (Scotiabank) and put the order number in the transfer notes.
- Order confirmation arrives by email. WhatsApp is for problems only.
- The menu is seasonal. Items are switched on and off one at a time, not as separate menus.
- A 5-day lead time applies to every date. A daily order cap and owner-blocked dates exist. Full days and blocked days look the same to customers.
- Dates use Trinidad time (America/Port_of_Spain).

## Capabilities and Constraints

- Storefront: menu by section, item photos, allergen tags, a "Seasonal" badge, flavour choice for cookies, a quantity limit per item.
- Cart with no login. Checkout collects name, email (required), WhatsApp number, pickup or delivery (with an address for delivery), a date from a three-state calendar, allergies (required, "None" allowed), optional notes, optional marketing opt-in, and a required policy checkbox.
- Delivery is not priced at checkout. The order total is items only. Delivery is paid for on delivery, by cash or card, and the owner confirms that amount after the order is placed.
- Order page at a private link (no login): status, "not confirmed" banner while unpaid, bank details with copy buttons, proof upload, a pickup address only after confirmation, a WhatsApp link.
- Find my order: the customer enters their email to receive order links.
- Payment window is 48 hours, with a reminder at 24 hours. Unpaid orders hold their slot.
- Currency is TTD only. Bank transfer only, no card payments. No customer accounts or order history across orders.
- Stack is already set: Next.js 16 App Router, React 19, Supabase, Tailwind, shadcn/ui and Magic UI, Lucide icons.
- Undecided: domain name, pickup location and hours, policy and refund text.

## Brand Commitments

- Name: "Butter & Scotch" (logo reads "Butter and Scotch"). Spelling in copy: "Butter & Scotch".
- Colours: red and cream, from the logos in `logos/`: Beige Background, Beige Transparent, Black Transparent, Red Background, Red Transparent.
- Voice: warm, a little playful, plain English. Copy should sound like the owner, not a corporate store.
- The Christmas menu's festive treatment is for seasonal items and seasonal touches, not the whole storefront. The rest of the site stays on the year-round red and cream brand.
- Never use stock or generated photos that could pass as the owner's baking.

## Evidence on Hand

- Christmas menu (attached image in the session, and in the spec under "Launch content"): 6 cake, loaf and shortbread items and 4 cupcake and cookie items, with prices.
- Logos in `logos/` and `public/brand/`.
- Item photos: the owner will supply them. Their path is not yet recorded.
- No testimonials, reviews, case studies or press exist. Do not invent any.

## Product Principles

- The total is always visible before checkout, including delivery.
- Nothing reads as confirmed until the payment is checked. Status and the "not confirmed" state always stay visible.
- Allergen information is shown where the customer decides, not hidden in a policy.
- Phone first. The flow must work one-handed on a phone from a social link.
- Full days and blocked days look the same to customers.

## Accessibility & Inclusion

- Customers are mostly on phones, often on mobile data. Keep pages light and touch targets large.
- Allergen and dietary information is required at checkout and must be readable without colour alone.
