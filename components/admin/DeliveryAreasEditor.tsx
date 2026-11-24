"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { saveAreaAction } from "@/app/admin/(protected)/settings/actions";
import { parseFeeCents } from "@/components/admin/SetFeeForm";
import { FieldError, useSettingsSave } from "@/components/admin/SettingsFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DeliveryArea } from "@/lib/types";

const FEE_ERROR = "Enter a fee between TT$0 and TT$1,000";

/** One delivery area. A new row (no area) is saved as a new area. Empty fee means "We'll quote". */
function AreaRow({ area, sort, onSaved }: { area?: DeliveryArea; sort: number; onSaved?: () => void }) {
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
      const parsed = parseFeeCents(trimmed);
      if (parsed === null) {
        setFeeError(FEE_ERROR);
        return;
      }
      feeCents = parsed;
    }
    setFeeError(undefined);
    run(
      () =>
        saveAreaAction({
          id: area?.id,
          name,
          feeCents,
          active,
          sort: area?.sort ?? sort,
        }),
      onSaved,
    );
  }

  const nameId = `${id}-name`;
  const feeId = `${id}-fee`;
  const activeId = `${id}-active`;
  const nameError = errors.name;
  const feeMessage = feeError ?? errors.feeCents;
  const activeError = errors.active;

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr] md:items-start">
        <div className="space-y-2">
          <Label htmlFor={nameId}>Area name</Label>
          <Input
            id={nameId}
            className="h-11"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
          />
          <FieldError id={`${nameId}-error`} message={nameError} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={feeId}>Delivery fee (TT$)</Label>
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
      </div>
      <div className="flex min-h-11 items-center justify-between gap-4">
        <Label htmlFor={activeId}>Switched on</Label>
        <Switch id={activeId} checked={active} onCheckedChange={setActive} aria-describedby={activeError ? `${activeId}-error` : undefined} />
      </div>
      <FieldError id={`${activeId}-error`} message={activeError} />
      <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {area ? "Save area" : "Add this area"}
      </Button>
    </form>
  );
}

/** Editable delivery areas. Adding an area opens a new row; each row saves on its own. */
export function DeliveryAreasEditor({ areas }: { areas: DeliveryArea[] }) {
  const [drafts, setDrafts] = useState<number[]>([]);
  const draftCounter = useRef(0);
  const nextSort = Math.max(0, ...areas.map((area) => area.sort)) + 1;

  return (
    <section aria-labelledby="delivery-areas-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 id="delivery-areas-heading" className="text-base font-semibold">
            Delivery areas
          </h2>
          <p className="text-sm text-muted-foreground">
            Leave the fee empty to say &ldquo;We&rsquo;ll quote&rdquo;. At least one area must stay switched on.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2 sm:w-auto"
          onClick={() => setDrafts((current) => [...current, ++draftCounter.current])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add area
        </Button>
      </div>
      {areas.map((area) => (
        <AreaRow key={area.id} area={area} sort={area.sort} />
      ))}
      {drafts.map((key) => (
        <AreaRow
          key={`draft-${key}`}
          sort={nextSort}
          onSaved={() => setDrafts((current) => current.filter((draft) => draft !== key))}
        />
      ))}
    </section>
  );
}
