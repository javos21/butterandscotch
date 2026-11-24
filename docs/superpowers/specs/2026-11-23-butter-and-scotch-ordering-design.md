# Butter & Scotch Ordering Site: Design

## Intent

Butter & Scotch is a made-to-order home bakery in Trinidad. Today it takes orders through a Google Form ("Butter & Scotch Christmas Order Form"): the customer picks items and a date, the owner contacts them on WhatsApp to confirm the total and delivery fee, and the customer pays by bank transfer and sends a screenshot on WhatsApp.

We are replacing the form with a small ordering site where:

- customers can order without an account, see the full total (including delivery) up front, and pay **once, in full**, by bank transfer;
- an order is **not confirmed until the owner has checked the payment proof**;
- the owner (and the developer) run everything from an admin panel on their phones.

It is modelled on the Monday Wear pre-order site (`C:\Users\javed\Documents\NakitaHyatali`) and is built from a copy of that codebase.

**What success looks like:** a customer can go from Instagram or WhatsApp to a placed order in a couple of minutes on a phone, without messaging the owner. The owner never has to work out a total, a delivery fee or a flavour mix by hand, and can confirm a payment in a few taps.

## Goals

- A mobile-first storefront with a cart and no login, with checkout in TTD.
- A date picker that enforces the 5-day lead time, a daily order cap and blocked dates, and shows clearly why a date is unavailable.
- Delivery fees by area, known at checkout.
- Proof-of-payment upload on a private order page, checked by hand in admin.
- Email at every step (email first). WhatsApp is only for problems.
- An easy, fast admin panel on mobile: orders, proof checking, cancellation, refund records, notes, menu, settings and CSV exports.
- The Christmas menu at launch.

## Non-goals (for now)

- Online card payments or any payment processor.
- Customer accounts or order history across orders.
- Live oDeliver rate quotes or creating bookings through oDeliver's API.
- Seasonal "menus" with their own ordering windows. Items are switched on and off one at a time instead.
- Deposits or part payments.
- Item swaps on an existing order (handled with notes and a manual adjustment, see Admin).
- Multiple currencies. TTD only.

## Anti-goals (failure even if it works)

- A customer believing their order is confirmed when it has not been paid and checked.
- A screenshot being treated as proof without the owner finding the money in her bank.
- An admin panel that is awkward on a phone, buried in menus, or needs a laptop.
- Leftover Monday Wear features or copy: deposits, balances, sizes, USD, stock, measurements, "Carnival", "costume".
- Customers being able to see how busy a day is (full days and blocked days look the same).

## Constraints

- **Timeline:** the Christmas season, so launch as soon as possible.
- **Users:** customers mostly on phones, arriving from social links. Two staff: the owner and the developer.
- **Payment:** bank transfer only (Scotiabank). The bank details come from the current form and live in settings. They are **not** hard-coded.
- **Lead time:** 5 days, editable in settings. The earliest date a customer can choose is today + 5 calendar days, using Trinidad time (America/Port_of_Spain). For example, ordering on Nov 23 gives Nov 28 as the earliest date.
- **Brand:** red and cream, using the logos in `logos/`:
  - Beige Background
  - Beige Transparent
  - Black Transparent
  - Red Background
  - Red Transparent

  The look should be clean, modern and a little fun. Visual design is a later step. This document covers flow and structure.
- **Admin UI kit:** shadcn/ui + Magic UI components, Lucide icons. The admin UX follows the `ui-ux-pro-max` skill's guidance (see Admin UX below).

## Approaches considered

1. **Copy the Monday Wear codebase and adapt it (chosen).** It uses the same stack: Next.js 16 App Router, React 19, Supabase (Postgres, Auth, Storage), Tailwind, shadcn/Magic UI, React Email + Brevo. Several pieces already work there:
   - the private order link
   - proof upload and the verification queue
   - the store switch
   - the reminder cron
   - emails, the admin shell and the CSV export

   We strip out what this site doesn't need and add the new features. It was chosen because it is the fastest route to Christmas and these pieces are already tested.
