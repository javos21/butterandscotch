# Butter & Scotch V2: Client Revisions Design

Status: **draft, revised 2026-11-27 after owner answers; awaiting approval before build.** Builds on `2026-11-23-butter-and-scotch-ordering-design.md`. Where this document and that spec disagree, this document wins.

## Intent

The owner has reviewed the Christmas ordering site and sent a list of copy, layout and flow changes. The biggest is a change of requirement: she no longer wants delivery fees estimated from oDeliver's rates. Customers pay for their order at checkout, and if they chose delivery they pay the delivery fee separately, on delivery, by cash or card.

V2 applies those changes before Christmas, without reopening the decisions in the V1 spec.

**What success looks like:** the owner reviews the live site and sees her copy, sections, order flow and Christmas dates reflected exactly. A customer can place an order without being shown a delivery fee they might not pay, and understands when they will be asked to pay for delivery.

## Goals

- Apply every item in the client's revision notes (navigation, hero, "Ordering made easy", menu, checkout, order page, footer).
- Remove delivery-fee estimation from checkout and from the order total.
- Add a hard order-close date and a last fulfilment date for the Christmas season.
- Let customers choose West or Chaguanas for pickup.
- Raise the limits for mini cookie bags and jars to 10, and loaves to 10.
- Build a customer record keyed by email, so orders from the same email are grouped together. Customers can request their order list by email, and can opt in to the WhatsApp broadcast at checkout.

## Non-goals

- Live oDeliver rate quotes or bookings. Delivery areas are deleted entirely. The owner wants to use oDeliver's API later, which is a future version. The "exact fee" link only sends customers to oDeliver.
- Customer logins or passwords. Identity is the email address only.
- Sending WhatsApp broadcasts from the site. The owner exports the opted-in list and sends broadcasts herself.
- Online card payments, deposits or part payments.
- Changing the bank-transfer payment flow, the proof-check flow, or the 48-hour payment window.
- Visual redesign beyond the brand colour changes listed below. Full visual design is a separate pass.

## Anti-goals

- A customer thinks delivery is included in the total when it is not.
- A customer orders for a date after Christmas close, or after the order-close date, because the copy and the checkout disagree.
- Dietary or allergy information (nuts, egg free) is missing or wrong on a menu item.
- Leftover V1 features on the checkout that the client removed (fee estimate, "notes" box, delivery total line).

## Constraints

- **Timeline:** Christmas. No new orders after **December 16** (owner: "you cannot make any new orders past Dec 16"). The last pickup or delivery date is **December 23**.
- **Not live yet:** V1 has not launched, so V2 is the next build. No migration of live orders is needed.
- **Lead time:** 5 days, per the owner. The notes also say "confirmed orders need a 7 day lead time" under "Ordering made easy". The owner said 5 days, so this document uses 5 and flags the 7-day line for copy correction (see Open items).
- **Payment:** unchanged. Bank transfer, proof upload, the owner checks the money before confirming.
- **Brand:** red `#8B1E1E` and cream/beige, from the logos in `logos/`.

## Approaches considered

### Delivery fee handling

1. **Remove fee estimation; charge delivery separately on delivery (chosen).** The owner's change. The checkout asks for a delivery address only. The order total is items only. The customer sees the note "Once your order is confirmed we will contact you with your total delivery amount. Delivery can be paid via cash or card upon delivery". Staff confirm the delivery amount after the order is placed, outside the order total.
2. **Keep the area table and fees, but hide the fee from customers.** Rejected. It keeps the area list, the "Other area" quote flow and the `awaiting_quote` state, all of which the owner has removed the reason for.

### Order close and last date

1. **Two new settings: order close date (Dec 16) and last fulfilment date (Dec 23), checked on the server (chosen).** An order placed after Dec 16 is refused, so a Dec 17 order is not allowed. Orders placed on Dec 16 are accepted (my call; owner to confirm). The date picker offers nothing after Dec 23. Both are editable in admin Settings after Christmas.
2. **Use the existing blocked dates feature.** Rejected as the main mechanism. Blocked dates block a fulfilment date. They can't express "stop taking orders on Dec 16 but still allow Dec 17–23 pickups", because the owner's rule is about when the order is placed. Blocked dates still work for single closed days, and the owner can use them for any day inside the season she doesn't bake.

## Customer flow changes

### Navigation bar

- Background: brand red. Text: beige.
- The centre logo is larger.
- Remove the holly graphic and the line under the bar.
- "Find my order" fits on one line.

### Hero (section 1)

- Headline on one line, with a smaller font size.
- Headline text: **"T'is the season to treat yourself"**.
- Photo: the full-spread image titled "Hero Image" in the shared Drive folder.
- Under the photo:
  - "5 day lead time"
  - "Orders close on December 16th"
  - "Last day for delivery/pickup December 23rd"

