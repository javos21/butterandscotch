---
name: Butter & Scotch
description: A warm, cream-and-crimson storefront for a made-to-order Trinidad home bakery.
colors:
  crimson: "#820914"
  crimson-deep: "#6A0610"
  oxblood-ink: "#560008"
  cream: "#FEF8F1"
  cream-warm: "#FFF0DE"
  card: "#FFFCF7"
  sage-wash: "#E3E1C6"
  olive-ink: "#3E3A0E"
  olive: "#6B6D38"
  olive-line: "#CBC7AE"
  holly: "#84873D"
  caramel: "#E0A028"
  cocoa: "#744324"
typography:
  display:
    fontFamily: "Young Serif, Georgia, serif"
    fontSize: "clamp(2.25rem, 8vw, 3.75rem)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Young Serif, Georgia, serif"
    fontSize: "clamp(1.75rem, 5.5vw, 2.5rem)"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: "Young Serif, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.12
  price:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.55
  label:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  sm: "10px"
  md: "16px"
  lg: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.cream}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "14px 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.crimson-deep}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.olive-ink}"
    rounded: "{rounded.md}"
    height: "52px"
  product-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "10px 10px 14px"
  option-chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.olive-ink}"
    rounded: "{rounded.sm}"
    height: "56px"
  option-chip-selected:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.cream}"
  choice-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.crimson-deep}"
    rounded: "{rounded.sm}"
    height: "56px"
  choice-row-selected:
    backgroundColor: "{colors.cream-warm}"
  notice-band:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.olive-ink}"
    rounded: "{rounded.sm}"
    height: "52px"
---

# Design System: Butter & Scotch

## 1. Overview

**Creative North Star: "The Gift-Tag Counter"**

The storefront should feel like the counter of a small, proud home bakery at Christmas: cream paper, a crimson ribbon, a sprig of holly on the tag, and every price written plainly on the card. It is warm and generous, never fussy. Bold soft-serif names do the shouting; a friendly rounded sans does the explaining; the owner's own photos carry the appetite. Colour is committed, not timid: crimson owns every action and every heading, cream owns the page, and olive steadies everything in between so the red never turns into a sale flyer.

The phone is the shop. Customers arrive from Instagram and WhatsApp, so the whole system is designed for a 375 px screen held in one hand: two-up product cards, full-width actions, 44 px+ tap targets, and a total that is always visible. The festive layer (holly divider, "Christmas" headlines, Seasonal badge) is a removable garnish on top of the year-round cream-and-crimson brand. Switch it off in January and the shop must still look finished.

This system rejects the generic online-store look: no grey e-commerce chrome, no stock photography, no corporate "Shop now" banners, no marketplace density. Per PRODUCT.md, it must never use stock or generated photos that could pass as the owner's baking, and nothing may read as confirmed until the payment is checked.

