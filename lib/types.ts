import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];

/** Bank transfer details shown to customers at checkout. Placeholders in local seed data. */
export type BankDetails = {
  bank: string;
  account_name: string;
  account_type: string;
  transit: string;
  account_no_same_bank: string;
  account_no_other_bank: string;
};

export type Settings = Omit<Tables["settings"]["Row"], "bank_details"> & {
  bank_details: BankDetails;
};

export type Section = Tables["sections"]["Row"];

export type Item = Tables["items"]["Row"];

export type DeliveryArea = Tables["delivery_areas"]["Row"];
