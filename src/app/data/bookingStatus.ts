// Shared booking status vocabulary — brief §3 / §6.1:
// "Design the status vocabulary and color system once, reuse everywhere."
//
// A booking's own status is the rental/operational track only, and it's
// terminal at Completed — billing progress (issued, paid, tax-invoiced) is
// tracked separately, on the Invoice/TaxInvoice records themselves (see
// needsFleetCoAction() in bookings.ts and InvoiceProgress in
// ui/InvoiceProgress.tsx), never folded back into this field. This used to
// be one longer chain (…→ Completed → Invoiced → Paid → Closed) before the
// two tracks split; nothing mutates a booking's status into those three
// values anymore, so they were retired from the type rather than left
// reachable-in-theory-only. See Documentation.tsx's "Status Lifecycles"
// section for the full split.
//
// Main chain:   Requested → Quoted → Accepted → Assigned → Active → Completed
// Branches:     Requested/Quoted can be Declined (by client) or Cancelled (by either side)
//               Accepted/Assigned can be Cancelled (e.g. vehicle/driver falls through before rental starts)

export type BookingStatus =
  | "Requested"
  | "Quoted"
  | "Accepted"
  | "Assigned"
  | "Active"
  | "Completed"
  | "Declined"
  | "Cancelled";

export const BOOKING_STATUS_FLOW: BookingStatus[] = [
  "Requested", "Quoted", "Accepted", "Assigned", "Active", "Completed",
];

export const BOOKING_STATUS_BRANCHES: BookingStatus[] = ["Declined", "Cancelled"];

export const ALL_BOOKING_STATUSES: BookingStatus[] = [...BOOKING_STATUS_FLOW, ...BOOKING_STATUS_BRANCHES];

// Sort priority for status columns (mirrors the FleetCMS STATUS_PRIORITY convention).
export const BOOKING_STATUS_PRIORITY: BookingStatus[] = [
  "Requested", "Quoted", "Accepted", "Assigned", "Active", "Completed", "Declined", "Cancelled",
];

// Valid next states from each status — the single source of truth for what
// action buttons a booking detail screen is allowed to offer. Completed is
// terminal: issuing or paying an invoice never advances booking.status any
// further, it only attaches an invoiceId (see OpsDocumentEditorPage.tsx's
// handleIssue) — billing progress from here on lives entirely on that
// invoice record.
export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Requested: ["Quoted", "Declined", "Cancelled"],
  Quoted: ["Accepted", "Declined", "Cancelled"],
  Accepted: ["Assigned", "Cancelled"],
  Assigned: ["Active", "Cancelled"],
  Active: ["Completed"],
  Completed: [],
  Declined: [],
  Cancelled: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_STATUS_TRANSITIONS[from].includes(to);
}

// "Which side acts next" used to be a plain status-keyed table here, but a
// booking's rental status alone can't answer that once billing status is
// tracked separately from it (see the note above bookings.ts's
// invoiceEligible/needsFleetCoAction) — "Active" might mean FleetCo needs
// to invoice, or that an invoice is sitting there waiting on the client, or
// nothing at all. needsFleetCoAction(booking, invoices, taxInvoices) in
// bookings.ts replaces this, reading the booking's actual invoice/tax-
// invoice state rather than guessing from status.
