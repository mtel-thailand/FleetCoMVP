import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Check, FileCheck2, LockKeyhole, ReceiptText } from "lucide-react";
import type { Booking } from "@/app/data/bookings";
import { getPaymentTermsDays, type ClientAccount } from "@/app/data/clients";
import type { Quotation, QuotationLineItem } from "@/app/data/quotations";
import { formatCurrency } from "@/app/data/formatters";
import { CommercialDocument } from "@/app/components/documents/CommercialDocument";
import { DocumentPreviewFrame } from "@/app/components/documents/DocumentWorkspace";
import { ActionModal } from "@/app/components/ui/ActionModal";
import { saveDraft } from "@/app/lib/documentDrafts";

const INPUT_CLASS = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-slate-600";

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

interface InvoiceIssueResult {
  lineItems: QuotationLineItem[];
  discount: number;
  vatRate: number;
  remarks: string;
  paymentTerms: string;
  validUntilOrDue: string;
}

export function InvoiceIssuanceReview({
  booking,
  client,
  quotation,
  docNumber,
  initialPaymentTerms,
  initialValidUntilOrDue,
  initialRemarks,
  onIssue,
}: {
  booking: Booking;
  client: ClientAccount | undefined;
  quotation: Quotation;
  docNumber: string;
  initialPaymentTerms: string;
  initialValidUntilOrDue: string;
  initialRemarks?: string;
  onIssue: (result: InvoiceIssueResult) => void;
}) {
  // The invoice is created from the accepted quotation, so its commercial
  // terms are inherited here and cannot diverge from the agreed document.
  const paymentTerms = initialPaymentTerms;
  const dueDate = initialValidUntilOrDue;
  const [remarks, setRemarks] = useState(initialRemarks ?? "");
  const [showConfirmation, setShowConfirmation] = useState(false);

  const lineItems = useMemo(() => quotation.lineItems.map((item) => ({ ...item })), [quotation.lineItems]);
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const afterDiscount = Math.max(0, subtotal - quotation.discount);
  const amountDue = afterDiscount + Math.round(afterDiscount * quotation.vatRate);
  const canIssue = lineItems.length > 0 && lineItems.every((item) => item.description.trim() && item.unitPrice > 0) && !!dueDate;

  useEffect(() => {
    saveDraft(booking.id, "invoice", {
      lineItems,
      discount: quotation.discount,
      paymentTerms,
      remarks,
      validUntilOrDue: dueDate,
    });
  }, [booking.id, dueDate, lineItems, paymentTerms, quotation.discount, remarks]);

  function issueInvoice() {
    onIssue({
      lineItems: lineItems.map((item) => ({ ...item })),
      discount: quotation.discount,
      vatRate: quotation.vatRate,
      remarks,
      paymentTerms,
      validUntilOrDue: dueDate,
    });
  }

  return (
    <div className="pb-4">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-slate-900">Review Invoice</h1>
        <p className="mt-1 text-xs text-slate-500">{docNumber} · Source quotation {quotation.id}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <DocumentPreviewFrame
          downloadFilename={`${docNumber}-invoice.pdf`}
          allowDownload={false}
          className="order-2 min-w-0 rounded-lg p-3 sm:px-6 sm:pb-6 sm:pt-4 xl:order-1"
        >
          <CommercialDocument
            mode="invoice"
            docNumber={docNumber}
            client={client}
            booking={booking}
            bookingId={booking.id}
            lineItems={lineItems}
            discount={quotation.discount}
            vatRate={quotation.vatRate}
            remarks={remarks}
            paymentTerms={paymentTerms}
            validUntilOrDue={dueDate}
            draft
          />
        </DocumentPreviewFrame>

        <aside className="order-1 space-y-4 xl:order-2 xl:sticky xl:top-20">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center gap-2">
              <ReceiptText size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">Invoice Review</h2>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <LockKeyhole size={14} className="mt-0.5 shrink-0" />
              <span>Pricing and line items are locked to accepted quotation {quotation.id}.</span>
            </div>

            <dl className="space-y-3 border-b border-slate-100 pb-4 text-xs">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Source quotation</dt>
                <dd className="font-medium text-slate-800">{quotation.id}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Line items</dt>
                <dd className="font-medium text-slate-800">{lineItems.length}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Amount due</dt>
                <dd className="font-semibold text-slate-900">{formatCurrency(amountDue)}</dd>
              </div>
            </dl>

            <div className="space-y-3 pt-4">
              <div>
                <label className={LABEL_CLASS}>Due date</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">{formatDate(dueDate)}</div>
                <p className="mt-1 text-[11px] text-slate-400">Calculated from the invoice issue date + {getPaymentTermsDays(paymentTerms)} days.</p>
              </div>
              <div>
                <label className={LABEL_CLASS}>Payment terms</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">{paymentTerms}</div>
                <p className="mt-1 text-[11px] text-slate-400">Inherited from accepted quotation {quotation.id}.</p>
              </div>
              <div>
                <label className={LABEL_CLASS}>Remarks</label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Optional notes printed on the invoice"
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>
            </div>

            <button
              disabled={!canIssue}
              onClick={() => setShowConfirmation(true)}
              className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--portal-accent)] px-3 text-xs font-medium text-white hover:bg-[var(--portal-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <FileCheck2 size={14} /> Issue Invoice
            </button>
          </div>
        </aside>
      </div>

      {showConfirmation && (
        <ActionModal title="Issue Invoice" subtitle={docNumber} onClose={() => setShowConfirmation(false)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-medium text-slate-900">Issue invoice for {formatCurrency(amountDue)}?</p>
              <p className="mt-1 leading-relaxed">The invoice will be locked to quotation {quotation.id} and sent to {client?.name ?? "the client"}. Corrections require a revised document.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={() => setShowConfirmation(false)}>Cancel</Button>
              <Button variant="primary" size="md" className="flex-1 px-0 py-2" onClick={issueInvoice}>
                <Check size={13} /> Confirm and Issue
              </Button>
            </div>
          </div>
        </ActionModal>
      )}
    </div>
  );
}
