import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const TONE: Record<OrderStatus, string> = {
  awaiting_quote: "bg-status-warning-bg text-status-warning",
  awaiting_payment: "bg-status-info-bg text-status-info",
  proof_submitted: "bg-status-progress-bg text-status-progress",
  confirmed: "bg-status-success-bg text-status-success",
  ready: "bg-status-success-bg text-status-success",
  completed: "bg-status-neutral-bg text-status-neutral",
  cancelled: "bg-status-danger-bg text-status-danger",
};

/** Status as coloured text. The label is always shown, so colour is never the only cue. */
export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium leading-snug",
        TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
