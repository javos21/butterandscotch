# Butter & Scotch V2: Client Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Model split (owner's choice):** each task is built by **Claude Haiku 5.5** (`claude-haiku-5-5`) and reviewed by **Claude Opus 5.5** (`claude-opus-5-5`) before the next task starts.

**Goal:** Apply the client's V2 revisions: delivery fee removed from checkout and totals, a hard Dec 16 order close and Dec 23 last date, customer records keyed by email with WhatsApp and community opt-ins, new menu sections and copy, and the layout changes from the client notes.

**Architecture:** V1 code stays. Delivery areas and the `awaiting_quote` state are removed. Two new settings are added. A `customers` table is added, and every order links to one by lowercased email. Each change is a pure domain function with tests, wrapped by the existing server actions and pages. Schema changes go in a new migration, `0006`.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres, Auth, Storage), Tailwind 4, shadcn/ui, zod 4, React Email + Brevo, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-v2-client-revisions-design.md` (this plan implements it). Read it alongside `docs/superpowers/specs/2026-11-23-butter-and-scotch-ordering-design.md` for V1 behaviour it doesn't change.

## Global Constraints

- Order close: no order may be placed after **December 16** (Trinidad time). An order placed on Dec 16 is accepted. Last fulfilment date: **December 23**. Both are settings: `order_close_date`, `last_fulfilment_date`.
- Lead time: **5 days** (`lead_time_days` setting, unchanged).
- Quantity limits: mini cookie bags **10**, mini cookie jars **10**, glazed lemon loaf **10**, chocolate cranberry loaf **10**. Other limits unchanged.
- Money in integer cents. Every displayed number has a `$` prefix (TTD, `formatMoney`).
- Brand red `#8B1E1E` on the nav bar background, the date selection and the primary buttons. Nav text beige.
- Copy strings, exact:
  - Hero headline: `T'is the season to treat yourself`
  - Hero lines: `5 day lead time`, `Orders close on December 16th`, `Last day for delivery/pickup December 23rd`
  - Ordering: `Choose your treats`; step 3 `Pay to confirm`
  - Separator: `Our Christmas Menu`
  - Date: `We need 5 days to bake this fresh — need it sooner? WhatsApp us.`
  - Pickup note: `You will be contacted for more information about collection once your order is confirmed.`
  - Delivery fee link text: `If you would like to check your exact delivery fee before you place your order, click here.`
  - Delivery note: `Once your order is confirmed we will contact you with your total delivery amount. Delivery can be paid via cash or card upon delivery.`
  - Allergy disclaimer: `Our kitchen is not allergen free. If you have severe allergies, please contact us before placing your order.`
  - Confirmation line: `Your order will only be confirmed after proof of payment is received.`
  - CTA: `Place Order`
  - Order page banner: `Your order is not confirmed until we have received and approved your payment.`
  - Broadcast checkbox: `Opt in to our WhatsApp broadcast for offers`
  - Community subtext: `be the first to know about special offers, flash sales, new items & more`
- Never stage with `git add -A` or `git add .`. Stage the exact paths each task touches.
- Each task ends with a commit on `main`.

## Review Focus

1. **A Dec 17 order is refused even when the chosen date is valid.** Placement after `order_close_date` is refused on the server. → `create-order.test.ts` "order placed after close is refused" (Task 3).
2. **The same email in different cases or with spaces is one customer.** `Anna@X.com ` and `anna@x.com` produce one customer row, with orders linked to it. → `customers.test.ts` "email is normalised" (Task 4).
3. **Find-my-order doesn't reveal orders on screen or tell strangers which emails have orders.** An unknown email and a known email get the same on-screen response, and only known emails receive a link email. → `find-order.test.ts` "unknown and known emails get the same response" (Task 6).
4. **A delivery order shows no fee and its total is items only.** → `create-order.test.ts` "delivery order total excludes any fee" (Task 2).
5. **Customer data is not overwritten by later orders on old orders.** An order keeps the name and phone typed on it, even after the customer record changes. → `customers.test.ts` "order snapshot unchanged after customer update" (Task 4).

---

### Task 1: Migration 0006 and settings

**Files:**
- Create: `supabase/migrations/0006_v2_customers_and_close.sql`
- Modify: `lib/database.types.ts` (regenerate), `lib/admin/settings.ts`, `lib/admin/settings-repo.ts`, `lib/data/settings.ts`, `supabase/seed.sql`, `supabase/production-seed.sql`
- Test: `lib/__tests__/admin-settings.test.ts`

