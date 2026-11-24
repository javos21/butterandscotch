"use client";

import { useId, useState, type FormEvent } from "react";
import { CalendarX, Loader2, Trash2 } from "lucide-react";
import { blockDatesAction, unblockDateAction } from "@/app/admin/(protected)/settings/actions";
import { toastActionResult } from "@/components/admin/action-toast";
import { FieldError, SAVE_FAILED, SectionHeader, useSettingsSave } from "@/components/admin/SettingsFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SettingsResult } from "@/lib/admin/settings";
import { formatFulfilDate } from "@/lib/format-date";

type BlockedDate = { date: string; note: string | null };

/** Blocked days: an add form (one day or a range) above a table with Remove per row. */
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
    let result: SettingsResult;
    try {
      result = await unblockDateAction(date);
    } catch (error) {
      console.error(error);
      result = { error: SAVE_FAILED };
    }
    setRemovingDate(null);
    toastActionResult(result);
    if ("error" in result) setRemoveError(result.error);
  }

  const headingId = `${id}-heading`;
  const fromId = `${id}-from`;
  const toId = `${id}-to`;
  const noteId = `${id}-note`;

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card">
      <SectionHeader
        id={headingId}
        title="Blocked dates"
        description="Customers can't pick these days. Leave the end date empty to block one day."
      />

      <form onSubmit={submit} noValidate className="grid gap-4 border-b p-4 sm:grid-cols-2 md:px-6 lg:grid-cols-[1fr_1fr_1.5fr_auto] lg:items-start">
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
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
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
        <Button type="submit" className="min-h-11 w-full gap-2 sm:col-span-2 lg:col-span-1 lg:mt-[1.375rem] lg:w-auto" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Block dates
        </Button>
      </form>

      {blocked.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <CalendarX className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No dates are blocked. Every day after the lead time is open.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4 md:pl-6">Date</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-12 pr-4 md:pr-6">
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blocked.map((row) => (
              <TableRow key={row.date}>
                <TableCell className="whitespace-normal pl-4 font-medium md:pl-6">{formatFulfilDate(row.date)}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{row.note ?? "—"}</TableCell>
                <TableCell className="pr-2 md:pr-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    disabled={removingDate !== null}
                    aria-label={`Remove blocked date ${formatFulfilDate(row.date)}`}
                    onClick={() => remove(row.date)}
                  >
                    {removingDate === row.date ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="px-4 pb-2 md:px-6">
        <FieldError id={`${id}-remove-error`} message={removeError} />
      </div>
    </section>
  );
}
