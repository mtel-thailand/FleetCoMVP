import { useState } from "react";
import { useNavigate } from "react-router";
import { Printer, ShieldCheck, Receipt, ArrowRight, FileCheck2, Ban } from "lucide-react";
import type { Invoice } from "@/app/data/invoices";
import { useClients } from "@/app/lib/clientsStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { updateInvoice } from "@/app/lib/invoicesStore";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { markInvoicePaid } from "@/app/lib/documentActions";
import { getAdminRole, ROLE_PORTAL } from "@/app/lib/auth";
import { useOpenBookingFromDocument, useOpenTaxInvoice } from "@/app/lib/documentNav";
import { useBodyScrollLock } from "@/app/hooks/useBodyScrollLock";
import { nowStamp } from "@/app/lib/taxInvoiceIssuance";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { MarkPaidForm } from "@/app/components/ui/MarkPaidForm";
import { ReasonForm } from "@/app/components/ui/ReasonForm";
import { ActionModal } from "@/app/components/ui/ActionModal";
import { CommercialDocument } from "@/app/components/documents/CommercialDocument";

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
  const navigate = useNavigate();
  const client = useClients().find((c) => c.id === invoice.clientId);
  const booking = useBookings().find((b) => b.id === invoice.bookingId);
  const openBooking = useOpenBookingFromDocument();
  const openTaxInvoice = useOpenTaxInvoice();
  const role = getAdminRole();
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showRejectPayment, setShowRejectPayment] = useState(false);
  const isClientPortal = role ? ROLE_PORTAL[role] === "client" : false;
  // Both portals can determine whether a tax invoice already exists so the
  // completed state can link directly to the issued document.
  const allTaxInvoices = useTaxInvoices();
  const taxInvoice = allTaxInvoices.find((t) => t.invoiceId === invoice.id);
  const payable = invoice.status === "Unpaid" || invoice.status === "Overdue" || invoice.status === "Payment Issue";
  // Brief §2: marking paid sits with Finance (and Approver, who also "views
  // spend dashboards"); FleetCo staff viewing this never gets to act either
  // — it's the client's payment to make. Everyone else still sees the full
  // document read-only.
  const canMarkPaid = role === "client_approver" || role === "client_finance" || role === "client_admin";
  // Ops verification starts here but runs on its dedicated review page,
  // where payment evidence and the generated tax invoice can be compared
  // before one final confirmation. Verification and issuance remain one
  // atomic action, so a Paid invoice never needs a second issuance step.
  const opsVerifyIssue = !isClientPortal && invoice.status === "Payment Submitted";

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
        {opsVerifyIssue && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => navigate(`/ops/documents/invoices/${invoice.id}/verify`)}
              className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer shrink-0"
            >
              <FileCheck2 size={13} /> Verify Payment
            </button>
            {opsVerifyIssue && (
              <button
                onClick={() => setShowRejectPayment(true)}
                className="flex items-center gap-1.5 h-8 px-3 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer shrink-0"
              >
                <Ban size={13} /> Reject Payment
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

    </div>
  );
}
