"use client";

import { useState, useTransition } from "react";
import { setProductFlagsAction } from "@/app/admin/(protected)/menu/actions";
import { runStaffAction } from "@/components/admin/action-toast";
import { Switch } from "@/components/ui/switch";

/**
 * One On menu / Seasonal switch on a product row. Flips at once, saves, and flips back if the save
 * fails. The whole labelled row is the 44px tap target.
 */
export function ProductFlagSwitch({
  id,
  name,
  flag,
  initial,
}: {
  id: string;
  name: string;
  flag: "active" | "seasonal";
  initial: boolean;
}) {
  const [checked, setChecked] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const label = flag === "active" ? "On menu" : "Seasonal";

  function change(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await runStaffAction(() => setProductFlagsAction({ id, [flag]: next }));
      if ("error" in result) setChecked(!next);
    });
  }

  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium">
      <Switch
        checked={checked}
        onCheckedChange={change}
        disabled={isPending}
        aria-label={`${label}: ${name}`}
      />
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </label>
  );
}
