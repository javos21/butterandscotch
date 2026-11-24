"use client";

import { useId, useState, useTransition } from "react";
import { CheckCheck, Loader2, PackageCheck } from "lucide-react";
import { markCompletedAction, markReadyAction } from "@/app/admin/(protected)/orders/[id]/actions";
import { CancelOrderDialog } from "@/components/admin/CancelOrderDialog";
import { ChangeDateDialog } from "@/components/admin/ChangeDateDialog";
import { runStaffAction } from "@/components/admin/action-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { OrderStatus } from "@/lib/order-status";

type PendingAction = "ready" | "completed" | null;

/**
 * The staff actions that apply to an order's current status. Date change and cancel are offered
 * on every open order; mark ready and mark completed follow the status flow.
 */
export function OrderActionsBar({
  orderId,
  status,
  fulfilDate,
  today,
}: {
  orderId: string;
  status: OrderStatus;
  fulfilDate: string;
  today: string;
}) {
  const notifyId = useId();
  const [notify, setNotify] = useState(true);
  const [pending, setPending] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();

  const canMarkReady = status === "confirmed";
  const canMarkCompleted = status === "confirmed" || status === "ready";
  const canChangeDateOrCancel = status !== "completed" && status !== "cancelled";

  if (!canMarkReady && !canMarkCompleted && !canChangeDateOrCancel) return null;

  function markReady() {
    setPending("ready");
    startTransition(async () => {
      await runStaffAction(() => markReadyAction({ orderId, notify }));
      setPending(null);
    });
  }

  function markCompleted() {
    setPending("completed");
    startTransition(async () => {
      await runStaffAction(() => markCompletedAction({ orderId }));
      setPending(null);
    });
  }

  // Mark completed is the primary action once an order is ready; before that, mark ready is.
  const completedIsPrimary = status === "ready";

  return (
    <section aria-labelledby={`${notifyId}-heading`} className="space-y-4 rounded-xl border bg-card p-4">
      <h2 id={`${notifyId}-heading`} className="text-base font-semibold">
        Order actions
      </h2>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {canMarkReady ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Checkbox
                id={notifyId}
                checked={notify}
                onCheckedChange={(checked) => setNotify(checked === true)}
                className="size-5"
              />
              <Label htmlFor={notifyId} className="min-h-11 items-center font-normal">
                Email the customer
              </Label>
            </div>
            <Button type="button" className="min-h-11 gap-2" onClick={markReady} disabled={isPending}>
              {pending === "ready" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <PackageCheck className="size-4" aria-hidden="true" />
              )}
              Mark ready
            </Button>
          </div>
        ) : null}

        {canMarkCompleted ? (
          <Button
            type="button"
            variant={completedIsPrimary ? "default" : "outline"}
            className="min-h-11 gap-2"
            onClick={markCompleted}
            disabled={isPending}
          >
            {pending === "completed" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheck className="size-4" aria-hidden="true" />
            )}
            Mark completed
          </Button>
        ) : null}

        {canChangeDateOrCancel ? (
          <>
            <ChangeDateDialog orderId={orderId} currentDate={fulfilDate} today={today} disabled={isPending} />
            <CancelOrderDialog orderId={orderId} disabled={isPending} />
          </>
        ) : null}
      </div>
    </section>
  );
}
