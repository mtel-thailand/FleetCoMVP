import { useState } from "react";
import { useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import type { Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import type { Quotation, QuotationLineItem } from "@/app/data/quotations";
import { useBookings } from "@/app/lib/bookingsStore";
import { useClients } from "@/app/lib/clientsStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { addQuotation, nextQuotationId } from "@/app/lib/quotationsStore";
import { addInvoice, nextInvoiceId } from "@/app/lib/invoicesStore";
import { updateBooking } from "@/app/lib/bookingsStore";
import { addNotification } from "@/app/lib/notificationsStore";
import { formatCurrency } from "@/app/data/formatters";
import { DocumentEditor, type DocMode } from "@/app/components/documents/DocumentEditor";
import { getDraft, clearDraft } from "@/app/lib/documentDrafts";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useOpenBookingFromDocument } from "@/app/lib/documentNav";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// Routed landing spot for creating a Quotation or Invoice — see
// DocumentEditor.tsx's own header comment for why this moved off of
// OpsBookingDetailPanel's local modal state onto a real route. Owns the
// booking/client lookup (same thin-page shape as every other detail page)
// plus the actual issue-mutation logic, moved here from
// OpsBookingDetailPanel.tsx wholesale since it's this page's own concern
// now, not the booking panel's.
//
// docNumber is reserved once, when this page mounts (nextQuotationId()/
// nextInvoiceId() inside useState's initializer) — same "reserved once,
// stable for the page's life" behavior the old modal's local state gave
// it, just moved up a level.

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return nowStamp().slice(0, 10);
}

// A blank starting line item, pre-filled with what the booking already tells
// us (vehicle class, quantity, rental period) — ops still has to price and
// describe it (canIssue in DocumentEditor requires a non-empty description),
// consistent with every seeded quotation using a hand-written line, not a
// mechanical rate-card × days computation.
function defaultLineItem(booking: Booking): QuotationLineItem {
  const days =
    Math.round(
      (new Date(booking.endDate + "T00:00:00").getTime() - new Date(booking.startDate + "T00:00:00").getTime()) / 86400000,
    ) + 1;
  return {
    description: "",
    vehicleClass: booking.vehicleClassRequested,
    quantity: booking.quantity,
    unit: days > 1 ? `vehicle (${days}-day period)` : "vehicle (1 day)",
    unitPrice: 0,
    amount: 0,
  };
}

// What the split-screen editor starts with, per mode. A saved draft (see
// documentDrafts.ts) wins over both — it means this exact booking+mode was
// already in progress and explicitly saved, so it's a closer match to what
// the user actually wants back than either fresh default below. Absent a
// draft: quotations start blank (from the booking alone); invoices
// "convert" the booking's accepted quotation — same line items and
// discount carried over, since an invoice is that quotation billed, not a
// fresh negotiation (brief §6.1/§6.2).
function editorInitialValues(mode: DocMode, booking: Booking, quotation: Quotation | undefined, client: ClientAccount | undefined) {
  const draft = getDraft(booking.id, mode);
  if (draft) {
    return {
      initialLineItems: draft.lineItems,
      initialDiscount: draft.discount,
      initialPaymentTerms: draft.paymentTerms,
      initialValidUntilOrDue: draft.validUntilOrDue,
      initialRemarks: draft.remarks,
    };
  }
  const paymentTermsDefault = `${client?.billingTerms ?? "Net 30"} from invoice date.`;
  if (mode === "invoice") {
    return {
      initialLineItems: quotation?.lineItems ?? [defaultLineItem(booking)],
      initialDiscount: quotation?.discount ?? 0,
      initialPaymentTerms: quotation?.paymentTerms ?? paymentTermsDefault,
      initialValidUntilOrDue: addDays(today(), client?.creditTermsDays ?? 30),
    };
  }
  return {
    initialLineItems: [defaultLineItem(booking)],
    initialDiscount: 0,
    initialPaymentTerms: paymentTermsDefault,
    initialValidUntilOrDue: addDays(today(), 7),
  };
}

