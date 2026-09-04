import { useEffect, useState } from "react";
import { AlertTriangle, FileCheck2, FileText } from "lucide-react";
import type { Booking } from "@/app/data/bookings";
import { getRateCardEntry, type ClientAccount, type RateCardEntry } from "@/app/data/clients";
import type { QuotationLineItem } from "@/app/data/quotations";
import { formatCurrency } from "@/app/data/formatters";
import { getAdminRole } from "@/app/lib/auth";
import { saveDraft } from "@/app/lib/documentDrafts";
import { useBookings } from "@/app/lib/bookingsStore";
import { useVehicles } from "@/app/lib/vehiclesStore";
import { useDrivers } from "@/app/lib/driversStore";
import { getDriverConflicts, getVehicleConflicts } from "@/app/lib/assignmentConflicts";
import { VAT_RATE, computeDocumentTotals } from "@/app/lib/documentTotals";
import { SignaturePad } from "@/app/components/ui/SignaturePad";
import { DatePicker } from "@/app/components/ui/DatePicker";
import { CommercialDocument } from "@/app/components/documents/CommercialDocument";
import { DocumentWorkspace, EditorSection, IssueFooter } from "@/app/components/documents/DocumentWorkspace";
import { IssueConfirmationModal } from "@/app/components/documents/IssueConfirmationModal";
import { Field, INPUT_CLASS, numberOrEmpty, parseNumber } from "@/app/components/documents/documentFields";

// Composing a document from scratch. The page shell (preview column,
// sidebar card, sticky footer) is DocumentWorkspace.tsx, shared with
// InvoiceIssuanceReview.tsx — see that file for the layout rationale.
//
// Quotations and invoices share this component (an invoice is quite
// literally a "converted" quotation — same shape: line items, discount,
// VAT, remarks, terms, a validity/due date). Tax invoices are handled
// separately (see TaxInvoiceIssuePanel in OpsBookingDetailPanel.tsx)
// because they're derived/confirmed from an already-issued invoice, not
// composed from scratch — nothing here to "type" into a blank line-item
// table. An invoice raised against an accepted quotation doesn't come here
// either: its pricing is locked, so it gets the review panel instead.
//
// Routed page content now (OpsDocumentEditorPage.tsx owns the route, the
// lookup, and the page-level header/Back button) — was a large modal
// (backdrop + rounded panel) rendered inline on the booking page
// underneath. Converted because it was already effectively full-screen in
// practice, and brief §6.2 calls this specific split-screen editor out by
// name as needing real design space ("treat them as branded artifacts"),
// unlike RequestVehicle.tsx's compact request form, which stays a modal —
// see that file's own note on why.
//
// Draft save/restore (saved automatically here, restored via getDraft in
// OpsDocumentEditorPage.tsx) directly resolves the "a reload loses your
// in-progress document" tradeoff this file accepted when the editor stopped
// being a modal.
export type DocMode = "quotation" | "invoice";

function rentalDurationDays(booking: Booking) {
  return Math.round(
    (new Date(`${booking.endDate}T00:00:00`).getTime() - new Date(`${booking.startDate}T00:00:00`).getTime()) / 86400000,
  ) + 1;
}

function getRentalLineItem(booking: Booking, client: ClientAccount | undefined, source?: QuotationLineItem): QuotationLineItem {
  const days = rentalDurationDays(booking);
  const quantityLabel = booking.quantity === 1 ? "vehicle" : "vehicles";
  const unit = "vehicle";
  const rateCardEntry = getRateCardEntry(client, booking.vehicleClassRequested, booking.rentalType);
  const rateCardPeriodPrice = rateCardEntry ? rateCardEntry.pricePerDay * days : 0;
  const quantity = source?.quantity || booking.quantity;
  const unitPrice = source?.unitPrice && source.unitPrice > 0 ? source.unitPrice : rateCardPeriodPrice;

  return {
    // Preserve an edited draft's description and unit. The editor is a
    // single-line rental document today, but those fields are still part of
    // the persisted document contract and must survive a navigation/reload.
    description: source?.description?.trim() || `${booking.vehicleClassRequested} rental - ${quantity} ${quantity === 1 ? "vehicle" : quantityLabel}`,
    vehicleClass: booking.vehicleClassRequested,
    quantity,
    unit: source?.unit || unit,
    unitPrice,
    amount: quantity * unitPrice,
  };
}

function LockedValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-1">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{value}</div>
    </div>
  );
}

function LineItemsEditor({ lineItem, booking, rateCardEntry, onChange }: { lineItem: QuotationLineItem; booking: Booking; rateCardEntry?: RateCardEntry; onChange: (item: QuotationLineItem) => void }) {
  function updatePrice(rawValue: string) {
    const unitPrice = parseNumber(rawValue);
    onChange({ ...lineItem, unitPrice, amount: lineItem.quantity * unitPrice });
  }

  const days = rentalDurationDays(booking);
  const suggestedPeriodPrice = rateCardEntry ? rateCardEntry.pricePerDay * days : 0;

  return (
    <EditorSection title="Rental line item" collapsible>
      <div className="space-y-3">
        <LockedValue label="Vehicle class" value={lineItem.vehicleClass} />
        <LockedValue label="Quantity" value={lineItem.quantity} />
        <Field label="Unit price (THB)" id="quotation-unit-price">
          <input
            id="quotation-unit-price"
            type="number"
            min={0}
            value={numberOrEmpty(lineItem.unitPrice)}
            onChange={(event) => updatePrice(event.target.value)}
            placeholder="Unit price"
            aria-label="Unit price (THB)"
            className={INPUT_CLASS}
          />
          {rateCardEntry ? (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Rate card: {formatCurrency(rateCardEntry.pricePerDay)}/day × {days} days = {formatCurrency(suggestedPeriodPrice)} per vehicle.
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-600">
              No {booking.rentalType} rate is configured for {booking.vehicleClassRequested}. Enter a price manually or add this rate in Client Accounts.
            </p>
          )}
        </Field>
        <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
          <span className="text-[11px] text-slate-500">Line amount</span>
          <span className="text-sm font-semibold text-slate-900">{formatCurrency(lineItem.amount)}</span>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">Set the unit price to update the total.</p>
    </EditorSection>
  );
}

