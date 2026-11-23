import { createElement, type ComponentType } from "react";
import { render } from "@react-email/components";
import OrderReceived from "@/lib/email/templates/OrderReceived";
import StaffNewOrder from "@/lib/email/templates/StaffNewOrder";
import ProofReceived from "@/lib/email/templates/ProofReceived";
import StaffProofReceived from "@/lib/email/templates/StaffProofReceived";
import OrderLinks from "@/lib/email/templates/OrderLinks";
import type {
  EmailDeps,
  EmailProvider,
  TemplateData,
  TemplateName,
} from "@/lib/email/types";

export type {
  EmailDeps,
  EmailLogEntry,
  EmailProvider,
  TemplateData,
  TemplateName,
} from "@/lib/email/types";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const TEMPLATES: { [K in TemplateName]: ComponentType<TemplateData[K]> } = {
  order_received: OrderReceived,
  staff_new_order: StaffNewOrder,
  proof_received: ProofReceived,
  staff_proof_received: StaffProofReceived,
  order_links: OrderLinks,
};

const SUBJECTS: { [K in TemplateName]: (data: TemplateData[K]) => string } = {
  order_received: (data) =>
    `Order ${data.orderNumber} received — ${
      data.awaitingQuote ? "awaiting delivery quote" : "awaiting payment"
    }`,
  staff_new_order: (data) => `New order ${data.orderNumber} from ${data.customerName}`,
  proof_received: (data) => `We received your payment proof for ${data.orderNumber}`,
  staff_proof_received: (data) => `Payment proof to check for ${data.orderNumber}`,
  order_links: () => "Your Butter & Scotch orders",
};

async function renderTemplate<K extends TemplateName>(
  name: K,
  data: TemplateData[K],
): Promise<string> {
  const Component = TEMPLATES[name];
  return render(createElement(Component, data));
}

/** Brevo transactional email. Throws with Brevo's message on a non-2xx response. */
export function brevoProvider(
  apiKey: string,
  from: { email: string; name: string },
): EmailProvider {
  return {
    async send({ to, subject, html, replyTo }) {
      const res = await fetch(BREVO_URL, {
        method: "POST",
        // A hung provider must not stall the action that sent the email.
        signal: AbortSignal.timeout(10_000),
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: from,
          to: [{ email: to }],
          subject,
          htmlContent: html,
          ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        messageId?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(
          `Brevo ${res.status}: ${json.message ?? res.statusText}`,
        );
      }
      return { id: json.messageId ?? "" };
    },
  };
}

let consoleCount = 0;

/** Development provider: logs the email instead of sending it. */
export function consoleProvider(): EmailProvider {
  return {
    async send({ to, subject, html, replyTo }) {
      consoleCount += 1;
      console.log(
        `[email:console] to=${to} subject="${subject}" bytes=${html.length}` +
          (replyTo ? ` replyTo=${replyTo}` : ""),
      );
      return { id: `console-${consoleCount}` };
    },
  };
}

/**
 * Renders and sends one template. Never throws: provider and render errors
 * are written to the log with `error` set and reported as `{ ok: false }`.
 */
export async function sendTemplate<K extends TemplateName>(
  deps: EmailDeps,
  args: {
    orderId: string | null;
    template: K;
    to: string;
    data: TemplateData[K];
    replyTo?: string;
  },
): Promise<{ ok: boolean }> {
  let providerId: string | null = null;
  let errorMessage: string | null = null;

  try {
    const subject = SUBJECTS[args.template](args.data);
    const html = await renderTemplate(args.template, args.data);
    const result = await deps.provider.send({
      to: args.to,
      subject,
      html,
      replyTo: args.replyTo,
    });
    providerId = result.id;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  try {
    await deps.log({
      order_id: args.orderId,
      template: args.template,
      to_email: args.to,
      provider_id: providerId,
      error: errorMessage,
    });
  } catch (err) {
    console.error("[email] failed to write email_log", err);
  }

  return { ok: errorMessage === null };
}
