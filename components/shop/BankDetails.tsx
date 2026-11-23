"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BankDetails as BankDetailsValue } from "@/lib/types";

type Row = { label: string; value: string };

/** Bank transfer details with a copy button per value. Shown only while the customer can still pay. */
export function BankDetails({ bank, orderNumber }: { bank: BankDetailsValue; orderNumber: string }) {
  const rows: Row[] = [
    { label: "Bank", value: bank.bank },
    { label: "Account name", value: bank.account_name },
    { label: "Account type", value: bank.account_type },
    { label: "Transit", value: bank.transit },
    { label: "Account # (from Scotiabank)", value: bank.account_no_same_bank },
    { label: "Account # (from another bank)", value: bank.account_no_other_bank },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Pay by bank transfer</h2>
      <dl className="divide-y rounded-lg border">
        {rows.map((row) => (
          <BankRow key={row.label} row={row} />
        ))}
      </dl>
      <p className="text-sm">Put your order number {orderNumber} in the transfer notes.</p>
    </section>
  );
}

function BankRow({ row }: { row: Row }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(row.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the value is on screen to copy by hand.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{row.label}</dt>
        <dd className="break-all font-mono text-sm">{row.value}</dd>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Copy ${row.label}`}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
