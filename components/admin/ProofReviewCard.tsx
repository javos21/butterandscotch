"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";
import { verifyPaymentAction } from "@/app/admin/(protected)/payments/actions";
import { runStaffAction } from "@/components/admin/action-toast";
import { Button } from "@/components/ui/button";
import { isPdfPath } from "@/lib/admin/proof-file";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";

const REASON_MIN = 3;
const REASON_MAX = 300;
const REASON_ERROR = "Please give a reason (3–300 characters)";

export type ProofReviewCardProps = {
  paymentId: string;
  receiptPath: string | null;
  receiptUrl: string | null;
  reference: string | null;
  totalCents: number;
};

/** Shows the customer's payment proof with Reject (asks for a reason) and Confirm. */
export function ProofReviewCard({ paymentId, receiptPath, receiptUrl, reference, totalCents }: ProofReviewCardProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingDecision, setPendingDecision] = useState<"confirm" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const shown = { receiptPath, reference };

  function confirm() {
    setPendingDecision("confirm");
    startTransition(async () => {
      await runStaffAction(() => verifyPaymentAction({ paymentId, decision: "confirm", shown }));
      setPendingDecision(null);
      setConfirmOpen(false);
    });
  }

  return (
    <section id="proof" aria-labelledby="proof-heading" className="scroll-mt-20 space-y-4 rounded-xl border bg-card p-4">
      <h2 id="proof-heading" className="text-base font-semibold">
        Payment proof
      </h2>

      {receiptUrl ? (
        isPdfPath(receiptPath) ? (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-muted"
          >
            <FileText className="size-4" aria-hidden="true" />
            Open PDF
          </a>
        ) : (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="block">
            {/* Signed storage URL, so next/image is not used. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl}
              alt="Customer's payment receipt"
              className="max-h-96 w-full rounded-lg border object-contain bg-muted"
            />
          </a>
        )
      ) : (
        <p className="text-sm text-muted-foreground">No proof file — ask the customer to re-upload</p>
      )}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Expected total</dt>
          <dd className="font-medium tabular-nums">{formatMoney(totalCents)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="font-medium break-words">{reference ?? "No reference given"}</dd>
        </div>
      </dl>

      <p className="text-sm">Find the money in your bank account before confirming.</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <RejectProofDialog paymentId={paymentId} shown={shown} disabled={isPending} />
        <Button type="button" className="min-h-11 gap-2" onClick={() => setConfirmOpen(true)} disabled={isPending}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Confirm payment
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(next) => !isPending && setConfirmOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {formatMoney(totalCents)} received?</DialogTitle>
            <DialogDescription>
              The order is confirmed and the customer is emailed their receipt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              Back
            </Button>
            <Button type="button" className="min-h-11 gap-2" onClick={confirm} disabled={isPending}>
              {pendingDecision === "confirm" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Yes, confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RejectProofDialog({
  paymentId,
  shown,
  disabled,
}: {
  paymentId: string;
  shown: { receiptPath: string | null; reference: string | null };
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      setError(REASON_ERROR);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await runStaffAction(() =>
        verifyPaymentAction({ paymentId, decision: "reject", reason: trimmed, shown }),
      );
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
        <Button type="button" variant="destructive" className="min-h-11" disabled={disabled}>
          <XCircle className="size-4" aria-hidden="true" />
          Reject proof
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this payment proof?</DialogTitle>
          <DialogDescription>
            The customer is emailed the reason and asked to upload a new proof.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">Reason for the customer</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REASON_MAX + 50}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "reject-reason-error" : undefined}
            placeholder="For example: the amount does not match the order total"
          />
          {error ? (
            <p id="reject-reason-error" className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="min-h-11" disabled={isPending}>
              Keep proof
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" className="min-h-11 gap-2" onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Reject proof
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
