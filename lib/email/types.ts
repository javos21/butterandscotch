import type { BankDetails } from "@/lib/types";

export type OrderReceivedData = {
  orderNumber: string;
  token: string;
  customerName: string;
  items: {
    name: string;
    flavour: string | null;
    quantity: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  /** Null for pickup, and for a delivery area that is still waiting for a quote. */
  deliveryFeeCents: number | null;
  totalCents: number;
  awaitingQuote: boolean;
  /** Bank details to pay into. Null while the order waits for a delivery quote. */
  bank: BankDetails | null;
};

export type StaffNewOrderData = {
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  fulfilDate: string;
  totalCents: number;
  awaitingQuote: boolean;
  adminUrl: string;
};

export type ProofReceivedData = {
  orderNumber: string;
  token: string;
  customerName: string;
  totalCents: number;
};

export type StaffProofReceivedData = {
  orderNumber: string;
  customerName: string;
  totalCents: number;
  adminUrl: string;
};

export type OrderLinksData = {
  customerName?: string;
  orders: { orderNumber: string; token: string; fulfilDate: string }[];
};

export type TemplateData = {
  order_received: OrderReceivedData;
  staff_new_order: StaffNewOrderData;
  proof_received: ProofReceivedData;
  staff_proof_received: StaffProofReceivedData;
  order_links: OrderLinksData;
};

export type TemplateName = keyof TemplateData;

export type EmailLogEntry = {
  order_id: string | null;
  template: TemplateName;
  to_email: string;
  provider_id: string | null;
  error: string | null;
};

export type EmailProvider = {
  send(msg: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }): Promise<{ id: string }>;
};

export type EmailDeps = {
  provider: EmailProvider;
  log(entry: EmailLogEntry): Promise<void>;
};
