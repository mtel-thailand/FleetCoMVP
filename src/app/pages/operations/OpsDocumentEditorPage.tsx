import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { translate } from "@/app/i18n";
import { bookingInvoices, bookingQuotations, bookingTaxInvoices, invoiceEligible, type Booking } from "@/app/data/bookings";
import { getClientPaymentDays, getClientPaymentTerms, getPaymentTermsDays, type ClientAccount } from "@/app/data/clients";
import { isQuotationExpired, type Quotation, type QuotationLineItem } from "@/app/data/quotations";
import { useBookings } from "@/app/lib/bookingsStore";
import { useClients } from "@/app/lib/clientsStore";
import { addQuotation, nextQuotationId, updateQuotation, useQuotations } from "@/app/lib/quotationsStore";
import { addInvoice, nextInvoiceId, useInvoices } from "@/app/lib/invoicesStore";
import { updateBooking } from "@/app/lib/bookingsStore";
import { addNotification } from "@/app/lib/notificationsStore";
import { formatCurrency } from "@/app/data/formatters";
import { DocumentEditor, type DocMode } from "@/app/components/documents/DocumentEditor";
import { InvoiceIssuanceReview } from "@/app/components/documents/InvoiceIssuanceReview";
import { getDraft, clearDraft } from "@/app/lib/documentDrafts";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { usePageHeader } from "@/app/lib/pageHeaderStore";
import { addCalendarDays, demoNowStamp } from "@/app/data/demoDates";

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
  return demoNowStamp();
}

function addDays(dateStr: string, days: number): string {
  return addCalendarDays(dateStr, days);
}

function today(): string {
  return nowStamp().slice(0, 10);
}

