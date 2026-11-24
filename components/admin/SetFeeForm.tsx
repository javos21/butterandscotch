"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { setDeliveryFeeAction } from "@/app/admin/(protected)/orders/[id]/actions";
import { runStaffAction } from "@/components/admin/action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseFeeCents } from "@/lib/admin/fee";

const FEE_ERROR = "Enter a fee between 0 and 1,000";

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
      const result = await runStaffAction(() => setDeliveryFeeAction({ orderId, feeCents }));
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
          <Label htmlFor={inputId}>Delivery fee</Label>
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
