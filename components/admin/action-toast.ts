import { toast } from "sonner";

type ActionResult = { ok: true; emailFailed?: boolean } | { error: string };

/** Shows the toast for a staff action result: saved, saved with a failed email, or the error. */
export function toastActionResult(result: ActionResult): void {
  if ("error" in result) {
    toast.error(result.error);
    return;
  }
  if (result.emailFailed) {
    toast.warning("Saved — email failed, see history");
    return;
  }
  toast.success("Saved");
}
