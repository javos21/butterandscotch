"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { saveProductAction } from "@/app/admin/(protected)/menu/actions";
import { runStaffAction } from "@/components/admin/action-toast";
import { FieldError, SectionHeader } from "@/components/admin/SettingsFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ProductField } from "@/lib/admin/products";
import type { Item, Section } from "@/lib/types";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Add or edit a menu item: name, section, price, unit, description, allergen note, flavours, limit, switches. */
export function ProductForm({ item, sections }: { item: Item | null; sections: Section[] }) {
  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{ field?: ProductField; message: string } | null>(null);
  const [values, setValues] = useState({
    sectionId: item?.section_id ?? sections[0]?.id ?? "",
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: item ? String(item.price_cents / 100) : "",
    unitLabel: item?.unit_label ?? "each",
    allergenNote: item?.allergen_note ?? "",
    flavours: (item?.flavours ?? []).join("\n"),
    maxQty: String(item?.max_qty ?? 10),
    active: item?.active ?? true,
    seasonal: item?.seasonal ?? false,
  });

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await runStaffAction(() =>
        saveProductAction({ ...values, id: item?.id, maxQty: Number(values.maxQty) }),
      );
      if ("error" in result) {
        setError({ field: "field" in result ? result.field : undefined, message: result.error });
        return;
      }
      if (!item) router.replace(`/admin/menu/${result.id}`);
      else router.refresh();
    });
  }

  const errorFor = (field: ProductField) => (error?.field === field ? error.message : undefined);
  const ids = (name: string) => `${id}-${name}`;
  const describedBy = (field: ProductField, name: string) => (errorFor(field) ? `${ids(name)}-error` : undefined);

  return (
    <section aria-labelledby={ids("heading")} className="rounded-xl border bg-card">
      <form onSubmit={submit} noValidate>
        <SectionHeader
          id={ids("heading")}
          title="Details"
          description={item ? "Changes show on the menu as soon as you save." : "Save first, then add a photo."}
        />
        <div className="space-y-5 p-4 md:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id={ids("name")} label="Name" error={errorFor("name")}>
              <Input
                id={ids("name")}
                className="h-11"
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
                aria-invalid={errorFor("name") ? true : undefined}
                aria-describedby={describedBy("name", "name")}
              />
            </Field>
            <Field id={ids("section")} label="Menu section" error={errorFor("sectionId")}>
              <select
                id={ids("section")}
                className="h-11 w-full rounded-[10px] border border-input bg-card px-3 text-base"
                value={values.sectionId}
                onChange={(event) => set("sectionId", event.target.value)}
                aria-invalid={errorFor("sectionId") ? true : undefined}
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field id={ids("price")} label="Price (TT$)" error={errorFor("price")}>
              <Input
                id={ids("price")}
                inputMode="decimal"
                autoComplete="off"
                className="h-11 tabular-nums"
                value={values.price}
                onChange={(event) => set("price", event.target.value)}
                aria-invalid={errorFor("price") ? true : undefined}
                aria-describedby={describedBy("price", "price")}
              />
            </Field>
            <Field id={ids("unit")} label="Unit" hint="each, per dozen, per loaf" error={errorFor("unitLabel")}>
              <Input
                id={ids("unit")}
                className="h-11"
                value={values.unitLabel}
                onChange={(event) => set("unitLabel", event.target.value)}
                aria-invalid={errorFor("unitLabel") ? true : undefined}
                aria-describedby={describedBy("unitLabel", "unit")}
              />
            </Field>
            <Field id={ids("max")} label="Most per order" error={errorFor("maxQty")}>
              <Input
                id={ids("max")}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                className="h-11"
                value={values.maxQty}
                onChange={(event) => set("maxQty", event.target.value)}
                aria-invalid={errorFor("maxQty") ? true : undefined}
                aria-describedby={describedBy("maxQty", "max")}
              />
            </Field>
          </div>

          <Field id={ids("description")} label="Description (optional)" error={errorFor("description")}>
            <Textarea
              id={ids("description")}
              rows={3}
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
              aria-invalid={errorFor("description") ? true : undefined}
              aria-describedby={describedBy("description", "description")}
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              id={ids("allergen")}
              label="Allergen note (optional)"
              hint="Shown on the card, e.g. Contains nuts"
              error={errorFor("allergenNote")}
            >
              <Input
                id={ids("allergen")}
                className="h-11"
                value={values.allergenNote}
                onChange={(event) => set("allergenNote", event.target.value)}
                aria-invalid={errorFor("allergenNote") ? true : undefined}
                aria-describedby={describedBy("allergenNote", "allergen")}
              />
            </Field>
            <Field
              id={ids("flavours")}
              label="Flavours (optional)"
              hint="One per line. Customers must pick one."
              error={errorFor("flavours")}
            >
              <Textarea
                id={ids("flavours")}
                rows={3}
                value={values.flavours}
                onChange={(event) => set("flavours", event.target.value)}
                aria-invalid={errorFor("flavours") ? true : undefined}
                aria-describedby={describedBy("flavours", "flavours")}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border px-3">
              <span className="text-sm font-medium">On menu</span>
              <Switch checked={values.active} onCheckedChange={(checked) => set("active", checked)} />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border px-3">
              <span className="text-sm font-medium">Seasonal badge</span>
              <Switch checked={values.seasonal} onCheckedChange={(checked) => set("seasonal", checked)} />
            </label>
          </div>

          {error && !error.field ? <FieldError id={ids("form-error")} message={error.message} /> : null}
        </div>
        <div className="flex justify-end border-t px-4 py-3 md:px-6">
          <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {item ? "Save changes" : "Add item"}
          </Button>
        </div>
      </form>
    </section>
  );
}
