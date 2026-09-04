import { useState, type ReactNode } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { toast } from "sonner";
import { translate } from "@/app/i18n";
import { Check, Ban, FileText } from "lucide-react";
import type { Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import { isQuotationExpired, quotationDisplayStatus, quotationTotals, type Quotation } from "@/app/data/quotations";
import { formatCurrency } from "@/app/data/formatters";
import { useClients } from "@/app/lib/clientsStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { acceptQuotation, declineQuotation } from "@/app/lib/documentActions";
import { getAdminRole, ROLE_PORTAL } from "@/app/lib/auth";
import { useOpenBookingFromDocument } from "@/app/lib/documentNav";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { ReasonForm } from "@/app/components/ui/ReasonForm";
import { SignaturePad } from "@/app/components/ui/SignaturePad";
import { CommercialDocument } from "@/app/components/documents/CommercialDocument";
import {
  DOCUMENT_PREVIEW_FRAME_CLASS,
  DocumentPreviewFrame,
  DocumentWorkspace,
  EditorSection,
} from "@/app/components/documents/DocumentWorkspace";
import { formatDate } from "@/app/components/ui/utils";

// The primary place a quotation is viewed and, when it's still pending, the
// primary place it's decided — reachable directly (a routed
// /documents/quotations/:id page, both portals) or via a cross-page handoff
// from a booking's own Documents list (useOpenQuotation, which navigates
// straight here). Rendered as the actual A4 document (same
// letterhead/table/totals layout as DocumentEditor's live A4Preview on the
// issuing side, and what "Download PDF" produces), because deciding
// on a quotation without seeing that was the point of building this view in
// the first place.
//
// Accept/Decline also live on the Booking Detail page as a quick action —
// both call the exact same acceptQuotation/declineQuotation (documentActions.ts),
// so there's one implementation of the decision even though there are two
// places to make it. No onClose here — this is a routed page now, not a
// modal — Decline is the one exception, deliberately: unlike Cancel Booking
// or Reject Request/Payment (which swap ReasonForm in for its trigger
// button, in place, elsewhere in this app), Decline sits above a full A4
// document the client may still want to read while deciding, so it gets a
// real modal (DeclineModal, below) instead of competing with that document
// for space. Accept doesn't need any of this: once accepted, this document
// is just a static record with nothing left to do here, while the booking
// it belongs to just changed in a way worth seeing (status badge, Case
// Timeline, which nav section it now lives under) — so it navigates back to
// the booking rather than leaving the client staring at an inert "no longer
// be actioned" document.

// Scroll locking used to be a hand-rolled useBodyScrollLock() call here (and
// in every other overlay) — without it the page, or the document's own
// internal scrollbox below, stays scrollable underneath the backdrop. Modal
// now gets that from Radix, which additionally compensates for scrollbar
// width so opening this no longer nudges the page sideways.
//
// No *visible* modal-level heading here — ReasonForm's own label already
// reads as one ("Reason for declining"), and a second heading above it would
// just repeat that. The `title` prop below is the screen-reader-only name
// Radix requires, so assistive tech still announces the dialog by that label.
function DeclineModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  return (
    <Modal onClose={onCancel} overlayClassName="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" contentClassName="w-full max-w-md rounded-xl shadow-2xl" title="Reason for declining">
        <ReasonForm
          title="Reason for declining"
          placeholder="Let FleetCo know why, so they can revise the quotation..."
          confirmLabel="Confirm Decline"
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </Modal>
  );
}