2. **Fresh project on the same stack, copying pieces by hand.** This gives a cleaner codebase, but it means rebuilding working pieces, so it would launch later.
3. **WooCommerce + oDeliver plugin.** This gives live delivery rates, but proof upload, the custom calendar, caps and a mobile admin would all need plugins and workarounds, and it is off the developer's stack. Rejected.

## Customer flow

1. **Menu (home).** Sections (initially "Cupcakes & Cookies" and "Cakes, Loaves & Shortbread"), each listing the active items. Each item has:
   - a photo
   - a name
   - a price
   - a unit ("per dozen", "each", "per bag")
   - a short description
   - an allergen tag where relevant ("Contains nuts")
   - an optional "Seasonal" badge

   The customer adds items to a cart. If the item has flavours (cookie bag, cookie jar), they choose one. To mix flavours, they add separate lines (2 × Dark Chocolate & Toffee, 1 × Coconut Butterscotch). "Half & Half" is its own flavour. Each item has a quantity limit (default 10 for most items, 2 for cookie jars, 5 for cakes, matching the form), set per item in admin. The limit applies to the **item's total across all of its flavour lines** in the order, and it is checked in the cart and again on the server. A note on the menu says: "Ordering more than this, or something custom? Message us on WhatsApp first."
2. **Checkout.**
   - Contact: name, **email (required)**, WhatsApp number (Trinidad format, normalised to +1-868-XXX-XXXX).
   - **Pickup or delivery.**
     - Delivery: pick an **area** from a list, then enter the address. The area's fee is added to the total.
     - An area list option, "Other area (we'll contact you)", places the order in **`awaiting_quote`**. The order page hides the bank details and proof upload and shows "Awaiting delivery quote — we'll email your total". The payment clock doesn't start, but the order still holds its date slot. When staff set the fee in admin ("Set delivery fee"), the order moves to `awaiting_payment` and the customer gets a *"Your total is ready — pay to confirm"* email.
   - **Date:** a calendar (see Date picker).
   - **Allergies or dietary needs:** required ("None" is allowed). Shown with the note that the kitchen isn't allergen-free and listing the nut items.
   - Anything else (optional).
   - Marketing opt-in (yes or no, optional). Stored only.
   - A required checkbox accepting the order policy (policy text from settings).
   - A summary with the items, delivery fee and **total**.
   - The button reads **"Place order — pay to confirm"**.
3. **Order page `/order/[token]`.** A private link that works without login. It shows:
   - a large status badge
   - a banner while unpaid: "Your order is **not confirmed** until we receive and check your payment"
   - the order number (short, e.g. `BS-0142`), the items, the date, pickup or delivery, and the total
   - bank details with copy buttons, and the instruction to put the order number in the transfer notes
   - a proof upload (image or PDF, plus an optional transfer reference)
   - the pickup location, only once the order is confirmed
   - a WhatsApp link for problems
4. **Emails** (Brevo + React Email, reusing the Monday Wear sender). Every email repeats the private link.
   - *Order received — awaiting payment.* Has the total and the bank details. For "Other area" orders it is *Order received — awaiting delivery quote* instead, with no bank details.
   - *Your total is ready — pay to confirm.* Sent when staff set the fee for an "Other area" order.
   - *Payment reminder.* Sent 24 hours into the payment window if there is still no proof.
   - *Order confirmed.* Has a **PDF receipt attached** (see Receipt).
   - *Proof not accepted.* Includes the reason and a re-upload link.
   - *Date changed.*
   - *Order cancelled.* Includes the reason.
   - *Ready for pickup / out for delivery.* Optional, sent when staff press "Mark ready".
   - Staff get: *new order*, *new proof to check*.
5. **"Find my order"** (from Monday Wear): the customer enters their email and receives their order links.

### Date picker

