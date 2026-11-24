"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Loader2, Ban } from "lucide-react";
import { cancelOrderAction } from "@/app/admin/(protected)/orders/[id]/actions";
import { toastActionResult } from "@/components/admin/action-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REASON_MIN = 3;
const REASON_MAX = 300;
const REASON_ERROR = "Please give a reason (3–300 characters)";

/** Cancels an order. Destructive, so it asks for a reason and a confirmation. The customer is emailed. */
export function CancelOrderDialog({ orderId, disabled }: { orderId: string; disabled?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      setError(REASON_ERROR);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelOrderAction({ orderId, reason: trimmed });
      toastActionResult(result);
      if ("ok" in result) {
        setOpen(false);
        setReason("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" className="min-h-11 gap-2" disabled={disabled}>
          <Ban className="size-4" aria-hidden="true" />
          Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              The customer is emailed that the order is cancelled. This cannot be undone from here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`${id}-reason`}>Reason</Label>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              placeholder="For example: we cannot make this date"
            />
            {error ? (
              <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)} disabled={isPending}>
              Keep order
            </Button>
            <Button type="submit" variant="destructive" className="min-h-11 gap-2" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Cancel order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