### "Ordering made easy"

- Moves up to sit above the menu section.
- "Choose your bakes" becomes **"Choose your treats"**.
- Remove "Delivery fee included before checkout".
- Step 3 becomes **"Pay to confirm"**, with the text: "We want to ensure you get your treats for when you need them, so don't forget that your order is only confirmed once proof of payment is received and confirmed. Orders need a 5 day lead time." (The "7 day" wording is replaced, per the owner's 5-day decision.)
- Add the line: "If you have gifting questions, catering needs, specific requests or dietary requirements, reach out to us before you order." This line should link to WhatsApp.

### Separator

- Remove the holly graphic and line.
- Text: **"Our Christmas Menu"**.

### Menu

- All items centred (currently left-aligned).
- Add under the menu: "Any special requests or dietary concerns, make sure you contact us first to ensure we can fulfil it", with "contact us" linking to WhatsApp.
- Sections are reorganised:

  **Cookies & Shortbread**
  - Mini Cookie Jars: Dark Chocolate & Toffee, Coconut Butterscotch, Red Velvet, Mix of all 3 flavours. Limit **10** per order (was 2).
  - Mini Cookie Bags: Dark Chocolate & Toffee, Coconut Butterscotch, Red Velvet, Mix of all 3 flavours. Limit **10**.
  - Sorrel Cranberry Shortbread Bar. Tags: Egg Free.

  **Cakes, Cupcakes & Loaves**
  - Hummingbird Cake. Tags: Contains nuts, Seasonal.
  - Honey Pistachio Cake. Tags: Contains nuts.
  - Orange Almond Cake. Tags: Contains nuts.
  - Red Velvet Cupcakes. Options: Christmas Themed Icing, Standard. Photo swipe with labelled photos from the Drive folder.
  - Lemon Blueberry Cupcakes. Options: Christmas Themed Icing, Standard. Photo swipe with labelled photos from the Drive folder.
  - Glazed Lemon Loaf. Limit **10** per order (was 5).
  - Chocolate Cranberry Loaf. Limit **10** per order (was 5).

- Dietary indicators: keep "Contains nuts". Add "Egg Free" for the Sorrel Cranberry Shortbread Bar.
- The flavour "Half & Half" is replaced by "Mix of all 3 flavours" on the cookie items. The Red Velvet flavour is new on the cookie items.

### Checkout

- **Contact:** unchanged (name, email, WhatsApp).
- **Pickup or delivery:**
  - Pickup: a dropdown with **West** and **Chaguanas**. Under it: "You will be contacted for more information about collection once your order is confirmed."
  - Delivery: a single **address** field. No area list. No fee shown.
  - Under the delivery address, smaller and lighter italic text: "If you would like to check your exact delivery fee before you place your order, click [here]." The link goes to the Oh Deliver page (URL to confirm).
  - Note under delivery: "Once your order is confirmed we will contact you with your total delivery amount. Delivery can be paid via cash or card upon delivery."
- **Date:**
  - Copy: "We need 5 days to bake this fresh — need it sooner? WhatsApp us." (One dash, as the owner asked.)
  - The date colour becomes brand red.
  - Dates after December 23 are unavailable. If the order date is after December 16, checkout refuses the order with a message that orders are closed for Christmas.
- **Allergies and notes:**
  - Remove the "Notes" box.
  - Keep the allergies field.
  - Add the disclaimer: "Our kitchen is not allergen free. If you have severe allergies, please contact us before placing your order."
- **Anything else:** moves into its own section. It holds one checkbox: "Opt in to our WhatsApp broadcast for offers." This replaces the V1 marketing opt-in. The choice is saved on the customer record (see Customers).
- **Order policy:** a placeholder block until Farrah writes the policy. It is read from settings.
- **Confirmation line:** replace "your order is confirmed after payment proof is checked" with "Your order will only be confirmed after proof of payment is received." Remove its red shape, so it no longer looks like a button, and place it below the Place Order button.
- **CTA:** "Place order - pay to confirm" becomes **"Place Order"**.
- **Totals:** the summary shows items and the order total only. Add "$" in front of every number.

### Order page (`/order/[token]`)

- Top text: "Your order is not confirmed until we have received and approved your payment."
- "Questions about this order?" links to WhatsApp with a pre-written message that includes the order number, e.g. "Hi, I have a question about order BS-0142."

### Footer

- Social links: Instagram (`http://instagram.com/butterandscotchtt`), TikTok (`https://www.tiktok.com/@butterandscotchtt`), Facebook (`https://www.facebook.com/butterscotchtt/`).
- WhatsApp link.
- Email: `butterandscotchtt@gmail.com` (mailto link).
- "Join the community" with an email box. Subtext: "be the first to know about special offers, flash sales, new items & more". Submitting saves the email to the customer record with its own opt-in flag (see Customers).

## Customers (CRM by email)

The client wants a simple customer list, but customers order without signing up. So a customer record is created per email address.

- **Key:** the email, lowercased and trimmed. No other normalisation (no Gmail dot rules).
- **Grouping:** each order has a `customer_id`. Every order with the same email joins the same customer.
- **Customer fields:** email, name, WhatsApp number (both from the latest order), `broadcast_opt_in` (boolean), `broadcast_opt_in_at`, `community_opt_in` (boolean, from the footer box), `community_opt_in_at`, first and last order dates.
- **Order snapshot:** each order keeps its own name and phone as typed, so a later change to the customer record never changes an old order.
- **Consent:** each opt-in stores the checkbox or form text shown and the time it was given. An opt-out is recorded when a customer asks; there is no automated unsubscribe in V2.
- **Customer order lookup:** the customer enters their email on the site and the site emails them links to their orders. The list is not shown on screen, so anyone typing an email can't see someone else's orders. This replaces V1 "Find my order" (my call; owner to confirm).
- **Admin Customers screen (my call; owner to confirm):** a list with name, email, WhatsApp, order count, total spent and opt-in status. A CSV export of opted-in customers for the broadcast list.

## Data and settings changes

- **Delivery:** remove the fee from the order total and the checkout. Remove the `awaiting_quote` order state, the "Set delivery fee" admin action, and the "Your total is ready" email. Delete the `delivery_areas` table, its admin screen and its settings. Future delivery pricing will come from oDeliver's API in a later version.
- **Customers:** add a `customers` table (see Customers). Add `customer_id` to `orders`. Add `customers` to the admin nav or Settings, per the owner's answer.
- **Order total:** items only. Adjustments and refunds work as in V1.
- **Settings:** add `order_close_date` (Dec 16) and `last_fulfilment_date` (Dec 23). Pickup locations become a list: West, Chaguanas.
- **Items:** bag and jar limits become 10. Loaf limits become 10. Add the Egg Free tag. Add the Red Velvet flavour to cookie items. Replace "Half & Half" with "Mix of all 3 flavours" on cookie items. Add Christmas Themed Icing / Standard options to the two cupcakes.
- **Emails:** the "Order received" email no longer mentions a delivery fee. Its wording on delivery is updated to match the checkout note.

## Assets

- Hero image: "Hero Image" from the shared Google Drive folder.
- Cupcake photo swipes: labelled photos (Christmas Themed Icing, Standard) for Red Velvet and Lemon Blueberry, from the shared Drive folder.
- Until assets arrive, use placeholders. Never use stock or generated photos that could pass as her baking.

## Left to the builder

- Exactly which V1 code paths to delete for the delivery change. The builder should search for `awaiting_quote`, `delivery_areas`, and the fee copy first.
- Migration of existing orders with `awaiting_quote` status. There are none in production yet, so the builder should confirm this before deleting the state.
- The date-picker rule for a date that is both unavailable and inside the lead time.
- Test updates (Vitest + Playwright, as in V1).

## Open items (need the owner)

1. **Oh Deliver URL** for the "check your exact delivery fee" link.
2. **WhatsApp number** for all WhatsApp links.
3. **Pickup hours and address** for West and Chaguanas. Her copy only says "you will be contacted", so the builder will show that line and leave the address blank.
4. **Order policy text** (Farrah).
5. **7-day lead-time line:** the owner said 5 days. Confirm the replacement copy in "Ordering made easy".
6. **Dec 16 inclusive:** are orders placed on Dec 16 itself accepted? (Assumed yes.)
7. **Customer lookup by email:** emailed links (assumed) or on-screen list?
8. **Admin Customers screen and CSV export:** wanted for V2 (assumed yes)?
9. **Two checkboxes or one:** the V1 "Anything else" opt-in is merged into the WhatsApp broadcast checkbox (assumed). Confirm the footer box stays a separate consent flag.

## Build and review

- **Build:** Claude Haiku 5.5 (`claude-haiku-5-5`), as the owner asked.
- **Review:** Claude Opus 5.5 (`claude-opus-5-5`), as the owner asked. It reviews each build step before it is merged.
- The implementation plan will say which steps Haiku builds and which Opus reviews.

## Calls I made (for the owner to check)

- Order close and last date are settings, not blocked dates (see Approaches).
- Delivery areas are deleted, not hidden.
- The 7-day lead-time line is replaced with 5 days, because the owner said 5 days.
- The "Oh Deliver" link is kept as a plain link, with no fee calculation.
- Customers are keyed by lowercased, trimmed email, with no other normalisation.
- Placeholder copy stays in place for the order policy and pickup hours until they are sent.
