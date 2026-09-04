// Invoices — brief §6. Step 2 of the Quotation → Invoice → Tax Invoice chain.
// §6.1: "'marked as paid' by the client is a claim, not a settlement — FleetCo
// finance confirms before the tax invoice is released." That's why "Payment
// Submitted" and "Paid" are distinct statuses below, not one and the same.
import type { QuotationLineItem } from "./quotations";
import { demoToday, rebaseDemoDates } from "./demoDates";

// Payment Issue: FleetCo rejected a submitted claim (amount short, wrong
// reference, etc) — see documentActions.ts's markInvoicePaid /
// OpsBookingDetailPanel's handleRejectPayment. Previously represented as
// Unpaid/Overdue plus a paymentRejectionReason side-field rather than its
// own status, which meant a rejected claim looked identical to "never
// tried" everywhere that only reads .status (the table, the sidebar badge,
// DocumentChain's bar) — the reason was only visible once you opened the
// invoice itself. A first-class status instead of a compound one.
export type InvoiceStatus = "Unpaid" | "Payment Submitted" | "Paid" | "Overdue" | "Payment Issue";

export function invoiceDisplayStatus(
  invoice: Pick<Invoice, "status" | "dueDate">,
  today = demoToday(),
): InvoiceStatus {
  // Keep the stored status as the payment event that actually happened. An
  // unpaid invoice becomes overdue as time passes, so the urgency shown to a
  // user is derived rather than requiring a background job in the demo.
  return invoice.status === "Unpaid" && !!invoice.dueDate && invoice.dueDate < today
    ? "Overdue"
    : invoice.status;
}

export type Invoice = {
  id: string;
  bookingId: string;
  quotationId: string;
  clientId: string;
  isRecurring: boolean;
  amountDue: number;
  issuedAt: string;
  dueDate: string;
  status: InvoiceStatus;
  paymentDate: string | null;
  paymentReference: string | null;
  // Filenames only — this demo has no real file storage, same "just the
  // name" convention as ClientAccount.contractFileName. Empty array = no
  // slip attached, not a boolean, since Mark-as-Paid now requires at least
  // one and supports more than one (P'Tarn's "support uploading multiple
  // bank slip files").
  paymentSlipFiles: string[];
  // brief §6.1: "marked as paid" is a claim, not a settlement — FleetCo
  // finance can reject it (amount short, wrong reference) as well as verify
  // it. Set when Finance rejects a claim, cleared the moment the client
  // resubmits a fresh one — so it only ever reflects the *current* claim's
  // outcome, not a stale complaint about a since-corrected submission.
  paymentRejectionReason?: string;
  created: string;
  updated: string;
  // Optional — only invoices issued through the §6.2 split-screen document
  // editor carry the underlying line items/discount/VAT breakdown; the
  // historical mock invoices above only ever needed the flat amountDue.
  lineItems?: QuotationLineItem[];
  discount?: number;
  vatRate?: number;
  paymentTerms?: string;
  remarks?: string;
  // Historical invoices issued through the former shared document editor
  // may carry the FleetCo signature captured there. The current invoice
  // review flow derives the document from an accepted quotation and does
  // not request a second signature.
  fleetcoSignature?: string;
};

