"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteProductAction } from "@/app/admin/(protected)/menu/actions";
import { runStaffAction } from "@/components/admin/action-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Deletes a menu item after a confirmation. Past orders keep their own copy of the item name, so
 * their records are unchanged. To hide an item temporarily, staff switch it off instead.
 */
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await runStaffAction(() => deleteProductAction({ id }));
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.replace("/admin/menu");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 gap-2 text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Delete item
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              It&rsquo;s removed from the menu and its photo is deleted. Past orders keep their record. This can&rsquo;t
              be undone. To hide it for a while, switch it off instead.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 gap-2"
              disabled={isPending}
              onClick={confirm}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Delete item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