export function OpsDocumentEditorPage({ mode }: { mode: DocMode }) {
  const { id } = useParams<{ id: string }>();
  const bookings = useBookings();
  const clients = useClients();
  const quotations = useQuotations();
  const openBooking = useOpenBookingFromDocument();

  const booking = bookings.find((b) => b.id === id);
  const client = booking ? clients.find((c) => c.id === booking.clientId) : undefined;

  // Reserved once, on mount — see file header comment.
  const [docNumber] = useState(() => (mode === "quotation" ? nextQuotationId() : nextInvoiceId()));

  usePageHeader(booking ? (mode === "quotation" ? "New Quotation" : "New Invoice") : undefined, booking?.id ?? "");

  function goToBooking() {
    if (booking) openBooking(booking.id);
  }

  function handleIssue(result: {
    lineItems: QuotationLineItem[]; discount: number; vatRate: number; remarks: string; paymentTerms: string; validUntilOrDue: string; signature: string;
  }) {
    if (!booking) return;
    const stamp = nowStamp();
    if (mode === "quotation") {
      addQuotation({
        id: docNumber, version: 1, bookingId: booking.id, clientId: booking.clientId,
        lineItems: result.lineItems, discount: result.discount, vatRate: result.vatRate,
        remarks: result.remarks, paymentTerms: result.paymentTerms, validUntil: result.validUntilOrDue,
        status: "Issued", issuedAt: stamp, fleetcoSignature: result.signature, created: stamp, updated: stamp,
      });
      updateBooking(booking.id, { quotationId: docNumber, status: "Quoted", updated: nowStamp() });
      addNotification({
        eventTypeId: "quotation_issued",
        portal: "client",
        recipient: `Thailand Post — ${booking.requestedByName}`,
        bookingId: booking.id,
        message: `Quotation ${docNumber} is ready for your review.`,
      });
      toast.success(`Quotation ${docNumber} issued and sent to ${client?.name ?? "the client"}.`);
    } else {
      const subtotal = result.lineItems.reduce((s, li) => s + li.amount, 0);
      const afterDiscount = Math.max(0, subtotal - result.discount);
      const amountDue = afterDiscount + Math.round(afterDiscount * result.vatRate);
      addInvoice({
        id: docNumber, bookingId: booking.id, quotationId: booking.quotationId ?? "", clientId: booking.clientId,
        isRecurring: booking.isRecurringBilling, amountDue, issuedAt: stamp, dueDate: result.validUntilOrDue,
        status: "Unpaid", paymentDate: null, paymentReference: null, paymentSlipFiles: [],
        created: stamp, updated: stamp,
        lineItems: result.lineItems, discount: result.discount, vatRate: result.vatRate, fleetcoSignature: result.signature,
      });
      // booking.status is never touched here, one-off or recurring — see
      // bookings.ts's invoiceEligible/needsFleetCoAction note. The rental
      // stays at whatever operational status it's actually at (Assigned,
      // Active, or Completed); billing progress lives entirely in this
      // invoice record from here on.
      updateBooking(booking.id, { invoiceId: docNumber, updated: nowStamp() });
      addNotification({
        eventTypeId: "invoice_issued",
        portal: "client",
        recipient: `Thailand Post — ${booking.requestedByName}`,
        bookingId: booking.id,
        message: `Invoice ${docNumber} has been issued — ${formatCurrency(amountDue)} due ${result.validUntilOrDue}.`,
      });
      toast.success(`Invoice ${docNumber} issued and sent to ${client?.name ?? "the client"}.`);
    }
    // The draft's job is done the moment a real, persisted document exists
    // — leaving it would just mean the next quotation/invoice for this same
    // booking+mode (a recurring cycle's next invoice, say) opens pre-filled
    // with a stale draft instead of this fresh issued document's own data.
    clearDraft(booking.id, mode);
    goToBooking();
  }

  return (
    <div>
      <button
        onClick={goToBooking}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 mb-4 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {booking ? (
        <div className="max-w-[1600px]">
          <DocumentEditor
            mode={mode}
            booking={booking}
            client={client}
            docNumber={docNumber}
            {...editorInitialValues(
              mode,
              booking,
              booking.quotationId ? quotations.find((q) => q.id === booking.quotationId) : undefined,
              client,
            )}
            onIssue={handleIssue}
          />
        </div>
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Booking not found"
            subtitle={`${id ?? "This booking"} doesn't exist.`}
            action={{ label: "Go to All Requests", to: "/ops/requests" }}
          />
        </div>
      )}
    </div>
  );
}
