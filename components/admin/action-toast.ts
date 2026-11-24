import { toast } from "sonner";

type ActionResult = { ok: true; emailFailed?: boolean } | { error: string };

export const SAVE_FAILED = "Couldn't save — try again";

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

/**
 * Runs a staff action, toasts its outcome and returns it. A thrown error (a server action that failed
 * outright) is logged and toasted as SAVE_FAILED, so the caller's pending state always clears and the
 * error page is never shown. Never throws.
 */
export async function runStaffAction<T extends ActionResult>(
  action: () => Promise<T>,
): Promise<T | { error: string }> {
  let result: T | { error: string };
  try {
    result = await action();
  } catch (error) {
    console.error(error);
    result = { error: SAVE_FAILED };
  }
  toastActionResult(result);
  return result;
}
