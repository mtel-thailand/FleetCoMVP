import type { Invoice, InvoiceStatus } from "@/app/data/invoices";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency } from "@/app/data/formatters";
import { formatDate } from "./utils";

// The billing counterpart to BookingProgress — deliberately a different
// shape, not a 4-step version of the same stepper. InvoiceStatus isn't a
// clean sequence the way the rental chain is: Unpaid and Overdue are the
// same step with an urgency variant, not two steps forward. A segmented
// progress bar plus the real status badge reads that correctly, whereas a
// stepper would force an artificial step for "overdue." All three states
// that still need payment action share the same amber bar, while their text
// labels retain distinct urgency colors.
//
// Exported so InvoiceInbox.tsx's table can reuse the identical mapping for
// its own compact per-row bar — one definition of "what does each status
// look like as a bar," not two color scales drifting apart over time.
// Payment Issue sits at step 2 alongside Payment Submitted: the client has
// made a payment attempt, even though FleetCo needs them to correct it.
export const PROGRESS: Record<InvoiceStatus, { filled: number; bar: string }> = {
  Unpaid: { filled: 1, bar: "bg-amber-400" },
  Overdue: { filled: 1, bar: "bg-amber-400" },
  "Payment Issue": { filled: 2, bar: "bg-indigo-400" },
  "Payment Submitted": { filled: 2, bar: "bg-indigo-400" },
  Paid: { filled: 3, bar: "bg-emerald-500" },
};

// "Due" here is a display-only relabel of the "Unpaid" status, scoped to
// this cell — the underlying InvoiceStatus value stays "Unpaid" everywhere
// else, matching how bookingStatusLabel/clientRentalStatusLabel already do
// a display-only rename elsewhere in this app without touching the stored
// value itself.
const CELL_LABEL: Record<InvoiceStatus, string> = {
  Unpaid: "Due",
  Overdue: "Overdue",
  "Payment Issue": "Payment Issue",
  "Payment Submitted": "Payment Submitted",
  Paid: "Paid",
};

// Compact, per-row version of the bar above — no card chrome (border/
// padding/amount/invoice-id), for use inside a row that already shows those
// facts. The booking-detail page gives the document column enough width for
// longer labels.
//
// dueDate is optional and appended only for Due and Overdue. Payment Issue
// already explains the needed action and stays date-free, matching Payment
// Submitted/Paid. Left
// optional rather than required so a caller with its own dedicated Due
// Date column (InvoiceInbox.tsx's table) isn't forced to repeat that
// column's own job inside this cell too.
//
// align defaults to "end" for DocumentChain's DocRow, where this sits under
// a right-aligned amount in a right-aligned column — but InvoiceInbox.tsx's
// table needs "start" instead: its Status <td> lines up under a left-aligned
// "Status" header alongside every other left-aligned column, and a
// right-end-anchored bar+label there reads as misaligned against its own
// header and neighboring rows rather than as a deliberate right edge.
export function InvoiceStatusCell({
  status,
  dueDate,
  align = "end",
  variant = "compact",
}: {
  status: InvoiceStatus;
  dueDate?: string;
  align?: "start" | "end";
  variant?: "compact" | "table";
}) {
  const { filled, bar } = PROGRESS[status];
  const showDueDate = status === "Unpaid" || status === "Overdue";
  const labelColor = status === "Overdue" ? "text-rose-600" : status === "Payment Issue" ? "text-orange-600" : "text-slate-700";
  const isTable = variant === "table";
  return (
    // gap-1, not gap-0 — zero gap left the bar and label touching, reading
    // as one glued-together mark instead of two related-but-distinct
    // pieces (the segments have their own gap-0.5 breathing room between
    // each other; the bar-to-label boundary deserves at least as much).
    <div className={`flex flex-col ${isTable ? "gap-2" : "gap-1"} ${align === "start" ? "items-start" : "items-end"}`}>
      <div className={isTable ? "flex gap-1" : "flex gap-0.5"}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${isTable ? "h-1 w-10" : "h-1 w-5"} rounded-full ${i < filled ? bar : "bg-slate-100"}`}
          />
        ))}
      </div>
      <span className={`${isTable ? "text-[11px]" : "text-[10px]"} font-medium ${labelColor}`}>
        {CELL_LABEL[status]}
        {showDueDate && dueDate && <span className="text-slate-400"> · {formatDate(dueDate)}</span>}
      </span>
    </div>
  );
}

// Takes every invoice tied to the booking (newest first — see
// bookings.ts's bookingInvoices) rather than a single one, because a
// recurring-billing booking can have more than one. Only the latest drives
// what's shown here — earlier cycles are what the Documents list is for.
export function InvoiceProgress({ invoices }: { invoices: Invoice[] }) {
  const latest = invoices[0];

  if (!latest) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center" aria-label="Invoice status">
        <p className="text-xs font-medium text-slate-400">Not yet invoiced</p>
      </div>
    );
  }

  const { filled, bar } = PROGRESS[latest.status];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4" aria-label="Invoice status">
      <div className="flex gap-1 mb-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < filled ? bar : "bg-slate-200"}`} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={latest.status} />
        <span className="text-xs font-semibold text-slate-800">{formatCurrency(latest.amountDue)}</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">{latest.id} · issued {formatDate(latest.issuedAt)}</p>
      {invoices.length > 1 && (
        <p className="text-[11px] text-slate-400 mt-1">
          + {invoices.length - 1} earlier invoice{invoices.length - 1 > 1 ? "s" : ""} — see Documents below
        </p>
      )}
    </div>
  );
}
