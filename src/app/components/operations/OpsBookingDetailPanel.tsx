import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/app/components/ui/Button";
import { Textarea } from "@/app/components/ui/Input";
import { Check, Car, Truck, AlertTriangle, FileCheck2, Ban, Hash, Calendar, MapPin, MoreHorizontal, Pencil, Play, XCircle, ChevronRight, type LucideIcon } from "lucide-react";
import {
  type Booking, type VehicleDriverAssignment, bookingInvoices, bookingQuotations, fleetCoBookingStatusLabel, bookingTaxInvoices, invoiceEligible, isRentalBooking,
} from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import type { Vehicle, VehicleClass } from "@/app/data/vehicles";
import type { Driver } from "@/app/data/drivers";
import { isQuotationExpired, type Quotation } from "@/app/data/quotations";
import { invoiceDisplayStatus, type Invoice } from "@/app/data/invoices";
import type { TaxInvoice } from "@/app/data/taxInvoices";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { StatTile } from "@/app/components/ui/StatTile";
import { DocumentChain } from "@/app/components/ui/DocumentChain";
import { RentalTimeline, buildRentalTimeline } from "@/app/components/ui/RentalTimeline";
import { ReasonForm } from "@/app/components/ui/ReasonForm";
import { ActionModal } from "@/app/components/ui/ActionModal";
import { formatDate, localDateKey } from "@/app/components/ui/utils";
import { getVehicleConflicts, getDriverConflicts, type Conflict } from "@/app/lib/assignmentConflicts";
import { getRentalReminder, rentalReminderLabel } from "@/app/lib/fleetCoActions";
import { updateBooking } from "@/app/lib/bookingsStore";
import { transitionVehicleStatusBatch, transitionVehicleStatuses } from "@/app/lib/vehiclesStore";
import { useIssueReports, updateIssueReport } from "@/app/lib/issueReportsStore";
import { SHOW_ISSUE_REPORTS } from "@/app/data/issueReports";
import { addNotification } from "@/app/lib/notificationsStore";
import { useLocation, useNavigate } from "react-router";
import { useOpenTaxInvoice } from "@/app/lib/documentNav";
import { toastError, toastSuccess } from "@/app/lib/toast";
import { addCalendarDays, demoNowStamp } from "@/app/data/demoDates";

function AnimatedDetails({
  label,
  count,
  muted = false,
  children,
}: {
  label: string;
  count: number;
  muted?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full cursor-pointer list-none items-center gap-1.5 px-1 py-1 text-left text-[11px] font-medium ${muted ? "text-slate-400" : "text-slate-500"}`}
      >
        {label} ({count})
        <ChevronRight size={14} className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className={`min-h-0 overflow-hidden ${open ? "visible" : "invisible pointer-events-none"}`}>
          <div className="pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

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
// (Verify Payment & Issue Tax Invoice, Reject Payment) has moved to
// InvoiceDetail.tsx, for the same reason Accept/Decline live on
// QuotationDetail.tsx and Mark-as-Paid lives on InvoiceDetail.tsx already —
// this page's billing cluster is now just a "View Invoice" hand-off, same
// role ClientBookingDetail's own "View Invoice" button already plays.

function nowStamp() {
  return demoNowStamp();
}

function addDays(dateStr: string, days: number): string {
  return addCalendarDays(dateStr, days);
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

// Shared by the page-level capacity banner (Requested/Accepted) and the
// assignment modal itself — the modal has no other route to this context
// when editing an existing assignment, since the page banner only renders
// pre-assignment.
function formatCapacitySummary(quantity: number, vehicleClass: string, availableVehicleCount: number, availableDriverCount: number) {
  const vehicleLabel = quantity === 1 ? vehicleClass : `${vehicleClass}s`;
  const required = `${quantity} ${vehicleLabel} and ${quantity} compatible driver${quantity === 1 ? "" : "s"}`;
  const available = `${availableVehicleCount} matching vehicle${availableVehicleCount === 1 ? "" : "s"} and ${availableDriverCount} compatible driver${availableDriverCount === 1 ? "" : "s"}`;
  return { required, available, hasCapacity: availableVehicleCount >= quantity && availableDriverCount >= quantity };
}

// The header's one primary action — same size/weight/color as
// ClientBookingDetail.tsx's own "View Quotation"/"View Invoice" button
// (h-8, accent fill), so the two portals' pages read as the same control
// in the same place, not a family resemblance.
function HeaderAction({
  onClick, icon: Icon, children, title,
}: { onClick: () => void; icon: LucideIcon; children: React.ReactNode; title?: string }) {
  return (
    <Button variant="primary" size="toolbar" className="shrink-0"
      onClick={onClick} title={title}
    >
      <Icon size={13} /> {children}
    </Button>
  );
}

// A secondary option next to a primary header action (Reject a request
// that's about to be quoted, reassign instead of starting, dispute a
// payment claim) — visibly lighter than HeaderAction so the primary path
// still reads as the default one click away.
function HeaderSecondaryAction({
  onClick, icon: Icon, children, compact = false,
}: { onClick: () => void; icon: LucideIcon; children: React.ReactNode; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer shrink-0 ${compact ? "h-7 px-2.5" : "h-8 px-3"}`}
    >
      <Icon size={13} /> {children}
    </button>
  );
}

