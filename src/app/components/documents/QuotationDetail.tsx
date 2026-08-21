import { useState } from "react";
import { toast } from "sonner";
import { Printer, Check, Ban, FileText } from "lucide-react";
import type { Quotation } from "@/app/data/quotations";
import { useClients } from "@/app/lib/clientsStore";
import { acceptQuotation, declineQuotation } from "@/app/lib/documentActions";
import { getAdminRole } from "@/app/lib/auth";
import { useOpenBookingFromDocument } from "@/app/lib/documentNav";
import { useBodyScrollLock } from "@/app/hooks/useBodyScrollLock";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { ReasonForm } from "@/app/components/ui/ReasonForm";
import { SignaturePad } from "@/app/components/ui/SignaturePad";
import { CommercialDocument } from "@/app/components/documents/CommercialDocument";

// The primary place a quotation is viewed and, when it's still pending, the
// primary place it's decided — reachable directly (a routed
// /documents/quotations/:id page, both portals) or via a cross-page handoff
// from a booking's own Documents list (useOpenQuotation, which navigates
// straight here). Rendered as the actual A4 document (same
// letterhead/table/totals layout as DocumentEditor's live A4Preview on the
// issuing side, and what "Print / Download PDF" produces), because deciding
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

// useBodyScrollLock matches every other full-screen overlay in this app
// (RequestVehicle, DocumentEditor, etc.) — without it the page (or the
// document's own internal scrollbox below) stays scrollable underneath the
// backdrop. No separate title here — ReasonForm's own label already reads
// as one ("Reason for declining"), so a second modal-level heading above it
// would just repeat that.
function DeclineModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  useBodyScrollLock();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <ReasonForm
          title="Reason for declining"
          placeholder="Let FleetCo know why, so they can revise the quotation..."
          confirmLabel="Confirm Decline"
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}

// Same shell as DeclineModal, own content — a signature, not a reason.
// rememberAs uses the signing role, same mechanism DocumentEditor.tsx
// already uses on FleetCo's side (P'Tarn's "save signature per account,"
// per the SignaturePad's own rememberAs comment) — each client role that
// can accept keeps its own remembered signature across quotations, no new
// persistence to build.
function AcceptModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (signature: string) => void }) {
  useBodyScrollLock();
  const [signature, setSignature] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-slate-900">Sign to accept</h3>
        <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">
          This signs the quotation on Thailand Post's behalf and moves the booking to Accepted.
        </p>
        <SignaturePad value={signature} onChange={setSignature} rememberAs={getAdminRole() ?? undefined} />
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button
            disabled={!signature}
            onClick={() => onConfirm(signature!)}
            className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Confirm Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function QuotationDetail({ quotation }: { quotation: Quotation }) {
  const client = useClients().find((c) => c.id === quotation.clientId);
  const openBooking = useOpenBookingFromDocument();
  const role = getAdminRole();
  const [showDecline, setShowDecline] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const isPending = quotation.status === "Issued";
  // Brief §2: accepting quotations is the Approver's job, not the
  // Requester's or Finance's; FleetCo staff viewing this never gets to
  // decide either, since it's the client's call. Everyone else still sees
  // the full document read-only.
  const canDecide = role === "client_approver" || role === "client_admin";

  function handleConfirmAccept(signature: string) {
    acceptQuotation(quotation, signature);
    setShowAccept(false);
    toast.success("Quotation accepted — moved to My Rentals.");
    openBooking(quotation.bookingId);
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
  }

  // Whichever of these applies is the one thing this page is passively
  // telling the viewer about itself — Decline's own form doesn't live here
  // anymore (see DeclineModal above), just what to show when there's
  // nothing to decide, or no decision to make.
  let decisionArea: React.ReactNode = null;
  if (isPending && !canDecide) {
    decisionArea = <p className="text-xs text-sky-700 bg-white border border-sky-100 rounded-lg px-3 py-2.5 shadow-sm">Awaiting the client's decision on this quotation.</p>;
  } else if (!isPending) {
    decisionArea = (
      <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm flex items-center gap-2">
        <FileText size={13} className="text-slate-400 shrink-0" /> This quotation reflects the terms as issued and can no longer be actioned.
      </p>
    );
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
              <StatusBadge status={quotation.status} />
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
          {isPending && canDecide && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDecline(true)}
                className="flex items-center gap-1.5 h-8 px-3 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <Ban size={13} /> Decline
              </button>
              <button
                onClick={() => setShowAccept(true)}
                className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer"
              >
                <Check size={13} /> Accept Quotation
              </button>
            </div>
          )}
        </div>
        {decisionArea && <div className="mt-4 max-w-xl">{decisionArea}</div>}
      </div>

      {/* Document toolbar — just Print, right-aligned above the scrollable
          frame below rather than inside it, so it's always visible without
          needing real position:sticky; it's simply outside the box that
          scrolls. Plain text control, not a boxed button — this is a
          secondary, incidental action sitting next to the document, not a
          primary one competing with Accept/Decline above it. Doc id/version
          dropped from here too — it's already the page's H1 a few lines up,
          repeating it here added nothing. */}
      <div className="flex justify-end mb-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          <Printer size={13} /> Print / Download PDF
        </button>
      </div>

      {/* The document frame — fills the page's own width now (no more
          max-w-4xl cap forcing it narrow); the A4 sheet inside keeps its
          own fixed 210mm regardless and just centers in whatever room this
          gives it, same as a real page sitting on a wider desk. Fixed
          height + its own scroll, not the whole page's — a full A4 sheet
          is taller than most viewports, and scrolling the entire page to
          read it would carry the toolbar and header away with it. print:
          overrides all of this back to plain flow, since none of it
          means anything on paper. */}
      <div className="bg-slate-200 rounded-2xl overflow-hidden print:bg-white print:rounded-none">
        <div className="p-4 sm:p-8 print:p-0 h-[75vh] print:h-auto overflow-y-auto print:overflow-visible">
          {/* The document itself — same shape as A4Preview (issuing side),
              rendered through the same A4Document pagination component so
              a long quotation splits into real pages instead of either
              clipping or spilling past the sheet's bottom edge, both on
              screen and (matching, not independently reflowed) in print. */}
          <CommercialDocument
            mode="quotation"
            docNumber={quotation.id}
            client={client}
            booking={undefined}
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
            clientSignature={quotation.clientSignature}
          />
        </div>
      </div>

      {showDecline && <DeclineModal onCancel={() => setShowDecline(false)} onConfirm={handleDecline} />}
      {showAccept && <AcceptModal onCancel={() => setShowAccept(false)} onConfirm={handleConfirmAccept} />}
    </div>
  );
}
