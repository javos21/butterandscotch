import { broadcastCsv, loadBroadcastCustomers } from "@/lib/admin/customers";
import { requireStaff } from "@/lib/auth/require-staff";

export const dynamic = "force-dynamic";

/** CSV of customers who opted in to the WhatsApp broadcast. Requires a staff session. */
export async function GET() {
  await requireStaff();
  const customers = await loadBroadcastCustomers();
  return new Response(broadcastCsv(customers), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="broadcast-customers.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
