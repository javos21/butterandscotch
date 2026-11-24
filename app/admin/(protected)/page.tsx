import { requireStaff } from "@/lib/auth/require-staff";

export default async function AdminTodayPage() {
  await requireStaff();
  return <h1 className="text-xl font-semibold">Today</h1>;
}