export function DocumentEditor({
  mode, booking, client, docNumber,
  initialLineItems, initialDiscount, initialPaymentTerms, initialValidUntilOrDue, initialRemarks,
  onIssue,
}: {
  mode: DocMode;
  booking: Booking;
  client: ClientAccount | undefined;
  docNumber: string;
  initialLineItems: QuotationLineItem[];
  initialDiscount: number;
  initialPaymentTerms: string;
  initialValidUntilOrDue: string;
  initialRemarks?: string;
  onIssue: (result: { lineItems: QuotationLineItem[]; discount: number; vatRate: number; remarks: string; paymentTerms: string; validUntilOrDue: string; signature: string }) => void;
}) {
  const allBookings = useBookings();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>(() => [getRentalLineItem(booking, client, initialLineItems[0])]);
  const [discount, setDiscount] = useState(initialDiscount);
  const [remarks, setRemarks] = useState(initialRemarks ?? "");
  // Payment terms are managed in Client Accounts. This draft captures the
  // current default for the quotation, but the editor never changes it.
  const [paymentTerms] = useState(initialPaymentTerms);
  const [validUntilOrDue, setValidUntilOrDue] = useState(initialValidUntilOrDue);
  const [signature, setSignature] = useState<string | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);

  const missing: string[] = [];
  if (lineItems.length === 0) missing.push("at least one line item");
  else {
    if (lineItems.some((li) => !li.description.trim())) missing.push("a description on every line item");
    if (lineItems.some((li) => li.unitPrice <= 0)) missing.push("a unit price on every line item");
  }
  if (!validUntilOrDue) missing.push(mode === "quotation" ? "a valid-until date" : "a due date");
  if (!signature) missing.push("your signature");
  const documentLabel = mode === "quotation" ? "Quotation" : "Invoice";
  const dateLabel = mode === "quotation" ? "Valid until" : "Due date";
  const availableVehicleCount = vehicles.filter(
    (vehicle) => vehicle.vehicleClass === booking.vehicleClassRequested && getVehicleConflicts(vehicle, booking, allBookings).length === 0,
  ).length;
  const availableDriverCount = drivers.filter(
    (driver) => getDriverConflicts(driver, booking, allBookings, booking.vehicleClassRequested).length === 0,
  ).length;
  const hasQuotedCapacity = availableVehicleCount >= booking.quantity && availableDriverCount >= booking.quantity;

  const { grandTotal } = computeDocumentTotals(lineItems, discount, VAT_RATE);

  useEffect(() => {
    saveDraft(booking.id, mode, { lineItems, discount, paymentTerms, remarks, validUntilOrDue });
  }, [booking.id, mode, lineItems, discount, paymentTerms, remarks, validUntilOrDue]);

  return (
    <>
      <DocumentWorkspace
        title={mode === "quotation" ? "New Quotation" : "New Invoice"}
        subtitle={`${docNumber} (not yet issued) · For ${client?.name ?? booking.clientId} · ${booking.id}`}
        sidebarWidth={400}
        downloadFilename={`${docNumber}-${mode}.pdf`}
        allowDownload={false}
        stick="preview"
        mobileSidebarFirst
        showLivePreviewLabel={false}
        preview={
          <CommercialDocument
            mode={mode}
            docNumber={docNumber}
            client={client}
            booking={booking}
            bookingId={booking.id}
            lineItems={lineItems}
            discount={discount}
            vatRate={VAT_RATE}
            remarks={remarks}
            paymentTerms={paymentTerms}
            validUntilOrDue={validUntilOrDue}
            fleetcoSignature={signature}
            draft
          />
        }
      >
        {/* Sections run in the order the document is actually built: what
            you're charging for, then the terms around it, then the
            signature that closes it. The total and the Issue button live in
            the pinned footer rather than leading the panel, so no summary
            is ever on screen above the line items it's summarising. */}
        <div className="flex items-center gap-2 p-4">
          <FileText size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Quotation Review</h2>
        </div>

        {mode === "quotation" && !hasQuotedCapacity && (
          <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <p>
              <span className="font-semibold">Availability warning — </span>
              {booking.quantity} requested; {availableVehicleCount} matching vehicle{availableVehicleCount === 1 ? "" : "s"} and {availableDriverCount} compatible driver{availableDriverCount === 1 ? "" : "s"} are currently available. You can still issue this quotation; confirm capacity before assignment.
            </p>
          </div>
        )}

        <LineItemsEditor
          lineItem={lineItems[0] ?? getRentalLineItem(booking, client)}
          booking={booking}
          rateCardEntry={getRateCardEntry(client, booking.vehicleClassRequested, booking.rentalType)}
          onChange={(next) => setLineItems([next])}
        />

        <EditorSection title="Pricing & terms" collapsible>
          <div className="space-y-3">
            <Field label="Discount (THB)" id="quotation-discount">
              <input id="quotation-discount" type="number" min={0} value={numberOrEmpty(discount)} onChange={(e) => setDiscount(parseNumber(e.target.value))} className={INPUT_CLASS} />
            </Field>
            <Field label={dateLabel} id="quotation-valid-until">
              <DatePicker id="quotation-valid-until" value={validUntilOrDue} onChange={setValidUntilOrDue} className={INPUT_CLASS} />
            </Field>
            <Field label="Payment terms">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{paymentTerms}</div>
              <p className="mt-1 text-[11px] text-slate-400">Managed in Client Accounts and captured when this quotation is issued.</p>
            </Field>
            <Field label="Remarks" id="quotation-remarks">
              <textarea id="quotation-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes printed on the document"
                className={`${INPUT_CLASS} resize-none`} />
            </Field>
          </div>
        </EditorSection>

        <EditorSection title="Authorized signature" collapsible defaultOpen={false} required>
          <SignaturePad value={signature} onChange={setSignature} rememberAs={getAdminRole() ?? undefined} />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            Type, draw, or upload a signature. It is remembered on this device and printed on the issued document.
          </p>
        </EditorSection>

        <IssueFooter
          amountLabel={mode === "quotation" ? "Grand total" : "Amount"}
          amount={formatCurrency(grandTotal)}
          missing={missing}
          buttonLabel={`Issue ${documentLabel}`}
          buttonIcon={<FileCheck2 size={14} />}
          onIssue={() => setConfirmIssue(true)}
        />
      </DocumentWorkspace>

      {confirmIssue && (
        <IssueConfirmationModal
          documentLabel={documentLabel}
          docNumber={docNumber}
          amount={formatCurrency(grandTotal)}
          clientName={client?.name ?? "the client"}
          onClose={() => setConfirmIssue(false)}
          onConfirm={() => onIssue({ lineItems: [lineItems[0] ?? getRentalLineItem(booking, client)], discount, vatRate: VAT_RATE, remarks, paymentTerms, validUntilOrDue, signature: signature! })}
        />
      )}
    </>
  );
}
