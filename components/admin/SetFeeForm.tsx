"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { setDeliveryFeeAction } from "@/app/admin/(protected)/orders/[id]/actions";
import { toastActionResult } from "@/components/admin/action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FEE_ERROR = "Enter a fee between TT$0 and TT$1,000";
const FEE_MAX_CENTS = 100_000;

/** Turns "12.5" or "12" into cents, or null when the text is not a fee in range. */
export function parseFeeCents(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  return cents >= 0 && cents <= FEE_MAX_CENTS ? cents : null;
}

/** Sets the delivery fee on an order waiting for a quote. The customer is emailed the total. */
export function SetFeeForm({ orderId }: { orderId: string }) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const feeCents = parseFeeCents(value);
    if (feeCents === null) {
      setError(FEE_ERROR);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setDeliveryFeeAction({ orderId, feeCents });
      toastActionResult(result);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <section aria-labelledby={`${inputId}-heading`} className="space-y-4 rounded-xl border bg-card p-4">
      <h2 id={`${inputId}-heading`} className="text-base font-semibold">
        Set delivery fee
      </h2>
      <p className="text-sm text-muted-foreground">
        Enter the delivery fee for this area. The customer is emailed the new total and bank details.
      </p>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={inputId}>Delivery fee (TT$)</Label>
          <Input
            id={inputId}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            placeholder="0.00"
            className="min-h-11 max-w-xs"
          />
          {error ? (
            <p id={errorId} className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="min-h-11 gap-2" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save fee and email total
        </Button>
      </form>
    </section>
  );
}