**Interfaces:**
- Produces (settings row): `order_close_date date not null default '2026-12-16'`, `last_fulfilment_date date not null default '2026-12-23'`, `pickup_locations text[] not null default '{West,Chaguanas}'`.
- Produces tables: `customers (id uuid pk, email text unique not null, name text, phone text, broadcast_opt_in boolean not null default false, broadcast_opt_in_at timestamptz, community_opt_in boolean not null default false, community_opt_in_at timestamptz, first_order_at timestamptz, last_order_at timestamptz, created_at timestamptz default now())`.
- Modifies `orders`: add `customer_id uuid references customers(id)`; drop `delivery_area_id`, `delivery_area_name`, `delivery_fee_cents`; drop the `delivery_areas` table; `status` check no longer allows `awaiting_quote`.
- Produces `lib/admin/settings.ts`: type `Settings` gains `order_close_date: string`, `last_fulfilment_date: string`, `pickup_locations: string[]`; `delivery_areas` removed from the type.

- [ ] **Step 1: Failing test.** In `admin-settings.test.ts` add: `parseSettings(defaults)` returns `order_close_date === "2026-12-16"` and `last_fulfilment_date === "2026-12-23"`; a settings update with `last_fulfilment_date` before `order_close_date` is rejected with "Last fulfilment date must be on or after the order close date".
- [ ] **Step 2:** Run `npx vitest run lib/__tests__/admin-settings.test.ts` → FAIL.
- [ ] **Step 3:** Write the migration: create `customers`; add `orders.customer_id`; backfill nothing (no live orders); drop the three delivery columns and `delivery_areas`; replace the status check to remove `awaiting_quote`; add the three settings columns. Grant rules follow `0004_grants.sql`. Regenerate `lib/database.types.ts` with `supabase gen types typescript --local > lib/database.types.ts`. Add the new settings to both seed files; remove delivery area rows.
- [ ] **Step 4:** Run the tests → PASS. Run `npx supabase db reset` locally and confirm it applies cleanly.
- [ ] **Step 5: Commit** the listed paths only: `feat(db): v2 customers table, close dates; drop delivery areas`.

**Review (Opus 5.5):** the migration drops nothing that a live order relies on, and `awaiting_quote` is no longer accepted by the check constraint.

---

### Task 2: Remove delivery fee and quote flow

**Files:**
- Modify: `lib/orders/create-order.ts`, `lib/validation.ts`, `lib/types.ts`, `lib/order-status.ts`, `lib/admin/order-actions.ts`, `lib/admin/fee.ts`, `lib/email/templates/OrderReceived.tsx`, `app/admin/(protected)/orders/[id]/actions.ts`, `app/admin/(protected)/orders/[id]/page.tsx`, `app/admin/(protected)/page.tsx`, `components/admin/StatusBadge.tsx`, `components/admin/OrderFilters.tsx`, `components/shop/OrderStatusBanner.tsx`, `lib/admin/counts.ts`
- Delete: `components/admin/SetFeeForm.tsx`, `components/admin/DeliveryAreasEditor.tsx`, `lib/email/templates/TotalReady.tsx`, `lib/admin/fee.ts`, `lib/admin/settings-tabs.ts` (its delivery-areas tab only; keep other tabs), and the delivery-area code in `lib/admin/settings-repo.ts`
- Test: `lib/__tests__/create-order.test.ts`, `lib/__tests__/order-status.test.ts`, `lib/__tests__/admin-fee.test.ts` (delete this file)

**Interfaces:**
- `createOrder` input no longer takes `areaId`. Its output `status` is `"awaiting_payment"` for every order. `total_cents = subtotal_cents`.
- `OrderStatus` is `"awaiting_payment" | "proof_submitted" | "confirmed" | "ready" | "completed" | "cancelled"`.
- Remove the `"set_fee"` action from `order-actions`.

- [ ] **Step 1: Failing tests.** In `create-order.test.ts`: "delivery order total excludes any fee" — a delivery order with two items totalling 3000 cents has `total_cents === 3000`, `status === "awaiting_payment"`, and no field named `delivery_fee_cents` in the insert. In `order-status.test.ts`: `canTransition("awaiting_quote", ...)` no longer exists; `parseStatus("awaiting_quote")` throws.
- [ ] **Step 2:** Run the two test files → FAIL.
- [ ] **Step 3:** Remove the area lookup and quote branch from `create-order.ts`; remove fee and area fields from `validation.ts` and `types.ts`; remove the `awaiting_quote` status from `order-status.ts`; delete the files listed above; remove the "Set delivery fee" action, the quote-needed filter chip and the Today "quotes to set" count. Update `OrderReceived.tsx` so it no longer shows a fee; for delivery orders it shows the note "Once your order is confirmed we will contact you with your total delivery amount. Delivery can be paid via cash or card upon delivery."
- [ ] **Step 4:** Run the tests → PASS. Run `npx tsc --noEmit` → no errors.
- [ ] **Step 5: Commit**: `feat: remove delivery fee estimation and quote flow`.

