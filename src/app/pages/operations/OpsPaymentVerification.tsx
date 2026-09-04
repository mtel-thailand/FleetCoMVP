import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Ban, Check, FileQuestion, Hash, Paperclip, ReceiptText, ShieldCheck } from "lucide-react";
import { TaxInvoiceDocument } from "@/app/components/documents/TaxInvoiceDetail";
import { DocumentPreviewFrame } from "@/app/components/documents/DocumentWorkspace";
import { ActionModal } from "@/app/components/ui/ActionModal";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { ReasonForm } from "@/app/components/ui/ReasonForm";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { formatDate } from "@/app/components/ui/utils";
import { formatCurrency } from "@/app/data/formatters";
import { useBookings } from "@/app/lib/bookingsStore";
import { useClients } from "@/app/lib/clientsStore";
import { updateInvoice, useInvoices } from "@/app/lib/invoicesStore";
import { usePageHeader } from "@/app/lib/pageHeaderStore";
import { buildTaxInvoiceRecord, nowStamp, verifyPaymentAndIssueTaxInvoice } from "@/app/lib/taxInvoiceIssuance";
import { nextTaxInvoiceId, useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { toastSuccess } from "@/app/lib/toast";

export function OpsPaymentVerification() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const invoice = useInvoices().find((item) => item.id === id);
  const booking = useBookings().find((item) => item.id === invoice?.bookingId);
  const client = useClients().find((item) => item.id === invoice?.clientId);
  const existingTaxInvoice = useTaxInvoices().find((item) => item.invoiceId === invoice?.id);
  const [docNumber] = useState(() => nextTaxInvoiceId());
  const [previewStamp] = useState(() => nowStamp());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showRejectPayment, setShowRejectPayment] = useState(false);

  usePageHeader(invoice ? "Verify Payment" : undefined, invoice?.id ?? "");

  function returnToInvoice(invoiceId: string) {
    navigate(`/ops/documents/invoices/${invoiceId}`, { replace: true, state: location.state });
  }

  if (!invoice || !booking) {
    return (
      <div className="max-w-2xl bg-white rounded-lg border border-slate-200">
        <EmptyState
          icon={FileQuestion}
          title="Invoice not found"
          subtitle={`${id ?? "This invoice"} cannot be reviewed.`}
          action={{ label: "Go to Invoices", to: "/ops/documents/invoices" }}
        />
      </div>
    );
  }

  if (invoice.status !== "Payment Submitted" || existingTaxInvoice) {
    return (
      <div>
        <button
          onClick={() => returnToInvoice(invoice.id)}
          className="mb-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Invoice
        </button>
        <div className="max-w-2xl bg-white rounded-lg border border-slate-200">
          <EmptyState
            icon={ShieldCheck}
            title="No verification required"
            subtitle={existingTaxInvoice ? `Tax invoice ${existingTaxInvoice.id} has already been issued.` : `This invoice is currently ${invoice.status}.`}
            action={{ label: "View Invoice", to: `/ops/documents/invoices/${invoice.id}` }}
          />
        </div>
      </div>
    );
  }

  const taxInvoicePreview = buildTaxInvoiceRecord({ invoice, booking, client, docNumber, stamp: previewStamp });

  function handleVerifyPayment() {
    verifyPaymentAndIssueTaxInvoice({ invoice: invoice!, booking: booking!, client, docNumber });
    toastSuccess("Payment verified and tax invoice {id} issued.", { id: docNumber });
    returnToInvoice(invoice!.id);
  }

  function handleRejectPayment(reason: string) {
    updateInvoice(invoice!.id, { status: "Payment Issue", paymentRejectionReason: reason, updated: nowStamp() });
    toastSuccess("Payment claim for {id} rejected.", { id: invoice!.id });
    returnToInvoice(invoice!.id);
  }

  return (
    <div className="max-w-[1600px]">
      <button
        onClick={() => returnToInvoice(invoice.id)}
        className="mb-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to Invoice
      </button>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">Review Payment</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{invoice.id} · Tax invoice preview</p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0">
          <DocumentPreviewFrame
            downloadFilename={`${docNumber}-tax-invoice.pdf`}
            allowDownload={false}
            className="rounded-lg p-3 sm:px-6 sm:pb-6 sm:pt-4"
          >
            <TaxInvoiceDocument taxInvoice={taxInvoicePreview} booking={booking} />
          </DocumentPreviewFrame>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center gap-2">
              <ReceiptText size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">Payment Review</h2>
            </div>

            <dl className="space-y-3 text-xs">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Amount</dt>
                <dd className="font-semibold text-slate-900">{formatCurrency(invoice.amountDue)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Payment date</dt>
                <dd className="text-right font-medium text-slate-800">{formatDate(invoice.paymentDate)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="flex items-center gap-1 text-slate-500"><Hash size={12} /> Reference</dt>
                <dd className="max-w-[180px] break-words text-right font-medium text-slate-800">{invoice.paymentReference}</dd>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <dt className="mb-2 flex items-center gap-1 text-slate-500"><Paperclip size={12} /> Payment slips</dt>
                <dd className="space-y-1.5">
                  {invoice.paymentSlipFiles.map((file) => (
                    <div key={file} className="rounded-md bg-slate-50 px-2.5 py-2 text-slate-700 break-all">{file}</div>
                  ))}
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                <span>FleetCo Finance verification</span>
              </div>
              <button
                onClick={() => setShowConfirmation(true)}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--portal-accent)] px-3 text-xs font-medium text-white hover:bg-[var(--portal-accent-hover)] cursor-pointer"
              >
                <Check size={14} /> Verify Payment
              </button>
              <button
                onClick={() => setShowRejectPayment(true)}
                className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <Ban size={14} /> Reject Payment
              </button>
            </div>
          </div>
        </aside>
      </div>

      {showConfirmation && (
        <ActionModal title="Verify Payment" subtitle={invoice.id} onClose={() => setShowConfirmation(false)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-medium text-slate-900">Issue tax invoice {docNumber}?</p>
              <p className="mt-1 leading-relaxed">The invoice will be marked Paid and the tax invoice will become immutable. A verification record will be attached to the issued document.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={() => setShowConfirmation(false)}>Cancel</Button>
              <Button variant="primary" size="md" className="flex-1 px-0 py-2" onClick={handleVerifyPayment}>
                <Check size={13} /> Verify and Issue
              </Button>
            </div>
          </div>
        </ActionModal>
      )}

      {showRejectPayment && (
        <ActionModal title="Reject Payment" subtitle={invoice.id} onClose={() => setShowRejectPayment(false)}>
          <ReasonForm
            title="Reason for rejecting this payment claim"
            placeholder="e.g. amount received does not match the invoice, or the reference does not match any transaction..."
            confirmLabel="Reject Payment"
            onCancel={() => setShowRejectPayment(false)}
            onConfirm={handleRejectPayment}
          />
        </ActionModal>
      )}
    </div>
  );
}
