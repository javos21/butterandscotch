"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toastActionResult } from "@/components/admin/action-toast";
import { Button } from "@/components/ui/button";
import type { SettingsResult } from "@/lib/admin/settings";

export const SAVE_FAILED = "Couldn't save — try again";

/**
 * Runs a settings action, shows its toast, and keeps any field error keyed by the field name.
 * A thrown error is logged and shown as a toast, so the staff member is never left without feedback.
 */
export function useSettingsSave() {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function run(action: () => Promise<SettingsResult>, onSaved?: () => void) {
    setErrors({});
    startTransition(async () => {
      let result: SettingsResult;
      try {
        result = await action();
      } catch (error) {
        console.error(error);
        toastActionResult({ error: SAVE_FAILED });
        return;
      }
      toastActionResult(result);
      if ("error" in result) {
        if (result.field) setErrors({ [result.field]: result.error });
        return;
      }
      onSaved?.();
    });
  }

  return { run, isPending, errors };
}

/** Error text that sits under its field. Empty when there is no error. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** Card title row: heading, optional helper text, and an optional action (e.g. "Add area") on the right. */
export function SectionHeader({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
      <div className="space-y-1">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A settings card with its own form and Save button. Stacks on phones, inputs are full width. */
export function SectionCard({
  id,
  title,
  description,
  isPending,
  onSubmit,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card">
      <form onSubmit={onSubmit} noValidate>
        <SectionHeader id={id} title={title} description={description} />
        <div className="space-y-5 p-4 md:p-6">{children}</div>
        <div className="flex justify-end border-t px-4 py-3 md:px-6">
          <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Save changes
          </Button>
        </div>
      </form>
    </section>
  );
}
