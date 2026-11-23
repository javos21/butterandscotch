"use client";

import { useState, useTransition, type FormEvent } from "react";
import { findOrderAction } from "@/app/(shop)/find-order/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NEUTRAL_MESSAGE =
  "If we have orders for that email, we've sent the links. Check your inbox (and spam).";

/** Asks for an email and emails the order links. Shows the same neutral message whatever the outcome. */
export function FindOrderForm() {
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await findOrderAction(data);
      } catch {
        // Transport errors still show the neutral message instead of reaching the error boundary.
      } finally {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <p role="status" className="text-sm">
        {NEUTRAL_MESSAGE}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Email my order links"}
      </Button>
    </form>
  );
}
