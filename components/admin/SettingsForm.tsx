"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { updateSettingsAction } from "@/app/admin/(protected)/settings/actions";
import { FieldError, SectionCard, useSettingsSave } from "@/components/admin/SettingsFields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BankDetails, Settings } from "@/lib/types";

/** One labelled field, with its error under it. The input inside gets the matching id. */
function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function ShopSection({ settings }: { settings: Settings }) {
  const id = useId();
  const [storeOpen, setStoreOpen] = useState(settings.store_open);
  const [leadTime, setLeadTime] = useState(String(settings.lead_time_days));
  const [dailyCap, setDailyCap] = useState(String(settings.daily_order_cap));
  const { run, isPending, errors } = useSettingsSave();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() =>
      updateSettingsAction({
        store_open: storeOpen,
        lead_time_days: Number(leadTime),
        daily_order_cap: Number(dailyCap),
      }),
    );
  }

  return (
    <SectionCard
      id={`${id}-shop`}
      title="Shop"
      description="Turn the shop off to stop new orders. Lead time is how many days ahead customers must book."
      isPending={isPending}
      onSubmit={submit}
    >
      {/* The whole row is the tap target: tapping the label text toggles the switch. */}
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
        <span className="text-sm font-medium">Taking orders</span>
        <Switch id={`${id}-open`} checked={storeOpen} onCheckedChange={setStoreOpen} />
      </label>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id={`${id}-lead`} label="Lead time (days)" error={errors.lead_time_days}>
          <Input
            id={`${id}-lead`}
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            className="h-11"
            value={leadTime}
            onChange={(event) => setLeadTime(event.target.value)}
            aria-invalid={errors.lead_time_days ? true : undefined}
            aria-describedby={errors.lead_time_days ? `${id}-lead-error` : undefined}
          />
        </Field>
        <Field id={`${id}-cap`} label="Daily order limit" error={errors.daily_order_cap}>
          <Input
            id={`${id}-cap`}
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            className="h-11"
            value={dailyCap}
            onChange={(event) => setDailyCap(event.target.value)}
            aria-invalid={errors.daily_order_cap ? true : undefined}
            aria-describedby={errors.daily_order_cap ? `${id}-cap-error` : undefined}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

const BANK_FIELDS: { key: keyof BankDetails; label: string }[] = [
  { key: "bank", label: "Bank" },
  { key: "account_name", label: "Account name" },
  { key: "account_type", label: "Account type" },
  { key: "transit", label: "Transit number" },
  { key: "account_no_same_bank", label: "Account number (same bank)" },
  { key: "account_no_other_bank", label: "Account number (other bank)" },
];

function BankSection({ settings }: { settings: Settings }) {
  const id = useId();
  const [bank, setBank] = useState<BankDetails>(settings.bank_details);
  const { run, isPending, errors } = useSettingsSave();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => updateSettingsAction({ bank_details: bank }));
  }

  return (
    <SectionCard
      id={`${id}-bank`}
      title="Bank details"
      description="Shown to customers on the total email and receipt. Checked for blanks on save."
      isPending={isPending}
      onSubmit={submit}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {BANK_FIELDS.map(({ key, label }) => {
          const fieldId = `${id}-bank-${key}`;
          const error = errors[`bank_details.${key}`];
          return (
            <Field key={key} id={fieldId} label={label} error={error}>
              <Input
                id={fieldId}
                autoComplete="off"
                className="h-11"
                value={bank[key]}
                onChange={(event) => setBank({ ...bank, [key]: event.target.value })}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : undefined}
              />
            </Field>
          );
        })}
      </div>
    </SectionCard>
  );
}

function PickupSection({ settings }: { settings: Settings }) {
  const id = useId();
  const [pickupInfo, setPickupInfo] = useState(settings.pickup_info);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp_number);
  const [notifyEmail, setNotifyEmail] = useState(settings.notify_email ?? "");
  const { run, isPending, errors } = useSettingsSave();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() =>
      updateSettingsAction({
        pickup_info: pickupInfo,
        whatsapp_number: whatsapp,
        notify_email: notifyEmail,
      }),
    );
  }

  const pickupId = `${id}-pickup`;
  const whatsappId = `${id}-whatsapp`;
  const emailId = `${id}-notify`;

  return (
    <SectionCard
      id={`${id}-contact`}
      title="Pickup and contact"
      description="Pickup info goes into the ready email for pickup orders. Notification email gets a copy of new orders."
      isPending={isPending}
      onSubmit={submit}
    >
      <Field id={pickupId} label="Pickup info" error={errors.pickup_info}>
        <Textarea
          id={pickupId}
          rows={4}
          className="min-h-24"
          value={pickupInfo}
          onChange={(event) => setPickupInfo(event.target.value)}
          aria-invalid={errors.pickup_info ? true : undefined}
          aria-describedby={errors.pickup_info ? `${pickupId}-error` : undefined}
        />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id={whatsappId} label="WhatsApp number" error={errors.whatsapp_number}>
          <Input
            id={whatsappId}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className="h-11"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            aria-invalid={errors.whatsapp_number ? true : undefined}
            aria-describedby={errors.whatsapp_number ? `${whatsappId}-error` : undefined}
          />
        </Field>
        <Field id={emailId} label="Notification email" error={errors.notify_email}>
          <Input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="off"
            className="h-11"
            value={notifyEmail}
            onChange={(event) => setNotifyEmail(event.target.value)}
            aria-invalid={errors.notify_email ? true : undefined}
            aria-describedby={errors.notify_email ? `${emailId}-error` : undefined}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function PolicySection({ settings }: { settings: Settings }) {
  const id = useId();
  const [policy, setPolicy] = useState(settings.policy_text);
  const { run, isPending, errors } = useSettingsSave();
  const policyId = `${id}-policy`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => updateSettingsAction({ policy_text: policy }));
  }

  return (
    <SectionCard
      id={`${id}-policy-heading`}
      title="Order policy"
      description={`Customers agree to this policy at checkout. Version ${settings.policy_version}. Changing the text makes it version ${settings.policy_version + 1}.`}
      isPending={isPending}
      onSubmit={submit}
    >
      <Field id={policyId} label="Policy text" error={errors.policy_text}>
        <Textarea
          id={policyId}
          rows={8}
          className="min-h-40"
          value={policy}
          onChange={(event) => setPolicy(event.target.value)}
          aria-invalid={errors.policy_text ? true : undefined}
          aria-describedby={errors.policy_text ? `${policyId}-error` : undefined}
        />
      </Field>
    </SectionCard>
  );
}

/** The four settings cards. Each card saves only its own fields and has its own Save button. */
export function SettingsForm({ settings }: { settings: Settings }) {
  return (
    <div className="space-y-6">
      <ShopSection settings={settings} />
      <BankSection settings={settings} />
      <PickupSection settings={settings} />
      <PolicySection settings={settings} />
    </div>
  );
}