**Review (Opus 5.5):** no code path still reads `delivery_fee_cents` or `delivery_areas`; `git grep -n "awaiting_quote\|delivery_area"` returns nothing outside migrations.

---

### Task 3: Order close and last date

**Files:**
- Modify: `lib/dates.ts`, `lib/orders/create-order.ts`, `lib/data/settings.ts`, `components/shop/DateCalendar.tsx`, `app/(shop)/checkout/actions.ts`
- Test: `lib/__tests__/dates.test.ts`, `lib/__tests__/create-order.test.ts`

**Interfaces:**
- Produces `lib/dates.ts`: `isOrderingClosed(today: Date, closeDate: string, tz?: string): boolean` (true when the Trinidad calendar date of `today` is after `closeDate`); `isAfterLastFulfilment(date: string, lastDate: string): boolean`.
- `createOrder` input gains `settings.order_close_date` and `settings.last_fulfilment_date`; it returns `{ ok: false, reason: "closed" }` when `isOrderingClosed` is true and `{ ok: false, reason: "after_last_date" }` when the fulfil date is after the last fulfilment date.

- [ ] **Step 1: Failing tests.** In `dates.test.ts`: `isOrderingClosed` with close `2026-12-16` is false on Dec 16 and true on Dec 17 (use a fixed `Date` in Trinidad time). In `create-order.test.ts`: "order placed after close is refused" — `today` is Dec 17, fulfil date Dec 23 → `reason: "closed"`; "order placed on Dec 16 is accepted" → `ok: true`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the two helpers. In `DateCalendar.tsx`, dates after `last_fulfilment_date` are unavailable, and when `isOrderingClosed` is true the whole calendar shows the closed message "Orders are closed for Christmas." Pass settings from `checkout/page.tsx`.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5: Commit**: `feat(checkout): refuse orders after Dec 16 close and Dec 23 last date`.

**Review (Opus 5.5):** the close check runs on the server inside `createOrder`, not only in the UI.

---

### Task 4: Customer records by email

**Files:**
- Create: `lib/customers/normalise-email.ts`, `lib/customers/upsert-customer.ts`, `lib/customers/customers-repo.ts`
- Modify: `lib/orders/create-order.ts`, `lib/validation.ts`, `lib/orders/order-repo.ts`
- Test: `lib/__tests__/customers.test.ts`, `lib/__tests__/customers.int.test.ts`

**Interfaces:**
- Produces `normaliseEmail(input: string): string` — trim, lowercase, nothing else.
- Produces `upsertCustomer(input: { email: string; name: string; phone: string; broadcastOptIn: boolean; communityOptIn?: boolean; now: Date }, repo: CustomersRepo): Promise<{ customerId: string }>`. Sets `broadcast_opt_in_at` only when opt-in changes from false to true; never clears an opt-in set earlier (opt-outs are recorded manually, per the design doc).
- `CustomersRepo`: `upsertByEmail(row): Promise<{ id: string }>`, `setCommunityOptIn(email, now): Promise<void>`.
- `createOrder` calls `upsertCustomer` in the same transaction as the order insert and stores `customer_id`.

- [ ] **Step 1: Failing tests** in `customers.test.ts` (in-memory repo):
  - "email is normalised": `Anna@X.com ` and `anna@x.com` return the same `customerId`.
  - "opt-in timestamp set once": opt-in on Dec 1, placed again on Dec 2 with opt-in true → timestamp still Dec 1.
  - "order snapshot unchanged after customer update": an order created as "Anna", then a second order as "Anna B" → the first order's `customer_name` is still "Anna".
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the three modules. Wire into `create-order.ts`; add `broadcastOptIn` to the checkout schema in `validation.ts` (default `false`), replacing `marketingOptIn`.
- [ ] **Step 4:** Run unit tests → PASS. Run `npx vitest run lib/__tests__/customers.int.test.ts` against local Supabase → PASS (tests the unique email constraint and the case-insensitive match).
- [ ] **Step 5: Commit**: `feat(customers): customer records keyed by email with opt-ins`.

**Review (Opus 5.5):** the upsert and order insert share one transaction, so a failed order never leaves a customer row with no order, or an order with no customer row.

---

### Task 5: Checkout form

