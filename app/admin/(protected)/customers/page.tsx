import { listCustomers, type CustomerSummary } from "@/lib/admin/customers";
import { requireStaff } from "@/lib/auth/require-staff";
import { formatMoney } from "@/lib/money";

export default async function AdminCustomersPage() {
  await requireStaff();
  const customers = await listCustomers();
  const optedIn = customers.filter((c) => c.broadcastOptIn).length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} customers, {optedIn} opted in to the WhatsApp broadcast. Cancelled orders
            are not counted.
          </p>
        </div>
        <a
          href="/admin/customers/export"
          download
          className="inline-flex min-h-11 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          Download broadcast list (CSV)
        </a>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No customers yet
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {customers.map((customer) => (
            <li key={customer.id} className="min-w-0">
              <CustomerCard customer={customer} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomerCard({ customer }: { customer: CustomerSummary }) {
  return (
    <article className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
      <div className="min-w-0">
        <h2 className="truncate font-semibold">{customer.name || "No name"}</h2>
        <p className="break-all text-sm text-muted-foreground">{customer.email}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="min-w-0">
          <dt className="text-muted-foreground">WhatsApp</dt>
          <dd className="break-all">{customer.phone || "None"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Orders</dt>
          <dd className="tabular-nums">{customer.orderCount}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Total spent</dt>
          <dd className="tabular-nums">{`$${formatMoney(customer.totalSpentCents)}`}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Broadcast</dt>
          <dd>{customer.broadcastOptIn ? "Opted in" : "Not opted in"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Community</dt>
          <dd>{customer.communityOptIn ? "Opted in" : "Not opted in"}</dd>
        </div>
      </dl>
    </article>
  );
}