// The billing-track counterpart to a rental-track HeaderAction — flat like
// HeaderSecondaryAction (no solid fill, so it doesn't compete with whichever
// rental action is sitting solid right next to it), but tinted with the
// brand color instead of neutral slate, so it still reads as a real action
// rather than chrome.
function HeaderTonalAction({
  onClick, icon: Icon, children,
}: { onClick: () => void; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--portal-accent-light-2)] bg-[var(--portal-accent-light)] px-3 text-xs font-medium text-[var(--portal-accent)] hover:bg-[var(--portal-accent-light-2)] cursor-pointer"
    >
      <Icon size={13} /> {children}
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
            aria-pressed={selected}
            aria-label={`${selected ? "Selected" : "Select"} vehicle ${v.plateNumber}`}
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
              <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-800">
                {selected && <Check size={13} className="shrink-0 text-[var(--portal-accent)]" />}
                <span className="truncate">{v.plateNumber} · {v.brand} {v.model}</span>
              </span>
              {(selected || disabled) && (
                <StatusBadge status={selected ? "Selected" : "Unavailable"} />
              )}
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
    <div className="space-y-1.5">
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
            aria-pressed={selected}
            aria-label={`${selected ? "Selected" : "Select"} driver ${d.name}`}
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
              <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-800">
                {selected && <Check size={13} className="shrink-0 text-[var(--portal-accent)]" />}
                <span className="truncate">{d.name}</span>
              </span>
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