**Files:**
- Modify: `components/shop/CheckoutForm.tsx`, `app/(shop)/checkout/page.tsx`, `app/(shop)/checkout/actions.ts`, `lib/validation.ts`
- Test: `lib/__tests__/validation.test.ts`, `e2e/order-flow.spec.ts`

**Interfaces:**
- Pickup: `pickupLocation: "West" | "Chaguanas"` (required when fulfilment is pickup), from `settings.pickup_locations`.
- Delivery: `deliveryAddress: string` (required, 5–300 characters).
- `notes` is removed from the form and the schema. Allergies stay required (`"None"` allowed).

- [ ] **Step 1: Failing tests.** `validation.test.ts`: pickup without a location is rejected with "Choose West or Chaguanas"; delivery without an address is rejected; `notes` in the input is ignored and not returned.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Rebuild the checkout form: pickup dropdown plus its note; address-only delivery with the Oh Deliver link (`TODO(owner)` placeholder until the owner sends the exact URL; do not guess it) and the delivery note; date copy; allergy disclaimer; broadcast checkbox in its own "Anything else" section; policy placeholder read from settings; confirmation line below the button with no button styling; CTA `Place Order`; `$` on every number.
- [ ] **Step 4:** Run unit tests → PASS. Run `npx playwright test e2e/order-flow.spec.ts` → PASS after updating its selectors for the new CTA.
- [ ] **Step 5: Commit**: `feat(checkout): v2 copy, pickup locations, address-only delivery, broadcast opt-in`.

**Review (Opus 5.5):** the checkbox defaults to unchecked, and the copy matches the Global Constraints exactly.

---

### Task 6: Order page and find-my-order

**Files:**
- Modify: `components/shop/OrderStatusBanner.tsx`, `app/(shop)/order/[token]/page.tsx`, `app/(shop)/find-order/actions.ts`, `app/(shop)/find-order/page.tsx`, `components/shop/FindOrderForm.tsx`, `lib/orders/resend-links.ts`
- Test: `lib/__tests__/resend-links.test.ts`, `lib/__tests__/find-order.test.ts`

**Interfaces:**
- `resendOrderLinks(email, deps)` looks up the customer by `normaliseEmail(email)` and emails one link per order. It returns the same `{ ok: true, message: "If that email has orders, we've sent the links." }` whether or not the email exists.
- The WhatsApp "questions about this order" link carries a prefilled message: `Hi, I have a question about order ${orderNumber}.`

- [ ] **Step 1: Failing tests.** `find-order.test.ts`: "unknown and known emails get the same response" — the returned object is deep-equal for both; only the known email triggers `sendEmail`. `resend-links.test.ts`: the message contains the order number and links for every order of the customer.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Replace the banner text with the Global Constraints string. Add the prefilled WhatsApp URL.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5: Commit**: `feat(orders): order page copy, find-my-order by email without enumeration`.

**Review (Opus 5.5):** no response on screen or in the network body differs between a known and an unknown email.

---

### Task 7: Menu, sections and tags

**Files:**
- Modify: `lib/data/menu.ts`, `components/shop/MenuItemCard.tsx`, `components/shop/FlavourSheet.tsx`, `app/(shop)/page.tsx`, `supabase/seed.sql`, `supabase/production-seed.sql`, `lib/validation.ts`
- Test: `lib/__tests__/menu.test.ts` (create)

**Interfaces:**
- Sections in order: `Cookies & Shortbread`, `Cakes, Cupcakes & Loaves`.
- Item fields used: `name`, `price_cents`, `unit`, `description`, `allergenTags: ("nuts" | "egg_free")[]`, `seasonal: boolean`, `flavours: string[]`, `options: { label: string }[]` (cupcakes only), `limit: number`.
- Flavours for the cookie items: `Dark Chocolate & Toffee`, `Coconut Butterscotch`, `Red Velvet`, `Mix of all 3 flavours`. `Half & Half` is removed.

- [ ] **Step 1: Failing tests** in `menu.test.ts`: the section names and order match; the bag and jar `limit` is 10; the Glazed Lemon Loaf and Chocolate Cranberry Loaf `limit` is 10; the Sorrel Cranberry Shortbread Bar has the `egg_free` tag; the Hummingbird Cake has `seasonal: true` and the `nuts` tag; the two cupcakes have options `Christmas Themed Icing` and `Standard`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Update `lib/data/menu.ts` and both seed files. Centre the item cards. Add the menu footnote with its WhatsApp link. Add the Lucide icon for `nuts` and `egg_free` with text labels for screen readers. The cupcake photo swipe uses the existing `carousel.tsx` with photos from `public/menu/` (labelled `Christmas Cupcakes.webp` and `Sorrel Cranberry Shortbread.webp` are present; the rest of the labelled photos come from Drive and use placeholders until received).
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5: Commit**: `feat(menu): v2 sections, tags, limits and cupcake options`.

