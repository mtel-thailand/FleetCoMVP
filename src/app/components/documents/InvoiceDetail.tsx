import { useState, type ReactNode } from "react";
import { Button } from "@/app/components/ui/Button";
import { useLocation, useNavigate } from "react-router";
import { Receipt, ArrowRight, FileCheck2, FileText, Ban } from "lucide-react";
import type { Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import type { TaxInvoice } from "@/app/data/taxInvoices";
import type { Invoice } from "@/app/data/invoices";
import { formatCurrency } from "@/app/data/formatters";
import { useClients } from "@/app/lib/clientsStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { updateInvoice } from "@/app/lib/invoicesStore";
import { toastSuccess } from "@/app/lib/toast";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { markInvoicePaid } from "@/app/lib/documentActions";
import { getAdminRole, ROLE_PORTAL } from "@/app/lib/auth";
import { useOpenBookingFromDocument, useOpenQuotation, useOpenTaxInvoice } from "@/app/lib/documentNav";
import { invoiceDisplayStatus } from "@/app/data/invoices";
import { nowStamp } from "@/app/lib/taxInvoiceIssuance";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { MarkPaidForm } from "@/app/components/ui/MarkPaidForm";
import { ReasonForm } from "@/app/components/ui/ReasonForm";
import { ActionModal } from "@/app/components/ui/ActionModal";
import { CommercialDocument } from "@/app/components/documents/CommercialDocument";
import {
  DOCUMENT_PREVIEW_FRAME_CLASS,
  DocumentPreviewFrame,
  DocumentWorkspace,
  EditorSection,
} from "@/app/components/documents/DocumentWorkspace";
import { formatDate } from "@/app/components/ui/utils";

// The primary place an invoice is viewed and, when it's payable, the
// primary place a payment is marked — same role QuotationDetail plays for
// quotations, same A4 document treatment (see that file's comment for why),
// same "routed page, no onClose" shape too. Line items render when the
// invoice carries them (every invoice issued through the §6.2 document
// editor does); older/historical mock invoices only ever had a flat
// amountDue, which alone still fully covers those.
//
function InvoicePreview({
  invoice,
  client,
  booking,
  lineItems,
  discount,
  vatRate,
  paymentTerms,
  remarks,
}: {
  invoice: Invoice;
  client: ClientAccount | undefined;
  booking: Booking | undefined;
  lineItems: NonNullable<Invoice["lineItems"]>;
  discount: number;
  vatRate: number;
  paymentTerms: string | undefined;
  remarks: string | undefined;
}) {
  return (
    <CommercialDocument
      mode="invoice"
      docNumber={invoice.id}
      client={client}
      booking={booking}
      bookingId={invoice.bookingId}
      lineItems={lineItems}
      discount={discount}
      vatRate={vatRate}
      validUntilOrDue={invoice.dueDate}
      issueDate={invoice.issuedAt}
      paymentTerms={paymentTerms}
      remarks={remarks}
      fleetcoSignature={invoice.fleetcoSignature}
      amountDueOverride={invoice.amountDue}
      paymentInfo={
        invoice.status === "Payment Submitted" || invoice.status === "Paid"
          ? { date: invoice.paymentDate, reference: invoice.paymentReference, slipFiles: invoice.paymentSlipFiles }
          : undefined
      }
    />
  );
}

function InvoiceReviewRow({ label, value, emphasis = false }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${emphasis ? "font-semibold text-slate-900" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}

function ClientInvoiceReview({
  invoice,
  client,
  booking,
  lineItems,
  discount,
  vatRate,
  paymentTerms,
  remarks,
  payable,
  canMarkPaid,
  taxInvoice,
  onOpenTaxInvoice,
  onSubmitPayment,
}: {
  invoice: Invoice;
  client: ClientAccount | undefined;
  booking: Booking | undefined;
  lineItems: NonNullable<Invoice["lineItems"]>;
  discount: number;
  vatRate: number;
  paymentTerms: string | undefined;
  remarks: string | undefined;
  payable: boolean;
  canMarkPaid: boolean;
  taxInvoice: TaxInvoice | undefined;
  onOpenTaxInvoice: () => void;
  onSubmitPayment: (date: string, reference: string, slipFiles: string[]) => void;
}) {
  const rentalPeriod = booking ? `${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}` : "—";
  const quantity = lineItems.length > 0
    ? lineItems.reduce((sum, item) => sum + item.quantity, 0)
    : booking?.quantity ?? "—";

  return (
    <DocumentWorkspace
      title={invoice.id}
      subtitle={`For ${client?.name ?? invoice.clientId} · ${invoice.bookingId}`}
      sidebarWidth={400}
      downloadFilename={`${invoice.id}.pdf`}
      stick="preview"
      mobileSidebarFirst
      showLivePreviewLabel={false}
      showHeader={false}
      preview={
        <InvoicePreview
          invoice={invoice}
          client={client}
          booking={booking}
          lineItems={lineItems}
          discount={discount}
          vatRate={vatRate}
          paymentTerms={paymentTerms}
          remarks={remarks}
        />
      }
    >
      <div className="flex items-center gap-2 p-4">
        <Receipt size={16} className="text-[var(--portal-accent)]" />
        <h2 className="text-sm font-semibold text-slate-900">Review invoice</h2>
      </div>

      <EditorSection title="Rental details">
        <div className="rounded-lg bg-slate-50 p-3.5">
          <div className="space-y-2.5">
            <InvoiceReviewRow label="Rental period" value={rentalPeriod} />
            <InvoiceReviewRow label="Vehicle class" value={lineItems[0]?.vehicleClass ?? booking?.vehicleClassRequested ?? "—"} />
            <InvoiceReviewRow label="Quantity" value={quantity} />
            <InvoiceReviewRow label="Delivery site" value={booking?.pickupLocation ?? "—"} />
          </div>
        </div>
      </EditorSection>

      <EditorSection title="Amount & terms">
        <div className="rounded-lg bg-slate-50 p-3.5">
          <div className="space-y-2.5">
            <InvoiceReviewRow label="Amount due" value={formatCurrency(invoice.amountDue)} emphasis />
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3 space-y-2.5">
            <InvoiceReviewRow label="Due date" value={formatDate(invoice.dueDate)} />
            <InvoiceReviewRow label="Payment terms" value={paymentTerms ?? "—"} />
          </div>
        </div>
      </EditorSection>

      <EditorSection title="Payment">
        {payable && canMarkPaid ? (
          <MarkPaidForm
            onConfirm={onSubmitPayment}
            submitLabel={invoice.status === "Payment Issue" ? "Resubmit Payment Details" : "Submit Payment Details"}
          />
        ) : (
          <div className="rounded-lg bg-slate-50 p-3.5">
            <div className="space-y-2.5">
              <InvoiceReviewRow label="Status" value={<StatusBadge status={invoiceDisplayStatus(invoice)} />} />
              {invoice.paymentDate && <InvoiceReviewRow label="Payment date" value={formatDate(invoice.paymentDate)} />}
              {invoice.paymentReference && <InvoiceReviewRow label="Reference" value={invoice.paymentReference} />}
            </div>
            {invoice.status === "Payment Issue" && invoice.paymentRejectionReason && (
              <div className="mt-3 border-t border-rose-200 pt-3">
                <p className="mb-1 text-xs font-medium text-rose-700">Payment needs attention</p>
                <p className="text-xs leading-relaxed text-rose-700">{invoice.paymentRejectionReason}</p>
              </div>
            )}
            {invoice.status === "Payment Submitted" && (
              <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">
                Payment submitted and awaiting FleetCo finance verification.
              </p>
            )}
            {payable && !canMarkPaid && (
              <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">
                Submit the bank transfer reference and slip for FleetCo verification.
              </p>
            )}
            {taxInvoice && (
              <button
                type="button"
                onClick={onOpenTaxInvoice}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] cursor-pointer"
              >
                <FileCheck2 size={12} /> View tax invoice <ArrowRight size={11} />
              </button>
            )}
          </div>
        )}
      </EditorSection>
    </DocumentWorkspace>
  );
}

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const navigate = useNavigate();
  const location = useLocation();
  const client = useClients().find((c) => c.id === invoice.clientId);
  const booking = useBookings().find((b) => b.id === invoice.bookingId);
  const sourceQuotation = useQuotations().find((q) => q.id === invoice.quotationId);
  // Older demo invoices predate the detailed document snapshot and only
  // carry the amount due. The accepted quotation is their authoritative
  // source for the same locked line details, which lets the issued view
  // show the rental period without changing the invoice's stored totals.
  const lineItems = invoice.lineItems ?? sourceQuotation?.lineItems ?? [];
  const discount = invoice.discount ?? sourceQuotation?.discount ?? 0;
  const vatRate = invoice.vatRate ?? sourceQuotation?.vatRate ?? 0.07;
  const paymentTerms = invoice.paymentTerms ?? sourceQuotation?.paymentTerms;
  const remarks = invoice.remarks ?? sourceQuotation?.remarks;
  const openBooking = useOpenBookingFromDocument();
  const openQuotation = useOpenQuotation();
  const openTaxInvoice = useOpenTaxInvoice();
  const role = getAdminRole();
  const isClientPortal = role ? ROLE_PORTAL[role] === "client" : false;
  const [showRejectPayment, setShowRejectPayment] = useState(false);
  // Both portals can determine whether a tax invoice already exists so the
  // completed state can link directly to the issued document.
  const allTaxInvoices = useTaxInvoices();
  const taxInvoice = allTaxInvoices.find((t) => t.invoiceId === invoice.id);
  const displayStatus = invoiceDisplayStatus(invoice);
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
    toastSuccess("Payment submitted for {id}.", { id: invoice.id });
  }

  // Status untouched either way — it never left "Invoiced"/"Active" while
  // the payment was only "submitted", so there's nothing to revert.
  // paymentDate/Reference/SlipFiles are deliberately left as-is, not
  // cleared — they're what the rejected claim actually contained, useful
  // context alongside the reason.
  function handleRejectPayment(reason: string) {
    updateInvoice(invoice.id, { status: "Payment Issue", paymentRejectionReason: reason, updated: nowStamp() });
    setShowRejectPayment(false);
    toastSuccess("Payment claim for {id} rejected.", { id: invoice.id });
  }

  // Same split as QuotationDetail's decisionArea — passive status context,
  // not the inline payment form. Only fires when there's
  // nothing actionable for *this* viewer to do: a payable invoice a
  // non-Finance role can't act on, or a submitted payment still awaiting
  // verification. Payment Issue is excluded because its dedicated
  // rejection-reason banner already explains the state. Paid invoices need
  // no extra confirmation banner. When the viewer *can* act on a payable
  // invoice, the header's own button is enough — no extra message needed
  // alongside it.
  let decisionArea: React.ReactNode = null;
  if (payable && !canMarkPaid && invoice.status !== "Payment Issue") {
    decisionArea = <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">Payment details are due — submit the bank transfer reference and slip for FleetCo verification.</p>;
  } else if (!payable && invoice.status === "Payment Submitted" && !opsVerifyIssue) {
    decisionArea = <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs text-sky-700">Payment submitted — FleetCo finance is verifying it.</p>;
  }

  return (
    <div className="max-w-[1600px]">
      {/* Page header — full width of the page, not squeezed to the
          document's own width (see QuotationDetail's identical header for
          why). Mark-as-Paid (when it applies) gets real button weight as
          the primary action, same treatment as QuotationDetail's
          Accept/Decline pair. Download lives inside the document preview
          below, not here — same split QuotationDetail uses. */}
      <div className="flex items-start justify-between gap-4 mb-5 print:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-semibold text-slate-900 truncate">{invoice.id}</h1>
            <StatusBadge status={displayStatus} />
          </div>
          {/* Doc-type label dropped — see QuotationDetail.tsx's comment on
              the same line; identical redundancy, identical fix. text-xs on
              the button itself (not just this <p>) for the same reason too
              — theme.css's button font-size reset doesn't yield to a size
              class on an ancestor, only on the button itself. */}
          <p className="text-xs text-slate-500 mt-1">
            For <button onClick={() => openBooking(invoice.bookingId)} className="text-xs underline decoration-dotted hover:text-slate-800 cursor-pointer">{invoice.bookingId}</button>
          </p>
          {taxInvoice && !isClientPortal && (
            <button
              onClick={() => openTaxInvoice(taxInvoice.id)}
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 mt-1.5 cursor-pointer"
            >
              <FileCheck2 size={12} /> Tax invoice available <ArrowRight size={11} />
            </button>
          )}
          {sourceQuotation && (
            <button
              onClick={() => openQuotation(sourceQuotation.id)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 mt-1.5 cursor-pointer"
            >
              <FileText size={12} /> Source quotation {sourceQuotation.id} <ArrowRight size={11} />
            </button>
          )}
        </div>
        {opsVerifyIssue && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="primary" size="toolbar" className="shrink-0"
              onClick={() => navigate(`/ops/documents/invoices/${invoice.id}/verify`, { state: location.state })}
            >
              <FileCheck2 size={13} /> Verify Payment
            </Button>
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
          not inside the document's own scroll frame below. Shown to every
          viewer of a
          Payment Issue invoice, not just whoever can act on it — same
          "always visible" behavior this banner already had. Gated on the
          status itself now, not the reason field's mere presence — same
          thing in practice (markInvoicePaid clears the reason the moment a
          fresh claim moves the status off Payment Issue), but the status is
          the more direct signal to read. */}
      {!isClientPortal && invoice.status === "Payment Issue" && (
        <div className="mb-4 w-full bg-rose-50 border border-rose-100 rounded-lg px-3 py-2.5 text-xs text-rose-700 leading-relaxed">
          <span className="font-semibold">FleetCo couldn't verify your last payment: </span>
          {invoice.paymentRejectionReason}
        </div>
      )}
      {!isClientPortal && decisionArea && <div className="mb-5 w-full">{decisionArea}</div>}

      {isClientPortal ? (
        <ClientInvoiceReview
          invoice={invoice}
          client={client}
          booking={booking}
          lineItems={lineItems}
          discount={discount}
          vatRate={vatRate}
          paymentTerms={paymentTerms}
          remarks={remarks}
          payable={payable}
          canMarkPaid={canMarkPaid}
          taxInvoice={taxInvoice}
          onOpenTaxInvoice={() => taxInvoice && openTaxInvoice(taxInvoice.id)}
          onSubmitPayment={handleMarkPaid}
        />
      ) : (
        <DocumentPreviewFrame downloadFilename={`${invoice.id}.pdf`} className={DOCUMENT_PREVIEW_FRAME_CLASS}>
          <InvoicePreview
            invoice={invoice}
            client={client}
            booking={booking}
            lineItems={lineItems}
            discount={discount}
            vatRate={vatRate}
            paymentTerms={paymentTerms}
            remarks={remarks}
          />
        </DocumentPreviewFrame>
      )}

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
