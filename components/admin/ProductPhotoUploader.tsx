"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2 } from "lucide-react";
import { uploadProductPhotoAction } from "@/app/admin/(protected)/menu/actions";
import { runStaffAction } from "@/components/admin/action-toast";
import { ProductPhoto } from "@/components/admin/ProductPhoto";
import { FieldError, SectionHeader } from "@/components/admin/SettingsFields";
import { Button } from "@/components/ui/button";
import { COMPRESS_ABOVE_BYTES, compressReceipt } from "@/lib/receipt-file";

const SENDABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Photo for one item. Large phone photos and HEIC (where the browser can read it) are shrunk to a
 * JPEG in the browser first; the server then resizes to WebP and stores it in R2.
 */
export function ProductPhotoUploader({ id, name, imageUrl }: { id: string; name: string; imageUrl: string | null }) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function upload(file: File) {
    setError(undefined);
    startTransition(async () => {
      let toSend = file;
      if (!SENDABLE.has(file.type) || file.size > COMPRESS_ABOVE_BYTES) {
        try {
          toSend = await compressReceipt(file);
        } catch {
          setError("That photo couldn't be read. Please use a JPG, PNG or WEBP photo.");
          return;
        }
      }
      const formData = new FormData();
      formData.set("id", id);
      formData.set("photo", toSend);
      const result = await runStaffAction(() => uploadProductPhotoAction(formData));
      if ("error" in result) setError(result.error);
      else router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <section aria-labelledby={`${inputId}-heading`} className="rounded-xl border bg-card">
      <SectionHeader
        id={`${inputId}-heading`}
        title="Photo"
        description="Use a well-lit photo of the real bake. It's resized for the web automatically."
      />
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center md:p-6">
        <ProductPhoto src={imageUrl} name={name} sizes="(min-width: 640px) 200px, 100vw" className="aspect-[4/3] w-full sm:w-48" />
        <div className="space-y-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full gap-2 sm:w-auto"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImageUp className="size-4" aria-hidden="true" />}
            {isPending ? "Uploading…" : imageUrl && !imageUrl.includes("placehold.co") ? "Replace photo" : "Upload photo"}
          </Button>
          <label htmlFor={inputId} className="sr-only">
            Photo of {name}
          </label>
          <p className="text-sm text-muted-foreground">JPG, PNG, WEBP or iPhone photos.</p>
          <FieldError id={`${inputId}-error`} message={error} />
        </div>
      </div>
    </section>
  );
}