- **Too soon** (inside the lead time): a soft cream/grey shade. Tapping it explains: "We need 5 days to bake this fresh — need it sooner? WhatsApp us."
- **Unavailable** (blocked by the owner, *or* at the daily cap): a muted red shade with a strikethrough. Both reasons look the same to customers.
- **Available:** plain. The selected date is solid red.
- A legend sits under the calendar. Past dates are hidden or disabled.
- The cap is checked again on the server when the order is placed, so two people can't take the last slot at the same moment. If the date has filled up in the meantime, the customer is asked to pick another date.

### Receipt

- When staff confirm a payment, the system builds a **PDF receipt** and attaches it to the *Order confirmed* email. It uses `@react-pdf/renderer` or similar, rendered on the server, and is sent as a Brevo attachment.
- The receipt shows:
  - the logo
  - "Receipt" and the order number (`BS-0142`)
  - the customer's name
  - the date paid and the pickup or delivery date
  - the items (name, flavour, quantity, unit price, line total)
  - the delivery fee and any adjustments made before payment
  - the **total**, marked "Paid in full — bank transfer"
  - the bakery's contact line
- My call: the same PDF can also be downloaded from the confirmed order page and from admin. It is generated from the order data each time, so it isn't stored.

### Order states

`awaiting_quote` ("Other area" only) → `awaiting_payment → proof_submitted → confirmed → ready → completed`, plus `cancelled`.

- A rejected proof sends the order back to `awaiting_payment` and **restarts the payment window**.
- Orders in every state except `cancelled` count toward the daily cap. **An unpaid order holds its slot** until it is paid or cancelled.
- **Payment window: 48 hours.** It starts when the order enters `awaiting_payment`, either when it is placed or when staff set the delivery fee, and it restarts after a rejected proof. A reminder email goes out at 24 hours. At 48 hours with no proof, the order is **cancelled automatically** (email sent, slot freed). The pickup or delivery date doesn't affect this, so short-notice orders and staff date changes are never cancelled early.
- Orders in `proof_submitted` or `awaiting_quote` are never auto-cancelled. They wait for staff, and the Today screen flags any `awaiting_quote` order.
- The reminder and auto-cancel run from a cron. It runs **hourly**, instead of Monday Wear's daily schedule, so the 24- and 48-hour marks are close to accurate.

## Delivery areas

