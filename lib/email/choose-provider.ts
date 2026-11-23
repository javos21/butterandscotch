import type { EmailProvider } from "@/lib/email/types";
import { brevoProvider, consoleProvider } from "@/lib/email/send";

/** A provider that rejects every send, so the misconfiguration lands in email_log.error. */
function unconfiguredProvider(message: string): EmailProvider {
  return {
    async send() {
      throw new Error(message);
    },
  };
}

/**
 * Picks the email provider from env. In production an unknown or missing
 * EMAIL_PROVIDER, or a Brevo setup without its key or sender, returns a
 * provider that fails on send instead of silently using the console.
 */
export function chooseProvider(
  env: Record<string, string | undefined>,
): EmailProvider {
  if (env.EMAIL_PROVIDER === "brevo") {
    if (!env.BREVO_API_KEY || !env.EMAIL_FROM) {
      return unconfiguredProvider(
        "Brevo not configured (BREVO_API_KEY / EMAIL_FROM)",
      );
    }
    return brevoProvider(env.BREVO_API_KEY, {
      email: env.EMAIL_FROM,
      name: env.EMAIL_FROM_NAME ?? "Butter & Scotch",
    });
  }
  if (env.NODE_ENV === "production") {
    return unconfiguredProvider(
      "Email provider not configured (set EMAIL_PROVIDER=brevo)",
    );
  }
  return consoleProvider();
}
