import { useState } from "react";
import { Check, Truck, AlertTriangle, FileCheck2, Ban, Hash, Calendar, MapPin, Repeat } from "lucide-react";
import {
  type Booking, type VehicleDriverAssignment, bookingInvoices, bookingQuotations, bookingStatusLabel, bookingTaxInvoices, invoiceEligible, REQUEST_STATUSES,
} from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import type { Vehicle, VehicleClass } from "@/app/data/vehicles";
import type { Driver } from "@/app/data/drivers";
import { type Quotation } from "@/app/data/quotations";
import { type Invoice } from "@/app/data/invoices";
import type { TaxInvoice } from "@/app/data/taxInvoices";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { StatTile } from "@/app/components/ui/StatTile";
import { DocumentChain } from "@/app/components/ui/DocumentChain";
import { RentalTimeline, buildRentalTimeline } from "@/app/components/ui/RentalTimeline";
import { ReasonForm } from "@/app/components/ui/ReasonForm";
import { ActionModal } from "@/app/components/ui/ActionModal";
import { formatDate } from "@/app/components/ui/utils";
import { getVehicleConflicts, getDriverConflicts, type Conflict } from "@/app/lib/assignmentConflicts";
import { updateBooking } from "@/app/lib/bookingsStore";
import { useIssueReports, updateIssueReport } from "@/app/lib/issueReportsStore";
import { SHOW_ISSUE_REPORTS } from "@/app/data/issueReports";
import { addNotification } from "@/app/lib/notificationsStore";
import { useNavigate } from "react-router";
import { useOpenInvoice, useOpenTaxInvoice } from "@/app/lib/documentNav";

// Ops-side booking detail — presentational content for the routed
// /ops/bookings/:id page (see OpsBookingDetail.tsx).
//
// Rebuilt to actually match ClientBookingDetail.tsx's own balance, not just
// borrow its container width: one primary action button top-right in the
// header (same slot as that file's "View Quotation"/"View Invoice"), no
// boxed "Next Step" card, no separate progress-stepper card — the header's
// status badge plus the action button already say "where this is" and
// "what's next," which is what BookingProgress/InvoiceProgress existed to
// do less directly. The one real difference from the client page ops can't
// design away: a booking can have two independent things needing ops's
// attention at once (a rental-track action and a billing-track action —
// e.g. Active with a Payment Submitted invoice sitting on it), which the
// client's own state machine never produces. Handled as up to two action
// clusters side by side in the header, not a fabricated single button that
// would hide one of them, and not a card section either.
//
// Actions that need more than a click (picking a vehicle+driver per unit,
// typing a rejection reason) open as a modal now — the shared
// components/ui/ActionModal.tsx shell, not a local one — instead of
// expanding inline into the page. That's the same underlying idea as the
// client page deferring Accept/Decline to a separate document page rather
// than cramming a decision inline: acting is a distinct moment from
// reading, not another paragraph of the page.
//
// No callback props for actions (onUpdate/onAssign/etc.) — this calls
// updateBooking directly, matching the precedent ClientBookingDetail.tsx's
// handleCancelBooking already set. Quotation/invoice creation lives in
// OpsDocumentEditorPage.tsx (a real route, not local state here) — see that
// file's own header comment for why. Deciding on an existing invoice
// (Verify & Issue Tax Invoice, Reject Payment) has moved to
// InvoiceDetail.tsx, for the same reason Accept/Decline live on
// QuotationDetail.tsx and Mark-as-Paid lives on InvoiceDetail.tsx already —
// this page's billing cluster is now just a "View Invoice" hand-off, same
// role ClientBookingDetail's own "View Invoice" button already plays.

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// today()/defaultLineItem()/editorInitialValues() moved to
// OpsDocumentEditorPage.tsx along with the editor flow itself — addDays()
// stays here, still used by the recurring-billing info banner below.

// The label/value box a couple of sections below reuse — pulled out so a
// multi-unit assignment can repeat it once per unit without repeating its
// own heading each time (see the "Assigned Vehicle & Driver" block below).
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

