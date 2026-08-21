import { useEffect, useState } from "react";
import { Plus, Trash2, FileCheck2, Printer } from "lucide-react";
import type { Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import type { QuotationLineItem } from "@/app/data/quotations";
import type { VehicleClass } from "@/app/data/vehicles";
import { formatCurrency } from "@/app/data/formatters";
import { getAdminRole } from "@/app/lib/auth";
import { saveDraft } from "@/app/lib/documentDrafts";
import { SignaturePad } from "@/app/components/ui/SignaturePad";
import { CommercialDocument } from "@/app/components/documents/CommercialDocument";

// brief §6.2: "All three documents share one editor pattern: a single
// screen, form on the left, live A4 preview on the right. What you type is
// what you get." Quotations and invoices share this component (an invoice
// is quite literally a "converted" quotation — same shape: line items,
// discount, VAT, remarks, terms, a validity/due date). Tax invoices are
// handled separately (see TaxInvoiceIssuePanel in OpsBookingDetailPanel.tsx)
// because they're derived/confirmed from an already-issued invoice, not
// composed from scratch — nothing here to "type" into a blank line-item
// table.
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
// Layout compared against FLCCMS's own DocumentEditorPage (a sibling
// project's take on the same brief) and adopted what was genuinely better
// there: a naturally-flowing page with the live preview column pinned via
// `sticky` instead of the fixed `h-[calc(100vh-220px)]` dual-independent-
// scroll container this used to compute — simpler, and doesn't depend on a
// magic-number height guess. Form fields grouped into divided sections
// (divide-y) for the same reason FLCCMS's does — a flat space-y-4 stack
// read as one undifferentiated block. Kept, deliberately, rather than
// copying over: FLCCMS's preview is single-page-only with no overflow
// handling, and uses `transform: scale` (leaves a layout gap where the
// unscaled footprint used to be — see A4Document.tsx's own comment on why
// this uses `zoom` instead); this file's signature capture, which FLCCMS's
// editor has no equivalent step for at all before issuing.
//
// Draft save/restore (saved automatically here, restored via getDraft in
// OpsDocumentEditorPage.tsx) directly resolves the "a reload loses your
// in-progress document" tradeoff this file's own header comment used to
// accept when the editor stopped being a modal.
export type DocMode = "quotation" | "invoice";

const VEHICLE_CLASSES: VehicleClass[] = ["Pickup", "Van", "4-Wheel Truck", "6-Wheel Truck", "Sedan"];
const VAT_RATE = 0.07;
const INPUT_CLASS = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-slate-600";

// Numeric inputs below display "" instead of a literal 0 — a value of 0 is
// still what's stored, but a "0" character sitting in the field is what
// caused the actual bug this replaces: typing into a field that already
// reads "0" can land the new digits on either side of it (e.g. "0500"
// instead of "500") depending on where the cursor lands, since there was
// always a real character there to type around. An empty field has nothing
// to type around.
function numberOrEmpty(n: number): string | number {
  return n === 0 ? "" : n;
}
function parseNumber(raw: string): number {
  return Number(raw) || 0;
}

function LineItemsEditor({ lineItems, onChange }: { lineItems: QuotationLineItem[]; onChange: (items: QuotationLineItem[]) => void }) {
  function update(i: number, patch: Partial<QuotationLineItem>) {
    const next = lineItems.map((li, idx) => {
      if (idx !== i) return li;
      const merged = { ...li, ...patch };
      merged.amount = merged.quantity * merged.unitPrice;
      return merged;
    });
    onChange(next);
  }
  function remove(i: number) {
    onChange(lineItems.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...lineItems, { description: "", vehicleClass: "Pickup", quantity: 1, unit: "day", unitPrice: 0, amount: 0 }]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Line items</p>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          <Plus size={12} /> Add line
        </button>
      </div>
      <div className="space-y-2">
        {lineItems.map((li, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-100 p-2.5">
            <div className="flex items-start gap-2">
              <input
                value={li.description}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="Description (e.g. Van rental with dedicated driver)"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                title="Remove line"
                className="mt-1.5 shrink-0 cursor-pointer text-slate-300 transition-colors hover:text-rose-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <select
                value={li.vehicleClass}
                onChange={(e) => update(i, { vehicleClass: e.target.value as VehicleClass })}
                aria-label="Vehicle class"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
              >
                {VEHICLE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" min={1} value={numberOrEmpty(li.quantity)} onChange={(e) => update(i, { quantity: parseNumber(e.target.value) })} placeholder="Qty" aria-label="Quantity"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
              <input value={li.unit} onChange={(e) => update(i, { unit: e.target.value })} placeholder="Unit"
                aria-label="Unit" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
              <input type="number" min={0} value={numberOrEmpty(li.unitPrice)} onChange={(e) => update(i, { unitPrice: parseNumber(e.target.value) })} placeholder="Unit price" aria-label="Unit price"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div className="text-right text-xs text-slate-500">Line amount: <span className="font-semibold text-slate-700">{formatCurrency(li.amount)}</span></div>
          </div>
        ))}
      </div>
    </div>
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
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>(initialLineItems);
  const [discount, setDiscount] = useState(initialDiscount);
  const [remarks, setRemarks] = useState(initialRemarks ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initialPaymentTerms);
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
  const canIssue = missing.length === 0;
  const documentLabel = mode === "quotation" ? "Quotation" : "Invoice";
  const pageTitle = mode === "quotation" ? "New Quotation" : "New Invoice";

  useEffect(() => {
    saveDraft(booking.id, mode, { lineItems, discount, paymentTerms, remarks, validUntilOrDue });
  }, [booking.id, mode, lineItems, discount, paymentTerms, remarks, validUntilOrDue]);

  return (
    <div className="pb-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">{pageTitle}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {docNumber} (not yet issued) · For {client?.name ?? booking.clientId} · {booking.id}
          </p>
        </div>
        <button
          disabled={!canIssue}
          onClick={() => setConfirmIssue(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--portal-accent)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--portal-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FileCheck2 size={14} /> Issue {documentLabel}
        </button>
      </div>

      {confirmIssue && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-800">
            Issuing locks {docNumber} and notifies {client?.name ?? "the client"}. Corrections require a revised document rather than editing this record.
          </p>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setConfirmIssue(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
              Back
            </button>
            <button
              onClick={() => onIssue({ lineItems, discount, vatRate: VAT_RATE, remarks, paymentTerms, validUntilOrDue, signature: signature! })}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--portal-accent)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--portal-accent-hover)]"
            >
              <FileCheck2 size={13} /> Confirm &amp; Issue {documentLabel}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        {/* Left: the page header above owns document context and issuance;
            the card stays focused on editing fields. */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:mt-5">
          <div className="border-b border-slate-100 px-5 py-4">
            <LineItemsEditor lineItems={lineItems} onChange={setLineItems} />
          </div>

          <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Discount (THB)</label>
              <input type="number" min={0} value={numberOrEmpty(discount)} onChange={(e) => setDiscount(parseNumber(e.target.value))}
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{mode === "quotation" ? "Valid until" : "Due date"}</label>
              <input type="date" value={validUntilOrDue} onChange={(e) => setValidUntilOrDue(e.target.value)}
                className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>Payment terms</label>
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>

          <div className="border-b border-slate-100 px-5 py-4">
            <label className={LABEL_CLASS}>Remarks</label>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes printed on the document"
              className={`${INPUT_CLASS} resize-none`} />
          </div>

          <div className="border-b border-slate-100 px-5 py-4">
            <label className={LABEL_CLASS}>Authorized signature</label>
            <SignaturePad value={signature} onChange={setSignature} rememberAs={getAdminRole() ?? undefined} />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              Type, draw, or upload a signature. It is remembered on this device and printed on the issued document.
            </p>
          </div>

        </div>

        {/* Right: live A4 preview — sticky rather than living inside a
            fixed-height dual-scroll container, so it just follows the page
            as the (potentially long) form scrolls, and un-sticks naturally
            past its own height instead of needing a second, independent
            scrollbar for the form column. Its own max-height + scroll below
            keeps a genuinely long multi-page document from making the
            sticky column itself unwieldy. */}
        <div className="xl:sticky xl:top-4">
          {/* Print/Download PDF is page chrome, not document content, so it
              stays in a compact toolbar above the sheet. */}
          <div className="mb-2 flex items-center justify-end px-1 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <Printer size={13} /> Print / Download PDF
            </button>
          </div>
          <div className="border border-slate-200 rounded-xl bg-slate-100 p-6 max-h-[calc(100vh-140px)] overflow-y-auto print:max-h-none print:overflow-visible print:bg-white print:p-0 print:border-0">
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
          </div>
        </div>
      </div>
    </div>
  );
}