export const mockInvoices: Invoice[] = rebaseDemoDates<Invoice[]>([
  {
    id: "INV-2026-0001", bookingId: "BK-2026-0008", quotationId: "QT-2026-0007", clientId: "CLI-001",
    isRecurring: false, amountDue: 2354, issuedAt: "2026-07-07 09:00", dueDate: "2026-08-06",
    status: "Overdue", paymentDate: null, paymentReference: null, paymentSlipFiles: [],
    created: "2026-07-07 09:00", updated: "2026-07-07 09:00",
  },
  {
    id: "INV-2026-0002", bookingId: "BK-2026-0009", quotationId: "QT-2026-0008", clientId: "CLI-001",
    isRecurring: false, amountDue: 18190, issuedAt: "2026-07-28 09:00", dueDate: "2026-08-12",
    status: "Paid", paymentDate: "2026-08-03", paymentReference: "KTB20260803-0091", paymentSlipFiles: ["KTB20260803-0091-slip.jpg"],
    created: "2026-07-28 09:00", updated: "2026-08-05 14:00",
  },
  {
    id: "INV-2026-0003", bookingId: "BK-2026-0010", quotationId: "QT-2026-0009", clientId: "CLI-001",
    isRecurring: false, amountDue: 101650, issuedAt: "2026-06-29 10:00", dueDate: "2026-07-29",
    status: "Paid", paymentDate: "2026-07-10", paymentReference: "SCB20260710-0044", paymentSlipFiles: ["SCB20260710-0044-slip.pdf"],
    // Verification must precede the tax invoice it unlocks (brief §6.1) —
    // TI-2026-0001 was issued 2026-07-11 09:30, so this has to land before that.
    created: "2026-06-29 10:00", updated: "2026-07-11 09:00",
  },
  {
    id: "INV-2026-0004", bookingId: "BK-2026-0004", quotationId: "QT-2026-0004", clientId: "CLI-001",
    isRecurring: true, amountDue: 52965, issuedAt: "2026-06-30 18:00", dueDate: "2026-07-30",
    status: "Paid", paymentDate: "2026-07-05", paymentReference: "KBank20260705-0012", paymentSlipFiles: ["KBank20260705-0012-slip.jpg"],
    created: "2026-06-30 18:00", updated: "2026-07-06 09:00",
  },
  {
    id: "INV-2026-0005", bookingId: "BK-2026-0004", quotationId: "QT-2026-0004", clientId: "CLI-001",
    isRecurring: true, amountDue: 52965, issuedAt: "2026-07-31 18:00", dueDate: "2026-08-30",
    status: "Payment Submitted", paymentDate: "2026-08-12", paymentReference: "KBank20260812-0077",
    // Two files, not one — the one seed example showing multi-file support
    // works from the data side too, not just a freshly-submitted claim.
    paymentSlipFiles: ["KBank20260812-0077-slip-front.jpg", "KBank20260812-0077-slip-back.jpg"],
    created: "2026-07-31 18:00", updated: "2026-08-12 10:00",
  },
  // Active rental with a verified payment. Along with BK-2026-0004 and
  // BK-2026-0006, this gives the Active group one each of Paid, Payment
  // Submitted, and Due in the client portal.
  {
    id: "INV-2026-0006", bookingId: "BK-2026-0016", quotationId: "QT-2026-0012", clientId: "CLI-001",
    isRecurring: false, amountDue: 9630, issuedAt: "2026-08-06 10:00", dueDate: "2026-09-05",
    status: "Paid", paymentDate: "2026-08-10", paymentReference: "KTB20260810-0038", paymentSlipFiles: ["KTB20260810-0038-slip.jpg"],
    created: "2026-08-06 10:00", updated: "2026-08-11 09:00",
  },
  // First cycle of BK-2026-0017's recurring billing, invoiced in advance —
  // that booking is still "Assigned" (Upcoming), rental doesn't start until
  // 2026-09-01, and this is already issued and due 2026-08-28, well before
  // pickup. See that booking's own comment in bookings.ts for why. Also the
  // the Upcoming "Due" example; the other Upcoming rentals have not been
  // invoiced yet.
  {
    id: "INV-2026-0007", bookingId: "BK-2026-0017", quotationId: "QT-2026-0013", clientId: "CLI-001",
    isRecurring: true, amountDue: 43335, issuedAt: "2026-08-17 10:00", dueDate: "2026-08-28",
    status: "Unpaid", paymentDate: null, paymentReference: null, paymentSlipFiles: [],
    created: "2026-08-17 10:00", updated: "2026-08-17 10:00",
  },
  {
    id: "INV-2026-0008", bookingId: "BK-2026-0006", quotationId: "QT-2026-0003", clientId: "CLI-001",
    isRecurring: false, amountDue: 11984, issuedAt: "2026-08-17 09:00", dueDate: "2026-09-16",
    status: "Unpaid", paymentDate: null, paymentReference: null, paymentSlipFiles: [],
    created: "2026-08-17 09:00", updated: "2026-08-17 09:00",
  },
  // Completed rental with a rejected payment claim. Completed rentals now
  // demonstrate the remaining billing outcomes: Payment Issue, Overdue,
  // Paid, and Due.
  {
    id: "INV-2026-0009", bookingId: "BK-2026-0007", quotationId: "QT-2026-0006", clientId: "CLI-001",
    isRecurring: false, amountDue: 11984, issuedAt: "2026-08-05 09:00", dueDate: "2026-08-19",
    status: "Payment Issue", paymentDate: "2026-08-12", paymentReference: "SCB20260812-0042", paymentSlipFiles: ["SCB20260812-0042-slip.jpg"],
    paymentRejectionReason: "Reference number doesn't match any transaction in the bank statement — please double-check and resubmit.",
    created: "2026-08-05 09:00", updated: "2026-08-13 11:00",
  },
  // Second finance-verification example for a one-day active rental, so
  // Action Required demonstrates more than one rental type.
  {
    id: "INV-2026-0010", bookingId: "BK-2026-0005", quotationId: "QT-2026-0005", clientId: "CLI-001",
    isRecurring: false, amountDue: 2996, issuedAt: "2026-08-14 09:00", dueDate: "2026-08-29",
    status: "Payment Submitted", paymentDate: "2026-08-15", paymentReference: "SCB20260815-0138",
    paymentSlipFiles: ["SCB20260815-0138-slip.jpg"],
    lineItems: [{ description: "4-Wheel truck — same-day overflow delivery", vehicleClass: "4-Wheel Truck", quantity: 1, unit: "vehicle (1 day)", unitPrice: 2800, amount: 2800 }],
    discount: 0, vatRate: 0.07,
    created: "2026-08-14 09:00", updated: "2026-08-15 16:20",
  },
]);
