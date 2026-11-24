import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Item photo in its cream mount (DESIGN.md "Product card"). Placeholder images from the seed
 * are shown as a plain labelled tile, never as a fake photo of the owner's baking.
 */
export function ItemPhoto({
  src,
  name,
  sizes,
  priority,
  className,
}: {
  src: string | null;
  name: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const isPlaceholder = !src || src.includes("placehold.co");
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-sage-wash", className)}>
      {isPlaceholder ? (
        <div className="flex h-full w-full items-center justify-center p-4 text-center">
          <span className="font-display text-lg leading-tight text-olive">Photo coming soon</span>
        </div>
      ) : (
        <Image src={src} alt={name} fill sizes={sizes} priority={priority} className="object-cover" />
      )}
    </div>
  );
}
