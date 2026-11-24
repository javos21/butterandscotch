import { createElement, type ComponentType } from "react";
import { render } from "@react-email/components";
import OrderReceived from "@/lib/email/templates/OrderReceived";
import StaffNewOrder from "@/lib/email/templates/StaffNewOrder";
import ProofReceived from "@/lib/email/templates/ProofReceived";
import StaffProofReceived from "@/lib/email/templates/StaffProofReceived";
import OrderLinks from "@/lib/email/templates/OrderLinks";
import OrderConfirmed from "@/lib/email/templates/OrderConfirmed";
import ProofRejected from "@/lib/email/templates/ProofRejected";
import TotalReady from "@/lib/email/templates/TotalReady";
import DateChanged from "@/lib/email/templates/DateChanged";
import OrderCancelled from "@/lib/email/templates/OrderCancelled";
import OrderReady from "@/lib/email/templates/OrderReady";
import type {
  EmailAttachment,
  EmailDeps,
  EmailProvider,
  TemplateData,
  TemplateName,
} from "@/lib/email/types";

export type {
  EmailAttachment,
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
  order_confirmed: OrderConfirmed,
  proof_rejected: ProofRejected,
  total_ready: TotalReady,
  date_changed: DateChanged,
  order_cancelled: OrderCancelled,
  order_ready: OrderReady,
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
  order_confirmed: (data) => `Order ${data.orderNumber} confirmed — receipt attached`,
  proof_rejected: (data) => `Action needed: payment proof for ${data.orderNumber}`,
  total_ready: (data) => `Your total for ${data.orderNumber} is ready — pay to confirm`,
  date_changed: (data) => `New date for order ${data.orderNumber}`,
  order_cancelled: (data) => `Order ${data.orderNumber} cancelled`,
  order_ready: (data) =>
    data.fulfilment === "pickup"
      ? `Order ${data.orderNumber} is ready for pickup`
      : `Order ${data.orderNumber} is on its way`,
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
    async send({ to, subject, html, replyTo, attachments }) {
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
          ...(attachments && attachments.length > 0
            ? {
                attachment: attachments.map((file) => ({
                  name: file.filename,
                  content: file.content.toString("base64"),
                })),
              }
            : {}),
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
    async send({ to, subject, html, replyTo, attachments }) {
      consoleCount += 1;
      console.log(
        `[email:console] to=${to} subject="${subject}" bytes=${html.length}` +
          (replyTo ? ` replyTo=${replyTo}` : "") +
          (attachments && attachments.length > 0
            ? ` attachments=${attachments
                .map((file) => `${file.filename} (${file.content.length} bytes)`)
                .join(", ")}`
            : ""),
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
    attachments?: EmailAttachment[];
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
      attachments: args.attachments,
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
