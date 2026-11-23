# Butter & Scotch: Foundation + Customer Proof of Concept — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a copy of the Monday Wear codebase into the Butter & Scotch foundation (schema, domain logic, emails) and a plain, unstyled customer flow: menu → cart → checkout with delivery-area fee and three-state calendar → private order page with "not confirmed" banner and proof upload.

**Architecture:** One Next.js 16 app, as in Monday Wear. Pages are server components; every write is a server action that calls a pure domain function (`lib/orders/*`) with an injected repo and email deps, so the logic is unit-tested without a database. Supabase holds data, staff auth and the private `receipts` bucket. Order creation runs in one Postgres function that also enforces blocked dates and the daily cap under a per-date advisory lock.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres, Auth, Storage), Tailwind 4, shadcn/ui, zod 4, React Email + Brevo (console provider locally), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-butter-and-scotch-ordering-design.md`

**Source codebase (read-only reference):** `C:\Users\javed\Documents\NakitaHyatali` ("Monday Wear"). Where a task says "adapt from Monday Wear `X`", open that file and keep its structure, error handling and race handling, removing what the notes say.

This is **plan 1 of 4**. Later plans (written after this one ships): **2** Admin panel (guided by the `ui-ux-pro-max` skill; confirm/reject proof, PDF receipt on confirmation, set delivery fee, adjust, change date, cancel, refunds, notes, history, menu/settings/areas/blocked dates, CSV exports); **3** Payment window cron (24 h reminder, 48 h auto-cancel, hourly); **4** Visual design (red & cream brand, logos) and deploy.

## Global Constraints

- Currency: TTD only. Money is integer cents everywhere. Display format `TT$1,234.00` (`formatMoney`), `TT$300` for whole prices on the menu (`formatPrice`).
- Time zone for all business dates: `America/Port_of_Spain`. Dates are ISO `YYYY-MM-DD` strings.
- Lead time default **5** days: earliest choosable date = Trinidad today + `lead_time_days`. Daily order cap default **10**. Booking horizon: dates up to Trinidad today + **90** days (constant `BOOKING_HORIZON_DAYS`).
- Order numbers: `BS-0001` format.
- Order statuses (exact strings): `awaiting_quote`, `awaiting_payment`, `proof_submitted`, `confirmed`, `ready`, `completed`, `cancelled`. Every status except `cancelled` counts toward the daily cap.
- Quantity limits apply to an item's **total across all its flavour lines** in one order.
- Customers never log in; the order page is reached only by its random access token (32 bytes, base64url).
- The customer-facing word is "order", never "pre-order"; no Monday Wear copy may survive: deposit, balance, size, USD, stock, measurements, Carnival, costume, look, Monday Wear, Nakita.
- Required checkout copy: submit button **"Place order — pay to confirm"**; unpaid order banner **"Your order is not confirmed until we receive and check your payment"**; quote banner **"Awaiting delivery quote — we'll email your total"**; too-soon tap note **"We need 5 days to bake this fresh — need it sooner? WhatsApp us."** (the number comes from `lead_time_days`).
- Calendar legend labels: "Too soon", "Unavailable", "Your date". Full days and blocked days are indistinguishable to customers.
- Real bank details are **never** committed. The seed uses placeholders; the owner enters the real ones in admin (plan 2).
- UI in this plan is deliberately plain (default shadcn components, system font, no brand styling). It must still work at 375 px width with no horizontal scroll.

## Review Focus

1. **Ordering near midnight.** A customer ordering at 11 pm Trinidad time (03:00 UTC next day) must get the lead time counted from the Trinidad date, on both the calendar and the server. → `lib/__tests__/dates.test.ts` "uses the Trinidad date, not UTC" (Task 3).
2. **Two customers taking the last slot at once.** With the cap at 1, two simultaneous orders for the same date: exactly one succeeds, the other gets "that date just filled up". → `lib/__tests__/create-order.int.test.ts` "concurrent orders cannot exceed the cap" (Task 5).
3. **A stale cart.** The cart in localStorage holds an item that has since been switched off, or an old price. The server reprices from the database and refuses inactive items with a clear message. → `create-order.test.ts` "reprices from the database" and "refuses an inactive item" (Task 5).
4. **Double-tapping Place order / network retry.** The same idempotency key returns the same order, never two. → `create-order.test.ts` "same idempotency key returns the existing order" (Task 5).
5. **Phone numbers typed every which way.** `1234567`, `868 123 4567`, `+1 (868) 123-4567`, `18681234567` all store as `+1-868-123-4567`; a non-TT international number with `+` is kept as `+<digits>`; junk is refused. → `lib/__tests__/phone.test.ts` (Task 4).

---

### Task 1: Copy Monday Wear and strip it to a clean base

**Files:**
- Create: everything copied from `C:\Users\javed\Documents\NakitaHyatali` into `C:\Users\javed\Documents\ButterandScotchTT`, **excluding** `node_modules`, `.next`, `.git`, `.env.local`, `test-results`, `.playwright-mcp`, `.superpowers`, `.impeccable`, `docs`, `tsconfig.tsbuildinfo`, `PRODUCT.md`, `supabase/.temp`.
- Delete (Monday-only, or rebuilt in later tasks from the Monday Wear source folder): **all of `app/(shop)`** (Tasks 5–8 recreate checkout, order, find-order and the menu), `lib/orders/create-order.ts`, `lib/orders/get-order.ts`, `app/admin/(protected)/products`, `app/admin/(protected)/requests`, `app/admin/(protected)/orders`, `app/admin/(protected)/payments`, `app/admin/(protected)/settings`, `app/api/cron`, `components/shop/*` (all), `components/admin/*` except `AdminSidebar.tsx`, `lib/product-options.ts`, `lib/currency-pref.ts`, `lib/brand.ts`, `lib/images.ts`, `lib/requests/`, `lib/admin/` (all; plan 2 rebuilds admin), `lib/orders/payment-state.ts`, `lib/orders/reminders*.ts`, `lib/payment-details.ts`, `lib/data/catalog.ts`, `lib/email/templates/*`, `supabase/migrations/*`, every test in `lib/__tests__` and `e2e/` that covers a deleted module.
- Keep: `lib/orders/submit-proof.ts` and `lib/orders/resend-links.ts` (adapted in Tasks 6–7), `lib/supabase/*`, `lib/auth/require-staff.ts`, `lib/email/{send.ts,types.ts,deps.ts,choose-provider.ts,layout.tsx}`, `lib/receipt-file.ts`, `lib/uuid.ts`, `lib/utils.ts`, `lib/cron-auth.ts`, `components/ui/*`, `app/admin/login`, `app/admin/layout.tsx`, `app/admin/(protected)/layout.tsx`, `proxy.ts`, configs.
- Modify: `package.json` (`"name": "butter-and-scotch"`), `supabase/config.toml` (`project_id = "ButterandScotchTT"`, keep `enable_signup = false`), `app/layout.tsx` (title `{ default: "Butter & Scotch", template: "%s · Butter & Scotch" }`, description "Made-to-order bakes from Butter & Scotch, Trinidad.", drop the Google fonts, plain `font-sans`), `README.md` (rewrite for Butter & Scotch: same setup steps, no Zelle/PayPal/Carnival), `.env.example` (`SEED_STAFF_EMAIL=owner@example.test`, `SEED_STAFF_PASSWORD=BsStaff-Local-2026`, add `SEED_DEV_EMAIL=dev@example.test`).
- Create: `app/admin/(protected)/page.tsx` placeholder ("Admin coming in plan 2") so login still lands somewhere; `.gitignore` kept from Monday Wear.

**Interfaces:**
- Produces: a building, linting project with no Monday Wear domain code; `git` repo on branch `main`.

- [ ] **Step 1:** `git init -b main` in `ButterandScotchTT` (the folder already holds `logos/`, `docs/superpowers/`, `Quote-ButterAndScotchTT.dotx`; keep them). Copy with `robocopy` using the exclusions above.
- [ ] **Step 2:** Delete the Monday-only files listed. Remove the deleted templates from `TEMPLATES`/`SUBJECTS` in `lib/email/send.ts` and their keys from `TemplateData` in `lib/email/types.ts`, leaving the maps empty (Task 5 fills them). Remove imports that now dangle (`AdminSidebar` links to deleted pages: reduce it to a single "Home" link for now).
- [ ] **Step 3:** In `lib/email/layout.tsx` replace Monday Wear branding with plain "Butter & Scotch" text header and footer (no images yet).
- [ ] **Step 4:** `npm i`, then run `npx tsc --noEmit`, `npm run lint`, `npm test`. Expected: all pass (some test files may be gone; zero failing). `lib/database.types.ts` will be regenerated in Task 2; if `tsc` fails only on references to deleted tables, leave those for Task 2 and note it.
- [ ] **Step 5:** `grep -rniE "monday|nakita|carnival|deposit|zelle|paypal|costume" app components lib e2e supabase README.md` returns nothing outside `node_modules`. Fix any hits.
- [ ] **Step 6: Commit** `git add -A && git commit -m "chore: start from Monday Wear base, strip Monday-only code"`

---

### Task 2: Database schema, seed and types

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`
- Regenerate: `lib/database.types.ts`
- Modify: `lib/types.ts`
- Test: `lib/__tests__/rls.int.test.ts` (adapt from Monday Wear's), `lib/__tests__/availability.int.test.ts`

**Interfaces:**
- Produces (tables): `settings`, `sections`, `items`, `delivery_areas`, `blocked_dates`, `orders`, `order_items`, `payments`, `order_adjustments`, `refunds`, `order_notes`, `order_events`, `email_log`, `staff`.
- Produces (functions): `create_order_with_items(order_data jsonb, items jsonb) returns table(id uuid, order_number text, access_token text)` (service role only); `public_unavailable_dates(from_date date, to_date date) returns setof date` (anon + authenticated); `is_staff()`.
- Produces (TS types in `lib/types.ts`): `Settings`, `Section`, `Item`, `DeliveryArea`, `BankDetails = { bank: string; account_name: string; account_type: string; transit: string; account_no_same_bank: string; account_no_other_bank: string }`.

Schema (columns and constraints; the implementer writes the SQL):

| Table | Columns |
|---|---|
| `settings` (single row id=1) | `store_open bool default false`, `lead_time_days int default 5 check 1..60`, `daily_order_cap int default 10 check >=1`, `bank_details jsonb default '{}'`, `pickup_info text default ''`, `policy_text text default ''`, `policy_version int default 1`, `whatsapp_number text default ''`, `notify_email text`, `updated_at` |
| `sections` | `id uuid`, `name text`, `sort int` |
| `items` | `id`, `section_id → sections restrict`, `name`, `description text null`, `unit_label text` ("per dozen", "each", "per bag", "per jar"), `price_cents int >=0`, `image_url text null`, `allergen_note text null`, `seasonal bool default false`, `flavours text[] default '{}'`, `max_qty int default 10 check 1..100`, `active bool default true`, `sort int` |
| `delivery_areas` | `id`, `name`, `fee_cents int null` (**null = "Other area", needs a quote**), `active bool`, `sort int` |
| `blocked_dates` | `date date primary key`, `note text null` |
| `orders` | `id`, `order_number text unique default next_order_number()` (`'BS-' \|\| lpad(nextval,4,'0')`), `access_token unique`, `idempotency_key unique`, `customer_name`, `email`, `phone`, `fulfilment text check in ('pickup','delivery')`, `delivery_area_id → delivery_areas set null`, `delivery_area_name text null`, `delivery_address text null`, `delivery_fee_cents int null`, `fulfil_date date not null`, `allergies text not null`, `notes text null`, `marketing_opt_in bool default false`, `subtotal_cents int`, `adjustments_cents int default 0`, `total_cents int`, `status` (the seven statuses, default `awaiting_payment`), `payment_window_started_at timestamptz null`, `reminder_sent_at timestamptz null`, `policy_version int`, `policy_accepted_at timestamptz`, `created_at`, `updated_at`; index on `(fulfil_date) where status <> 'cancelled'`, on `status`, on `email` |
| `order_items` | `id`, `order_id → orders cascade`, `item_id → items set null`, `item_name`, `flavour text null`, `unit_label`, `unit_price_cents`, `quantity int check 1..100` |
| `payments` | `id`, `order_id → orders cascade`, `amount_cents`, `reference text null check (null or 3..64 chars)`, `receipt_path text`, `status check in ('submitted','confirmed','rejected') default 'submitted'`, `reviewed_by → auth.users set null`, `reviewed_at`, `reject_reason`, `created_at`; **unique index on `(order_id) where status = 'submitted'`** |
| `order_adjustments` | `id`, `order_id cascade`, `amount_cents int` (signed), `reason text not null`, `after_payment bool`, `staff_id → auth.users`, `created_at` |
| `refunds` | `id`, `order_id cascade`, `amount_cents >0`, `refunded_on date`, `note text`, `staff_id`, `created_at` |
| `order_notes` | `id`, `order_id cascade`, `body text`, `staff_id`, `created_at` |
| `order_events` | `id`, `order_id cascade`, `kind text`, `detail jsonb`, `staff_id null`, `created_at` |
| `email_log`, `staff` | as Monday Wear `0001_init.sql` |

`create_order_with_items` (adapt Monday Wear `0003_create_order_fn.sql`): first `perform pg_advisory_xact_lock(hashtext('fulfil:' || (order_data->>'fulfil_date')))`; then if the date is in `blocked_dates`, or `count(*)` of orders on that date with `status <> 'cancelled'` is `>= settings.daily_order_cap`, `raise exception 'date_unavailable'`; then insert order and items. Grant execute to `service_role` only.

`public_unavailable_dates`: `security definer`, `stable`, returns blocked dates plus dates at or over the cap within the range; nothing else (no notes, no counts). Grant execute to `anon, authenticated`.

RLS: public (anon, authenticated) may `select` `settings` **except it must not expose `notify_email`** — do this with a view `public_settings` (columns `store_open, lead_time_days, daily_order_cap, pickup_info, policy_text, policy_version, whatsapp_number`) granted to anon, and no anon policy on `settings` itself; `sections` (all), `items` where `active`, `delivery_areas` where `active`. No anon access to `blocked_dates`, orders or any order child table. Staff (`is_staff()`) full access to everything. Buckets: `receipts` private (staff select), `items` public read / staff write.

Seed (`supabase/seed.sql`): settings with `store_open = true`, placeholder bank details (`bank: "Scotiabank"`, `account_name: "Sample Name"`, `account_type: "Chequings"`, `transit: "00000"`, account numbers `"0000000"` / `"000000000000"`), `pickup_info = 'Placeholder pickup location and hours.'`, `policy_text = 'Placeholder order policy.'`, `whatsapp_number = '+1-868-000-0000'`, `notify_email = 'orders@example.test'`. The two sections and ten items exactly as the spec's "Launch content" (prices in cents, `unit_label`, `max_qty`, `allergen_note = 'Contains nuts'` on the three nut cakes, `seasonal = true` on Sorrel Cranberry Shortbread and Chocolate Cranberry Loaf, flavours `{Coconut Butterscotch, Dark Chocolate & Toffee, Half & Half}` on Mini Cookie Bag and Cookie Jar, descriptions carrying "Double-layer 8-inch" / "9-inch", `image_url` = `https://placehold.co/800x800/F5EFE6/8B1E1E?text=<Name>`). Delivery areas and fees exactly as the spec's "Delivery areas" list, one row per bullet entry (e.g. "Port of Spain" 3000), plus "Other area (we'll contact you)" with `fee_cents null` sorted last. Two staff users from `SEED_STAFF_EMAIL` and `SEED_DEV_EMAIL` with the seed password (adapt Monday Wear seed's auth insert).

- [ ] **Step 1: Write the failing integration tests.** In `rls.int.test.ts` (anon client): `select` on `orders`, `payments`, `blocked_dates`, `settings` returns no rows/permission error; `public_settings` returns one row without `notify_email`; `items` returns only active rows. In `availability.int.test.ts` (service client sets up, anon client asserts): with `daily_order_cap = 1`, a blocked date `2027-01-10` and one non-cancelled order on `2027-01-12` and one **cancelled** order on `2027-01-13`, `public_unavailable_dates('2027-01-01','2027-01-31')` returns exactly `['2027-01-10','2027-01-12']`.
- [ ] **Step 2:** `npx supabase start && npm run db:reset` then `node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/__tests__/rls.int.test.ts lib/__tests__/availability.int.test.ts`. Expected: FAIL (tables/functions missing).
- [ ] **Step 3:** Write `0001_init.sql` and `seed.sql` as specified.
- [ ] **Step 4:** `npm run db:reset`, `npx supabase gen types typescript --local > lib/database.types.ts`, update `lib/types.ts` with the exported types above. Re-run the two suites. Expected: PASS. `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(db): Butter & Scotch schema, availability function, seed`

---

### Task 3: Money, statuses and dates

**Files:**
- Modify: `lib/money.ts` (rewrite), `lib/order-status.ts` (rewrite)
- Create: `lib/dates.ts`
- Test: `lib/__tests__/money.test.ts`, `lib/__tests__/order-status.test.ts`, `lib/__tests__/dates.test.ts`

**Interfaces:**
- Produces `lib/money.ts`: `formatMoney(cents: number): string`, `formatPrice(cents: number): string`, `sumCents(values: number[]): number`, `lineTotal(unitPriceCents: number, quantity: number): number`.
- Produces `lib/order-status.ts`: `type OrderStatus`, `ORDER_STATUSES`, `STATUS_LABEL: Record<OrderStatus,string>`, `class OrderStateError`, `afterProofSubmitted(s: OrderStatus): OrderStatus`, `countsTowardCap(s: OrderStatus): boolean`, `paymentOpen(s: OrderStatus): boolean`.
- Produces `lib/dates.ts`: `TT_TIME_ZONE = "America/Port_of_Spain"`, `BOOKING_HORIZON_DAYS = 90`, `trinidadToday(now: Date): string`, `addDays(iso: string, days: number): string`, `earliestDate(now: Date, leadDays: number): string`, `type DayState = "past" | "too_soon" | "unavailable" | "available" | "beyond"`, `dayState(iso: string, ctx: { today: string; leadDays: number; unavailable: ReadonlySet<string> }): DayState`.

`STATUS_LABEL`: `awaiting_quote` "Awaiting delivery quote", `awaiting_payment` "Awaiting payment — not confirmed", `proof_submitted` "Payment being checked", `confirmed` "Confirmed", `ready` "Ready", `completed` "Completed", `cancelled` "Cancelled".

- [ ] **Step 1: Write the failing tests.**

```ts
// money.test.ts
expect(formatMoney(30000)).toBe("TT$300.00");
expect(formatPrice(30000)).toBe("TT$300");
expect(formatPrice(4550)).toBe("TT$45.50");
expect(lineTotal(5000, 3)).toBe(15000);

// order-status.test.ts
expect(afterProofSubmitted("awaiting_payment")).toBe("proof_submitted");
expect(afterProofSubmitted("proof_submitted")).toBe("proof_submitted"); // replacing a proof
for (const s of ["awaiting_quote","confirmed","ready","completed","cancelled"] as const)
  expect(() => afterProofSubmitted(s)).toThrow(OrderStateError);
expect(countsTowardCap("cancelled")).toBe(false);
expect(countsTowardCap("awaiting_quote")).toBe(true);
expect(paymentOpen("awaiting_payment")).toBe(true);
expect(paymentOpen("awaiting_quote")).toBe(false);

// dates.test.ts
test("uses the Trinidad date, not UTC", () => {
  const lateEvening = new Date("2026-11-23T03:00:00Z"); // 22 Nov, 11 pm in Trinidad
  expect(trinidadToday(lateEvening)).toBe("2026-11-22");
  expect(earliestDate(lateEvening, 5)).toBe("2026-11-27");
});
expect(earliestDate(new Date("2026-11-23T12:00:00Z"), 5)).toBe("2026-11-28");
expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
const ctx = { today: "2026-11-23", leadDays: 5, unavailable: new Set(["2026-12-03"]) };
expect(dayState("2026-11-22", ctx)).toBe("past");
expect(dayState("2026-11-23", ctx)).toBe("too_soon");
expect(dayState("2026-11-27", ctx)).toBe("too_soon");
expect(dayState("2026-11-28", ctx)).toBe("available");
expect(dayState("2026-12-03", ctx)).toBe("unavailable");
expect(dayState("2027-02-21", ctx)).toBe("available");   // today + 90
expect(dayState("2027-02-22", ctx)).toBe("beyond");      // today + 91
```

- [ ] **Step 2:** `npx vitest run lib/__tests__/money.test.ts lib/__tests__/order-status.test.ts lib/__tests__/dates.test.ts` → FAIL.
- [ ] **Step 3:** Implement. `trinidadToday` uses `Intl.DateTimeFormat("en-CA", { timeZone: TT_TIME_ZONE })`. `addDays` does UTC date arithmetic on the ISO string. Precedence in `dayState`: past → too_soon → beyond → unavailable → available.
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5: Commit** `feat: TTD money, order statuses, Trinidad dates`

---

### Task 4: Cart, phone and checkout validation

**Files:**
- Modify: `lib/cart.ts` (rewrite), `lib/validation.ts` (rewrite)
- Create: `lib/phone.ts`
- Test: `lib/__tests__/cart.test.ts`, `lib/__tests__/phone.test.ts`, `lib/__tests__/validation.test.ts`

**Interfaces:**
- Produces `lib/cart.ts`: `type CartLine = { lineId: string; itemId: string; name: string; flavour: string | null; unitLabel: string; unitPriceCents: number; quantity: number; maxQty: number }`; `type CartAction = { type: "add"; line: Omit<CartLine,"lineId"> } | { type: "setQuantity"; lineId: string; quantity: number } | { type: "remove"; lineId: string } | { type: "clear" }`; `cartReducer(state, action): CartLine[]`; `itemQuantity(lines, itemId): number`; `roomFor(lines, itemId, maxQty): number`; `cartSubtotal(lines): number`; `CART_STORAGE_KEY = "bs-cart-v1"`; `loadCart()`, `saveCart(lines)` (same safety as Monday Wear).
- Produces `lib/phone.ts`: `normalisePhone(input: string): string | null`, `waLink(phone: string, text?: string): string | null` (move from Monday Wear `lib/admin/phone.ts`, add optional prefilled `?text=`).
- Produces `lib/validation.ts`: `checkoutSchema` and `type CheckoutInput` with fields `name` (trim 2..80), `email` (z.email, lower-cased), `phone` (transformed by `normalisePhone`, error "Please enter a valid WhatsApp number"), `fulfilment: z.discriminatedUnion("type", [{ type: "pickup" }, { type: "delivery", areaId: z.guid(), address: trim 5..300 }])`, `date` (`/^\d{4}-\d{2}-\d{2}$/`), `allergies` (trim 1..500), `notes` (≤1000, optional), `marketingOptIn` (boolean, default false), `acceptPolicy: z.literal(true)`, `idempotencyKey` (16..64), `lines: array 1..30 of { itemId: z.guid(), flavour: string 1..60 | null, quantity: int 1..100 }`.

Cart rules: `add` merges into an existing line with the same `itemId` and `flavour` (adds quantity); the reducer **clamps** so the item's total across all lines never exceeds `maxQty`; `setQuantity` to 0 removes the line.

- [ ] **Step 1: Write the failing tests.**

```ts
// cart.test.ts
const bag = { itemId: "bag", name: "Mini Cookie Bag", unitLabel: "each", unitPriceCents: 5000, maxQty: 10 };
let s = cartReducer([], { type: "add", line: { ...bag, flavour: "Coconut Butterscotch", quantity: 2 } });
s = cartReducer(s, { type: "add", line: { ...bag, flavour: "Coconut Butterscotch", quantity: 1 } });
expect(s).toHaveLength(1); expect(s[0].quantity).toBe(3);
s = cartReducer(s, { type: "add", line: { ...bag, flavour: "Half & Half", quantity: 9 } });
expect(itemQuantity(s, "bag")).toBe(10);                // clamped across flavours
expect(roomFor(s, "bag", 10)).toBe(0);
expect(cartSubtotal(s)).toBe(50000);
s = cartReducer(s, { type: "setQuantity", lineId: s[0].lineId, quantity: 0 });
expect(s).toHaveLength(1);

// phone.test.ts
for (const raw of ["1234567", "868 123 4567", "+1 (868) 123-4567", "18681234567", "+1-868-123-4567"])
  expect(normalisePhone(raw)).toBe("+1-868-123-4567");
expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
expect(normalisePhone("12345")).toBeNull();
expect(normalisePhone("call me")).toBeNull();
expect(waLink("+1-868-123-4567", "Order BS-0001")).toBe("https://wa.me/18681234567?text=Order%20BS-0001");

// validation.test.ts
const ok = { name: "Ana", email: "Ana@Example.com", phone: "868 123 4567", fulfilment: { type: "pickup" },
  date: "2026-12-20", allergies: "None", acceptPolicy: true, idempotencyKey: "k".repeat(20),
  lines: [{ itemId: "11111111-1111-4111-8111-111111111111", flavour: null, quantity: 1 }] };
const parsed = checkoutSchema.parse(ok);
expect(parsed.email).toBe("ana@example.com"); expect(parsed.phone).toBe("+1-868-123-4567");
expect(parsed.marketingOptIn).toBe(false);
expect(checkoutSchema.safeParse({ ...ok, allergies: "  " }).success).toBe(false);
expect(checkoutSchema.safeParse({ ...ok, acceptPolicy: false }).success).toBe(false);
expect(checkoutSchema.safeParse({ ...ok, fulfilment: { type: "delivery", areaId: ok.lines[0].itemId, address: "" } }).success).toBe(false);
```

- [ ] **Step 2:** Run the three files → FAIL.
- [ ] **Step 3:** Implement. Phone: strip non-digits (remember whether it started with `+`); 7 digits → prefix `1868`; 10 digits starting `868` → prefix `1`; 11 digits starting `1868` → TT; TT result formatted `+1-868-XXX-XXXX`; otherwise, if input began with `+` and has 8..15 digits → `+<digits>`; else null.
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5: Commit** `feat: cart with flavour lines and per-item limits, phone normalising, checkout schema`

---

### Task 5: Place an order (domain, repo, action, first emails)

**Files:**
- Create (adapting Monday Wear's files of the same path): `lib/orders/create-order.ts` (keep its structure: injected repo/email, `defer`, idempotency), `app/(shop)/checkout/actions.ts` (repo against the new tables; `getSettings` here reads the full `settings` row with the admin client, since it needs `notify_email`)
- Create: `lib/data/settings.ts` (rewrite: `getPublicSettings()` from `public_settings`, `getBankDetails()` server-only via admin client), `lib/data/menu.ts`, `lib/email/templates/OrderReceived.tsx`, `lib/email/templates/StaffNewOrder.tsx`
- Modify: `lib/email/types.ts`, `lib/email/send.ts`
- Test: `lib/__tests__/create-order.test.ts`, `lib/__tests__/create-order.int.test.ts`, `lib/__tests__/email.test.ts`

**Interfaces:**
- Consumes: `checkoutSchema` (Task 4), `dayState`, `trinidadToday` (Task 3), `sumCents`, `lineTotal` (Task 3), `create_order_with_items` (Task 2).
- Produces `lib/data/menu.ts`: `getMenu(): Promise<{ sections: (Section & { items: Item[] })[]; areas: DeliveryArea[] }>` (active items/areas, sorted), `getUnavailableDates(from: string, to: string): Promise<string[]>`.
- Produces `lib/orders/create-order.ts`:
  - `type OrderRepo = { getSettings(): Promise<Settings>; getItems(ids: string[]): Promise<Item[]>; getArea(id: string): Promise<DeliveryArea | null>; findByIdempotencyKey(key: string): Promise<OrderRef | null>; insertOrder(order: NewOrder, items: NewOrderItem[]): Promise<InsertedOrder> }`
  - `insertOrder` throws `DateUnavailableError` (exported class) when the database raises `date_unavailable`.
  - `createOrder(input: unknown, deps: { repo: OrderRepo; email: EmailDeps; now?: () => Date; defer?: (t: () => Promise<void>) => void }): Promise<{ token: string } | { error: string; field?: "date" | "lines" | "fulfilment" }>`
- Produces email templates: `order_received: { orderNumber; token; customerName; items: { name: string; flavour: string | null; quantity: number; lineTotalCents: number }[]; subtotalCents; deliveryFeeCents: number | null; totalCents; awaitingQuote: boolean; bank: BankDetails | null }`, `staff_new_order: { orderNumber; customerName; email; phone; fulfilDate; totalCents; awaitingQuote: boolean; adminUrl }`.

Rules `createOrder` enforces (in this order):
1. Parse; on failure `{ error: "Please check your details and try again." }`.
2. Same idempotency key → existing token.
3. `store_open` false → `{ error: "We're not taking orders right now. Your cart is saved." }`.
4. `dayState(date)` with `today = trinidadToday(now())` and an **empty** unavailable set: `past`/`too_soon` → `{ field: "date", error: "Please choose a date at least {lead} days from today." }`; `beyond` → `{ field: "date", error: "Please choose a date within the next 90 days." }`.
5. Every line's item exists and is active, else `{ field: "lines", error: "{name or 'An item'} is no longer available. Remove it from your cart to continue." }`. Flavour must be one of `item.flavours` when the list is non-empty, and `null` when empty, else `{ field: "lines", error: "Please choose a flavour for {name}." }`. Sum of quantities per item ≤ `max_qty`, else `{ field: "lines", error: "You can order up to {max} {name} per order." }`.
6. Prices come only from the database (`unit_price_cents = item.price_cents`).
7. Delivery: area must exist and be active, else `{ field: "fulfilment", error: "Please choose a delivery area." }`. `fee_cents === null` → status `awaiting_quote`, `delivery_fee_cents null`, `total = subtotal`, `payment_window_started_at null`. Otherwise status `awaiting_payment`, `total = subtotal + fee`, `payment_window_started_at = now`. Pickup → `awaiting_payment`, no fee. Store `delivery_area_name` as a copy.
8. `DateUnavailableError` → `{ field: "date", error: "Sorry — that date just filled up. Please pick another date." }`.
9. After insert (deferred): `order_received` to the customer (subject `"Order {n} received — awaiting payment"`, or `"Order {n} received — awaiting delivery quote"` when quoting; `bank` is null when quoting) and `staff_new_order` to `notify_email` if set (subject `"New order {n} from {name}"`). Both templates are plain React Email using the Task 1 layout and include the order link `${NEXT_PUBLIC_SITE_URL}/order/{token}`. The customer email states in bold: "Your order is not confirmed until we receive and check your payment."

- [ ] **Step 1: Write the failing unit tests** in `create-order.test.ts` with an in-memory repo and a recording email provider (pattern from Monday Wear's test). Fix `now = new Date("2026-11-23T12:00:00Z")`, settings `lead_time_days 5`. Tests:
  - "places a pickup order": one Red Velvet (`price_cents 30000`) × 2 on `2026-11-28` → inserted order has `status "awaiting_payment"`, `subtotal_cents 60000`, `total_cents 60000`, `payment_window_started_at` = now ISO; email `order_received` sent with `awaitingQuote false` and bank details.
  - "adds the area fee": delivery to an area with `fee_cents 4000` → `total_cents 64000`, `delivery_fee_cents 4000`, `delivery_area_name` copied.
  - "other area waits for a quote": area `fee_cents null` → `status "awaiting_quote"`, `payment_window_started_at null`, email `awaitingQuote true`, `bank null`.
  - "refuses a date inside the lead time": `2026-11-27` → `field "date"`, message contains "at least 5 days".
  - "reprices from the database": client line carries no price; DB price 30000 is used even if the test's cart had another price.
  - "refuses an inactive item" → `field "lines"`, "no longer available".
  - "limit is per item across flavours": Cookie Jar (`max_qty 2`) with 2 × "Coconut Butterscotch" + 1 × "Half & Half" → error "You can order up to 2 Cookie Jar per order."
  - "flavour required": Mini Cookie Bag with `flavour null` → "Please choose a flavour for Mini Cookie Bag."
  - "same idempotency key returns the existing order": second call returns the first token; `insertOrder` called once.
  - "date filled up": repo throws `DateUnavailableError` → `field "date"`, "just filled up".
  - "store closed" → closed message, nothing inserted.
- [ ] **Step 2: Write the failing integration test** `create-order.int.test.ts` (real local DB, service client, calls the production repo from `app/(shop)/checkout/actions.ts` via an exported `buildOrderRepo()`): set `daily_order_cap = 1`; **"concurrent orders cannot exceed the cap"**: `Promise.allSettled` two `insertOrder` calls for the same date with different idempotency keys → exactly one fulfilled, one rejected with `DateUnavailableError`. **"blocked date refused"**: insert into `blocked_dates`, `insertOrder` rejects with `DateUnavailableError`. Reset settings and rows in `afterEach`.
- [ ] **Step 3:** Run both → FAIL.
- [ ] **Step 4:** Implement `create-order.ts`, `checkout/actions.ts` (`placeOrderAction(input: unknown)` wraps `createOrder` exactly like Monday Wear, with `after()` for email; export `buildOrderRepo` for the integration test), `lib/data/*`, templates, `TemplateData`/`TEMPLATES`/`SUBJECTS` entries. Extend `email.test.ts` to render both templates and assert the subject strings and that the "not confirmed" sentence appears in `order_received` HTML.
- [ ] **Step 5:** Run unit + integration suites → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 6: Commit** `feat(orders): place orders with area fees, quotes, date cap and item limits`

---

### Task 6: Order page data and proof upload

**Files:**
- Create: `lib/orders/get-order.ts` (new shape below), `app/(shop)/order/[token]/actions.ts` (adapt Monday Wear's repo)
- Modify: `lib/orders/submit-proof.ts` (adapt)
- Create: `lib/email/templates/ProofReceived.tsx`, `lib/email/templates/StaffProofReceived.tsx`
- Test: `lib/__tests__/get-order.int.test.ts`, `lib/__tests__/submit-proof.test.ts`

**Interfaces:**
- Consumes: `afterProofSubmitted`, `paymentOpen`, `STATUS_LABEL` (Task 3); `getBankDetails`, `getPublicSettings` (Task 5).
- Produces `getOrderView(token: string): Promise<OrderView | null>` where `OrderView = { orderNumber; status: OrderStatus; statusLabel; customerName; createdAt; fulfilment: "pickup" | "delivery"; areaName: string | null; address: string | null; fulfilDate: string; items: { name; flavour: string | null; quantity; unitLabel; lineTotalCents }[]; subtotalCents; deliveryFeeCents: number | null; adjustmentsCents; totalCents; bank: BankDetails | null; canUploadProof: boolean; latestPayment: { status: "submitted" | "confirmed" | "rejected"; rejectReason: string | null; createdAt: string } | null; pickupInfo: string | null; whatsappNumber: string }`. No email, phone or token in the view.
  - `bank` is set only when `paymentOpen(status)`; `canUploadProof = paymentOpen(status)`; `pickupInfo` only when `fulfilment = "pickup"` and status is `confirmed`, `ready` or `completed`.
- Produces `submitProof(input: { token: string; reference: string; file: ProofFile }, deps: SubmitProofDeps): Promise<{ ok: true } | { error: string }>` and server action `submitProofAction(formData: FormData)`.

Adaptation notes for `submit-proof.ts` (from Monday Wear): remove `kind`, `currency`, `payment_method`, deposit/balance maths; amount is always `order.total_cents`; **reference is optional** — empty after trim is stored as `null`, otherwise must be 3..64 chars; status move uses `afterProofSubmitted`; `awaiting_quote` gets "We'll email your total before you pay."; `cancelled` gets "This order was cancelled"; `confirmed`/later gets "Your payment is already confirmed". Keep the guard-first status move, upload, upsert-pending, settled/inserted handling and receipt cleanup exactly as Monday Wear does. Receipt path `{orderId}/payment-{Date.now()}.{ext}`. Emails: `proof_received` to customer (subject `"We received your payment proof for {n}"`, body says staff will check it and the order is confirmed once they do) and `staff_proof_received` to `notify_email` (subject `"Payment proof to check for {n}"`).

- [ ] **Step 1: Write the failing tests.** Port Monday Wear's `submit-proof.test.ts` cases that still apply (file type/size checks, HEIC with empty MIME, replace pending proof, settled-during-upload, concurrent status change) to the new signature, and add: "reference is optional" (empty reference → payment stored with `reference null`, ok); "refuses while awaiting quote" (error text above); "amount is the order total" (`amount_cents` = `total_cents` 64000). In `get-order.int.test.ts`: an `awaiting_quote` order's view has `bank null` and `canUploadProof false`; an `awaiting_payment` order's view has `bank` set and `canUploadProof true` and no `email`/`phone` keys; a `confirmed` pickup order has `pickupInfo` set and `bank null`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement as above.
- [ ] **Step 4:** Run → PASS. `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(orders): order page view and full-payment proof upload`

---

### Task 7: Find my order

**Files:**
- Modify: `lib/orders/resend-links.ts`
- Create (adapt Monday Wear's): `app/(shop)/find-order/actions.ts`, `app/(shop)/find-order/page.tsx`, `components/shop/FindOrderForm.tsx`
- Create: `lib/email/templates/OrderLinks.tsx`
- Test: `lib/__tests__/resend-links.test.ts` (port from Monday Wear)

**Interfaces:**
- Produces template `order_links: { customerName?: string; orders: { orderNumber: string; token: string; fulfilDate: string }[] }`, subject `"Your Butter & Scotch orders"`. `ResendOrder` gains `fulfilDate: string`.

- [ ] **Step 1:** Port the Monday Wear tests; add `fulfilDate` to fixtures and assert it reaches the email data. Run → FAIL.
- [ ] **Step 2:** Implement (repo: non-cancelled orders for the email, newest first). Run → PASS.
- [ ] **Step 3: Commit** `feat: find my order by email`

---

### Task 8: Plain customer pages

**Files:**
- Create: `app/(shop)/layout.tsx` (`CartProvider`, plain header with "Butter & Scotch" text link to `/`, cart link showing count and subtotal, footer with WhatsApp link "Questions or problems? WhatsApp us" built by `waLink(settings.whatsapp_number)` and a "Find my order" link; `Toaster`), `app/(shop)/page.tsx`, `app/(shop)/checkout/page.tsx`, `app/(shop)/order/[token]/page.tsx`
- Create: `components/shop/CartProvider.tsx` (adapt Monday Wear's: React context over `cartReducer` + `loadCart`/`saveCart`), `components/shop/MenuItemCard.tsx`, `components/shop/CheckoutForm.tsx`, `components/shop/DateCalendar.tsx`, `components/shop/OrderStatusBanner.tsx`, `components/shop/BankDetails.tsx`, `components/shop/ProofUploadForm.tsx` (adapt Monday Wear's, including in-browser compression via `planReceipt`)
- Test: `components/shop/__tests__/DateCalendar.test.tsx` only if the repo already has a DOM test setup; otherwise covered by Task 9 e2e.

**Interfaces:**
- Consumes: `getMenu`, `getUnavailableDates`, `getPublicSettings` (Task 5), `placeOrderAction` (Task 5), `getOrderView`, `submitProofAction` (Task 6), `dayState`, `trinidadToday`, `addDays`, `BOOKING_HORIZON_DAYS` (Task 3), cart API (Task 4).
- Produces `DateCalendar` props: `{ today: string; leadDays: number; unavailable: string[]; value: string | null; onChange(date: string): void; whatsappHref: string | null }`. Each day cell is a `<button>` with `data-date="YYYY-MM-DD"` and `data-state={DayState}`; only `available` cells are enabled; tapping a `too_soon` cell shows the lead-time note inline (it is focusable but does not select). Legend under the grid. Month navigation limited to months that contain non-past, non-beyond days.

Page behaviour:
- **Menu `/`:** store closed → a single message "We're not taking orders right now — check back soon." and no add buttons. Otherwise sections in order; each `MenuItemCard` shows image, name, `formatPrice`, unit label, description, allergen note, "Seasonal" badge if set, a flavour `<select>` when `flavours.length > 0` (no default; Add is disabled until chosen), a quantity stepper capped by `roomFor`, and "Add to cart". Under the menu: "Ordering more than this, or something custom? Message us on WhatsApp first." with the WhatsApp link.
- **Checkout `/checkout`:** server component loads menu areas, public settings, `today = trinidadToday(new Date())`, and `getUnavailableDates(today, addDays(today, BOOKING_HORIZON_DAYS))`; renders `CheckoutForm`. The form shows cart lines (quantity stepper, remove), name, email, WhatsApp number, pickup/delivery radio; delivery shows an area `<select>` listing `name — TT$fee` (or just the name for the quote area) and an address textarea; `DateCalendar`; allergies (required; helper text: kitchen is not allergen-free and names the items with `allergen_note`); anything else; marketing opt-in checkbox ("Can we contact you with offers and specials?"); policy text with required checkbox; summary (subtotal, delivery fee or "Delivery fee: we'll email your total" for the quote area, **Total**); submit button "Place order — pay to confirm". Generates the idempotency key once per mount (`randomId`). On `{ error, field }` shows the message next to that field (date errors also clear the selected date); on `{ token }` clears the cart and `router.push("/order/" + token)`.
- **Order `/order/[token]`:** `notFound()` for an unknown token. `OrderStatusBanner` shows `statusLabel` as a large badge plus: for `awaiting_payment` the exact unpaid banner text; for `awaiting_quote` the exact quote banner text; for `proof_submitted` "We're checking your payment. We'll email you once it's confirmed."; for a rejected latest payment, its reason and "Please upload a new proof."; for `confirmed` "Your order is confirmed 🎉". Then order number, date (formatted `Saturday, 28 November 2026`), pickup/delivery details, items, subtotal/fee/total. When `bank` is set: `BankDetails` with a copy button per value and the line "Put your order number {n} in the transfer notes." and the two account-number rows labelled "Account # (from Scotiabank)" and "Account # (from another bank)". When `canUploadProof`: `ProofUploadForm` (file required, reference optional). When `pickupInfo` is set: pickup info. Always: WhatsApp link with text "Order {n}".
- **Find my order `/find-order`:** keep Monday Wear's page, plain.

- [ ] **Step 1:** Build the components and pages as described with default shadcn components (`button`, `input`, `select`, `radio-group`, `checkbox`, `textarea`, `card`, `badge`, `alert`). Lucide icons only where needed (cart, copy, check).
- [ ] **Step 2:** `npm run dev`; in the browser at 375 × 812, walk: add a cookie bag (flavour required), add Red Velvet × 2, checkout with pickup on the first available date, land on the order page with the unpaid banner and bank details, upload a PNG, see "Payment being checked". Repeat with "Other area" and confirm the quote banner and no bank details. Confirm no horizontal scroll on any page.
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` → clean.
- [ ] **Step 4: Commit** `feat(shop): plain menu, cart, checkout with calendar, order page`

---

### Task 9: End-to-end tests

**Files:**
- Modify: `e2e/order-flow.spec.ts` (rewrite), `e2e/admin-guard.spec.ts` (keep: `/admin` redirects to login when signed out), `e2e/fixtures/*` (a small `receipt.png`)
- Test: the spec files themselves

**Interfaces:**
- Consumes: the pages from Task 8 and the seed from Task 2.

- [ ] **Step 1: Write the specs** (mobile viewport `devices["Pixel 7"]` project added in `playwright.config.ts` alongside desktop):
  - "pickup order to proof": add Mini Cookie Bag (choose "Half & Half") and Red Velvet Cupcakes × 2 → checkout → fill contact (`868 555 0101`) → pickup → click the first `[data-state="available"]` day → allergies "None" → accept policy → "Place order — pay to confirm" → URL matches `/order/` → text "Your order is not confirmed until we receive and check your payment" visible → "TT$650.00" visible → upload `receipt.png` → "Payment being checked" visible.
  - "lead time days cannot be picked": on checkout, today's cell has `data-state="too_soon"`; clicking it shows "We need 5 days to bake this fresh" and the submit stays blocked with no date.
  - "other area waits for a quote": delivery → "Other area (we'll contact you)" → place order → "Awaiting delivery quote — we'll email your total" visible and no "Transit" text on the page.
  - "item limit across flavours": Cookie Jar 2 × one flavour, then the stepper for a second flavour cannot go above 0 / Add is disabled.
- [ ] **Step 2:** `npm run db:reset && npx playwright test` → the new specs FAIL only if Task 8 has gaps; fix the pages, not the tests, until PASS.
- [ ] **Step 3:** Full check: `npm test`, `node --env-file=.env.local node_modules/vitest/vitest.mjs run`, `npx tsc --noEmit`, `npm run lint`, `npx playwright test` → all pass.
- [ ] **Step 4: Commit** `test(e2e): customer order flow on mobile and desktop`
