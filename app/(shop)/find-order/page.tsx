import type { Metadata } from "next";
import { FindOrderForm } from "@/components/shop/FindOrderForm";

export const metadata: Metadata = {
  title: "Find your order",
  robots: { index: false, follow: false },
};

/** Lost your order link? Enter your email and we send the links to your orders. */
export default function FindOrderPage() {
  return (
    <main className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Find your order</h1>
      <p className="text-sm text-muted-foreground">
        Enter the email you ordered with and we will send your private order links.
      </p>
      <FindOrderForm />
    </main>
  );
}