function ReviewRow({ label, value, emphasis = false }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${emphasis ? "font-semibold text-slate-900" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}

function QuotationPreview({ quotation, client, booking, clientSignature }: {
  quotation: Quotation;
  client: ClientAccount | undefined;
  booking: Booking | undefined;
  clientSignature?: string | null;
}) {
  return (
    <CommercialDocument
      mode="quotation"
      docNumber={quotation.id}
      client={client}
      booking={booking}
      bookingId={quotation.bookingId}
      lineItems={quotation.lineItems}
      discount={quotation.discount}
      vatRate={quotation.vatRate}
      remarks={quotation.remarks}
      paymentTerms={quotation.paymentTerms}
      validUntilOrDue={quotation.validUntil}
      issueDate={quotation.issuedAt}
      version={quotation.version}
      fleetcoSignature={quotation.fleetcoSignature}
      clientSignature={clientSignature}
    />
  );
}

function ClientQuotationReview({
  quotation,
  client,
  booking,
  isPending,
  isExpired,
  canDecide,
  role,
  signature,
  onSignatureChange,
  onDecline,
  onAccept,
}: {
  quotation: Quotation;
  client: ClientAccount | undefined;
  booking: Booking | undefined;
  isPending: boolean;
  isExpired: boolean;
  canDecide: boolean;
  role: ReturnType<typeof getAdminRole>;
  signature: string | null;
  onSignatureChange: (value: string | null) => void;
  onDecline: () => void;
  onAccept: () => void;
}) {
  const { grandTotal } = quotationTotals(quotation);
  const rentalPeriod = booking ? `${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}` : "—";
  const deliverySite = booking?.pickupLocation ?? "—";

  return (
    <DocumentWorkspace
      title={quotation.id}
      subtitle={`For ${client?.name ?? quotation.clientId} · ${quotation.bookingId}`}
      sidebarWidth={400}
      downloadFilename={`${quotation.id}.pdf`}
      stick="preview"
      mobileSidebarFirst
      showLivePreviewLabel={false}
      showHeader={false}
      preview={<QuotationPreview quotation={quotation} client={client} booking={booking} clientSignature={signature} />}
    >
      <div className="flex items-center gap-2 p-4">
        <FileText size={16} className="text-[var(--portal-accent)]" />
        <h2 className="text-sm font-semibold text-slate-900">Review quotation</h2>
      </div>

      <EditorSection title="Rental details">
        <div className="rounded-lg bg-slate-50 p-3.5">
          <div className="space-y-2.5">
            <ReviewRow label="Rental period" value={rentalPeriod} />
            <ReviewRow label="Vehicle class" value={quotation.lineItems[0]?.vehicleClass ?? booking?.vehicleClassRequested ?? "—"} />
            <ReviewRow label="Quantity" value={quotation.lineItems.reduce((sum, item) => sum + item.quantity, 0)} />
            <ReviewRow label="Delivery site" value={deliverySite} />
          </div>
        </div>
      </EditorSection>

      <EditorSection title="Terms">
        <div className="rounded-lg bg-slate-50 p-3.5">
          <div className="space-y-2.5">
            <ReviewRow label="Payment terms" value={quotation.paymentTerms} />
            <ReviewRow label="Valid until" value={formatDate(quotation.validUntil)} />
          </div>
        </div>
      </EditorSection>

      {isPending && canDecide && (
        <EditorSection title="Your approval" required>
          <SignaturePad value={signature} onChange={onSignatureChange} rememberAs={role ?? undefined} />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            This signature confirms Thailand Post accepts the quotation and authorizes the booking to proceed.
          </p>
        </EditorSection>
      )}

      <div className="sticky bottom-0 z-10 rounded-b-lg bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <span className="text-xs text-slate-500">Grand total</span>
          <span className="text-base font-semibold text-slate-900">{formatCurrency(grandTotal)}</span>
        </div>

        {isPending && canDecide ? (
          <div className="flex gap-2">
            <Button variant="outline" size="md" className="flex-1 px-2" onClick={onDecline}>
              <Ban size={13} /> Decline
            </Button>
            <Button variant="primary" size="md" className="flex-1 px-2" disabled={!signature} onClick={onAccept}>
              <Check size={13} /> Accept Quotation
            </Button>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-slate-400">
            {isPending ? "Awaiting an authorized approver's decision." : isExpired ? "This quotation has expired and can no longer be actioned." : "This quotation reflects the terms as issued and can no longer be actioned."}
          </p>
        )}
      </div>
    </DocumentWorkspace>
  );
}

export function QuotationDetail({ quotation, showExpiredNotice = true, headerNotice }: {
  quotation: Quotation;
  showExpiredNotice?: boolean;
  headerNotice?: ReactNode;
}) {
  const client = useClients().find((c) => c.id === quotation.clientId);
  const booking = useBookings().find((item) => item.id === quotation.bookingId);
  const openBooking = useOpenBookingFromDocument();
  const role = getAdminRole();
  const [showDecline, setShowDecline] = useState(false);
  const [signature, setSignature] = useState<string | null>(quotation.clientSignature ?? null);
  const isExpired = isQuotationExpired(quotation);
  const isPending = quotation.status === "Issued" && !isExpired;
  const isClientPortal = role ? ROLE_PORTAL[role] === "client" : false;
  // Brief §2: accepting quotations is the Approver's job, not the
  // Requester's or Finance's; FleetCo staff viewing this never gets to
  // decide either, since it's the client's call. Everyone else still sees
  // the full document read-only.
  const canDecide = role === "client_approver" || role === "client_admin";

  function handleConfirmAccept() {
    if (!signature || !isPending || !canDecide) return;
    acceptQuotation(quotation, signature);
    toast.success(translate("Quotation accepted — this booking is now in My Rentals."));
    // Acceptance moves the record into My Rentals. This is a completed
    // workflow transition, not an exploratory cross-link back to the source
    // quotation, so land in the booking's new canonical home.
    openBooking(quotation.bookingId, { preserveOrigin: false });
  }
  function handleDecline(reason: string) {
    declineQuotation(quotation, reason);
    // Not just cosmetic: showDecline is what gates DeclineModal's render,
    // and nothing else resets it — quotation.status flipping away from
    // "Issued" doesn't imply this on its own the way it did back when the
    // form's visibility was itself gated on isPending too. Without this the
    // modal would stay open afterward, showing an already-submitted reason
    // with nothing left for Confirm to do.
    setShowDecline(false);
    toast.success(translate("Quotation {id} declined.", { id: quotation.id }));
  }

  // Whichever of these applies is the one thing this page is passively
  // telling the viewer about itself — Decline's own form doesn't live here
  // anymore (see DeclineModal above), just what to show when there's
  // nothing to decide, or no decision to make.
  let decisionArea: React.ReactNode = null;
  if (!isClientPortal && isPending) {
    decisionArea = <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs text-sky-700">Awaiting the client's decision on this quotation.</p>;
  } else if (!isClientPortal && isExpired && showExpiredNotice) {
    decisionArea = <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">This quotation has expired. Issue a revised quotation before asking the client to approve it.</p>;
  }

  return (
    <div className="max-w-[1600px]">
      {/* Page header — full width of the page, not boxed inside or
          constrained to the document card's own width below. This is app
          chrome (title/badge/byline, Accept/Decline), not the document
          itself — nothing about it needs to match an A4 sheet's width, any
          more than ClientBookingDetail's header does. print:hidden — not
          part of what prints either. */}
      <div className="mb-5 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-semibold text-slate-900 truncate">{quotation.id}{quotation.version > 1 ? ` (v${quotation.version})` : ""}</h1>
              <StatusBadge status={quotationDisplayStatus(quotation)} />
            </div>
            {/* Doc-type label deliberately dropped from here — it's already
                this page's persistent header title (usePageHeader in
                QuotationDetailPage.tsx) sitting directly above, and the A4
                document itself repeats it again, bigger, a few lines down.
                All this line needs to add is the one thing neither of those
                is: a quick, clickable way back to the booking. */}
            <p className="text-xs text-slate-500 mt-1">
              {/* text-xs on the button itself, not just inherited from this
                  <p> — theme.css's `button { font-size: var(--text-base) }`
                  base-layer reset only yields to a utility class applied
                  directly to the button; a size class on an ancestor doesn't
                  reach it, since buttons don't inherit font-size the way a
                  span or plain text node would. Without this the id rendered
                  at 16px/500 next to "For" at 12px/400. */}
              For <button onClick={() => openBooking(quotation.bookingId)} className="text-xs underline decoration-dotted hover:text-slate-800 cursor-pointer">{quotation.bookingId}</button>
            </p>
          </div>
        </div>
        {decisionArea && <div className="mt-4 w-full">{decisionArea}</div>}
        {headerNotice && <div className="mt-4 w-full">{headerNotice}</div>}
      </div>

      {isClientPortal ? (
        <ClientQuotationReview
          quotation={quotation}
          client={client}
          booking={booking}
          isPending={isPending}
          isExpired={isExpired}
          canDecide={canDecide}
          role={role}
          signature={signature}
          onSignatureChange={setSignature}
          onDecline={() => setShowDecline(true)}
          onAccept={handleConfirmAccept}
        />
      ) : (
        <DocumentPreviewFrame downloadFilename={`${quotation.id}.pdf`} className={DOCUMENT_PREVIEW_FRAME_CLASS}>
          <QuotationPreview quotation={quotation} client={client} booking={booking} />
        </DocumentPreviewFrame>
      )}

      {showDecline && <DeclineModal onCancel={() => setShowDecline(false)} onConfirm={handleDecline} />}
    </div>
  );
}
