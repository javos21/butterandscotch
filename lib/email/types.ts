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
  /** Items only. Delivery is paid separately, on delivery. */
  totalCents: number;
  fulfilment: "pickup" | "delivery";
  /** Bank details to pay into. */
  bank: BankDetails;
};

export type StaffNewOrderData = {
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  fulfilDate: string;
  totalCents: number;
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

type CustomerOrderBase = {
  orderNumber: string;
  token: string;
  customerName: string;
};

export type OrderConfirmedData = CustomerOrderBase & {
  /** ISO "YYYY-MM-DD" business date. */
  fulfilDate: string;
  fulfilment: "pickup" | "delivery";
  totalCents: number;
};

export type ProofRejectedData = CustomerOrderBase & {
  reason: string;
  totalCents: number;
};

export type DateChangedData = CustomerOrderBase & {
  /** ISO "YYYY-MM-DD" business dates. */
  oldDate: string;
  newDate: string;
};

export type OrderCancelledData = CustomerOrderBase & {
  reason: string;
};

export type OrderReadyData = CustomerOrderBase & {
  fulfilment: "pickup" | "delivery";
  /** Collection instructions for pickup orders. Null when there are none. */
  pickupInfo: string | null;
};

export type TemplateData = {
  order_received: OrderReceivedData;
  staff_new_order: StaffNewOrderData;
  proof_received: ProofReceivedData;
  staff_proof_received: StaffProofReceivedData;
  order_links: OrderLinksData;
  order_confirmed: OrderConfirmedData;
  proof_rejected: ProofRejectedData;
  date_changed: DateChangedData;
  order_cancelled: OrderCancelledData;
  order_ready: OrderReadyData;
};

export type EmailAttachment = {
  filename: string;
  content: Buffer;
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
    attachments?: EmailAttachment[];
  }): Promise<{ id: string }>;
};

export type EmailDeps = {
  provider: EmailProvider;
  log(entry: EmailLogEntry): Promise<void>;
};