function InfoBanner({ tone, children }: { tone: "sky" | "indigo" | "amber" | "emerald" | "slate"; children: React.ReactNode }) {
  const toneClass: Record<string, string> = {
    sky: "bg-sky-50 border-sky-100 text-sky-700",
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    slate: "bg-slate-50 border-slate-100 text-slate-500",
  };
  return <div className={`border rounded-xl px-4 py-3 text-xs leading-relaxed ${toneClass[tone]}`}>{children}</div>;
}

// The header's one primary action — same size/weight/color as
// ClientBookingDetail.tsx's own "View Quotation"/"View Invoice" button
// (h-8, accent fill), so the two portals' pages read as the same control
// in the same place, not a family resemblance.
function HeaderAction({
  onClick, icon: Icon, children,
}: { onClick: () => void; icon: React.ComponentType<{ size?: number }>; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer shrink-0"
    >
      <Icon size={13} /> {children}
    </button>
  );
}

// A secondary option next to a primary header action (Reject a request
// that's about to be quoted, reassign instead of starting, dispute a
// payment claim) — visibly lighter than HeaderAction so the primary path
// still reads as the default one click away.
function HeaderSecondaryAction({
  onClick, icon: Icon, children,
}: { onClick: () => void; icon: React.ComponentType<{ size?: number }>; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-7 px-2.5 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-medium hover:bg-slate-50 cursor-pointer shrink-0"
    >
      <Icon size={11} /> {children}
    </button>
  );
}

// ── Vehicle + driver assignment — the §4.3 "assignment engine" ─────────────
// A quantity>1 booking ("Van × 2") needs a *different* vehicle and driver
// per unit, not one pair shared or duplicated — brief §3's "one vehicle +
// one dedicated driver, booked as a single unit" applies per unit, not once
// per booking. VehiclePickerList/DriverPickerList below are shared by every
// unit's picker so the button styling/conflict-annotation logic exists once
// regardless of how many units there are.

