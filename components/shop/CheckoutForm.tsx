"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { placeOrderAction } from "@/app/(shop)/checkout/actions";
import { useCart } from "@/components/shop/CartProvider";
import { DateCalendar, ORDERS_CLOSED_MESSAGE } from "@/components/shop/DateCalendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { BROADCAST_CONSENT_TEXT } from "@/lib/customers/consent-text";
import { roomFor } from "@/lib/cart";
import { formatFulfilDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { waLink } from "@/lib/phone";
import { randomId } from "@/lib/uuid";
import { PICKUP_LOCATIONS, checkoutFieldError, type CheckoutField } from "@/lib/validation";
import { deliveryFeeSentence, ODELIVER_FEE_URL } from "@/lib/checkout-copy";

const feeSentence = deliveryFeeSentence(ODELIVER_FEE_URL);

const PICKUP_NOTE =
  "You will be contacted for more information about collection once your order is confirmed.";
const DELIVERY_NOTE =
  "Once your order is confirmed we will contact you with your total delivery amount. Delivery can be paid via cash or card upon delivery.";
const ALLERGY_DISCLAIMER =
  "Our kitchen is not allergen free. If you have severe allergies, please contact us before placing your order.";
const CONFIRMATION_LINE = "Your order will only be confirmed after proof of payment is received.";

export type CheckoutFormProps = {
  /** Menu items with an allergen note, named in the allergies help text. */
  allergenNotes: { name: string; note: string }[];
  leadDays: number;
  today: string;
  unavailable: string[];
  /** Last fulfilment date; the calendar offers no date after it. */
  lastFulfilmentDate: string;
  /** True once ordering has closed for Christmas. */
  orderingClosed: boolean;
  policyText: string;
  whatsappNumber: string;
};

type Fulfilment = "pickup" | "delivery";

/** One message per field, plus a form-level message for failures that belong to no field. */
type Errors = Partial<Record<CheckoutField, string>> & { form?: string };

const GENERIC_ERROR = "We couldn’t place your order. Please try again — your details are still here.";

/** Checkout amounts always carry the $ prefix (TTD). Only checkout uses it; other pages are unchanged. */
function checkoutMoney(cents: number): string {
  return `$${formatMoney(cents)}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** The checkout: cart, details, pickup or delivery, date, allergies, broadcast opt-in, policy and the place-order button. */
export function CheckoutForm({
  allergenNotes,
  leadDays,
  today,
  unavailable,
  lastFulfilmentDate,
  orderingClosed,
  policyText,
  whatsappNumber,
}: CheckoutFormProps) {
  const router = useRouter();
  const { lines, subtotalCents, setQuantity, remove, clear } = useCart();
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => randomId());
  const [placed, setPlaced] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [pickupLocation, setPickupLocation] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [allergies, setAllergies] = useState("");
  const [broadcastOptIn, setBroadcastOptIn] = useState(false);
  const [acceptPolicy, setAcceptPolicy] = useState(false);

  const whatsappHref = waLink(whatsappNumber);

  if (lines.length === 0 && !placed) {
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-12 text-center">
        <p className="font-display text-3xl text-crimson-deep">Your basket is empty.</p>
        <Link href="/#menu" className="mx-auto flex min-h-12 w-fit items-center rounded-2xl bg-crimson px-6 font-bold text-cream hover:bg-crimson-deep">
          Back to the menu
        </Link>
      </div>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    // The same rules the server applies (phone normalisation, lengths, date), so a problem is
    // shown beside its field before the order is sent.
    const input = {
      name,
      email,
      phone,
      fulfilment:
        fulfilment === "pickup"
          ? { type: "pickup" as const, location: pickupLocation }
          : { type: "delivery" as const, address },
      date: date ?? "",
      allergies,
      broadcastOptIn,
      acceptPolicy,
      idempotencyKey,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        flavour: line.flavour,
        quantity: line.quantity,
      })),
    };

    const clientError = checkoutFieldError(input);
    if (clientError) {
      setErrors({ [clientError.field]: clientError.error });
      return;
    }

    startTransition(async () => {
      try {
        const result = await placeOrderAction({ ...input, acceptPolicy: true });
        if ("token" in result) {
          setPlaced(true);
          clear();
          router.push(`/order/${result.token}`);
          return;
        }
        if ("reason" in result) {
          // Ordering has closed, or the date is past the last fulfilment date: the calendar shows why.
          setDate(null);
          setErrors({
            date:
              result.reason === "closed"
                ? ORDERS_CLOSED_MESSAGE
                : `Please choose a date on or before ${new Date(`${lastFulfilmentDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}.`,
          });
          router.refresh();
          return;
        }
        if (result.field) {
          if (result.field === "date") {
            // The date may have filled up: pick a fresh date list and clear the choice.
            setDate(null);
            router.refresh();
          }
          setErrors({ [result.field]: result.error });
        } else {
          setErrors({ form: result.error });
        }
      } catch {
        setErrors({ form: GENERIC_ERROR });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5 px-4 pb-6">
      <h1 className="pt-2 text-center font-display text-[clamp(2.2rem,8vw,3rem)] leading-tight text-oxblood">Checkout</h1>
      <section className="space-y-4 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
        <h2 className="font-display text-2xl leading-tight text-crimson-deep">Your basket</h2>
        <ul className="divide-y divide-olive-line">
          {lines.map((line) => {
            const room = roomFor(lines, line.itemId, line.maxQty);
            return (
              <li key={line.lineId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-display text-lg leading-tight text-crimson-deep">{line.name}</p>
                  {line.flavour && <p className="text-[0.9375rem] text-olive">{line.flavour}</p>}
                  <p className="font-extrabold text-olive-ink">{checkoutMoney(line.unitPriceCents * line.quantity)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Decrease ${line.name}`}
                    onClick={() => setQuantity(line.lineId, line.quantity - 1)}
                  >
                    −
                  </Button>
                  <span className="w-6 text-center" aria-live="polite">
                    {line.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Increase ${line.name}`}
                    disabled={room === 0}
                    onClick={() => setQuantity(line.lineId, line.quantity + 1)}
                  >
                    +
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(line.lineId)}>
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {errors.lines && (
          <p role="alert" className="text-sm text-destructive">
            {errors.lines}
          </p>
        )}
      </section>

      <section className="space-y-5 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
        <h2 className="font-display text-2xl leading-tight text-crimson-deep">Your details</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required aria-invalid={!!errors.name} value={name} onChange={(e) => setName(e.target.value)} />
          <FieldError message={errors.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldError message={errors.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">WhatsApp number</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" required aria-invalid={!!errors.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <FieldError message={errors.phone} />
        </div>
      </section>

      <section className="space-y-5 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
        <h2 className="font-display text-2xl leading-tight text-crimson-deep">Pickup or delivery</h2>
        <RadioGroup value={fulfilment} onValueChange={(value) => setFulfilment(value as Fulfilment)}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="pickup" id="fulfil-pickup" />
            <Label htmlFor="fulfil-pickup">Pickup</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="delivery" id="fulfil-delivery" />
            <Label htmlFor="fulfil-delivery">Delivery</Label>
          </div>
        </RadioGroup>

        {fulfilment === "pickup" && (
          <div className="space-y-2">
            <Label htmlFor="pickup-location">Pickup location</Label>
            <select
              id="pickup-location"
              name="pickupLocation"
              aria-invalid={!!errors.pickupLocation}
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-base"
            >
              <option value="">Choose a location</option>
              {PICKUP_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
            <FieldError message={errors.pickupLocation} />
            <p className="text-sm italic text-muted-foreground">{PICKUP_NOTE}</p>
          </div>
        )}

        {fulfilment === "delivery" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Delivery address</Label>
              <Textarea id="address" name="address" required aria-invalid={!!errors.address} value={address} onChange={(e) => setAddress(e.target.value)} />
              <FieldError message={errors.address} />
            </div>
            <p className="text-sm italic text-muted-foreground">
              {feeSentence.lead}
              {feeSentence.link ? (
                <a href={feeSentence.link.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  {feeSentence.link.text}
                </a>
              ) : (
                "here"
              )}
              {feeSentence.trail}
            </p>
            <p className="text-sm italic text-muted-foreground">{DELIVERY_NOTE}</p>
          </div>
        )}
        {errors.fulfilment && (
          <p role="alert" className="text-sm text-destructive">
            {errors.fulfilment}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
        <h2 className="font-display text-2xl leading-tight text-crimson-deep">Date</h2>
        <DateCalendar
          today={today}
          leadDays={leadDays}
          unavailable={unavailable}
          lastFulfilmentDate={lastFulfilmentDate}
          orderingClosed={orderingClosed}
          value={date}
          onChange={(picked) => {
            setDate(picked);
            setErrors((current) => ({ ...current, date: undefined }));
          }}
          whatsappHref={whatsappHref}
        />
        {date && <p className="text-sm">Your date: {formatFulfilDate(date)}</p>}
        {errors.date && (
          <p role="alert" className="text-sm text-destructive">
            {errors.date}
          </p>
        )}
      </section>

      <section className="space-y-5 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
        <h2 className="font-display text-2xl leading-tight text-crimson-deep">Allergies</h2>
        <div className="space-y-2">
          <Label htmlFor="allergies">Allergies or dietary needs</Label>
          <div className="text-sm text-muted-foreground">
            {ALLERGY_DISCLAIMER}
            {allergenNotes.length > 0 && (
              <>
                {" "}Items with allergen notes:
                <ul className="mt-1 list-disc pl-5">
                  {allergenNotes.map((item) => (
                    <li key={item.name}>
                      {item.name}: {item.note}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <Textarea id="allergies" name="allergies" required aria-invalid={!!errors.allergies} value={allergies} onChange={(e) => setAllergies(e.target.value)} />
          <FieldError message={errors.allergies} />
        </div>
      </section>

      <section className="space-y-4 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
        <h2 className="font-display text-2xl leading-tight text-crimson-deep">Anything else</h2>
        <div className="flex items-start gap-2">
          <Checkbox id="broadcast" checked={broadcastOptIn} onCheckedChange={(checked) => setBroadcastOptIn(checked === true)} />
          <Label htmlFor="broadcast">{BROADCAST_CONSENT_TEXT}</Label>
        </div>
      </section>

      <section className="space-y-4 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
        <h2 className="font-display text-2xl leading-tight text-crimson-deep">Order policy</h2>
        <div className="max-h-40 overflow-y-auto whitespace-pre-line rounded-[10px] border border-olive-line bg-cream p-3 text-[0.9375rem] text-olive-ink">
          {policyText}
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="policy"
            checked={acceptPolicy}
            onCheckedChange={(checked) => setAcceptPolicy(checked === true)}
          />
          <Label htmlFor="policy">I have read and accept the order policy</Label>
        </div>
        {errors.policy && (
          <p role="alert" className="text-sm text-destructive">
            {errors.policy}
          </p>
        )}
      </section>

      <section className="space-y-2 rounded-[22px] bg-cream-warm p-4 text-base text-olive-ink sm:p-6">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{checkoutMoney(subtotalCents)}</span>
        </div>
        <div className="flex justify-between border-t border-olive-line pt-2 text-xl font-extrabold">
          <span>Total</span>
          <span>{checkoutMoney(subtotalCents)}</span>
        </div>
      </section>

      {errors.form && (
        <Alert variant="destructive">
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-14 w-full rounded-2xl text-lg font-bold" disabled={pending || lines.length === 0}>
        Place Order
      </Button>
      <p className="text-center text-sm text-olive-ink">{CONFIRMATION_LINE}</p>
    </form>
  );
}
