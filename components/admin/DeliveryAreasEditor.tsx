"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { saveAreaAction } from "@/app/admin/(protected)/settings/actions";
import { FieldError, SectionHeader, useSettingsSave } from "@/components/admin/SettingsFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseFeeCents } from "@/lib/admin/fee";
import { formatMoney } from "@/lib/money";
import type { DeliveryArea } from "@/lib/types";

const FEE_ERROR = "Enter a fee between 0 and 1,000";

/** Add or edit one area. The form is rebuilt each time the dialog opens, so it never shows stale values. */
function AreaDialog({
  area,
  sort,
  open,
  onOpenChange,
}: {
  area: DeliveryArea | null;
  sort: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const [name, setName] = useState(area?.name ?? "");
  const [fee, setFee] = useState(area?.fee_cents == null ? "" : String(area.fee_cents / 100));
  const [active, setActive] = useState(area?.active ?? true);
  const [feeError, setFeeError] = useState<string | undefined>();
  const { run, isPending, errors } = useSettingsSave();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = fee.trim();
    let feeCents: number | null = null;
    if (trimmed !== "") {
      feeCents = parseFeeCents(trimmed);
      if (feeCents === null) {
        setFeeError(FEE_ERROR);
        return;
      }
    }
    setFeeError(undefined);
    run(
      () => saveAreaAction({ id: area?.id, name, feeCents, active, sort: area?.sort ?? sort }),
      () => onOpenChange(false),
    );
  }

  const nameId = `${id}-name`;
  const feeId = `${id}-fee`;
  const activeId = `${id}-active`;
  const feeMessage = feeError ?? errors.feeCents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>{area ? "Edit delivery area" : "Add delivery area"}</DialogTitle>
            <DialogDescription>Leave the fee empty to quote it per order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={nameId}>Area name</Label>
            <Input
              id={nameId}
              className="h-11"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
            />
            <FieldError id={`${nameId}-error`} message={errors.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={feeId}>Delivery fee</Label>
            <Input
              id={feeId}
              inputMode="decimal"
              autoComplete="off"
              placeholder="We'll quote"
              className="h-11"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              aria-invalid={feeMessage ? true : undefined}
              aria-describedby={feeMessage ? `${feeId}-error` : undefined}
            />
            <FieldError id={`${feeId}-error`} message={feeMessage} />
          </div>
          {/* The whole row is the tap target: tapping the label text toggles the switch. */}
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border px-3">
            <span className="text-sm font-medium">Available at checkout</span>
            <Switch
              id={activeId}
              checked={active}
              onCheckedChange={setActive}
              aria-describedby={errors.active ? `${activeId}-error` : undefined}
            />
          </label>
          <FieldError id={`${activeId}-error`} message={errors.active} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 gap-2" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {area ? "Save area" : "Add area"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Delivery areas as a table. Add and Edit open the same dialog; each save stands on its own. */
export function DeliveryAreasEditor({ areas }: { areas: DeliveryArea[] }) {
  const headingId = useId();
  const [editing, setEditing] = useState<DeliveryArea | null>(null);
  const [open, setOpen] = useState(false);
  // Bumped on every open so the dialog's form state starts fresh from the row being edited.
  const [dialogKey, setDialogKey] = useState(0);
  const nextSort = Math.max(0, ...areas.map((area) => area.sort)) + 1;
  const activeCount = areas.filter((area) => area.active).length;

  function openFor(area: DeliveryArea | null) {
    setEditing(area);
    setDialogKey((key) => key + 1);
    setOpen(true);
  }

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card">
      <SectionHeader
        id={headingId}
        title="Delivery areas"
        description={`${activeCount} of ${areas.length} available at checkout. At least one must stay on.`}
        action={
          <Button type="button" variant="outline" className="min-h-11 w-full gap-2 sm:w-auto" onClick={() => openFor(null)}>
            <Plus className="size-4" aria-hidden="true" />
            Add area
          </Button>
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 md:pl-6">Area</TableHead>
            <TableHead className="text-right">Fee</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="w-12 pr-4 md:pr-6">
              <span className="sr-only">Edit</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {areas.map((area) => (
            <TableRow key={area.id} className={area.active ? undefined : "text-muted-foreground"}>
              <TableCell className="whitespace-normal pl-4 font-medium md:pl-6">
                {area.name}
                {area.active ? null : <span className="block text-xs font-normal sm:hidden">Off</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {area.fee_cents == null ? "Quote" : formatMoney(area.fee_cents)}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant={area.active ? "secondary" : "outline"}>{area.active ? "On" : "Off"}</Badge>
              </TableCell>
              <TableCell className="pr-2 md:pr-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Edit ${area.name}`}
                  onClick={() => openFor(area)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <AreaDialog key={dialogKey} area={editing} sort={nextSort} open={open} onOpenChange={setOpen} />
    </section>
  );
}