- These are staff-editable rows: name, fee, active, sort order.
- The starting fees come from oDeliver's published Hub & Spoke small-package rates (TT$30 Urban, $40 Rural, $50 Extended, $60 Remote, Tobago $60 + $30 inter-island). oDeliver doesn't publish which towns fall into which tier, so the tiers below are a **first guess** that the owner checks and edits:
  - Port of Spain, Diego Martin/Westmoorings, St. James/Maraval, San Juan/Barataria, St. Augustine/Tunapuna/Curepe, Chaguanas, San Fernando: **$30**
  - Arima, Couva, Princes Town, Marabella/Gasparillo: **$40**
  - Sangre Grande, Point Fortin, Penal/Siparia: **$50**
  - Mayaro/Rio Claro, Toco and other remote areas: **$60**
  - Tobago: **$90**
  - Other area (we'll contact you): no fee shown
- The fee is copied onto the order when it is placed, so later edits don't change existing orders.

## Admin (`/admin`)

Login is a staff email and password through Supabase Auth, with sign-up disabled. There are two staff accounts: the owner and the developer. Both have the same permissions.

### Admin UX

- The admin panel is phone first. It must be quick to use on a phone and must not need a laptop.
- Its design is guided by the `ui-ux-pro-max` skill.
- It uses shadcn/ui and Magic UI components and Lucide icons.
- Navigation is a bottom tab bar on mobile and a sidebar on desktop: **Today, Orders, Payments, Menu, Settings**.
- Primary actions are large touch targets placed where the thumb can reach.
- Status is shown with colour plus text.
- Destructive actions (cancel) ask for confirmation.
- Every action gives toast feedback.

### Screens

- **Today / This week:** the orders due each day, with their items added up per day. This is the baking list. It also shows the number of proofs waiting to be checked.
- **Orders list:** newest first. It has filter chips by status, search by name, order number or phone, and a date filter.
- **Order detail:**
  - Items, date, pickup or delivery (area, address, fee), allergies, notes, contact details, and a **WhatsApp button** (opens `wa.me` with the order number).
  - **Proof:** view the screenshot or PDF next to the expected total and the reference, then **Confirm** or **Reject (reason)**. The screen says: "Find the money in your bank account before confirming."
  - **Change date:** checks blocked dates. Staff can go over the cap.
  - **Set delivery fee:** only on `awaiting_quote` orders. It sets the fee, moves the order to `awaiting_payment` and sends the *total ready* email.
  - **Adjust total:** a signed amount with a reason.
    - **Before payment:** it changes the total the customer pays.
    - **After payment (confirmed or later):** it is **recorded only**. The difference is settled outside the site, on WhatsApp or by bank transfer. The order shows the adjustment and the note, but it doesn't track whether that money was paid and doesn't ask for another proof. There is one payment per order.

    Adjustments appear in the order and in the export.
  - **Mark ready**, which sends the optional email, and **Mark completed**.
  - **Cancel:** the reason is required, the email is sent and the slot is freed.
  - **Record refund:** amount, date and note. This is only a record, since money moves through the bank. The order shows "Refunded $X".
  - **Notes:** private, timestamped, and show which staff member wrote them.
  - **History:** status changes, actions and emails sent, with timestamps.
- **Payments:** a queue of proofs waiting to be checked (shortcut to the proof view), plus a list of confirmed payments and refunds.
- **Exports (CSV):** orders (one row per order with the totals, and a variant with one row per item) and payments/refunds, filtered by date range.
- **Menu:**
  - **Sections:** name and order.
  - **Items:** name, section, description, price, unit, photo, allergen tag, "Seasonal" badge, flavour options (list), quantity limit, on/off switch, sort order.
- **Settings:**
  - store open/closed
  - lead time (days, default 5)
  - daily order cap (default 10)
  - blocked dates (pick dates or ranges)
  - delivery areas and fees
  - bank details
  - pickup location and hours
  - policy text
  - WhatsApp number
  - staff notification email

## Data model (adapting Monday Wear's schema)

- `settings`: one row with the fields above.
- `sections`, `items`. Flavours are stored as a list on the item. Monday Wear's collections, products, variants, sizes, stock, USD prices and measurements are removed.
- `delivery_areas`.
- `blocked_dates` (date, optional note).
- `orders`:
  - order number and access token
  - customer name, email and phone
  - fulfilment (pickup or delivery), area, address and delivery fee
  - date
  - allergies, notes, marketing opt-in
  - subtotal, adjustments total, total
  - status, policy version, timestamps
- `order_items`: a copy of the name, flavour, unit price and quantity.
- `order_adjustments`: amount, reason, staff, time.
- `payments`: proof path, reference, amount, status (submitted, confirmed or rejected), reviewer, reject reason. There is one kind only: full payment.
- `refunds`: amount, date, note, staff.
- `order_notes`, `order_events` (history), `email_log`.
- Row-level security follows Monday Wear:
  - The public can read active items, sections, areas and the public settings, plus unavailable dates (without saying why).
  - Order access goes through server actions that check the token.
  - Staff have full access.
  - The receipts bucket is private, and staff view files through signed URLs.

## Launch content (Christmas menu, from the current form)

**Cupcakes & Cookies**
- Lemon Blueberry Cupcakes: $300/dozen, max 10.
- Red Velvet Cupcakes: $300/dozen, max 10.
- Mini Cookie Bag: $50 each, max 10. Flavours: Coconut Butterscotch, Dark Chocolate & Toffee, Half & Half.
- Cookie Jar: $90 each, max 2. Same flavours as the cookie bag.

**Cakes, Loaves & Shortbread**
- Sorrel Cranberry Shortbread: $300/dozen, max 10.
- Hummingbird Cake: $600, double-layer 8", contains nuts, max 5.
- Orange Almond Cake: $400, 9", contains nuts, max 5.
- Honey Pistachio Cake: $600, double-layer 8", contains nuts, max 5.
- Glazed Lemon Loaf: $250, max 5.
- Chocolate Cranberry Loaf: $300, max 5.

**Photos:** use placeholders until the owner sends real ones. Never use stock or generated photos that could pass as her baking.

## First step: proof-of-concept customer page

Before the full build, make a **plain, unstyled customer flow** as a proof of concept:

1. menu
2. cart with flavours
3. checkout with the area fee and the three-state calendar
4. order page with the "not confirmed" banner and proof upload

It runs on the adapted codebase and local Supabase. It exists to check the flow before visual design. Styling comes later, in a separate design pass using the red and cream brand.

## Decided by the developer's partner (calls made in brainstorming, open to correction)

- A 48-hour payment window: a reminder at 24 hours and auto-cancel at 48. It restarts after a rejected proof.
- Quantity limits apply to the item's total across all of its flavour lines.
- The PDF receipt can also be downloaded from the order page and admin.
- After-payment adjustments are recorded only (from the user: option b). "Other area" orders wait for a quote before payment (from the user).
- Unpaid orders hold their slot.
- Full days and blocked days look the same to customers.
- The pickup address appears only after confirmation.
- "Other area" delivery is allowed and staff add the fee.
- Item swaps are handled with notes and "Adjust total", not a swap tool.
- The order number format is `BS-0001`.

## Left to the builder

- Exactly what to delete or rename from Monday Wear, the migration strategy (fresh migrations versus editing existing ones), file layout and tests. Monday Wear's test style (Vitest + Playwright) is kept.
- The CSV column order.
- Hosting follows Monday Wear's deploy notes (Render + Supabase cloud + Brevo + daily cron).

## Open items (need the owner)

- Confirm the delivery-area tiers and fees against oDeliver's map or her receipts.
- Pickup location and hours text, and the policy and refund text.
- Brevo: whether she has an account and a sending domain. If not, set one up, or use Monday Wear's console sender until then.
- The domain name.
- Item photos.

## Admin decisions (2026-11-24, plan 2)

- **Look:** a plain, neutral tool: white/zinc surfaces, Inter, light only, with the **brand red** (`#8B1E1E`) as the only accent (primary buttons, active nav, focus ring). No cream or serif in admin. Guided by the `ui-ux-pro-max` rules: 44 px touch targets, icon + label navigation, one primary action per screen, destructive actions in red and confirmed, errors next to fields, toast feedback, no emoji as icons.
- **Navigation:** bottom tab bar on phones (Today, Orders, Payments, Settings, with a count badge on Payments); sidebar from 1024 px.
- **Split:** plan **2a** = Today, Orders list/detail (proof confirm/reject with PDF receipt, set delivery fee, change date, mark ready/completed, cancel, WhatsApp), Payments queue, Settings (store switch, lead time, cap, blocked dates, delivery areas, bank details, pickup info, policy text, WhatsApp number, notify email). Plan **2b** = Menu editing, Adjust total, refunds, notes, history view polish, CSV exports.
- **Carried from plan 1:** staff date changes go through a locked database function (blocked dates always enforced, cap can be overridden); `proof_submitted` orders with no submitted payment appear in the Payments queue; the admin sign-in e2e test asserts the real landing page.
- **Receipt PDF:** logo, "Receipt", order number, customer name, date paid, pickup/delivery date, items (name, flavour, quantity, unit price, line total), delivery fee, adjustments before payment, total marked "Paid in full — bank transfer", and the WhatsApp contact line. Also downloadable from the confirmed order page and from admin.