// A blank starting line item, pre-filled with what the booking already tells
// us (vehicle class, quantity, rental period) — ops still has to price it,
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
  const paymentTermsDefault = getClientPaymentTerms(client);
  if (mode === "invoice") {
    const invoicePaymentTerms = quotation?.paymentTerms ?? draft?.paymentTerms ?? paymentTermsDefault;
    return {
      initialLineItems: quotation?.lineItems ?? [defaultLineItem(booking)],
      initialDiscount: quotation?.discount ?? 0,
      initialPaymentTerms: invoicePaymentTerms,
      initialValidUntilOrDue: addDays(today(), getPaymentTermsDays(invoicePaymentTerms)),
      initialRemarks: draft?.remarks ?? quotation?.remarks ?? "",
    };
  }
  if (draft) {
    return {
      initialLineItems: draft.lineItems,
      initialDiscount: draft.discount,
      initialPaymentTerms: paymentTermsDefault,
      initialValidUntilOrDue: draft.validUntilOrDue,
      initialRemarks: draft.remarks,
    };
  }
  if (quotation) {
    return {
      initialLineItems: quotation.lineItems,
      initialDiscount: quotation.discount,
      initialPaymentTerms: paymentTermsDefault,
      initialValidUntilOrDue: addDays(today(), 7),
      initialRemarks: quotation.remarks,
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
  const navigate = useNavigate();
  const location = useLocation();
  const bookings = useBookings();
  const clients = useClients();
  const quotations = useQuotations();
  const invoices = useInvoices();
  const taxInvoices = useTaxInvoices();

  const booking = bookings.find((b) => b.id === id);
  const client = booking ? clients.find((c) => c.id === booking.clientId) : undefined;
  const quotationsForBooking = booking ? bookingQuotations(booking.id, quotations) : [];
  const latestQuotation = quotationsForBooking[0];
  const sourceQuotation = quotationsForBooking.find((quotation) => quotation.status === "Accepted");
  const invoicesForBooking = booking ? bookingInvoices(booking.id, invoices) : [];
  const latestInvoice = invoicesForBooking[0];
  const latestInvoiceHasTaxInvoice = !!latestInvoice && !!booking && bookingTaxInvoices(booking.id, taxInvoices).some((taxInvoice) => taxInvoice.invoiceId === latestInvoice.id);
  const canReviseExpiredQuotation = !!booking && booking.status === "Quoted" && !!latestQuotation && isQuotationExpired(latestQuotation) && booking.startDate >= today();
  const canCreateQuotation = !!booking && (
    booking.status === "Requested" ||
    canReviseExpiredQuotation
  );
  const canCreateInvoice = !!booking && !!sourceQuotation && invoiceEligible(booking) && (
    !latestInvoice || (booking.isRecurringBilling && latestInvoice.status === "Paid" && latestInvoiceHasTaxInvoice)
  );
  const origin = location.state as { navPath?: string; returnTo?: string; returnLabel?: string; returnState?: unknown } | null;
  const returnTo = origin?.returnTo?.startsWith("/ops/") ? origin.returnTo : undefined;

  // Reserved once, on mount — see file header comment.
  const [docNumber] = useState(() => (mode === "quotation" ? nextQuotationId() : nextInvoiceId()));

  usePageHeader(booking ? (mode === "quotation" ? "New Quotation" : "New Invoice") : undefined, booking?.id ?? "");

  function goToBooking() {
    if (booking) navigate(`/ops/bookings/${booking.id}`);
  }

  function goBack() {
    if (returnTo) {
      navigate(returnTo, { state: origin?.returnState });
      return;
    }
    goToBooking();
  }

  function handleIssue(result: {
    lineItems: QuotationLineItem[]; discount: number; vatRate: number; remarks: string; paymentTerms: string; validUntilOrDue: string; signature?: string;
  }) {
    if (!booking) return;
    const stamp = nowStamp();
    const paymentTerms = mode === "quotation" ? getClientPaymentTerms(client) : result.paymentTerms;
    const issuedDueDate = mode === "invoice"
      ? addDays(stamp.slice(0, 10), getPaymentTermsDays(paymentTerms))
      : result.validUntilOrDue;
    if (mode === "quotation") {
      const currentQuotation = bookingQuotations(booking.id, quotations)[0];
      const canIssue = booking.status === "Requested" || (
        booking.status === "Quoted" &&
        !!currentQuotation &&
        isQuotationExpired(currentQuotation) &&
        booking.startDate >= today()
      );
      if (!canIssue) {
        toast.error(translate("This booking is not ready for a new quotation."));
        return;
      }
      if (currentQuotation && currentQuotation.status !== "Superseded") {
        updateQuotation(currentQuotation.id, { status: "Superseded", updated: stamp });
      }
      addQuotation({
        id: docNumber, version: (currentQuotation?.version ?? 0) + 1, bookingId: booking.id, clientId: booking.clientId,
        lineItems: result.lineItems, discount: result.discount, vatRate: result.vatRate,
        remarks: result.remarks, paymentTerms, validUntil: issuedDueDate,
        status: "Issued", issuedAt: stamp, fleetcoSignature: result.signature, created: stamp, updated: stamp,
      });
      updateBooking(booking.id, { quotationId: docNumber, status: "Quoted", updated: nowStamp() });
      addNotification({
        eventTypeId: "quotation_issued",
        portal: "client",
        recipient: `${client?.name ?? booking.clientId} — ${booking.requestedByName}`,
        bookingId: booking.id,
        message: `Quotation ${docNumber} is ready for your review.`,
      });
      toast.success(translate("Quotation {docNumber} issued and sent to {client}.", { docNumber, client: client?.name ?? translate("the client") }));
    } else {
      const currentInvoices = bookingInvoices(booking.id, invoices);
      const currentLatestInvoice = currentInvoices[0];
      const currentHasTaxInvoice = !!currentLatestInvoice && bookingTaxInvoices(booking.id, taxInvoices).some((taxInvoice) => taxInvoice.invoiceId === currentLatestInvoice.id);
      const canIssue = !!sourceQuotation && invoiceEligible(booking) && (
        !currentLatestInvoice || (booking.isRecurringBilling && currentLatestInvoice.status === "Paid" && currentHasTaxInvoice)
      );
      if (!canIssue) {
        toast.error(translate("This invoice cycle is not ready to be issued."));
        return;
      }
      const subtotal = result.lineItems.reduce((s, li) => s + li.amount, 0);
      const afterDiscount = Math.max(0, subtotal - result.discount);
      const amountDue = afterDiscount + Math.round(afterDiscount * result.vatRate);
      addInvoice({
        id: docNumber, bookingId: booking.id, quotationId: sourceQuotation?.id ?? "", clientId: booking.clientId,
        isRecurring: booking.isRecurringBilling, amountDue, issuedAt: stamp, dueDate: issuedDueDate,
        status: "Unpaid", paymentDate: null, paymentReference: null, paymentSlipFiles: [],
        created: stamp, updated: stamp,
        lineItems: result.lineItems, discount: result.discount, vatRate: result.vatRate,
        paymentTerms, remarks: result.remarks,
        fleetcoSignature: result.signature || undefined,
      });
      // booking.status is never touched here, one-off or recurring — see
      // bookings.ts's invoiceEligible/needsFleetCoAction note. The rental
      // stays at whatever operational status it's actually at (Assigned,
      // Active, or Completed); billing progress lives entirely in this
      // invoice record from here on.
      updateBooking(booking.id, {
        invoiceId: docNumber,
        ...(sourceQuotation ? { quotationId: sourceQuotation.id } : {}),
        updated: nowStamp(),
      });
      addNotification({
        eventTypeId: "invoice_issued",
        portal: "client",
        recipient: `${client?.name ?? booking.clientId} — ${booking.requestedByName}`,
        bookingId: booking.id,
        message: `Invoice ${docNumber} has been issued — ${formatCurrency(amountDue)} due ${issuedDueDate}.`,
      });
      toast.success(translate("Invoice {docNumber} issued and sent to {client}.", { docNumber, client: client?.name ?? translate("the client") }));
    }
    // The draft's job is done the moment a real, persisted document exists
    // — leaving it would just mean the next quotation/invoice for this same
    // booking+mode (a recurring cycle's next invoice, say) opens pre-filled
    // with a stale draft instead of this fresh issued document's own data.
    clearDraft(booking.id, mode);
    if (returnTo) navigate(returnTo, { state: origin?.returnState });
    else goToBooking();
  }

  return (
    <div>
      <Button variant="ghost" size="icon" className="flex items-center gap-1.5 text-xs mb-4"
        onClick={goBack}
      >
        <ArrowLeft size={14} /> {origin?.returnLabel ? `Back to ${origin.returnLabel}` : "Back to Booking"}
      </Button>

      {booking ? (
        <div className="max-w-[1600px]">
          {mode === "invoice" ? (
            canCreateInvoice ? (
              <InvoiceIssuanceReview
                booking={booking}
                client={client}
                quotation={sourceQuotation}
                docNumber={docNumber}
                {...editorInitialValues(mode, booking, sourceQuotation, client)}
                onIssue={handleIssue}
              />
            ) : (
              <div className="max-w-2xl rounded-lg border border-slate-200 bg-white">
                <EmptyState
                  icon={FileQuestion}
                  title={!sourceQuotation ? "Accepted quotation required" : "Invoice cycle not ready"}
                  subtitle={!sourceQuotation ? "An invoice can only be generated from the booking's accepted quotation." : "A previous invoice is still awaiting payment, verification, or its tax invoice."}
                  action={{ label: "Back to Booking", to: `/ops/bookings/${booking.id}` }}
                />
              </div>
            )
          ) : (
            canCreateQuotation ? (
              <DocumentEditor
                mode={mode}
                booking={booking}
                client={client}
                docNumber={docNumber}
                {...editorInitialValues(mode, booking, latestQuotation, client)}
                onIssue={handleIssue}
              />
            ) : (
              <div className="max-w-2xl rounded-lg border border-slate-200 bg-white">
                <EmptyState
                  icon={FileQuestion}
                  title="Quotation not ready to be issued"
                  subtitle="Create a quotation from a request, or issue a revision while an expired quotation still has a viable rental date."
                  action={{ label: "Back to Booking", to: `/ops/bookings/${booking.id}` }}
                />
              </div>
            )
          )}
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
