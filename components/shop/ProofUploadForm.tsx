"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitProofAction } from "@/app/(shop)/order/[token]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  compressReceipt,
  planReceipt,
  RECEIPT_MAX_BYTES,
  TOO_LARGE_ERROR,
} from "@/lib/receipt-file";

const FILE_ERROR = "Please upload a JPG, PNG, WEBP, HEIC or PDF up to 4 MB";
const REFERENCE_ERROR = "Please enter the payment reference (3–64 characters)";
const FAILED_ERROR = "Upload failed — please try again";

/** Upload a screenshot or PDF of the bank transfer, with an optional reference. */
export function ProofUploadForm({ token }: { token: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const data = new FormData(event.currentTarget);
    const receipt = data.get("receipt");
    const reference = String(data.get("reference") ?? "").trim();

    if (!(receipt instanceof File)) {
      setError(FILE_ERROR);
      return;
    }
    const plan = planReceipt(receipt);
    if (plan.action === "empty") {
      setError(FILE_ERROR);
      return;
    }
    if (plan.action === "too_large") {
      setError(TOO_LARGE_ERROR);
      return;
    }
    if (reference.length > 0 && (reference.length < 3 || reference.length > 64)) {
      setError(REFERENCE_ERROR);
      return;
    }

    startTransition(async () => {
      try {
        let file = receipt;
        if (plan.action === "compress") {
          file = await compressReceipt(receipt);
          if (file.size > RECEIPT_MAX_BYTES) {
            setError(TOO_LARGE_ERROR);
            return;
          }
        }

        const payload = new FormData();
        payload.set("token", token);
        payload.set("reference", reference);
        payload.set("receipt", file);

        const result = await submitProofAction(payload);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        toast("Proof received — we're checking your payment");
        formRef.current?.reset();
        router.refresh();
      } catch {
        toast.error(FAILED_ERROR);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-base text-olive-ink">
        Attach a screenshot or PDF of your transfer, and the reference from your bank or app if you have it.
      </p>

      <div className="space-y-2">
        <Label htmlFor="receipt">Payment receipt</Label>
        <Input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/*,application/pdf"
          required
          className="h-auto py-2"
        />
        <p className="text-sm text-olive">JPG, PNG, WEBP, HEIC or PDF, max 4 MB.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reference">Payment reference (optional)</Label>
        <Input
          id="reference"
          name="reference"
          type="text"
          autoComplete="off"
          maxLength={64}
          placeholder="e.g. transaction ID"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-13 w-full rounded-2xl text-base font-bold">
        {pending ? "Uploading…" : "Upload proof"}
      </Button>
    </form>
  );
}
