"use client";

import { useState, useTransition, type FormEvent } from "react";
import { joinCommunityAction } from "@/app/(shop)/community/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMMUNITY_CONSENT_TEXT } from "@/lib/customers/consent-text";

/** Footer "Join the community" box. Saves the email with its own opt-in, separate from broadcast. */
export function CommunitySignup() {
  const [status, setStatus] = useState<{ kind: "idle" } | { kind: "ok" } | { kind: "error"; message: string }>({
    kind: "idle",
  });
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await joinCommunityAction(data);
        setStatus(result.ok ? { kind: "ok" } : { kind: "error", message: result.error });
      } catch {
        setStatus({ kind: "error", message: "Something went wrong. Please try again." });
      }
    });
  }

  if (status.kind === "ok") {
    return (
      <p role="status" className="text-center text-base font-bold text-olive-ink">
        Thanks for joining the community.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-2 text-center">
      <h2 className="font-display text-[1.75rem] leading-tight text-crimson-deep">Join the community</h2>
      <p className="text-[0.9375rem] text-olive-ink">{COMMUNITY_CONSENT_TEXT}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Label htmlFor="community-email" className="sr-only">
          Community email
        </Label>
        <Input
          id="community-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-invalid={status.kind === "error" ? true : undefined}
          aria-describedby={status.kind === "error" ? "community-error" : undefined}
          className="bg-card-cream"
        />
        <Button type="submit" disabled={pending} className="bg-crimson text-cream hover:bg-crimson-deep">
          {pending ? "Joining..." : "Join"}
        </Button>
      </form>
      {status.kind === "error" ? (
        <p id="community-error" role="alert" className="text-sm font-bold text-crimson">
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
