"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { changeDateAction } from "@/app/admin/(protected)/orders/[id]/actions";
import { runStaffAction } from "@/components/admin/action-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFulfilDate } from "@/lib/format-date";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Moves an order to another fulfil date. Blocked dates are always refused; full days need the override. */
export function ChangeDateDialog({
  orderId,
  currentDate,
  today,
  disabled,
}: {
  orderId: string;
  currentDate: string;
  today: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState(currentDate);
  const [overrideCap, setOverrideCap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!DATE_PATTERN.test(newDate)) {
      setError("Pick a valid date");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await runStaffAction(() => changeDateAction({ orderId, newDate, overrideCap }));
      if ("ok" in result) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={disabled}>
          <CalendarDays className="size-4" aria-hidden="true" />
          Change date
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Change the fulfil date</DialogTitle>
            <DialogDescription>
              Currently {formatFulfilDate(currentDate)}. The customer is emailed the new date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`${id}-date`}>New date</Label>
            <Input
              id={`${id}-date`}
              type="date"
              min={today}
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="min-h-11"
            />
            {error ? (
              <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id={`${id}-override`}
              checked={overrideCap}
              onCheckedChange={(checked) => setOverrideCap(checked === true)}
              className="size-5"
            />
            <Label htmlFor={`${id}-override`} className="min-h-11 items-center font-normal">
              Override daily limit
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)} disabled={isPending}>
              Keep current date
            </Button>
            <Button type="submit" className="min-h-11 gap-2" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Change date
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
