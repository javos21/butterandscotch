"use client";

import { useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { requestProofAgainAction } from "@/app/admin/(protected)/orders/[id]/actions";
import { toastActionResult } from "@/components/admin/action-toast";
import { Button } from "@/components/ui/button";

/** For a stuck order: asks the customer to upload their payment proof again. */
export function RequestProofAgainButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();

  function request() {
    startTransition(async () => {
      const result = await requestProofAgainAction({ orderId });
      toastActionResult(result);
    });
  }

  return (
    <Button type="button" className="min-h-11 gap-2" onClick={request} disabled={isPending}>
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <RotateCcw className="size-4" aria-hidden="true" />
      )}
      Ask for proof again
    </Button>
  );
}
