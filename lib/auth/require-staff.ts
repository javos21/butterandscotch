import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type StaffSession = { userId: string; name: string };

/**
 * Call first in every admin page and server action. Signed-out visitors go to the login page.
 * Signed-in users who are not in `staff` are sent back to the login page with ?error=not-staff.
 * (forbidden() needs the experimental authInterrupts flag, so it is not used here.)
 */
export async function requireStaff(): Promise<StaffSession> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin/login");
  }

  // RLS lets staff read the staff table; a non-staff user gets no row.
  const { data: staff, error } = await supabase
    .from("staff")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!staff) {
    redirect("/admin/login?error=not-staff");
  }

  return { userId: user.id, name: staff.name };
}
