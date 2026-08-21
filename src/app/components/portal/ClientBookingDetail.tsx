import { useState } from "react";
import { FileText, XCircle, Flag, Repeat2, Truck, Hash, Calendar, MapPin } from "lucide-react";
import type { Booking } from "@/app/data/bookings";
import { bookingInvoices, bookingQuotations, clientBookingStatusLabel, bookingTaxInvoices, REQUEST_STATUSES } from "@/app/data/bookings";
import type { Vehicle } from "@/app/data/vehicles";
import type { Driver } from "@/app/data/drivers";
import type { Quotation } from "@/app/data/quotations";
import type { Invoice } from "@/app/data/invoices";
import type { TaxInvoice } from "@/app/data/taxInvoices";
import { SHOW_ISSUE_REPORTS, type IssueCategory } from "@/app/data/issueReports";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { StatTile } from "@/app/components/ui/StatTile";
import { DocumentChain } from "@/app/components/ui/DocumentChain";
import { RentalTimeline, buildRentalTimeline } from "@/app/components/ui/RentalTimeline";
import { ReasonForm } from "@/app/components/ui/ReasonForm";
import { FormSelect } from "@/app/components/ui/FormSelect";
import { formatDate } from "@/app/components/ui/utils";
import { getAdminRole } from "@/app/lib/auth";
import { updateBooking } from "@/app/lib/bookingsStore";
import { useIssueReports, addIssueReport, nextIssueReportId } from "@/app/lib/issueReportsStore";
import { useOpenQuotation, useOpenInvoice, useOpenTaxInvoice } from "@/app/lib/documentNav";

const ISSUE_CATEGORIES: IssueCategory[] = ["Vehicle", "Driver", "Schedule", "Billing", "Other"];

// These actions are intentionally paused while the client booking workflow is
// being finalized. Keeping the underlying handlers intact makes them simple
// to restore when the policy is ready.
const SHOW_BOOKING_UTILITY_ACTIONS = false;

// Shared read/act surface for a single booking, rendered at the routed
// /portal/bookings/:id page (see BookingDetail.tsx) rather than as a modal —
// a client sees the exact same shape of information regardless of whether
// they clicked in from My Requests, My Rentals, or Billing History, and the
// booking now has a real, shareable URL instead of living only as scroll
// state inside whichever list opened it.
//
// Page-native layout, not a modal card left over from before the route
// existed: title/status/byline sit directly on the page (not boxed in a
// small header bar), the primary action gets real visual weight instead of
// a corner pill. Requested bookings keep their compact details and one-event
// timeline together as a single summary card; later workflow states keep
// that same growing details/timeline card on the left and stack documents,
// assignments, and issues on the right. Rental Details specifically uses
// StatTile — a handful of the
// booking's own scalar facts (type, vehicle, quantity, period, branch),
// scannable at a glance rather than read top-to-bottom as a label/value
// list. Later states are laid out as two columns above lg (Rental Details + Assigned
// Vehicle & Driver on the wide side — the record's own substance; the
// process trail narrower on the right), one column below it.
//
// No BookingProgress/InvoiceProgress steppers here (unlike RequestInbox.tsx,
// which keeps both) — those show FleetCo's own internal step-by-step (e.g.
// Accepted vs. Assigned as distinct waypoints), which is useful to ops but
// redundant-to-misleading for a client: the Status badge above already says
// where things stand in client terms, and the stepper's fixed happy path has
// no way to represent Rejected/Declined/Cancelled other than looking stuck.
//
// Accept/Decline and Mark-as-Paid live only on QuotationDetail/InvoiceDetail
// (the full A4 document, reached via useOpenQuotation/useOpenInvoice's own
// cross-page handoff — same mechanism DocumentChain already uses by default
// for every other quotation/invoice link in this app, so a document opened
// from here behaves identically to one opened anywhere else) — deciding on a
// quotation or a payment without seeing the actual document first isn't a
// shortcut worth having, so this page's own role is to get you there ("View
// Quotation"/"View Invoice" in the header), not to duplicate the decision
// itself. Cancel Booking and Report an Issue stay here only — they're
// booking-level, not document-level, actions, and have nothing to "view"
// first. Because it's a real navigate rather than a swapped-in local
// surface, the browser's own Back button already does the right thing at
// every level — no bespoke onBack/onClose pair to keep in sync.

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

