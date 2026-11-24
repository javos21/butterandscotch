import type { Metadata } from "next";
import { FindOrderForm } from "@/components/shop/FindOrderForm";

export const metadata: Metadata = {
  title: "Find your order",
  robots: { index: false, follow: false },
};

/** Lost your order link? Enter your email and we send the links to your orders. */
export default function FindOrderPage() {
  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-6">
      <h1 className="pt-2 text-center font-display text-[clamp(2.2rem,8vw,3rem)] leading-tight text-oxblood">Find your order</h1>
      <p className="text-center text-base text-olive-ink">
        Enter the email you ordered with and we will send your private order links.
      </p>
      <FindOrderForm />
    </main>
  );
}
