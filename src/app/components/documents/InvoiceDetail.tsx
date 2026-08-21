import { useState } from "react";
import { Printer, ShieldCheck, Receipt, ArrowRight, FileCheck2, Ban, Check } from "lucide-react";
import type { Invoice } from "@/app/data/invoices";
import type { Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import { useClients } from "@/app/lib/clientsStore";
import { useBookings, updateBooking } from "@/app/lib/bookingsStore";
import { updateInvoice } from "@/app/lib/invoicesStore";
import { useTaxInvoices, addTaxInvoice, nextTaxInvoiceId } from "@/app/lib/taxInvoicesStore";
import { markInvoicePaid } from "@/app/lib/documentActions";
import { getAdminRole, ROLE_PORTAL } from "@/app/lib/auth";
import { useOpenBookingFromDocument, useOpenTaxInvoice } from "@/app/lib/documentNav";
import { useBodyScrollLock } from "@/app/hooks/useBodyScrollLock";
import { addNotification } from "@/app/lib/notificationsStore";
import { thaiBahtText } from "@/app/lib/thaiBahtText";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { MarkPaidForm } from "@/app/components/ui/MarkPaidForm";
import { ReasonForm } from "@/app/components/ui/ReasonForm";
import { ActionModal } from "@/app/components/ui/ActionModal";
import { formatCurrency } from "@/app/data/formatters";
import { CommercialDocument } from "@/app/components/documents/CommercialDocument";

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

// ── Tax invoice issuance — brief §6.1 step 7 ────────────────────────────────
// Not the shared split-screen editor: a tax invoice is derived/confirmed
// from an already-verified invoice, not composed line-by-line from scratch.

// Invoices issued through the §6.2 editor carry their own lineItems/discount
// (so this reconstructs the exact breakdown that produced amountDue). Older
// pre-seeded invoices only ever stored the flat total — back-calculate at
// the standard 7% VAT rate with no discount data available, same approach
// already used for TI-2026-0001's seeded figures.
function computeTaxInvoiceAmounts(invoice: Invoice | undefined) {
  if (!invoice) return { subtotal: 0, discount: 0, vatAmount: 0, totalAmount: 0 };
  if (invoice.lineItems) {
    const subtotal = invoice.lineItems.reduce((s, li) => s + li.amount, 0);
    const discount = invoice.discount ?? 0;
    const afterDiscount = Math.max(0, subtotal - discount);
    const vatAmount = Math.round(afterDiscount * (invoice.vatRate ?? 0.07));
    return { subtotal, discount, vatAmount, totalAmount: afterDiscount + vatAmount };
  }
  const afterDiscount = invoice.amountDue / 1.07;
  const vatAmount = invoice.amountDue - afterDiscount;
  return { subtotal: afterDiscount, discount: 0, vatAmount, totalAmount: invoice.amountDue };
}

// Ops-only: confirms and issues the tax invoice for an already-verified
// (or about-to-be-verified) payment. Moved here from OpsBookingDetailPanel.tsx
// — this is the document's own decision surface now, same as
// Accept/Decline living on QuotationDetail.tsx rather than the booking page.
function TaxInvoiceIssuePanel({
  booking, invoice, client, docNumber, onClose, onIssue,
}: {
  booking: Booking | undefined; invoice: Invoice | undefined; client: ClientAccount | undefined; docNumber: string;
  onClose: () => void; onIssue: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const amounts = computeTaxInvoiceAmounts(invoice);

  return (
    <ActionModal title="Issue Tax Invoice" subtitle={`${docNumber} · ${booking?.id ?? invoice?.bookingId ?? ""}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-bold text-sm">TAX INVOICE</span>
            <span className="text-slate-500">ใบกำกับภาษี</span>
          </div>
          <div className="flex justify-between"><span className="text-slate-500">Seller / ผู้ขาย</span><span className="text-right">FleetCo Operations Co., Ltd.<br /><span className="text-slate-400">Entity registration pending</span></span></div>
          <div className="flex justify-between"><span className="text-slate-500">Buyer / ผู้ซื้อ</span><span className="text-right">{client?.name}<br /><span className="text-slate-400">Tax ID: {client?.taxId}</span></span></div>
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal / ยอดรวม</span><span>{formatCurrency(amounts.subtotal)}</span></div>
            {amounts.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount / ส่วนลด</span><span>−{formatCurrency(amounts.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-slate-500">VAT / ภาษีมูลค่าเพิ่ม (7%)</span><span>{formatCurrency(amounts.vatAmount)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total / ยอดรวมทั้งสิ้น</span><span>{formatCurrency(amounts.totalAmount)}</span></div>
            <p className="text-slate-400 italic pt-1">{thaiBahtText(amounts.totalAmount)}</p>
          </div>
        </div>

        {confirmed ? (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="text-xs text-amber-800">
              {/* Only mentions verifying when there's actually an unverified
                  claim to verify — the fallback entry point (an invoice
                  that's already Paid with no tax invoice yet) has nothing
                  left to verify, so saying so there would be misleading. */}
              {invoice?.status === "Payment Submitted" && "This verifies the payment and "}
              {invoice?.status === "Payment Submitted" ? "issues" : "This issues"} {docNumber}{booking && !booking.isRecurringBilling ? ` and closes out ${booking.id}` : ""}. Tax invoices are immutable
              once issued — corrections happen via a credit note, never by editing this document.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmed(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer">Back</button>
              <button onClick={onIssue} className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer">Confirm &amp; Issue</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmed(true)} className="w-full py-2.5 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer flex items-center justify-center gap-1.5">
            <Check size={13} /> Issue Tax Invoice
          </button>
        )}
      </div>
    </ActionModal>
  );
}

// The primary place an invoice is viewed and, when it's payable, the
// primary place a payment is marked — same role QuotationDetail plays for
// quotations, same A4 document treatment (see that file's comment for why),
// same "routed page, no onClose" shape too. Line items render when the
// invoice carries them (every invoice issued through the §6.2 document
// editor does); older/historical mock invoices only ever had a flat
// amountDue, which alone still fully covers those.
//
// Mark-as-Paid gets a real modal (MarkPaidModal, below), not an inline swap
// under the document — same reasoning as QuotationDetail's DeclineModal:
// the document itself sits in its own fixed-height, internally-scrolling
// frame, so a form appended after it lived inside that same scrollbox,
// requiring a scroll *within* the document viewer — past the whole invoice
// — to reach a form that opened from a button up in the header. A real
// modal decouples the two entirely; it appears where the click happened,
// not wherever the document viewer's scroll position leaves it.
function MarkPaidModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (date: string, reference: string, slipFiles: string[]) => void }) {
  useBodyScrollLock();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <MarkPaidForm onCancel={onCancel} onConfirm={onConfirm} />
      </div>
    </div>
  );
}

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const client = useClients().find((c) => c.id === invoice.clientId);
  const booking = useBookings().find((b) => b.id === invoice.bookingId);
  const openBooking = useOpenBookingFromDocument();
  const openTaxInvoice = useOpenTaxInvoice();
  const role = getAdminRole();
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showRejectPayment, setShowRejectPayment] = useState(false);
  // Reserves its own document number at open-time (nextTaxInvoiceId()) so
  // the number shown throughout the confirm flow stays exactly the one
  // written on Issue.
  const [taxInvoiceDocNumber, setTaxInvoiceDocNumber] = useState<string | null>(null);
  const isClientPortal = role ? ROLE_PORTAL[role] === "client" : false;
  // Both portals can now determine whether a tax invoice already exists —
  // the client uses it to show the "Tax invoice available" link, ops uses
  // it to decide whether "Verify & Issue" or "Issue Tax Invoice" applies.
  const allTaxInvoices = useTaxInvoices();
  const taxInvoice = allTaxInvoices.find((t) => t.invoiceId === invoice.id);
  const payable = invoice.status === "Unpaid" || invoice.status === "Overdue" || invoice.status === "Payment Issue";
  // Brief §2: marking paid sits with Finance (and Approver, who also "views
  // spend dashboards"); FleetCo staff viewing this never gets to act either
  // — it's the client's payment to make. Everyone else still sees the full
  // document read-only.
  const canMarkPaid = role === "client_approver" || role === "client_finance" || role === "client_admin";
  // Ops-side invoice decisions — moved here from OpsBookingDetailPanel.tsx,
  // for the same reason Accept/Decline live on QuotationDetail.tsx: the
  // document itself is the one canonical decision surface, not the booking
  // page. One combined "Verify & Issue Tax Invoice" action (not Verify then
  // a separate later Issue) — brief §6.1 step 7 itself names this as one
  // actor action ("FleetCo... Verifies payment, issues Tax Invoice /
  // Receipt"), and both flow diagrams draw it as a single "Review & Click
  // Issue tax invoice" step. "Issue Tax Invoice" alone is the fallback for
  // an invoice that's already Paid with no tax invoice yet — nothing left
  // to verify there.
  const opsVerifyIssue = !isClientPortal && invoice.status === "Payment Submitted";
  const opsIssueOnly = !isClientPortal && invoice.status === "Paid" && !taxInvoice;

  function handleMarkPaid(date: string, reference: string, slipFiles: string[]) {
    markInvoicePaid(invoice, date, reference, slipFiles);
    setShowMarkPaid(false);
  }

  // Status untouched either way — it never left "Invoiced"/"Active" while
  // the payment was only "submitted", so there's nothing to revert.
  // paymentDate/Reference/SlipFiles are deliberately left as-is, not
  // cleared — they're what the rejected claim actually contained, useful
  // context alongside the reason.
  function handleRejectPayment(reason: string) {
    updateInvoice(invoice.id, { status: "Payment Issue", paymentRejectionReason: reason, updated: nowStamp() });
    setShowRejectPayment(false);
  }

  // Setting status: "Paid" here is safe to run unconditionally — it's also
  // still the only way to fast-track a historical Paid invoice that somehow
  // has no tax invoice yet (the opsIssueOnly fallback), where this is a
  // harmless no-op re-confirmation, not a real transition.
  function handleIssueTaxInvoice() {
    if (!taxInvoiceDocNumber || !booking) return;
    const amounts = computeTaxInvoiceAmounts(invoice);
    const stamp = nowStamp();
    updateInvoice(invoice.id, { status: "Paid" });
    addTaxInvoice({
      id: taxInvoiceDocNumber, invoiceId: invoice.id, bookingId: booking.id, clientId: booking.clientId,
      sellerName: "FleetCo Operations Co., Ltd. (entity name pending)",
      sellerTaxId: "0000000000000",
      sellerAddress: "Registered address pending — FleetCo entity not yet finalized.",
      buyerName: client?.name ?? invoice.clientId,
      buyerTaxId: client?.taxId ?? "",
      buyerAddress: client?.registeredAddress ?? "",
      buyerBranch: client?.branch ?? "",
      subtotal: amounts.subtotal, discount: amounts.discount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount,
      amountInWordsThai: thaiBahtText(amounts.totalAmount),
      issuedAt: stamp, created: stamp,
    });
    // booking.status untouched — one-off or recurring, verifying/billing is
    // a billing-track event, not a rental-track one. See bookings.ts.
    updateBooking(booking.id, { taxInvoiceId: taxInvoiceDocNumber, updated: nowStamp() });
    addNotification({
      eventTypeId: "payment_verified",
      portal: "client",
      recipient: `Thailand Post — ${booking.requestedByName}`,
      bookingId: booking.id,
      message: `Payment verified — tax invoice ${taxInvoiceDocNumber} is available for download.`,
    });
    setTaxInvoiceDocNumber(null);
  }

  // Same split as QuotationDetail's decisionArea — passive status context,
  // not the form itself (that's MarkPaidModal now). Only fires when there's
  // nothing actionable for *this* viewer to do: a payable invoice a
  // non-Finance role can't act on, or a submitted payment still awaiting
  // verification. Paid invoices need no extra confirmation banner. When the
  // viewer *can* act on a payable invoice, the header's own button is
  // enough — no extra message needed alongside it.
  let decisionArea: React.ReactNode = null;
  if (payable && !canMarkPaid) {
    decisionArea = <p className="text-xs text-amber-700 bg-white border border-amber-100 rounded-lg px-3 py-2.5 shadow-sm">Payment due — your finance team can mark this as paid.</p>;
  } else if (!payable && invoice.status === "Payment Submitted" && !opsVerifyIssue) {
    decisionArea = <p className="text-xs text-sky-700 bg-white border border-sky-100 rounded-lg px-3 py-2.5 shadow-sm">Payment submitted — FleetCo finance is verifying it.</p>;
  }

  return (
    <div className="max-w-[1600px]">
      {/* Page header — full width of the page, not squeezed to the
          document's own width (see QuotationDetail's identical header for
          why). Mark-as-Paid (when it applies) gets real button weight as
          the primary action, same treatment as QuotationDetail's
          Accept/Decline pair. Print lives in the toolbar below, not here —
          same split QuotationDetail uses. */}
      <div className="flex items-start justify-between gap-4 mb-5 print:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-semibold text-slate-900 truncate">{invoice.id}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          {/* Doc-type label dropped — see QuotationDetail.tsx's comment on
              the same line; identical redundancy, identical fix. text-xs on
              the button itself (not just this <p>) for the same reason too
              — theme.css's button font-size reset doesn't yield to a size
              class on an ancestor, only on the button itself. */}
          <p className="text-xs text-slate-500 mt-1">
            For <button onClick={() => openBooking(invoice.bookingId)} className="text-xs underline decoration-dotted hover:text-slate-800 cursor-pointer">{invoice.bookingId}</button>
          </p>
          {taxInvoice && (
            <button
              onClick={() => openTaxInvoice(taxInvoice.id)}
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 mt-1.5 cursor-pointer"
            >
              <Receipt size={12} /> Tax invoice available <ArrowRight size={11} />
            </button>
          )}
        </div>
        {payable && canMarkPaid && (
          <button
            onClick={() => setShowMarkPaid(true)}
            className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer shrink-0"
          >
            <ShieldCheck size={13} /> {invoice.status === "Payment Issue" ? "Resubmit Payment" : "Mark as Paid"}
          </button>
        )}
        {(opsVerifyIssue || opsIssueOnly) && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setTaxInvoiceDocNumber(nextTaxInvoiceId())}
              className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer shrink-0"
            >
              <FileCheck2 size={13} /> {opsVerifyIssue ? "Verify & Issue Tax Invoice" : "Issue Tax Invoice"}
            </button>
            {opsVerifyIssue && (
              <button
                onClick={() => setShowRejectPayment(true)}
                className="flex items-center gap-1.5 h-7 px-2.5 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-medium hover:bg-slate-50 cursor-pointer shrink-0"
              >
                <Ban size={11} /> Reject Payment
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rejection-reason banner and decisionArea sit here, in the header —
          not inside the document's own scroll frame below (see MarkPaidModal's
          comment for why that frame is the wrong place for anything a viewer
          needs to actually notice or act on). Shown to every viewer of a
          Payment Issue invoice, not just whoever can act on it — same
          "always visible" behavior this banner already had. Gated on the
          status itself now, not the reason field's mere presence — same
          thing in practice (markInvoicePaid clears the reason the moment a
          fresh claim moves the status off Payment Issue), but the status is
          the more direct signal to read. */}
      {invoice.status === "Payment Issue" && (
        <div className="mb-4 w-full bg-rose-50 border border-rose-100 rounded-lg px-3 py-2.5 text-xs text-rose-700 leading-relaxed">
          <span className="font-semibold">FleetCo couldn't verify your last payment: </span>
          {invoice.paymentRejectionReason}
        </div>
      )}
      {decisionArea && <div className="mb-5 max-w-xl">{decisionArea}</div>}

      {/* Document toolbar — just Print, right-aligned above the scrollable
          frame below rather than inside it (see QuotationDetail's identical
          toolbar for why, including why it's plain text rather than a
          boxed button, and why the id doesn't repeat here). */}
      <div className="flex justify-end mb-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          <Printer size={13} /> Print / Download PDF
        </button>
      </div>

      {/* The document frame — fills the page's own width now, fixed height
          with its own internal scroll (see QuotationDetail's identical
          frame for the full reasoning). */}
      <div className="bg-slate-200 rounded-2xl overflow-hidden print:bg-white print:rounded-none">
        <div className="p-4 sm:p-8 print:p-0 h-[75vh] print:h-auto overflow-y-auto print:overflow-visible">
          <CommercialDocument
            mode="invoice"
            docNumber={invoice.id}
            client={client}
            booking={booking}
            bookingId={invoice.bookingId}
            lineItems={invoice.lineItems ?? []}
            discount={invoice.discount ?? 0}
            vatRate={invoice.vatRate ?? 0.07}
            validUntilOrDue={invoice.dueDate}
            issueDate={invoice.issuedAt}
            fleetcoSignature={invoice.fleetcoSignature}
            amountDueOverride={invoice.amountDue}
            paymentInfo={
              invoice.status === "Payment Submitted" || invoice.status === "Paid"
                ? { date: invoice.paymentDate, reference: invoice.paymentReference, slipFiles: invoice.paymentSlipFiles }
                : undefined
            }
          />
        </div>
      </div>

      {showMarkPaid && <MarkPaidModal onCancel={() => setShowMarkPaid(false)} onConfirm={handleMarkPaid} />}

      {showRejectPayment && (
        <ActionModal title="Reject Payment" subtitle={invoice.id} onClose={() => setShowRejectPayment(false)}>
          <ReasonForm
            title="Reason for rejecting this payment claim"
            placeholder="e.g. amount received doesn't match the invoice, or the reference doesn't match any transaction..."
            confirmLabel="Reject Payment"
            onCancel={() => setShowRejectPayment(false)}
            onConfirm={handleRejectPayment}
          />
        </ActionModal>
      )}

      {taxInvoiceDocNumber && (
        <TaxInvoiceIssuePanel
          booking={booking}
          invoice={invoice}
          client={client}
          docNumber={taxInvoiceDocNumber}
          onClose={() => setTaxInvoiceDocNumber(null)}
          onIssue={handleIssueTaxInvoice}
        />
      )}
    </div>
  );
}