// Just the label/value box a couple of sections below reuse — pulled out so
// a multi-unit assignment can repeat it once per unit without repeating its
// own heading each time (see the "Assigned Vehicle & Driver" card below).
function AssignmentRows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4">
          <span className="text-xs text-slate-500 shrink-0">{label}</span>
          <span className="text-xs font-medium text-slate-800 text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

function InfoBanner({ tone, children }: { tone: "sky" | "amber" | "slate"; children: React.ReactNode }) {
  const toneClass: Record<string, string> = {
    sky: "bg-sky-50 border-sky-100 text-sky-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    slate: "bg-slate-50 border-slate-100 text-slate-500",
  };
  return <div className={`border rounded-xl px-4 py-3 text-xs leading-relaxed ${toneClass[tone]}`}>{children}</div>;
}

function RentalDetailsContent({ booking, wide = false }: { booking: Booking; wide?: boolean }) {
  return (
    <>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Rental Details</h4>
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${wide ? "lg:grid-cols-4" : ""}`}>
        <StatTile
          icon={Calendar}
          label="Rental Period"
          value={
            <>
              {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
              <span className="font-normal text-slate-400"> · {booking.rentalType}</span>
            </>
          }
        />
        <StatTile icon={Truck} label="Vehicle Class" value={booking.vehicleClassRequested} />
        <StatTile icon={Hash} label="Quantity" value={String(booking.quantity)} />
        <StatTile icon={MapPin} label="Branch Location" value={booking.pickupLocation} />
      </div>
      {booking.jobNotes && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-1 text-[10px] font-normal uppercase tracking-wider text-slate-400">Notes</p>
          <p className="text-xs leading-relaxed text-slate-700">{booking.jobNotes}</p>
        </div>
      )}
    </>
  );
}

function AssignedVehicleCard({ assignmentUnits }: { assignmentUnits: [string, string][][] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned Vehicle &amp; Driver</h4>
      {assignmentUnits.length > 0 ? (
        <div className="space-y-3">
          {assignmentUnits.map((rows, i) => (
            <div key={i}>
              {assignmentUnits.length > 1 && (
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <Truck size={11} /> Unit {i + 1}
                </p>
              )}
              <AssignmentRows rows={rows} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Not yet assigned — FleetCo will confirm the vehicle and driver before your rental starts.</p>
      )}
    </div>
  );
}

function IssueReportForm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (category: IssueCategory, description: string) => void }) {
  const [category, setCategory] = useState<IssueCategory>("Vehicle");
  const [description, setDescription] = useState("");
  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Category</label>
        <FormSelect value={category} options={ISSUE_CATEGORIES} onChange={setCategory} />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">What's happening?</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue — the more detail, the faster FleetCo can act on it..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] resize-none"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer">
          Back
        </button>
        <button
          disabled={!description.trim()}
          onClick={() => onConfirm(category, description.trim())}
          className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}

export function ClientBookingDetail({
  booking, vehicles, drivers, quotations, invoices, taxInvoices, onRepeat,
}: {
  booking: Booking;
  vehicles: Vehicle[];
  drivers: Driver[];
  quotations: Quotation[];
  invoices: Invoice[];
  taxInvoices: TaxInvoice[];
  // Optional — not every screen that opens this page has a "repeat this"
  // concept wired up yet (BillingHistory doesn't). Where it's given, it
  // renders as a small secondary header action, not a primary one: repeating
  // a request is a convenience, not something tied to this booking's actual
  // state, so it doesn't belong in the state-dependent "Next Step" area.
  onRepeat?: () => void;
}) {
  const role = getAdminRole();
  const openQuotation = useOpenQuotation();
  const openInvoice = useOpenInvoice();
  const openTaxInvoice = useOpenTaxInvoice();
  const [showCancel, setShowCancel] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);

  // Reverse lookups, not booking.quotationId/invoiceId/taxInvoiceId — a
  // recurring-billing booking can have more than one invoice over its life
  // (isRecurringBilling exists precisely for that), and a single forward
  // pointer can only ever reflect the most recently issued one. See
  // bookings.ts. quotation/invoice/taxInvoice below stay "the current one"
  // (index 0, newest first) for everywhere this file only ever needs one;
  // the full arrays feed DocumentChain, which needs to show every cycle, not
  // just the latest. clientQuotations alone also feeds RentalTimeline (its
  // own quotation-issued/accepted/declined entries, one set per quotation);
  // clientInvoices/clientTaxInvoices don't — RentalTimeline dropped billing
  // history entirely, see that file's own header comment for why.
  const clientQuotations = bookingQuotations(booking.id, quotations);
  const clientInvoices = bookingInvoices(booking.id, invoices);
  const clientTaxInvoices = bookingTaxInvoices(booking.id, taxInvoices);
  const quotation = clientQuotations[0];
  const invoice = clientInvoices[0];
  const hasDocuments = clientQuotations.length > 0 || clientInvoices.length > 0 || clientTaxInvoices.length > 0;

  // Brief §2: accepting quotations is the Approver's job, not the
  // Requester's; marking paid sits with Finance (and Approver, who also
  // "views spend dashboards"). That gating happens entirely on
  // QuotationDetail/InvoiceDetail now, not here — "View Quotation"/"View
  // Invoice" below is offered to every role, since seeing the document is
  // harmless even for a role that can't act on it; whoever can't decide
  // just sees the same read-only view (and the same "awaiting a decision"
  // message) once they get there.
  // A booking can be withdrawn any time before the vehicle actually goes
  // out — matches BOOKING_STATUS_TRANSITIONS, which allows "Cancelled" from
  // Requested/Accepted/Assigned but not Active (that's a rental in
  // progress; "cancelling" it is a different, unbuilt concept). Quoted is
  // deliberately excluded here — Decline already covers "I don't want
  // this" for a live quotation, so a second, overlapping negative action on
  // the same status would just be confusing.
  const canCancel = role === "client_approver" || role === "client_admin";
  const cancellable = booking.status === "Requested" || booking.status === "Accepted" || booking.status === "Assigned";

  // Issue reports are a flag, not a commitment — unlike Accept/Decline/
  // Cancel/Mark-as-Paid, either client role dealing with the rental
  // day-to-day can raise one. Only gated by whether there's an actual
  // vehicle+driver out there to have a problem with (Assigned or Active);
  // Finance can still see reports read-only, same as anyone else, but
  // doesn't get the "Report an Issue" trigger.
  const allIssues = useIssueReports();
  const issues = allIssues.filter((r) => r.bookingId === booking.id);
  const canReportIssue = role === "client_approver" || role === "client_requester" || role === "client_admin";
  const reportable = booking.status === "Assigned" || booking.status === "Active";

  // One row-box per unit, grouped visually rather than distinguished only by
  // a text prefix on every line — with 2+ units, a flat "Unit 1 Vehicle /
  // Unit 1 Driver / Unit 2 Vehicle / ..." list reads as one undifferentiated
  // block; separate boxes read as what they are, two different assignments.
  const assignmentUnits: [string, string][][] = (booking.assignments ?? [])
    .map((a) => {
      const vehicle = vehicles.find((v) => v.id === a.vehicleId);
      const driver = drivers.find((d) => d.id === a.driverId);
      const rows: [string, string][] = [];
      if (vehicle) rows.push(["Vehicle", `${vehicle.plateNumber} · ${vehicle.brand} ${vehicle.model}`]);
      if (driver) {
        rows.push(["Driver", driver.name]);
        rows.push(["Driver Phone", driver.phone]);
      }
      return rows;
    })
    .filter((rows) => rows.length > 0);

  function handleCancelBooking(reason: string) {
    updateBooking(booking.id, { status: "Cancelled", declineReason: reason || undefined, updated: nowStamp() });
  }
  function handleReportIssue(category: IssueCategory, description: string) {
    addIssueReport({
      id: nextIssueReportId(),
      bookingId: booking.id,
      clientId: booking.clientId,
      category,
      description,
      reportedByName: booking.requestedByName,
      reportedAt: nowStamp(),
      status: "Open",
    });
    setShowReportIssue(false);
  }

  // Split three ways, not one combined "Next Step" blob:
  // - headerAction: for the two states FleetCo is actually waiting on the
  //   client for (a quotation to decide on, an invoice to pay), a single
  //   "View Quotation"/"View Invoice" button — the one primary action this
  //   page offers, sized and placed like one (full label, real padding,
  //   next to the title), not shrunk into a corner pill the way a modal's
  //   close-adjacent header control would be. The actual Accept/Decline/
  //   Mark-as-Paid choice happens over there, not here — see the file
  //   header comment.
  // - actionArea: booking-level context that doesn't belong in a button —
  //   currently the reason a booking was rejected, declined, or cancelled.
  //   Invoice/payment feedback stays on the invoice page itself.
  // - cancelAction: cancelling a booking, deliberately kept out of both —
  //   it isn't FleetCo waiting on a decision the way the other two are, and
  //   a destructive action sitting right next to the title invites
  //   mis-taps. Rendered inline near Repeat instead (see below), same
  //   low-key "available if you want it" tier.
  //
  // declineReason (Rejected/Declined/Cancelled's "why") used to live as its
  // own quiet card in the sidebar, below Documents — easy to miss on a page
  // whose header already tells you the booking didn't go through, but not
  // why. Promoted into actionArea instead so the booking outcome and its
  // explanation remain together at the top of this page.
  let headerAction: React.ReactNode = null;
  let actionArea: React.ReactNode = null;
  let cancelAction: React.ReactNode = null;
  if (booking.declineReason) {
    // Same Rejected/Declined/Cancelled split (and the exact wording) the
    // sidebar card used — just re-homed, plus a tone pulled from
    // StatusBadge's own color for that label so the banner agrees with the
    // badge sitting right above it at the top of the page (orange for
    // Rejected, rose for Declined, slate for Cancelled).
    const declineLabel = clientBookingStatusLabel(booking);
    const tone =
      declineLabel === "Cancelled" ? "bg-slate-50 border-slate-100 text-slate-500"
      : declineLabel === "Rejected" ? "bg-orange-50 border-orange-100 text-orange-700"
      : "bg-rose-50 border-rose-100 text-rose-700"; // Declined
    const lead = declineLabel === "Cancelled" ? "Cancellation reason: " : declineLabel === "Rejected" ? "Rejection reason: " : "Decline reason: ";
    actionArea = (
      <div className={`border rounded-lg px-3 py-2.5 text-xs leading-relaxed ${tone}`}>
        <span className="font-semibold">{lead}</span>
        {booking.declineReason}
      </div>
    );
  } else if (booking.status === "Requested") {
    actionArea = <InfoBanner tone="amber">Waiting on FleetCo to prepare and issue the quotation.</InfoBanner>;
  } else if (booking.status === "Quoted" && quotation?.status === "Issued") {
    // No inline Accept/Decline here — see the file header comment. Offered
    // to every role; QuotationDetail decides for itself who gets the actual
    // buttons versus a read-only "awaiting a decision" view.
    headerAction = (
      <button
        onClick={() => openQuotation(quotation.id)}
        className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer shrink-0"
      >
        <FileText size={13} /> View Quotation
      </button>
    );
  } else if (invoice && (invoice.status === "Unpaid" || invoice.status === "Overdue" || invoice.status === "Payment Issue")) {
    // Driven by the invoice's own status, not booking.status === "Invoiced"
    // — a recurring-billing booking sits at "Active" between cycles, but
    // can still have a real unpaid invoice sitting there needing payment.
    // Gating this on the booking's status would hide that entirely.
    headerAction = (
      <button
        onClick={() => openInvoice(invoice.id, booking.id)}
        className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer shrink-0"
      >
        <FileText size={13} /> View Invoice
      </button>
    );
  } else if (invoice && invoice.status === "Payment Submitted") {
    headerAction = (
      <button
        onClick={() => openInvoice(invoice.id, booking.id)}
        className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer shrink-0"
      >
        <FileText size={13} /> View Invoice
      </button>
    );
  } else if (SHOW_BOOKING_UTILITY_ACTIONS && cancellable) {
    // Cancelling doesn't get the header treatment the other three do — it's
    // not FleetCo waiting on a decision the way a quotation or an overdue
    // invoice is, it's an always-there option the client might reach for.
    // Same low-key tier as "Repeat this request," so it sits right next to
    // it (see cancelAction below) instead of next to the title, where a
    // destructive action would also sit uncomfortably close.
    if (canCancel) {
      if (showCancel) {
        cancelAction = (
          <ReasonForm
            title="Reason for cancelling (optional)"
            placeholder="Let FleetCo know why you're cancelling this booking..."
            confirmLabel="Confirm Cancellation"
            required={false}
            onCancel={() => setShowCancel(false)}
            onConfirm={handleCancelBooking}
          />
        );
      } else {
        cancelAction = (
          <button
            onClick={() => setShowCancel(true)}
            className="w-full py-2.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium hover:bg-rose-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <XCircle size={13} /> Cancel Booking
          </button>
        );
      }
    } else {
      cancelAction = <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">Nothing to do right now — FleetCo will update this booking as it progresses.</p>;
    }
  }

  const timeline = buildRentalTimeline(booking, clientQuotations);

  return (
    <div className="max-w-[1600px]">
      {/* Page header — title/badge/byline sit directly on the page, not
          boxed inside a card, and the primary action gets full button
          weight rather than a corner pill. Stays full-width above the
          2-column split below — it's page chrome, not "about this
          booking" content that pairs with a sidebar. */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-semibold text-slate-900">{booking.id}</h1>
            <StatusBadge status={clientBookingStatusLabel(booking)} />
          </div>
          <p className="text-xs text-slate-500 mt-1">Requested by {booking.requestedByName} · {formatDate(booking.created)}</p>
        </div>
        {headerAction}
      </div>

      {/* actionArea used to also repeat at the very bottom of the page —
          a real duplicate-render leftover from the header-extraction pass,
          just never visible in practice since neither test booking used
          this session happened to set it. Renders once now. */}
      {actionArea && <div className="mb-5">{actionArea}</div>}

      {booking.status === "Requested" || (REQUEST_STATUSES.includes(booking.status) && !hasDocuments) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <RentalDetailsContent booking={booking} wide />
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Rental Timeline</h4>
            <RentalTimeline entries={timeline} />
          </div>
        </div>
      ) : (
      /* Two columns above lg, single column below it. A 3:2 split gives the
         Documents & Billing column enough room for invoice amounts plus
         compact status labels without turning the main details into a narrow
         rail. Both groups keep the DOM order they'd have if this were one
         column, so mobile stacking (below lg) is unaffected. */
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <RentalDetailsContent booking={booking} />
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Rental Timeline</h4>
              <RentalTimeline entries={timeline} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          {hasDocuments && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              {/* "Documents & Billing," not just "Documents" — this card
                  already carries payment status per invoice row (Paid/
                  Payment Submitted/etc via DocumentChain's own StatusBadge),
                  so it's already where the client's billing progress lives,
                  not just a paperwork list. Naming it that way covers that
                  without needing a second, separate block for it. "Billing"
                  over "Finance" specifically to match this app's own
                  vocabulary — the sidebar section this maps to is literally
                  named Billing (Invoices & Payments lives under it);
                  "Finance" only exists elsewhere as a role name
                  (client_finance), not a section label. Ops's own mirrored
                  card (OpsBookingDetailPanel.tsx) keeps plain "Documents" —
                  this is the client's own finance to track, not ops's. */}
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Documents & Billing</h4>
              <DocumentChain
                quotations={clientQuotations}
                invoices={clientInvoices}
                taxInvoices={clientTaxInvoices}
                onOpenTaxInvoice={openTaxInvoice}
                expectingInvoice={!REQUEST_STATUSES.includes(booking.status)}
              />
            </div>
          )}

          {/* Once the request is confirmed, assignment belongs with the
              other operational/supporting cards in the right column. The
              card remains visible before allocation so Accepted bookings
              explain that FleetCo is still preparing the vehicle and driver. */}
          {!REQUEST_STATUSES.includes(booking.status) && (
            <AssignedVehicleCard assignmentUnits={assignmentUnits} />
          )}

          {SHOW_ISSUE_REPORTS && (issues.length > 0 || (reportable && canReportIssue)) && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Issue Reports</h4>
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div key={issue.id} className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-700">{issue.category}</span>
                      <StatusBadge status={issue.status} />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{issue.description}</p>
                    <p className="text-[11px] text-slate-400">{issue.reportedByName} · {formatDate(issue.reportedAt)}</p>
                    {issue.status === "Resolved" && issue.resolutionNotes && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                        <span className="font-semibold text-slate-600">FleetCo's response: </span>
                        {issue.resolutionNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {reportable && canReportIssue && (
                <div className="mt-2">
                  {showReportIssue ? (
                    <IssueReportForm onCancel={() => setShowReportIssue(false)} onConfirm={handleReportIssue} />
                  ) : (
                    <button
                      onClick={() => setShowReportIssue(true)}
                      className="w-full py-2 border border-dashed border-slate-300 text-slate-500 rounded-lg text-xs font-medium hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Flag size={13} /> Report an Issue
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tighter gap between these two than the space-y-5 rhythm above
              — Cancel and Repeat are both low-key, always-there utility
              actions that belong together as one small cluster, not two
              independent sections. */}
          {SHOW_BOOKING_UTILITY_ACTIONS && (cancelAction || onRepeat) && (
            <div className="space-y-2">
              {cancelAction}
              {onRepeat && (
                <button
                  onClick={onRepeat}
                  className="w-full py-2.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Repeat2 size={13} /> Repeat this request
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