function VehiclePickerList({
  vehicleClass, candidates, conflictsMap, selectedId, pickedElsewhere, onSelect,
}: {
  vehicleClass: VehicleClass;
  candidates: Vehicle[];
  conflictsMap: Map<string, Conflict[]>;
  selectedId: string | null;
  // Already picked for a *different* unit of this same booking — a separate
  // exclusion from conflictsMap, which only checks against other bookings.
  pickedElsewhere: Set<string>;
  onSelect: (id: string) => void;
}) {
  if (candidates.length === 0) {
    return <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5">No {vehicleClass} vehicles in the fleet.</p>;
  }
  return (
    <div className="space-y-1.5">
      {candidates.map((v) => {
        const conflicts = conflictsMap.get(v.id) ?? [];
        const elsewhere = pickedElsewhere.has(v.id);
        const disabled = conflicts.length > 0 || elsewhere;
        const selected = selectedId === v.id;
        return (
          <button
            key={v.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(v.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
              disabled
                ? "border-slate-100 bg-slate-50 cursor-not-allowed opacity-60"
                : selected
                  ? "border-[var(--portal-accent-soft)] bg-[var(--portal-accent-light)] cursor-pointer"
                  : "border-slate-200 hover:border-slate-300 cursor-pointer"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-800">
                {v.plateNumber} · {v.brand} {v.model}
              </span>
              <StatusBadge status={v.status} />
            </div>
            {disabled && (
              <p className="text-[11px] text-rose-600 mt-1 flex items-start gap-1">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                <span>{elsewhere ? "Already assigned to another unit of this booking." : conflicts.map((c) => c.detail).join(" ")}</span>
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DriverPickerList({
  candidates, conflictsMap, selectedId, pickedElsewhere, onSelect,
}: {
  candidates: Driver[];
  conflictsMap: Map<string, Conflict[]>;
  selectedId: string | null;
  pickedElsewhere: Set<string>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
      {candidates.map((d) => {
        const conflicts = conflictsMap.get(d.id) ?? [];
        const elsewhere = pickedElsewhere.has(d.id);
        const disabled = conflicts.length > 0 || elsewhere;
        const selected = selectedId === d.id;
        return (
          <button
            key={d.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(d.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
              disabled
                ? "border-slate-100 bg-slate-50 cursor-not-allowed opacity-60"
                : selected
                  ? "border-[var(--portal-accent-soft)] bg-[var(--portal-accent-light)] cursor-pointer"
                  : "border-slate-200 hover:border-slate-300 cursor-pointer"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-800">{d.name}</span>
              <span className="text-[10px] text-slate-400">{d.licenseClass}</span>
            </div>
            {disabled && (
              <p className="text-[11px] text-rose-600 mt-1 flex items-start gap-1">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                <span>{elsewhere ? "Already assigned to another unit of this booking." : conflicts.map((c) => c.detail).join(" ")}</span>
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

type UnitPick = { vehicleId: string | null; driverId: string | null };

function AssignmentForm({
  booking,
  vehicles,
  drivers,
  allBookings,
  onCancel,
  onAssign,
}: {
  booking: Booking;
  vehicles: Vehicle[];
  drivers: Driver[];
  allBookings: Booking[];
  onCancel: () => void;
  onAssign: (assignments: VehicleDriverAssignment[]) => void;
}) {
  const unitCount = booking.quantity;
  // Pre-filled from whatever's already assigned (reassignment case) — same
  // "start from the current state" behavior the single-pair form had.
  const [picks, setPicks] = useState<UnitPick[]>(() => {
    const existing = booking.assignments ?? [];
    return Array.from({ length: unitCount }, (_, i) => ({
      vehicleId: existing[i]?.vehicleId ?? null,
      driverId: existing[i]?.driverId ?? null,
    }));
  });

  const candidateVehicles = vehicles.filter((v) => v.vehicleClass === booking.vehicleClassRequested);
  const vehicleConflicts = new Map(candidateVehicles.map((v) => [v.id, getVehicleConflicts(v, booking, allBookings)]));
  const driverConflicts = new Map(
    drivers.map((d) => [d.id, getDriverConflicts(d, booking, allBookings, booking.vehicleClassRequested)]),
  );

  function setPick(index: number, patch: Partial<UnitPick>) {
    setPicks((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  const allOk = picks.every(
    (p) =>
      !!p.vehicleId &&
      !!p.driverId &&
      (vehicleConflicts.get(p.vehicleId)?.length ?? 1) === 0 &&
      (driverConflicts.get(p.driverId)?.length ?? 1) === 0,
  );

  return (
    <div className="space-y-5">
      {picks.map((pick, i) => {
        // Excludes only *other* units' picks — a unit keeps showing its own
        // current selection as selected, not disabled-against-itself.
        const vehiclesElsewhere = new Set(picks.filter((_, j) => j !== i).map((p) => p.vehicleId).filter((id): id is string => !!id));
        const driversElsewhere = new Set(picks.filter((_, j) => j !== i).map((p) => p.driverId).filter((id): id is string => !!id));
        return (
          <div key={i} className={unitCount > 1 ? "space-y-4 pb-5 border-b border-slate-100 last:border-b-0 last:pb-0" : "space-y-4"}>
            {unitCount > 1 && <p className="text-xs font-semibold text-slate-700">Unit {i + 1} of {unitCount}</p>}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Vehicle — {booking.vehicleClassRequested}
              </h4>
              <VehiclePickerList
                vehicleClass={booking.vehicleClassRequested}
                candidates={candidateVehicles}
                conflictsMap={vehicleConflicts}
                selectedId={pick.vehicleId}
                pickedElsewhere={vehiclesElsewhere}
                onSelect={(id) => setPick(i, { vehicleId: id })}
              />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Driver</h4>
              <DriverPickerList
                candidates={drivers}
                conflictsMap={driverConflicts}
                selectedId={pick.driverId}
                pickedElsewhere={driversElsewhere}
                onSelect={(id) => setPick(i, { driverId: id })}
              />
            </div>
          </div>
        );
      })}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-100 cursor-pointer">
          Cancel
        </button>
        <button
          disabled={!allOk}
          onClick={() => allOk && onAssign(picks.map((p) => ({ vehicleId: p.vehicleId!, driverId: p.driverId! })))}
          className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--portal-accent)] cursor-pointer"
        >
          <Check size={12} /> Confirm Assignment{unitCount > 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

export function OpsBookingDetailPanel({
  booking, vehicles, drivers, quotations, invoices, taxInvoices, client, allBookings,
}: {
  booking: Booking;
  vehicles: Vehicle[];
  drivers: Driver[];
  quotations: Quotation[];
  invoices: Invoice[];
  taxInvoices: TaxInvoice[];
  client: ClientAccount | undefined;
  allBookings: Booking[];
}) {
  const navigate = useNavigate();
  const [showAssign, setShowAssign] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const openTaxInvoice = useOpenTaxInvoice();
  const openInvoice = useOpenInvoice();

  const allIssues = useIssueReports();
  const issues = allIssues.filter((r) => r.bookingId === booking.id);

  function handleResolveIssue(issueId: string) {
    updateIssueReport(issueId, { status: "Resolved", resolutionNotes: resolutionNotes.trim() || undefined, resolvedAt: nowStamp() });
    setResolvingId(null);
    setResolutionNotes("");
  }

  // Reverse lookups, not booking.quotationId/invoiceId/taxInvoiceId — see
  // bookings.ts. A recurring-billing booking can have more than one invoice
  // over its life, which a single forward pointer can't represent; these
  // read from each document's own bookingId back-reference instead.
  const quotationsForBooking = bookingQuotations(booking.id, quotations);
  const invoicesForBooking = bookingInvoices(booking.id, invoices);
  const taxInvoicesForBooking = bookingTaxInvoices(booking.id, taxInvoices);
  const latestInvoice = invoicesForBooking[0];
  const latestInvoiceHasTaxInvoice = !!latestInvoice && taxInvoicesForBooking.some((t) => t.invoiceId === latestInvoice.id);
  const hasExistingAssignment = (booking.assignments?.length ?? 0) > 0;

  function handleAssign(assignments: VehicleDriverAssignment[]) {
    // assignedAt is separate from updated (which every later transition also
    // touches) — see Booking's own comment on the field. Written once, here,
    // the only place a booking ever reaches "Assigned".
    const stamp = nowStamp();
    updateBooking(booking.id, { status: "Assigned", assignments, assignedAt: stamp, updated: stamp });
    setShowAssign(false);
    addNotification({
      eventTypeId: "assignment_made",
      portal: "client",
      recipient: `Thailand Post — ${booking.requestedByName}`,
      bookingId: booking.id,
      message: `Vehicle and driver assigned to booking ${booking.id}.`,
    });
  }

  function handleRejectRequest(reason: string) {
    updateBooking(booking.id, { status: "Declined", declineReason: reason, updated: nowStamp() });
    setShowReject(false);
  }

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

  // ── Rental-track header action + info banner — status-driven, capped at
  // Completed. Complex interactions (assignment picking, a rejection
  // reason) open ActionModal rather than expanding inline — see the file
  // header comment. Declined/Cancelled produce neither: the declineArea
  // banner below (checked first, same as ClientBookingDetail.tsx's own)
  // already says what happened and why.
  let rentalPrimary: React.ReactNode = null;
  let rentalSecondary: React.ReactNode = null;
  let rentalInfo: React.ReactNode = null;
  switch (booking.status) {
    case "Requested":
      rentalPrimary = <HeaderAction icon={FileCheck2} onClick={() => navigate(`/ops/bookings/${booking.id}/quotation/new`)}>Create Quotation</HeaderAction>;
      rentalSecondary = <HeaderSecondaryAction icon={Ban} onClick={() => setShowReject(true)}>Reject Request</HeaderSecondaryAction>;
      break;
    case "Quoted":
      rentalInfo = <InfoBanner tone="sky">Waiting on {client?.name ?? "the client"} to accept or decline the quotation.</InfoBanner>;
      break;
    case "Accepted":
      rentalPrimary = <HeaderAction icon={Truck} onClick={() => setShowAssign(true)}>Assign Vehicle &amp; Driver</HeaderAction>;
      break;
    case "Assigned":
      rentalPrimary = <HeaderAction icon={Check} onClick={() => updateBooking(booking.id, { status: "Active", updated: nowStamp() })}>Start Rental</HeaderAction>;
      rentalSecondary = <HeaderSecondaryAction icon={Truck} onClick={() => setShowAssign(true)}>Reassign</HeaderSecondaryAction>;
      break;
    case "Active":
      rentalPrimary = <HeaderAction icon={Check} onClick={() => updateBooking(booking.id, { status: "Completed", updated: nowStamp() })}>Mark Completed</HeaderAction>;
      break;
    default:
      break;
  }

  // ── Billing-track header action + info banner — driven by the latest
  // invoice's own status, not booking.status === "Invoiced"/"Paid". A
  // recurring-billing booking sits at "Active" between cycles (see
  // BK-2026-0004) and can still have a real invoice needing payment,
  // verification, or a tax invoice — gating this on booking.status would
  // hide it entirely, which is exactly the bug that made a recurring
  // booking's pending payment invisible on this panel.
  let billingPrimary: React.ReactNode = null;
  let billingInfo: React.ReactNode = null;
  if (latestInvoice?.status === "Payment Submitted") {
    billingInfo = (
      <InfoBanner tone="amber">
        {client?.name ?? "The client"} submitted payment ({latestInvoice.paymentReference}, {formatDate(latestInvoice.paymentDate)}) — view the invoice to verify it and issue the tax invoice.
      </InfoBanner>
    );
    billingPrimary = <HeaderAction icon={FileCheck2} onClick={() => openInvoice(latestInvoice.id, booking.id)}>View Invoice</HeaderAction>;
  } else if (latestInvoice && (latestInvoice.status === "Unpaid" || latestInvoice.status === "Overdue" || latestInvoice.status === "Payment Issue")) {
    billingInfo = (
      <div className="space-y-2">
        <InfoBanner tone="indigo">Waiting on {client?.name ?? "the client"} to submit payment.</InfoBanner>
        {latestInvoice.status === "Payment Issue" && (
          <InfoBanner tone="slate">
            <span className="font-semibold text-slate-600">Last claim rejected: </span>
            {latestInvoice.paymentRejectionReason}
          </InfoBanner>
        )}
      </div>
    );
  } else if (latestInvoice?.status === "Paid" && !latestInvoiceHasTaxInvoice) {
    billingInfo = (
      <InfoBanner tone="emerald">
        Payment verified. View the invoice to issue the tax invoice{!booking.isRecurringBilling ? " and close out this booking" : ""}.
      </InfoBanner>
    );
    billingPrimary = <HeaderAction icon={FileCheck2} onClick={() => openInvoice(latestInvoice.id, booking.id)}>View Invoice</HeaderAction>;
  } else if (booking.isRecurringBilling && invoiceEligible(booking)) {
    // Reachable only once the current cycle (if any) is fully closed out —
    // every earlier branch above claims any invoice that's still pending
    // payment, verification, or its tax invoice, so by the time we get
    // here there's either no invoice yet or the last one is done. Navigates
    // to the exact same OpsDocumentEditorPage a one-off booking's invoice
    // uses — the quotation's line items are already scoped to a monthly
    // rate (brief §6.1: "Issues Invoice (one-off, or monthly for long-term
    // rentals)"), so no separate pre-fill logic is needed for cycle 2, 3, 4...
    billingInfo = (
      <InfoBanner tone="indigo">
        {latestInvoice
          ? `Last cycle (${latestInvoice.id}) is fully settled — next monthly invoice is typically due around ${formatDate(addDays(latestInvoice.issuedAt.slice(0, 10), 30))}.`
          : "No invoice issued yet for this rental — ready to bill the first month."}
      </InfoBanner>
    );
    billingPrimary = <HeaderAction icon={FileCheck2} onClick={() => navigate(`/ops/bookings/${booking.id}/invoice/new`)}>Issue {latestInvoice ? "Next" : "First"} Invoice</HeaderAction>;
  } else if (!booking.isRecurringBilling && !latestInvoice && invoiceEligible(booking)) {
    // A one-off booking's only invoice — issuable from the moment a
    // vehicle+driver is assigned, same as the recurring case above, not
    // gated on the rental actually having finished. Reachable exactly once
    // per booking: the branches above already claim every case where an
    // invoice exists, so this only fires while there isn't one yet.
    billingInfo = <InfoBanner tone="indigo">Ready to invoice — doesn't have to wait until the rental is complete.</InfoBanner>;
    billingPrimary = <HeaderAction icon={FileCheck2} onClick={() => navigate(`/ops/bookings/${booking.id}/invoice/new`)}>Issue Invoice</HeaderAction>;
  } else if (!booking.isRecurringBilling && latestInvoice?.status === "Paid" && latestInvoiceHasTaxInvoice) {
    // The one-off equivalent of "fully closed out" — quotation, invoice, and
    // tax invoice all issued, nothing left on either track. Used to be its
    // own booking.status value ("Closed"); now derived the same way every
    // other billing-track message here is, from the invoice/tax-invoice
    // state directly (see this section's own header comment).
    billingInfo = <InfoBanner tone="emerald">Fully closed out — quotation, invoice, and tax invoice all issued.</InfoBanner>;
  }

  // Same hoisted-above-the-split, checked-first priority as
  // ClientBookingDetail.tsx's own declineReason handling, same tone map
  // (orange for Rejected, rose for Declined, slate for Cancelled) pulled
  // from StatusBadge's own colors so the banner agrees with the badge in
  // the header above it — just sourced from bookingStatusLabel (ops's own
  // Rejected/Declined split) instead of the client-facing label, which
  // reduces to the exact same three values for these terminal statuses.
  let declineArea: React.ReactNode = null;
  if (booking.declineReason) {
    const declineLabel = bookingStatusLabel(booking);
    const tone =
      declineLabel === "Cancelled" ? "bg-slate-50 border-slate-100 text-slate-500"
      : declineLabel === "Rejected" ? "bg-orange-50 border-orange-100 text-orange-700"
      : "bg-rose-50 border-rose-100 text-rose-700"; // Declined
    const lead = declineLabel === "Cancelled" ? "Cancellation reason: " : declineLabel === "Rejected" ? "Rejection reason: " : "Decline reason: ";
    declineArea = (
      <div className={`border rounded-lg px-3 py-2.5 text-xs leading-relaxed ${tone}`}>
        <span className="font-semibold">{lead}</span>
        {booking.declineReason}
      </div>
    );
  }

  // Same rental-only timeline as ClientBookingDetail.tsx — buildRentalTimeline
  // takes just a booking + its quotations, nothing client-specific, so it's
  // exactly what should have replaced RequestInbox.tsx's old BookingProgress/
  // InvoiceProgress steppers once this panel dropped those (see file header
  // comment) rather than nothing at all.
  const timeline = buildRentalTimeline(booking, quotationsForBooking);

  return (
    <>
      <div className="max-w-[1600px]">
        {/* Page header — title/badge/byline on the left, up to two action
            clusters top-right, same slot and sizing as
            ClientBookingDetail.tsx's own "View Quotation"/"View Invoice"
            button. Two clusters (not one) only when a booking genuinely has
            both a rental-track and a billing-track action pending at once
            (e.g. Active with a Payment Submitted invoice) — the client
            portal's own state machine never produces that combination, so
            its header never needs more than one. */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-semibold text-slate-900">{booking.id}</h1>
              <StatusBadge status={bookingStatusLabel(booking)} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              For {client?.name ?? booking.clientId} · Requested by {booking.requestedByName} · {formatDate(booking.created)}
            </p>
          </div>
          {(rentalPrimary || billingPrimary) && (
            <div className="flex items-start gap-3 shrink-0">
              {rentalPrimary && (
                <div className="flex items-center gap-1.5">
                  {rentalPrimary}
                  {rentalSecondary}
                </div>
              )}
              {billingPrimary && (
                <div className="flex items-center gap-1.5">
                  {billingPrimary}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full-width context banners — decline reason first (checked
            first, same priority as ClientBookingDetail.tsx), then whichever
            track(s) have something to say but no button of their own
            (Quoted/waiting, Unpaid/waiting, Closed, a settled recurring
            cycle, ...). Plain banners, not a bordered "Next Step" card —
            same tier as ClientBookingDetail.tsx's own actionArea. */}
        {(declineArea || rentalInfo || billingInfo) && (
          <div className="space-y-2 mb-5">
            {declineArea}
            {rentalInfo}
            {billingInfo}
          </div>
        )}

        {/* Same 3:2 two-column split as ClientBookingDetail.tsx, same
            lg:grid-cols-5 breakpoint — Rental Details + Assigned Vehicle &
            Driver on the wide left, Documents + Issue Reports on the
            narrow right, matching that file's own Rental Details+
            Assignment / Documents & Billing+Issue Reports+Timeline split. */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Rental Details</h4>
              {/* Rental Type folded into Rental Period's own value line
                  ("dates · type"), same as ClientBookingDetail.tsx — one
                  label instead of a separate tile next to it. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatTile
                  icon={Calendar}
                  label="Rental Period"
                  value={
                    <>
                      {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                      <span className="text-slate-400 font-normal"> · {booking.rentalType}</span>
                    </>
                  }
                />
                <StatTile icon={Truck} label="Vehicle Class" value={booking.vehicleClassRequested} />
                <StatTile icon={Hash} label="Quantity" value={String(booking.quantity)} />
                <StatTile icon={MapPin} label="Branch Location" value={booking.pickupLocation} />
                <StatTile icon={Repeat} label="Recurring Billing" value={booking.isRecurringBilling ? "Yes — monthly" : "No"} />
              </div>
              {booking.jobNotes && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-normal text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{booking.jobNotes}</p>
                </div>
              )}
            </div>

            {/* Gated on the booking having left Requested/Quoted (i.e. the
                client has nothing left to decide — REQUEST_STATUSES, same
                boundary ClientBookingDetail.tsx gates its own mirrored card
                on), not on an assignment actually existing yet — same fix
                as that file's own: without this an Accepted-but-unassigned
                booking would just silently skip this card instead of
                showing "not yet assigned," which reads as this page being
                broken rather than as the expected pending state it is. */}
            {!REQUEST_STATUSES.includes(booking.status) && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Assigned Vehicle & Driver</h4>
                {assignmentUnits.length > 0 ? (
                  <div className="space-y-3">
                    {assignmentUnits.map((rows, i) => (
                      <div key={i}>
                        {assignmentUnits.length > 1 && (
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Truck size={11} /> Unit {i + 1}
                          </p>
                        )}
                        <AssignmentRows rows={rows} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Not yet assigned — use Assign Vehicle &amp; Driver above.</p>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-5">
            {(quotationsForBooking.length > 0 || invoicesForBooking.length > 0 || taxInvoicesForBooking.length > 0) && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Documents</h4>
                <DocumentChain quotations={quotationsForBooking} invoices={invoicesForBooking} taxInvoices={taxInvoicesForBooking} onOpenTaxInvoice={openTaxInvoice} />
              </div>
            )}

            {SHOW_ISSUE_REPORTS && issues.length > 0 && (
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
                          <span className="font-semibold text-slate-600">Resolution: </span>
                          {issue.resolutionNotes}
                        </div>
                      )}
                      {issue.status === "Open" && (
                        resolvingId === issue.id ? (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                            <textarea
                              rows={2}
                              value={resolutionNotes}
                              onChange={(e) => setResolutionNotes(e.target.value)}
                              placeholder="Optional — what was done about it..."
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] resize-none"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => setResolvingId(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer">
                                Back
                              </button>
                              <button onClick={() => handleResolveIssue(issue.id)} className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 cursor-pointer">
                                Mark Resolved
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setResolvingId(issue.id); setResolutionNotes(""); }}
                            className="mt-1 text-xs font-medium text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] cursor-pointer"
                          >
                            Mark Resolved
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Rental Timeline</h4>
              <div className="bg-slate-50 rounded-xl p-4">
                <RentalTimeline entries={timeline} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAssign && (
        <ActionModal
          title={hasExistingAssignment ? "Reassign Vehicle & Driver" : "Assign Vehicle & Driver"}
          subtitle={booking.id}
          onClose={() => setShowAssign(false)}
        >
          <AssignmentForm booking={booking} vehicles={vehicles} drivers={drivers} allBookings={allBookings} onCancel={() => setShowAssign(false)} onAssign={handleAssign} />
        </ActionModal>
      )}

      {showReject && (
        <ActionModal title="Reject Request" subtitle={booking.id} onClose={() => setShowReject(false)}>
          <ReasonForm
            title="Reason for rejecting"
            placeholder="Let the client know why — no matching vehicles, dates don't work, etc..."
            confirmLabel="Confirm Rejection"
            onCancel={() => setShowReject(false)}
            onConfirm={handleRejectRequest}
          />
        </ActionModal>
      )}

    </>
  );
}
