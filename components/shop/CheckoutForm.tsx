"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { placeOrderAction } from "@/app/(shop)/checkout/actions";
import { useCart } from "@/components/shop/CartProvider";
import { DateCalendar } from "@/components/shop/DateCalendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { roomFor } from "@/lib/cart";
import { formatFulfilDate } from "@/lib/format-date";
import { formatMoney, formatPrice } from "@/lib/money";
import { waLink } from "@/lib/phone";
import type { DeliveryArea } from "@/lib/types";
import { randomId } from "@/lib/uuid";
import { checkoutFieldError, type CheckoutField } from "@/lib/validation";

export type CheckoutFormProps = {
  areas: DeliveryArea[];
  /** Menu items with an allergen note, named in the allergies help text. */
  allergenNotes: { name: string; note: string }[];
  leadDays: number;
  today: string;
  unavailable: string[];
  policyText: string;
  whatsappNumber: string;
};

type Fulfilment = "pickup" | "delivery";

/** One message per field, plus a form-level message for failures that belong to no field. */
type Errors = Partial<Record<CheckoutField, string>> & { form?: string };

const GENERIC_ERROR = "We couldn’t place your order. Please try again — your details are still here.";
const QUOTE_FEE_TEXT = "Delivery fee: we'll email your total";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** The checkout: cart, details, pickup or delivery, date, allergies, policy and the place-order button. */
export function CheckoutForm({
  areas,
  allergenNotes,
  leadDays,
  today,
  unavailable,
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
  const [areaId, setAreaId] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [acceptPolicy, setAcceptPolicy] = useState(false);

  const whatsappHref = waLink(whatsappNumber);
  const area = fulfilment === "delivery" ? areas.find((a) => a.id === areaId) : undefined;
  const quoteOnly = area !== undefined && area.fee_cents === null;
  const feeCents = area?.fee_cents ?? 0;

  if (lines.length === 0 && !placed) {
    return (
      <div className="space-y-3">
        <p>Your cart is empty.</p>
        <Link href="/" className="underline underline-offset-4">
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
          ? { type: "pickup" as const }
          : { type: "delivery" as const, areaId, address },
      date: date ?? "",
      allergies,
      notes: notes.trim() || undefined,
      marketingOptIn,
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
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-8 p-4">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your cart</h2>
        <ul className="divide-y rounded-lg border">
          {lines.map((line) => {
            const room = roomFor(lines, line.itemId, line.maxQty);
            return (
              <li key={line.lineId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{line.name}</p>
                  {line.flavour && <p className="text-sm text-muted-foreground">{line.flavour}</p>}
                  <p className="text-sm">{formatMoney(line.unitPriceCents * line.quantity)}</p>
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your details</h2>
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Pickup or delivery</h2>
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

        {fulfilment === "delivery" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="area">Delivery area</Label>
              <select
                id="area"
                name="area"
                required
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Choose an area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fee_cents === null ? a.name : `${a.name} — ${formatPrice(a.fee_cents)}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Delivery address</Label>
              <Textarea id="address" name="address" required aria-invalid={!!errors.address} value={address} onChange={(e) => setAddress(e.target.value)} />
              <FieldError message={errors.address} />
            </div>
          </div>
        )}
        {errors.fulfilment && (
          <p role="alert" className="text-sm text-destructive">
            {errors.fulfilment}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Date</h2>
        <DateCalendar
          today={today}
          leadDays={leadDays}
          unavailable={unavailable}
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Allergies and notes</h2>
        <div className="space-y-2">
          <Label htmlFor="allergies">Allergies or dietary needs</Label>
          <div className="text-sm text-muted-foreground">
            Our kitchen is not allergen-free. Tell us about any allergies.
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
        <div className="space-y-2">
          <Label htmlFor="notes">Anything else?</Label>
          <Textarea id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="marketing"
            checked={marketingOptIn}
            onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
          />
          <Label htmlFor="marketing">Can we contact you with offers and specials?</Label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Order policy</h2>
        <div className="max-h-40 overflow-y-auto whitespace-pre-line rounded-md border p-3 text-sm">
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

      <section className="space-y-2 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMoney(subtotalCents)}</span>
        </div>
        {quoteOnly && (
          <p className="text-muted-foreground">{QUOTE_FEE_TEXT}</p>
        )}
        {area && !quoteOnly && (
          <div className="flex justify-between">
            <span>Delivery fee</span>
            <span>{formatMoney(feeCents)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{quoteOnly ? `${formatMoney(subtotalCents)} + delivery` : formatMoney(subtotalCents + feeCents)}</span>
        </div>
      </section>

      {errors.form && (
        <Alert variant="destructive">
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={pending || lines.length === 0}>
        Place order — pay to confirm
      </Button>
    </form>
  );
}
