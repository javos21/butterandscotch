import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Item thumbnail for the admin. Seed placeholders show as "No photo" so staff see what still needs one. */
export function ProductPhoto({ src, name, className, sizes }: { src: string | null; name: string; className?: string; sizes: string }) {
  const missing = !src || src.includes("placehold.co");
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-lg bg-muted", className)}>
      {missing ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
          <ImageOff className="size-5" aria-hidden="true" />
          <span className="text-xs">No photo</span>
        </div>
      ) : (
        <Image src={src} alt={name} fill sizes={sizes} className="object-cover" />
      )}
    </div>
  );
}