**Key Characteristics:**
- Cream page (#FEF8F1), crimson actions and headings, olive for prices, meta and rules.
- Soft heavy serif for names and headlines; rounded sans for prices, labels and body.
- Photo-first product cards in a two-column grid on phones; one generous hero photo.
- Hand-crafted garnish: holly-sprig dividers flanked by thin olive rules.
- Plain money: every card shows its price; totals and delivery are stated before checkout.
- Large, calm tap targets; full-width primary buttons on phones.

## 2. Colors

A committed two-voice palette: crimson for intent, olive for information, on warm cream paper.

### Primary
- **Ribbon Crimson** (#820914): every primary action (Add, Add to basket, Order Christmas menu, Pay to confirm), the confirmation notice band, selected option chips, and the basket badge. This is the colour that means "do this".
- **Deep Crimson** (#6A0610): hover/pressed state of crimson buttons; product names and section headlines where crimson text sits on cream.
- **Oxblood Ink** (#560008): the largest display headlines and the wordmark context, where a darker red keeps big type from vibrating.

### Secondary
- **Olive Ink** (#3E3A0E): prices, body text, input text. Dark enough for 4.5:1 on cream, warmer than black.
- **Olive** (#6B6D38): secondary text (lead time, "Contains nuts", helper text), icons in meta rows, the thin rules beside the holly divider.
- **Holly** (#84873D): holly leaves and other botanical garnish only. Never text.

### Neutral
- **Cream Paper** (#FEF8F1): the page background everywhere.
- **Card Cream** (#FFFCF7): card, input and unselected option surfaces; a half-step lighter than the page so cards lift without shadows.
- **Warm Cream** (#FFF0DE): the selected state of a choice row; the "Ordering several?" style hint wash.
- **Sage Wash** (#E3E1C6): quiet secondary banners (Gifting or catering?).
- **Olive Line** (#CBC7AE): 1 px card borders and decorative dividers only. Too faint (1.6:1) to mark the edge of anything interactive.

### Tertiary (product swatches only)
- **Caramel** (#E0A028) and **Cocoa** (#744324): flavour swatch dots (Coconut Butterscotch = caramel, Dark Chocolate & Toffee = cocoa, Half & Half = split circle). Never used for UI chrome.

### Named Rules
**The Ribbon Rule.** Crimson fills only things you can press or a status you must notice. Decorative crimson blocks, crimson section backgrounds and crimson body text are prohibited.

**The Paper Rule.** The page is always Cream Paper. No white (#FFFFFF) pages, no grey (#F5F5F5) sections; if it looks like a SaaS dashboard, the background is wrong.

**The Olive Not Grey Rule.** Secondary text and lines are olive, never neutral grey. Grey on cream reads dirty.

**The Visible Edge Rule.** Anything you can tap or type into (inputs, option chips, choice rows, the stepper, secondary buttons) is outlined in Olive (#6B6D38, 5.2:1), not Olive Line. Text on Sage Wash uses Olive Ink, never Olive (4.1:1 fails).

## 3. Typography

**Display Font:** Young Serif (with Georgia, serif)
**Body Font:** Nunito (with system-ui, sans-serif)

**Character:** Young Serif is a sturdy, soft, slightly old-fashioned serif, like the name on a bakery box lid; Nunito's rounded terminals make prices and labels feel friendly and legible at a glance. Together they read as homemade-but-proud, not boutique and not supermarket.

### Hierarchy
- **Display** (400, clamp(2.25rem, 8vw, 3.75rem), 1.04): the one hero headline per page ("Christmas bakes, made to share."), centred, Oxblood Ink.
- **Headline** (400, clamp(1.75rem, 5.5vw, 2.5rem), 1.1): section heads ("More Christmas favourites", "Ordering made easy"), product page names. Deep Crimson.
- **Title** (400, 1.375rem, 1.12): product names on cards, wrapping to two lines freely. Deep Crimson.
- **Price** (Nunito 800, 1.25rem, 1.2): "600", "300 per dozen". Olive Ink. Unit text stays in the same weight; never shrink "per dozen" into fine print.
- **Body** (Nunito 500, 1rem, 1.55): descriptions, helper text, policy copy; max 60ch.
- **Label** (Nunito 700, 0.9375rem, 1.3): buttons, chips, form labels, meta rows, badge text.

### Named Rules
**The One Serif Voice Rule.** Young Serif is for names and headlines only. Prices, buttons, forms and every number use Nunito. Serif digits in a price are prohibited.

**The No-Caps Rule.** No all-caps labels, no tracked-out eyebrow text. Sentence case everywhere ("Add to basket", "Find my order").

## 4. Elevation

The system is flat and paper-like. Depth comes from tone (Card Cream on Cream Paper) and a 1 px Olive Line border, not from shadows. The only shadow is a soft lift on the basket bar and open dialogs, so they read as "above the page".

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 -6px 24px rgba(86, 0, 8, 0.08)`): the sticky basket/total bar at the bottom of the screen.
- **Dialog lift** (`box-shadow: 0 18px 48px rgba(62, 58, 14, 0.18)`): dialogs and the menu sheet.

### Named Rules
**The Flat Card Rule.** Product cards, option chips and inputs never carry a drop shadow. If a card needs a shadow to be seen, the border colour is wrong.

## 5. Components

### Buttons
Confident and tactile, like a ribbon you pull.
- **Shape:** gently rounded rectangle (16px radius), 52px tall; full width on phones.
- **Primary:** Ribbon Crimson fill, Cream text, Nunito 700. Card "Add" buttons span the card width.
- **With price:** product page action reads "Add to basket · 50"; the price updates live with quantity.
- **Hover / Focus / Pressed:** fill shifts to Deep Crimson; pressed scales to 0.98; focus ring 3px Holly offset 2px.
- **Secondary:** Card Cream fill, 1px Olive border, Olive Ink text ("Find my order", Cancel).
- **Disabled:** 45% opacity, no hover, `aria-disabled`.

### Product card
The signature unit of the shop.
- **Corner Style:** 22px outer radius; the photo inside has 16px radius and 10px inset, so the cream frame shows like a mount around a photo.
- **Background / Border:** Card Cream, 1px Olive Line. No shadow.
- **Content order:** photo (4:3, object-fit cover) → name (Title, up to two lines) → price (Price) → allergen line in Olive ("Contains nuts", with a small leaf-free text label, never colour alone) → full-width crimson Add button pinned to the card bottom so buttons align across a row.
- **Grid:** two columns on phones (12px gap), three from 768px, four from 1200px; `minmax(0,1fr)` so long names wrap, never overflow.
- **Seasonal badge:** cream pill on the photo's top-left, Deep Crimson Label text "Seasonal".

### Option chips (packaging)
- **Style:** two side-by-side 56px chips, 10px radius, 1px Olive border, an outline icon (bag, jar) and "Bag · 50".
- **Selected:** Ribbon Crimson fill, Cream text, a filled check circle replacing the empty radio.
- **Helper:** limits sit under the chips in Olive Label ("Maximum 10 bags · Maximum 2 jars").

### Choice rows (flavour)
- **Style:** full-width 56px rows, 10px radius, 1px Olive border, a radio circle at left, Deep Crimson Label text, and a 22px swatch dot at right (Caramel, Cocoa, or split for Half & Half).
- **Selected:** Warm Cream fill, 1.5px Deep Crimson border, filled crimson check circle.
- These are real radio inputs; the swatch is decoration and the flavour name is always written.

### Quantity stepper
- 52px tall, 1px Olive border, 10px radius, three equal cells (− value +), Olive Ink glyphs, 48px minimum per button. Sits left of the Add to basket button on one row.

### Inputs / Fields
- **Style:** Card Cream fill, 1px Olive border, 10px radius, 52px tall, Nunito 500 16px (never smaller, to stop iOS zoom). Labels above in Label style.
- **Focus:** border shifts to Deep Crimson with a 3px Holly ring.
- **Error:** border Ribbon Crimson, message under the field in Deep Crimson Body with a small alert icon.

### Navigation (storefront header)
- **Style:** cream header, centred red logo (from `logos/Red Transparent Background.png`), Menu (hamburger + label) on the left, Find my order and Basket on the right, separated by thin Olive Line rules.
- **Basket:** outline basket icon in Ribbon Crimson with the count ("Basket 0"); count updates live.
- **Breadcrumb (product page):** "Christmas menu / Cupcakes & Cookies" in Label, first link Deep Crimson, current in Olive.

### Holly divider (seasonal garnish)
- A small holly sprig (two Holly leaves, three Ribbon Crimson berries) centred between two 1.5px Olive rules, above seasonal headlines and under the header. Inline SVG, decorative, `aria-hidden`. Removed outside the season.

### Meta row
- Icon + short fact pairs separated by a 1px Olive Line: "5-day lead time | TTD · Bank transfer", "5-day lead time | Choose your date at checkout". Olive icons, Olive Ink Label text.

### Ordering steps strip
- Three numbered steps (crimson numbered circle, Olive outline icon, two-line Label: Choose your bakes / Pick a date / See your total), separated by Olive Line rules; stacks vertically below 420px. Followed by a single Olive Body line ("Delivery fee included before checkout.").

### Notice band
- Full-width Ribbon Crimson band, 16px radius, Cream Label text centred: "Your order is confirmed after payment proof is checked." Used once per page where money is discussed. This is the visual carrier of the PRODUCT.md principle that nothing reads as confirmed until payment is checked.

### Gifting banner
- Sage Wash panel, 16px radius, text in Olive Ink or Deep Crimson: Headline-style serif "Gifting or catering?" with a crimson pill-ish button "Ask about a larger order" that opens WhatsApp.

### Footer
- Logo at left, then Instagram handle and email with Olive outline icons, separated by Olive Line rules; stacks on phones.

## 6. Do's and Don'ts

### Do:
- **Do** keep the page on Cream Paper (#FEF8F1) and cards on Card Cream (#FFFCF7) with a 1px Olive Line (#CBC7AE) border; outline every interactive control in Olive (#6B6D38).
- **Do** use Ribbon Crimson (#820914) for every primary action and the payment notice band, and nothing decorative.
- **Do** set product names in Young Serif and every price, button and number in Nunito 800/700.
- **Do** show the price on every card and in the Add to basket button ("Add to basket · 50").
- **Do** write allergen notes as text ("Contains nuts") next to the price, not only as an icon or colour (PRODUCT.md: allergen information is shown where the customer decides).
- **Do** keep tap targets at least 44px (buttons 52px) and primary buttons full width on phones.
- **Do** use the owner's real photos; until they exist, use plain labelled placeholders.
- **Do** keep the festive layer (holly divider, Christmas headlines, Seasonal badge) separable, so the shop looks complete without it.

### Don't:
- **Don't** use stock or generated photos that could pass as the owner's baking (PRODUCT.md).
- **Don't** let anything read as confirmed before the payment is checked: no green ticks, "Confirmed" or celebratory states on unpaid orders.
- **Don't** use grey for text, borders or backgrounds; secondary is olive.
- **Don't** add drop shadows to cards, chips or inputs, or gradients anywhere.
- **Don't** use all-caps or letter-spaced eyebrow labels, or emoji as icons.
- **Don't** shrink unit text ("per dozen", "each") into fine print; it is part of the price.
- **Don't** set body text, labels or inputs below 16px on phones.
- **Don't** convey flavour, availability or status by colour alone; always pair with the written name.
- **Don't** turn the storefront into a marketplace: no star ratings, reviews, "bestseller" ribbons or countdown timers (no reviews exist; never invent them).
