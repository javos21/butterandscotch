"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { blockDatesAction, unblockDateAction } from "@/app/admin/(protected)/settings/actions";
import { toastActionResult } from "@/components/admin/action-toast";
import { FieldError, useSettingsSave } from "@/components/admin/SettingsFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFulfilDate } from "@/lib/format-date";

type BlockedDate = { date: string; note: string | null };

/** Dates the shop cannot take orders for, with an add form (one day or a range) and Remove per row. */
export function BlockedDatesEditor({ blocked }: { blocked: BlockedDate[] }) {
  const id = useId();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const { run, isPending, errors } = useSettingsSave();
  const [removingDate, setRemovingDate] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | undefined>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () =>
        blockDatesAction({
          from,
          ...(to ? { to } : {}),
          ...(note.trim() ? { note } : {}),
        }),
      () => {
        setFrom("");
        setTo("");
        setNote("");
      },
    );
  }

  async function remove(date: string) {
    setRemovingDate(date);
    setRemoveError(undefined);
    const result = await unblockDateAction(date);
    setRemovingDate(null);
    toastActionResult(result);
    if ("error" in result) setRemoveError(result.error);
  }

  const fromId = `${id}-from`;
  const toId = `${id}-to`;
  const noteId = `${id}-note`;

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-4">
      <div className="space-y-1">
        <h2 id={`${id}-heading`} className="text-base font-semibold">
          Blocked dates
        </h2>
        <p className="text-sm text-muted-foreground">
          Customers can&rsquo;t pick these days. Leave the end date empty to block one day.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4">
        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dates are blocked.</p>
        ) : (
          <ul className="divide-y">
            {blocked.map((row) => (
              <li key={row.date} className="flex min-h-11 flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatFulfilDate(row.date)}</p>
                  {row.note ? <p className="text-sm text-muted-foreground">{row.note}</p> : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  disabled={removingDate !== null}
                  aria-label={`Remove blocked date ${formatFulfilDate(row.date)}`}
                  onClick={() => remove(row.date)}
                >
                  {removingDate === row.date ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <FieldError id={`${id}-remove-error`} message={removeError} />
      </div>

      <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Block a day or a range</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={fromId}>From</Label>
            <Input
              id={fromId}
              type="date"
              className="h-11"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-invalid={errors.from ? true : undefined}
              aria-describedby={errors.from ? `${fromId}-error` : undefined}
            />
            <FieldError id={`${fromId}-error`} message={errors.from} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={toId}>To (optional)</Label>
            <Input
              id={toId}
              type="date"
              className="h-11"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-invalid={errors.to ? true : undefined}
              aria-describedby={errors.to ? `${toId}-error` : undefined}
            />
            <FieldError id={`${toId}-error`} message={errors.to} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={noteId}>Note (optional)</Label>
          <Input
            id={noteId}
            className="h-11"
            value={note}
            placeholder="Public holiday"
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={errors.note ? `${noteId}-error` : undefined}
          />
          <FieldError id={`${noteId}-error`} message={errors.note} />
        </div>
        <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Block dates
        </Button>
      </form>
    </section>
  );
}