**Review (Opus 5.5):** every item has a price and the owner's limits; no placeholder photo is a stock or generated image.

---

### Task 8: Header, hero, separator and footer

**Files:**
- Modify: `components/shop/SiteHeader.tsx`, `app/(shop)/page.tsx`, `components/shop/SiteFooter.tsx`, `app/globals.css` (shop theme tokens for the red bar)
- Delete: `components/shop/HollyDivider.tsx`
- Create: `components/shop/CommunitySignup.tsx`, `app/(shop)/community/actions.ts`
- Test: `lib/__tests__/community.test.ts`, `e2e/order-flow.spec.ts` (the home page smoke test)

**Interfaces:**
- `joinCommunity(email: string): Promise<{ ok: true } | { ok: false; error: string }>` upserts the customer with `community_opt_in = true` and `community_opt_in_at = now` (via `setCommunityOptIn`).
- Footer links: Instagram `http://instagram.com/butterandscotchtt`, TikTok `https://www.tiktok.com/@butterandscotchtt`, Facebook `https://www.facebook.com/butterscotchtt/`, mailto `butterandscotchtt@gmail.com`, WhatsApp link (number pending, see Task 8 note).

- [ ] **Step 1: Failing tests** in `community.test.ts`: an invalid email returns `{ ok: false }`; a valid one sets `community_opt_in` true and does not change `broadcast_opt_in`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. The header uses the brand red background and beige text; the logo is larger; "Find my order" is one line (`whitespace-nowrap`). The hero headline is one line with the smaller size, with the photo and the three lines below it. The separator reads `Our Christmas Menu`. The footer adds the links and the community box with its subtext.
- [ ] **Step 4:** Run unit tests → PASS. Run the dev server (`preview_start`) and check the header and hero at 375 px and 1280 px for no horizontal scroll.
- [ ] **Step 5: Commit**: `feat(shop): v2 header, hero, separator and footer`.

**Review (Opus 5.5):** no holly graphic or divider remains (`git grep -n HollyDivider` is empty).

**Pending:** WhatsApp number and the exact Oh Deliver URL come from the owner. Until then the placeholders are marked with `TODO(owner)` in code and must not ship.

---

### Task 9: Admin Customers screen and CSV export

**Files:**
- Create: `app/admin/(protected)/customers/page.tsx`, `app/admin/(protected)/customers/export/route.ts`, `lib/admin/customers.ts`
- Modify: `lib/admin/nav-items.ts` only if the owner chooses a tab; otherwise add the link under Settings.
- Test: `lib/__tests__/admin-customers.test.ts`

**Interfaces:**
- `listCustomers(filter?: { optedIn?: boolean }): Promise<{ id; email; name; phone; orderCount; totalSpentCents; broadcastOptIn; communityOptIn }[]>` (server-only, `requireStaff()` first).
- `GET /admin/customers/export` returns CSV of customers where `broadcast_opt_in = true`, with columns `email,name,phone,broadcast_opt_in_at`.

- [ ] **Step 1: Failing tests**: the export contains only opted-in rows; a customer with two orders totals both; a customer with no orders has `orderCount` 0.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the list and the export route. Mobile layout uses cards, no horizontal scroll at 375 px.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5: Commit**: `feat(admin): customers list and broadcast export`.

**Review (Opus 5.5):** the export route calls `requireStaff()` before reading data.

---

### Task 10: Verification

**Files:** none changed unless a check fails.

- [ ] **Step 1:** `npx vitest run` → all unit tests PASS.
- [ ] **Step 2:** `npx vitest run --config <int config> lib/__tests__/*.int.test.ts` against local Supabase → PASS.
- [ ] **Step 3:** `npx playwright test` → PASS on the mobile (375 px) and desktop projects.
- [ ] **Step 4:** `npx tsc --noEmit` and `npx eslint .` → no errors.
- [ ] **Step 5:** Final Opus 5.5 review of the whole branch against the design doc. Report any section of the design doc not covered by a task.

**Review (Opus 5.5):** a line-by-line check that each Global Constraint string appears exactly as written.

---

## Owner inputs still needed (not blocking Tasks 1–7)

- WhatsApp number (Task 8).
- Exact Oh Deliver URL (Task 5).
- West and Chaguanas pickup address and hours (Task 5; copy stays as the line about being contacted).
- Order policy text from Farrah (Task 5; placeholder until then).
- Confirmation of the 5-day copy in "Ordering made easy" (Task 8).
- Whether to build the admin Customers screen (Task 9).