function pairPreferenceScore(vehicle: Vehicle, driver: Driver): number {
  // These are soft signals only. A driver's usual vehicle gets the strongest
  // preference, followed by a shared base location; neither one reserves a
  // vehicle or restricts where the driver may work.
  if (driver.homeVehicleId === vehicle.id) return 0;
  if (driver.homeBase && driver.homeBase === vehicle.homeDepot) return 1;
  return 2;
}

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
  const isReassignment = (booking.assignments?.length ?? 0) > 0;
  const matchingVehicles = vehicles.filter((v) => v.vehicleClass === booking.vehicleClassRequested);
  const vehicleConflicts = new Map(matchingVehicles.map((v) => [v.id, getVehicleConflicts(v, booking, allBookings)]));
  const driverConflicts = new Map(
    drivers.map((d) => [d.id, getDriverConflicts(d, booking, allBookings, booking.vehicleClassRequested)]),
  );
  // Keep successful demo choices immediately visible while retaining blocked
  // options underneath so conflict detection can still be demonstrated.
  const candidateVehicles = [...matchingVehicles].sort(
    (a, b) => (vehicleConflicts.get(a.id)?.length ?? 0) - (vehicleConflicts.get(b.id)?.length ?? 0),
  );
  const candidateDrivers = [...drivers].sort(
    (a, b) => (driverConflicts.get(a.id)?.length ?? 0) - (driverConflicts.get(b.id)?.length ?? 0),
  );
  const suggestedVehicles = candidateVehicles.filter((vehicle) => (vehicleConflicts.get(vehicle.id)?.length ?? 0) === 0);
  const suggestedDrivers = candidateDrivers.filter((driver) => (driverConflicts.get(driver.id)?.length ?? 0) === 0);
  const suggestedPairs = matchingVehicles
    .flatMap((vehicle) => drivers.map((driver) => ({ vehicle, driver })))
    .filter(({ vehicle, driver }) =>
      (vehicleConflicts.get(vehicle.id)?.length ?? 0) === 0 &&
      (driverConflicts.get(driver.id)?.length ?? 0) === 0,
    )
    .sort((a, b) => pairPreferenceScore(a.vehicle, a.driver) - pairPreferenceScore(b.vehicle, b.driver))
    .reduce<Array<{ vehicleId: string; driverId: string }>>((pairs, candidate) => {
      if (pairs.length >= unitCount) return pairs;
      if (pairs.some((pair) => pair.vehicleId === candidate.vehicle.id || pair.driverId === candidate.driver.id)) return pairs;
      pairs.push({ vehicleId: candidate.vehicle.id, driverId: candidate.driver.id });
      return pairs;
    }, []);
  const canSuggestCompleteAssignment = suggestedPairs.length >= unitCount;

  // Pre-filled from whatever's already assigned (reassignment case) — same
  // "start from the current state" behavior the single-pair form had. A new
  // happy-case booking starts with a complete, conflict-free suggestion so
  // the operator only needs to review and confirm it.
  const [picks, setPicks] = useState<UnitPick[]>(() => {
    const existing = booking.assignments ?? [];
    return Array.from({ length: unitCount }, (_, i) => ({
      vehicleId: existing[i]?.vehicleId ?? (canSuggestCompleteAssignment ? suggestedPairs[i].vehicleId : null),
      driverId: existing[i]?.driverId ?? (canSuggestCompleteAssignment ? suggestedPairs[i].driverId : null),
    }));
  });
  const [currentUnit, setCurrentUnit] = useState<number | null>(null);

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

  const currentPick = picks[currentUnit ?? 0];
  const vehiclesElsewhere = new Set(
    picks.filter((_, index) => index !== currentUnit).map((pick) => pick.vehicleId).filter((id): id is string => !!id),
  );
  const driversElsewhere = new Set(
    picks.filter((_, index) => index !== currentUnit).map((pick) => pick.driverId).filter((id): id is string => !!id),
  );
  const availableVehicles = candidateVehicles.filter(
    (vehicle) => (vehicleConflicts.get(vehicle.id)?.length ?? 0) === 0 && !vehiclesElsewhere.has(vehicle.id),
  );
  const unavailableVehicles = candidateVehicles.filter((vehicle) => !availableVehicles.includes(vehicle));
  const availableDrivers = candidateDrivers.filter(
    (driver) => (driverConflicts.get(driver.id)?.length ?? 0) === 0 && !driversElsewhere.has(driver.id),
  );
  const unavailableDrivers = candidateDrivers.filter((driver) => !availableDrivers.includes(driver));
  const selectedAvailableVehicles = availableVehicles.filter((vehicle) => vehicle.id === currentPick.vehicleId);
  const otherAvailableVehicles = availableVehicles.filter((vehicle) => vehicle.id !== currentPick.vehicleId);
  const selectedAvailableDrivers = availableDrivers.filter((driver) => driver.id === currentPick.driverId);
  const otherAvailableDrivers = availableDrivers.filter((driver) => driver.id !== currentPick.driverId);
  const isSuggestedAssignment = !isReassignment && canSuggestCompleteAssignment;
  // Restates the page's capacity context inside the modal — the "Edit
  // Assignment" entry point (an already-Assigned booking) never shows the
  // page-level banner at all, so this is otherwise invisible once here.
  const capacity = formatCapacitySummary(unitCount, booking.vehicleClassRequested, suggestedVehicles.length, suggestedDrivers.length);
  const capacityMessage = capacity.hasCapacity
    ? `Capacity available — ${capacity.available} found.`
    : `${capacity.required} required; ${capacity.available} available.`;
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className={`flex items-start gap-2 ${isSuggestedAssignment ? "text-xs text-emerald-700" : "text-[11px] leading-4 text-slate-500"}`}>
          {isSuggestedAssignment ? (
            <Check size={14} className="mt-0.5 shrink-0" />
          ) : capacity.hasCapacity ? (
            <Check size={12} className="mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
          )}
          <span>
            {isSuggestedAssignment ? (
              <><span className="font-semibold">Review suggested assignment.</span> We selected the best available vehicle and driver based on usual pairing and home base.</>
            ) : (
              capacityMessage
            )}
          </span>
        </div>
        <div className="mt-2 flex items-start gap-2 border-t border-slate-200 pt-2 text-[11px] leading-4 text-slate-500">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-slate-400" />
          <span>Before confirming, verify that the selected vehicle and driver can reach this rental. Travel time isn&apos;t checked automatically.</span>
        </div>
      </div>

      <div className="space-y-2">
        {picks.map((pick, index) => {
          const open = index === currentUnit;
          const vehicle = vehicles.find((item) => item.id === pick.vehicleId);
          const driver = drivers.find((item) => item.id === pick.driverId);
          const complete = !!vehicle && !!driver;
          return (
            <section key={index} className={`overflow-hidden rounded-lg border ${open ? "border-[var(--portal-accent-soft)]" : "border-slate-200"}`}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setCurrentUnit(open ? null : index)}
                className={`flex w-full items-center gap-3 px-3 py-3 text-left cursor-pointer ${open ? "bg-[var(--portal-accent-light)]" : "bg-white hover:bg-slate-50"}`}
              >
                <span className={`relative flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {complete ? (
                    <>
                      <Car size={15} />
                      <span className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-emerald-600 ring-[1.5px] ring-white">
                        <Check size={7} strokeWidth={3} className="text-white" />
                      </span>
                    </>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-800">Unit {index + 1}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {complete ? `${vehicle.plateNumber} · ${driver.name}` : "Vehicle and driver required"}
                  </span>
                </span>
                <ChevronRight size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
              </button>

              <div
                aria-hidden={!open}
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className={`min-h-0 overflow-hidden ${open ? "visible" : "invisible pointer-events-none"}`}>
                <div className="space-y-5 border-t border-slate-200 bg-white p-3">
                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Vehicle · {booking.vehicleClassRequested}
                      </h4>
                      <span className="text-[11px] text-emerald-700">{availableVehicles.length} available</span>
                    </div>
                    {selectedAvailableVehicles.length > 0 ? (
                      <VehiclePickerList
                        vehicleClass={booking.vehicleClassRequested}
                        candidates={selectedAvailableVehicles}
                        conflictsMap={vehicleConflicts}
                        selectedId={currentPick.vehicleId}
                        pickedElsewhere={vehiclesElsewhere}
                        onSelect={(id) => setPick(index, { vehicleId: id })}
                      />
                    ) : availableVehicles.length > 0 ? (
                      <VehiclePickerList
                        vehicleClass={booking.vehicleClassRequested}
                        candidates={availableVehicles}
                        conflictsMap={vehicleConflicts}
                        selectedId={currentPick.vehicleId}
                        pickedElsewhere={vehiclesElsewhere}
                        onSelect={(id) => setPick(index, { vehicleId: id })}
                      />
                    ) : (
                      <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">No vehicles are available for these dates.</p>
                    )}
                    {selectedAvailableVehicles.length > 0 && otherAvailableVehicles.length > 0 && (
                      <AnimatedDetails label="Other available vehicles" count={otherAvailableVehicles.length}>
                        <VehiclePickerList
                          vehicleClass={booking.vehicleClassRequested}
                          candidates={otherAvailableVehicles}
                          conflictsMap={vehicleConflicts}
                          selectedId={currentPick.vehicleId}
                          pickedElsewhere={vehiclesElsewhere}
                          onSelect={(id) => setPick(index, { vehicleId: id })}
                        />
                      </AnimatedDetails>
                    )}
                    {unavailableVehicles.length > 0 && (
                      <AnimatedDetails label="Unavailable vehicles" count={unavailableVehicles.length} muted>
                        <VehiclePickerList
                          vehicleClass={booking.vehicleClassRequested}
                          candidates={unavailableVehicles}
                          conflictsMap={vehicleConflicts}
                          selectedId={currentPick.vehicleId}
                          pickedElsewhere={vehiclesElsewhere}
                          onSelect={(id) => setPick(index, { vehicleId: id })}
                        />
                      </AnimatedDetails>
                    )}
                  </section>

                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</h4>
                      <span className="text-[11px] text-emerald-700">{availableDrivers.length} available</span>
                    </div>
                    {selectedAvailableDrivers.length > 0 ? (
                      <DriverPickerList
                        candidates={selectedAvailableDrivers}
                        conflictsMap={driverConflicts}
                        selectedId={currentPick.driverId}
                        pickedElsewhere={driversElsewhere}
                        onSelect={(id) => setPick(index, { driverId: id })}
                      />
                    ) : availableDrivers.length > 0 ? (
                      <DriverPickerList
                        candidates={availableDrivers}
                        conflictsMap={driverConflicts}
                        selectedId={currentPick.driverId}
                        pickedElsewhere={driversElsewhere}
                        onSelect={(id) => setPick(index, { driverId: id })}
                      />
                    ) : (
                      <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">No compatible drivers are available for these dates.</p>
                    )}
                    {selectedAvailableDrivers.length > 0 && otherAvailableDrivers.length > 0 && (
                      <AnimatedDetails label="Other available drivers" count={otherAvailableDrivers.length}>
                        <DriverPickerList
                          candidates={otherAvailableDrivers}
                          conflictsMap={driverConflicts}
                          selectedId={currentPick.driverId}
                          pickedElsewhere={driversElsewhere}
                          onSelect={(id) => setPick(index, { driverId: id })}
                        />
                      </AnimatedDetails>
                    )}
                    {unavailableDrivers.length > 0 && (
                      <AnimatedDetails label="Unavailable drivers" count={unavailableDrivers.length} muted>
                        <DriverPickerList
                          candidates={unavailableDrivers}
                          conflictsMap={driverConflicts}
                          selectedId={currentPick.driverId}
                          pickedElsewhere={driversElsewhere}
                          onSelect={(id) => setPick(index, { driverId: id })}
                        />
                      </AnimatedDetails>
                    )}
                  </section>
                </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!allOk}
            onClick={() => allOk && onAssign(picks.map((pick) => ({ vehicleId: pick.vehicleId!, driverId: pick.driverId! })))}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--portal-accent)] text-xs font-medium text-white hover:bg-[var(--portal-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--portal-accent)] cursor-pointer"
          >
            <Check size={13} /> {isReassignment ? "Confirm Reassignment" : `Confirm Assignment${unitCount > 1 ? "s" : ""}`}
          </button>
        </div>
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
  const location = useLocation();
  const [showAssign, setShowAssign] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showBookingActions, setShowBookingActions] = useState(false);
  const bookingActionsRef = useRef<HTMLDivElement | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const openTaxInvoice = useOpenTaxInvoice();

  function openDocumentEditor(mode: "quotation" | "invoice") {
    const bookingOrigin = location.state as { navPath?: string } | null;
    const navPath = bookingOrigin?.navPath?.startsWith("/ops/") ? bookingOrigin.navPath : undefined;
    navigate(`/ops/bookings/${booking.id}/${mode}/new`, {
      state: {
        returnTo: `/ops/bookings/${booking.id}`,
        returnLabel: "Booking",
        ...(navPath ? { navPath } : {}),
        ...(location.state ? { returnState: location.state } : {}),
      },
    });
  }

  useEffect(() => {
    if (!showBookingActions) return;
    function handleOutsideClick(event: MouseEvent) {
      if (bookingActionsRef.current && !bookingActionsRef.current.contains(event.target as Node)) {
        setShowBookingActions(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showBookingActions]);

  const allIssues = useIssueReports();
  const issues = allIssues.filter((r) => r.bookingId === booking.id);

  function handleResolveIssue(issueId: string) {
    updateIssueReport(issueId, { status: "Resolved", resolutionNotes: resolutionNotes.trim() || undefined, resolvedAt: nowStamp() });
    setResolvingId(null);
    setResolutionNotes("");
    toastSuccess("Issue report resolved.");
  }

  // Reverse lookups, not booking.quotationId/invoiceId/taxInvoiceId — see
  // bookings.ts. A recurring-billing booking can have more than one invoice
  // over its life, which a single forward pointer can't represent; these
  // read from each document's own bookingId back-reference instead.
  const quotationsForBooking = bookingQuotations(booking.id, quotations);
  const latestQuotation = quotationsForBooking[0];
  const acceptedQuotation = quotationsForBooking.find((quotation) => quotation.status === "Accepted");
  const invoicesForBooking = bookingInvoices(booking.id, invoices);
  const taxInvoicesForBooking = bookingTaxInvoices(booking.id, taxInvoices);
  const latestInvoice = invoicesForBooking[0];
  const latestInvoiceStatus = latestInvoice ? invoiceDisplayStatus(latestInvoice) : undefined;
  const latestInvoiceHasTaxInvoice = !!latestInvoice && taxInvoicesForBooking.some((t) => t.invoiceId === latestInvoice.id);
  const hasExistingAssignment = (booking.assignments?.length ?? 0) > 0;
  const availableVehicleCount = vehicles.filter(
    (vehicle) =>
      vehicle.vehicleClass === booking.vehicleClassRequested &&
      getVehicleConflicts(vehicle, booking, allBookings).length === 0,
  ).length;
  const availableDriverCount = drivers.filter(
    (driver) => getDriverConflicts(driver, booking, allBookings, booking.vehicleClassRequested).length === 0,
  ).length;
  const hasVehicleCapacity = availableVehicleCount >= booking.quantity;
  const hasDriverCapacity = availableDriverCount >= booking.quantity;

  function resourceAvailabilityBanner() {
    const { required, available, hasCapacity } = formatCapacitySummary(
      booking.quantity, booking.vehicleClassRequested, availableVehicleCount, availableDriverCount,
    );
    if (hasCapacity) {
      return (
        <InfoBanner tone="emerald">
          <span className="font-semibold">Capacity available — </span>
          {required} required; {available} available.
        </InfoBanner>
      );
    }
    const shortageTitle = !hasVehicleCapacity && !hasDriverCapacity
      ? "Vehicle and driver shortage"
      : !hasVehicleCapacity
        ? "Vehicle shortage"
        : "Driver shortage";
    return (
      <InfoBanner tone="amber">
        <span className="font-semibold">{shortageTitle} — </span>
        {required} required; {available} available.
      </InfoBanner>
    );
  }

  function handleAssign(assignments: VehicleDriverAssignment[]) {
    if (!acceptedQuotation) {
      setLifecycleError("An accepted quotation is required before assigning a vehicle and driver.");
      return;
    }
    const previousVehicleIds = new Set((booking.assignments ?? []).map((assignment) => assignment.vehicleId));
    const nextVehicleIds = new Set(assignments.map((assignment) => assignment.vehicleId));
    try {
      transitionVehicleStatusBatch([
        ...[...previousVehicleIds]
          .filter((vehicleId) => !nextVehicleIds.has(vehicleId))
          .map((id) => ({
            id,
            transition: {
              toStatus: "Available" as const,
              source: "booking" as const,
              bookingId: booking.id,
              actingUser: "Operations",
              reason: "Vehicle released after booking reassignment",
            },
          })),
        ...[...nextVehicleIds].map((id) => ({
          id,
          transition: {
            toStatus: "Reserved" as const,
            source: "booking" as const,
            bookingId: booking.id,
            actingUser: "Operations",
            reason: "Vehicle reserved for booking",
          },
        })),
      ]);
    } catch (error) {
      setLifecycleError(error instanceof Error ? error.message : "Unable to synchronize vehicle status.");
      toastError("Could not assign resources to {id}.", { id: booking.id });
      return;
    }
    // assignedAt is separate from updated (which every later transition also
    // touches) — see Booking's own comment on the field. Written once, here,
    // the only place a booking ever reaches "Assigned".
    const stamp = nowStamp();
    updateBooking(booking.id, { status: "Assigned", assignments, assignedAt: stamp, updated: stamp });
    setLifecycleError(null);
    setShowAssign(false);
    addNotification({
      eventTypeId: "assignment_made",
      portal: "client",
      recipient: `Thailand Post — ${booking.requestedByName}`,
      bookingId: booking.id,
      message: `Vehicle and driver assigned to booking ${booking.id}.`,
    });
    toastSuccess("Vehicle and driver assigned to {id}.", { id: booking.id });
  }

  function handleRejectRequest(reason: string) {
    updateBooking(booking.id, { status: "Declined", declineReason: reason, updated: nowStamp() });
    setShowReject(false);
    toastSuccess("Request {id} declined.", { id: booking.id });
  }

  // Ops-side mirror of ClientBookingDetail's own handleCancelBooking — same
  // release-then-cancel shape, kept as its own function rather than routed
  // through transitionAssignedVehicles below because "no assignment yet" is
  // the normal case here (Accepted), not an error to block on. Offered from
  // Accepted/Assigned only, not Requested: Requested already has its own
  // ops-initiated negative action (Reject Request, above) — adding a second,
  // overlapping one there would be exactly the confusion
  // ClientBookingDetail's own cancellable comment already calls out for why
  // Quoted stays excluded on that side.
  function handleCancelBooking(reason: string) {
    const vehicleIds = [...new Set((booking.assignments ?? []).map((assignment) => assignment.vehicleId))];
    if (vehicleIds.length > 0) {
      try {
        transitionVehicleStatuses(vehicleIds, {
          toStatus: "Available",
          source: "booking",
          bookingId: booking.id,
          actingUser: "Operations",
          reason: "Booking cancelled",
        });
      } catch (error) {
        setLifecycleError(error instanceof Error ? error.message : "Unable to release the assigned vehicle.");
        toastError("Could not cancel {id}.", { id: booking.id });
        return;
      }
    }
    const stamp = nowStamp();
    updateBooking(booking.id, {
      status: "Cancelled",
      cancelledFromStatus: booking.status,
      cancelledBy: "fleetco",
      cancelledAt: stamp,
      cancellationReason: reason,
      updated: stamp,
    });
    setLifecycleError(null);
    setShowCancel(false);
    addNotification({
      eventTypeId: "booking_cancelled",
      portal: "client",
      recipient: `Thailand Post — ${booking.requestedByName}`,
      bookingId: booking.id,
      message: `${booking.id} was cancelled by FleetCo: ${reason}`,
    });
    toastSuccess("Booking {id} cancelled.", { id: booking.id });
  }

  function transitionAssignedVehicles(toStatus: "On Rental" | "Available", reason: string): boolean {
    const vehicleIds = [...new Set((booking.assignments ?? []).map((assignment) => assignment.vehicleId))];
    if (vehicleIds.length === 0) {
      setLifecycleError("This booking has no assigned vehicle. Assign a vehicle before moving the rental forward.");
      return false;
    }
    try {
      transitionVehicleStatuses(vehicleIds, {
        toStatus,
        source: "booking",
        bookingId: booking.id,
        actingUser: "Operations",
        reason,
      });
      setLifecycleError(null);
      return true;
    } catch (error) {
      setLifecycleError(error instanceof Error ? error.message : "Unable to synchronize vehicle status.");
      toastError("Could not update rental {id}.", { id: booking.id });
      return false;
    }
  }

  function handleStartRental() {
    if (!transitionAssignedVehicles("On Rental", "Rental started")) return;
    const stamp = nowStamp();
    updateBooking(booking.id, { status: "Active", startedAt: stamp, updated: stamp });
    toastSuccess("Rental {id} started.", { id: booking.id });
  }

  function handleCompleteRental() {
    if (!transitionAssignedVehicles("Available", "Rental completed")) return;
    const stamp = nowStamp();
    updateBooking(booking.id, { status: "Completed", completedAt: stamp, updated: stamp });
    toastSuccess("Rental {id} completed.", { id: booking.id });
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
  // Both Start and Complete are manual-only (see handleStartRental /
  // handleCompleteRental below) — a real click, not a calendar date, is
  // what advances a booking. That means the schedule and the confirmed
  // status can drift in either direction, and this is the page the actual
  // action buttons live on, so it's the right place to say so — not just
  // the vehicle page, which can only point back here.
  const today = localDateKey();
  const rentalReminder = getRentalReminder(booking, today);
  const expiredQuotation = booking.status === "Quoted" && !!latestQuotation && isQuotationExpired(latestQuotation);
  const canIssueQuotationRevision = expiredQuotation && booking.startDate >= today;
  switch (booking.status) {
    case "Requested":
      rentalPrimary = <HeaderAction icon={FileCheck2} onClick={() => openDocumentEditor("quotation")}>Create Quotation</HeaderAction>;
      rentalSecondary = <HeaderSecondaryAction icon={Ban} onClick={() => setShowReject(true)}>Reject Request</HeaderSecondaryAction>;
      rentalInfo = resourceAvailabilityBanner();
      break;
    case "Quoted":
      if (expiredQuotation) {
        if (canIssueQuotationRevision) {
          rentalPrimary = <HeaderAction icon={FileCheck2} onClick={() => openDocumentEditor("quotation")}>Issue Revision</HeaderAction>;
          rentalInfo = <InfoBanner tone="amber"><span className="font-semibold">Quotation expired — </span>issue a revised quotation before asking {client?.name ?? "the client"} to decide.</InfoBanner>;
        } else {
          rentalInfo = <InfoBanner tone="slate"><span className="font-semibold">Quotation expired — </span>the rental start date has passed, so this request is closed.</InfoBanner>;
        }
      } else {
        rentalInfo = <InfoBanner tone="sky">Waiting on {client?.name ?? "the client"} to accept or decline the quotation.</InfoBanner>;
      }
      break;
    case "Accepted":
      rentalPrimary = <HeaderAction icon={Truck} onClick={() => setShowAssign(true)}>Assign Vehicle &amp; Driver</HeaderAction>;
      rentalInfo = resourceAvailabilityBanner();
      break;
    case "Assigned":
      rentalPrimary = <HeaderAction icon={Play} onClick={handleStartRental}>Start Rental</HeaderAction>;
      if (rentalReminder === "start_overdue") {
        rentalInfo = <InfoBanner tone="amber"><span className="font-semibold">{rentalReminderLabel(rentalReminder)} — </span>The rental period started on {formatDate(booking.startDate)}, but Start Rental hasn&apos;t been clicked yet.</InfoBanner>;
      } else if (rentalReminder === "start_due") {
        rentalInfo = <InfoBanner tone="amber"><span className="font-semibold">{rentalReminderLabel(rentalReminder)} — </span>Confirm the actual handover before starting the rental.</InfoBanner>;
      }
      break;
    case "Active":
      if (rentalReminder === "completion_overdue") {
        rentalPrimary = <HeaderAction icon={Check} onClick={handleCompleteRental}>Complete Rental</HeaderAction>;
        rentalInfo = <InfoBanner tone="amber"><span className="font-semibold">{rentalReminderLabel(rentalReminder)} — </span>The rental period ended on {formatDate(booking.endDate)}. Confirm the return or extension.</InfoBanner>;
      } else if (rentalReminder === "completion_due") {
        rentalPrimary = <HeaderAction icon={Check} onClick={handleCompleteRental}>Complete Rental</HeaderAction>;
        rentalInfo = <InfoBanner tone="amber"><span className="font-semibold">{rentalReminderLabel(rentalReminder)} — </span>Confirm the return or extension when the service is actually finished.</InfoBanner>;
      } else if (booking.startDate > today) {
        rentalPrimary = <HeaderAction icon={Check} onClick={handleCompleteRental}>Complete Rental</HeaderAction>;
        rentalInfo = <InfoBanner tone="amber"><span className="font-semibold">Needs review — </span>Marked Active, but its rental period doesn&apos;t start until {formatDate(booking.startDate)}.</InfoBanner>;
      } else {
        // No drift, so no banner needed — but still worth a hover hint that
        // this isn't gated to the scheduled end date. Complete Rental ends
        // the rental the moment it's clicked (see handleCompleteRental /
        // startedAt+completedAt above), so a return that comes in early
        // already works today; there's no separate "cut short" concept to
        // build (see #4 in the booking-flow audit — resolved as a no-op).
        rentalPrimary = (
          <HeaderAction icon={Check} onClick={handleCompleteRental} title="Ends the rental now — use it as soon as the vehicle is actually back, even before the scheduled end date.">
            Complete Rental
          </HeaderAction>
        );
      }
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
  if (latestInvoiceStatus === "Payment Submitted") {
    // Invoice already issued — no button here. Only "hasn't been issued yet"
    // gets a header action; a submitted payment is verified from the
    // Documents section below (DocumentChain), which already links straight
    // to this same invoice, not from a header shortcut duplicating it.
    billingInfo = (
      <InfoBanner tone="amber">
        {client?.name ?? "The client"} submitted payment ({latestInvoice.paymentReference}, {formatDate(latestInvoice.paymentDate)}) — view the invoice below to verify it and issue the tax invoice.
      </InfoBanner>
    );
  } else if (latestInvoice && (latestInvoiceStatus === "Unpaid" || latestInvoiceStatus === "Overdue" || latestInvoiceStatus === "Payment Issue")) {
    billingInfo = (
      <div className="space-y-2">
        <InfoBanner tone="indigo">Waiting on {client?.name ?? "the client"} to submit payment.</InfoBanner>
        {latestInvoiceStatus === "Payment Issue" && (
          <InfoBanner tone="slate">
            <span className="font-semibold text-slate-600">Last claim rejected: </span>
            {latestInvoice.paymentRejectionReason}
          </InfoBanner>
        )}
      </div>
    );
  } else if (invoiceEligible(booking) && !acceptedQuotation) {
    billingInfo = <InfoBanner tone="amber"><span className="font-semibold">Accepted quotation required — </span>issue an invoice only after the client has accepted a quotation for this booking.</InfoBanner>;
  } else if (booking.isRecurringBilling && invoiceEligible(booking) && acceptedQuotation && (!latestInvoice || (latestInvoice.status === "Paid" && latestInvoiceHasTaxInvoice))) {
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
    billingPrimary = <HeaderTonalAction icon={FileCheck2} onClick={() => openDocumentEditor("invoice")}>Issue {latestInvoice ? "Next" : "First"} Invoice</HeaderTonalAction>;
  } else if (!booking.isRecurringBilling && acceptedQuotation && !latestInvoice && invoiceEligible(booking)) {
    // A one-off booking's only invoice — issuable from the moment a
    // vehicle+driver is assigned, same as the recurring case above, not
    // gated on the rental actually having finished. The header action is
    // the single clear signal; no extra readiness banner is needed here.
    billingPrimary = <HeaderTonalAction icon={FileCheck2} onClick={() => openDocumentEditor("invoice")}>Issue Invoice</HeaderTonalAction>;
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
  // the header above it — just sourced from fleetCoBookingStatusLabel (ops's own
  // Rejected/Declined split) instead of the client-facing label, which
  // reduces to the exact same three values for these terminal statuses.
  let declineArea: React.ReactNode = null;
  const outcomeReason = booking.status === "Cancelled"
    ? booking.cancellationReason ?? booking.declineReason
    : booking.declineReason;
  if (outcomeReason) {
    const declineLabel = fleetCoBookingStatusLabel(booking);
    const tone =
      booking.status === "Cancelled" ? "bg-slate-50 border-slate-100 text-slate-500"
      : declineLabel === "Rejected" ? "bg-orange-50 border-orange-100 text-orange-700"
      : "bg-rose-50 border-rose-100 text-rose-700"; // Declined
    const lead = booking.status === "Cancelled" ? "Cancellation reason: " : declineLabel === "Rejected" ? "Rejection reason: " : "Decline reason: ";
    declineArea = (
      <div className={`border rounded-lg px-3 py-2.5 text-xs leading-relaxed ${tone}`}>
        <span className="font-semibold">{lead}</span>
        {outcomeReason}
      </div>
    );
  }

  // Same rental-only timeline as ClientBookingDetail.tsx — buildRentalTimeline
  // takes just a booking + its quotations, nothing client-specific, so it's
  // exactly what should have replaced RequestInbox.tsx's old BookingProgress/
  // InvoiceProgress steppers once this panel dropped those (see file header
  // comment) rather than nothing at all.
  const timeline = buildRentalTimeline(booking, quotationsForBooking);
  const hasDocuments = quotationsForBooking.length > 0 || invoicesForBooking.length > 0 || taxInvoicesForBooking.length > 0;
  const hasIssueReports = SHOW_ISSUE_REPORTS && issues.length > 0;
  const showAssignmentCard = isRentalBooking(booking);
  const hasSidebarContent = hasDocuments || showAssignmentCard || hasIssueReports;
  const canCancelBooking = booking.status === "Accepted" || booking.status === "Assigned";

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
              <StatusBadge status={expiredQuotation ? "Expired" : fleetCoBookingStatusLabel(booking)} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              For {client?.name ?? booking.clientId} · Requested by {booking.requestedByName} · {formatDate(booking.created)}
            </p>
          </div>
          {(rentalPrimary || billingPrimary || canCancelBooking) && (
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
              {canCancelBooking && (
                <div ref={bookingActionsRef} className="relative shrink-0">
                  <button
                    type="button"
                    aria-label="Booking actions"
                    aria-expanded={showBookingActions}
                    onClick={() => setShowBookingActions((visible) => !visible)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"
                  >
                    <MoreHorizontal size={17} />
                  </button>
                  {showBookingActions && (
                    <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => { setShowBookingActions(false); setShowCancel(true); }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <XCircle size={13} /> Cancelled Rental
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full-width context banners — decline reason first (checked
            first, same priority as ClientBookingDetail.tsx), then the
            rental track's own context. Billing status stays in Documents
            and the dedicated billing pages; it should not interrupt an All
            Rentals detail with an invoice banner. */}
        {(lifecycleError || declineArea || rentalInfo || (!isRentalBooking(booking) && billingInfo)) && (
          <div className="space-y-2 mb-5">
            {lifecycleError && <div role="alert"><InfoBanner tone="amber">{lifecycleError}</InfoBanner></div>}
            {declineArea}
            {rentalInfo}
            {!isRentalBooking(booking) && billingInfo}
          </div>
        )}

        {/* Match the client detail composition: the rental timeline belongs
            to Rental Details. Keep the 3:2 split only when there is real
            sidebar content; a new request without documents or issues uses
            the full width instead of leaving an empty right rail. */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className={`${hasSidebarContent ? "lg:col-span-3" : "lg:col-span-5"} space-y-5`}>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Rental Details</h4>
              {/* Rental Type folded into Rental Period's own value line
                  ("dates · type"), same as ClientBookingDetail.tsx — one
                  label instead of a separate tile next to it. */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${hasSidebarContent ? "" : "lg:grid-cols-4"}`}>
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
                <StatTile icon={MapPin} label="Delivery Site" value={booking.pickupLocation} />
              </div>
              {booking.jobNotes && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-normal text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{booking.jobNotes}</p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-[10px] font-normal text-slate-400 uppercase tracking-wider mb-3">Rental Timeline</h4>
                <RentalTimeline entries={timeline} />
              </div>
            </div>

          </div>

          {hasSidebarContent && (
          <div className="lg:col-span-2 space-y-5">
            {hasDocuments && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Documents</h4>
                <DocumentChain quotations={quotationsForBooking} invoices={invoicesForBooking} taxInvoices={taxInvoicesForBooking} onOpenTaxInvoice={openTaxInvoice} />
              </div>
            )}

            {/* Once the client has accepted, assignment becomes supporting
                operational context beside the primary rental details. Keep
                the pending state visible even before a pair is selected. */}
            {showAssignmentCard && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Vehicle & Driver</h4>
                  {booking.status === "Assigned" && hasExistingAssignment && (
                    <Button variant="link" size="icon" className="flex shrink-0 items-center gap-1 text-xs" type="button" onClick={() => setShowAssign(true)}>
                      <Pencil size={12} /> Edit Assignment
                    </Button>
                  )}
                </div>
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

            {hasIssueReports && (
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
                            <Textarea
                              rows={2}
                              value={resolutionNotes}
                              onChange={(e) => setResolutionNotes(e.target.value)}
                              placeholder="Optional — what was done about it..."
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

          </div>
          )}
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

      {showCancel && (
        <ActionModal title="Cancel Booking" subtitle={booking.id} onClose={() => setShowCancel(false)}>
          <div className="space-y-3">
            {lifecycleError && <InfoBanner tone="amber">{lifecycleError}</InfoBanner>}
            <ReasonForm
              title="Reason for cancelling"
              placeholder="Let the client know why — vehicle unavailable, client called in, etc..."
              confirmLabel="Confirm Cancellation"
              onCancel={() => { setLifecycleError(null); setShowCancel(false); }}
              onConfirm={handleCancelBooking}
            />
          </div>
        </ActionModal>
      )}

    </>
  );
}
