import { useState } from "react";
import { useTableState } from "@/app/hooks/useTableState";
import { Modal, ModalTitle } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { DatePicker } from "@/app/components/ui/DatePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { useNavigate } from "react-router";
import { X, Plus, AlertTriangle, Truck, Gauge, Building2, Pencil, CheckCircle2, XCircle, ExternalLink, Wrench, Info, ShieldCheck, Calendar, CalendarClock } from "lucide-react";
import type { Booking } from "@/app/data/bookings";
import type { Vehicle, VehicleClass, VehicleStatus } from "@/app/data/vehicles";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate, sortByStatus, sortByDatetime, localDateKey } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, parseExcelDate, exportDateTag } from "@/app/components/ui/exportUtils";
import { useVehicles, addVehicle, updateVehicle, transitionVehicleStatus, transitionVehicleStatuses } from "@/app/lib/vehiclesStore";
import { useBookings, updateBooking } from "@/app/lib/bookingsStore";
import { useDrivers } from "@/app/lib/driversStore";
import { useClients } from "@/app/lib/clientsStore";
import { toastError, toastSuccess } from "@/app/lib/toast";
import { demoNowStamp } from "@/app/data/demoDates";
import { useOpenBookingFromContext } from "@/app/lib/documentNav";

const VEHICLE_CLASSES: VehicleClass[] = ["Pickup", "Van", "4-Wheel Truck", "6-Wheel Truck", "Sedan"];
const VEHICLE_STATUSES: VehicleStatus[] = ["Available", "Reserved", "On Rental", "In Maintenance", "Out of Service"];
// The three statuses an operator can set by hand, each carrying its own icon
// so the picker previews what choosing it means (green = back in service,
// amber/red = pulled from availability) instead of making every option look
// identical until it's picked. Color only shows up on the one that's
// actually selected, and even then as a soft tint (matching how every badge
// and callout elsewhere in this app reads) — not a solid fill — so the rest
// of the row stays neutral instead of three saturated icons competing at once.
const MANUAL_STATUS_OPTIONS: { status: VehicleStatus; icon: typeof CheckCircle2; selected: string }[] = [
  { status: "Available", icon: CheckCircle2, selected: "bg-emerald-50 border-emerald-300 text-emerald-800" },
  { status: "In Maintenance", icon: Wrench, selected: "bg-orange-50 border-orange-300 text-orange-800" },
  { status: "Out of Service", icon: XCircle, selected: "bg-red-50 border-red-300 text-red-800" },
];
const STATUS_PRIORITY = ["Out of Service", "In Maintenance", "Reserved", "On Rental", "Available"];
const COMPLIANCE_WARNING_DAYS = 30;

function nowStamp() {
  return demoNowStamp();
}

// ── Compliance — brief §4.2: "Compliance documents with expiry alerts" ─────

type ComplianceLevel = "ok" | "soon" | "expired";

function nearestExpiry(v: Vehicle): { label: string; date: string } {
  const docs: [string, string][] = [
    ["Registration certificate", v.registrationExpiry],
    ["Compulsory insurance (พ.ร.บ.)", v.insuranceExpiry],
    ["Voluntary motor insurance", v.voluntaryInsuranceExpiry],
    ["Annual vehicle tax", v.taxStickerExpiry],
  ];
  // .reduce() over tuples returns a tuple, not {label, date} — destructure
  // it into the object this function actually promises to return.
  const [label, date] = docs.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { label, date };
}

function complianceLevel(dateStr: string, today = new Date()): ComplianceLevel {
  const diffDays = daysUntil(dateStr, today);
  if (diffDays < 0) return "expired";
  if (diffDays <= COMPLIANCE_WARNING_DAYS) return "soon";
  return "ok";
}

function daysUntil(dateStr: string, today = new Date()): number {
  const baseline = new Date(today);
  baseline.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${dateStr}T00:00:00`).getTime() - baseline.getTime()) / 86400000);
}

function complianceDetail(dateStr: string): string {
  const level = complianceLevel(dateStr);
  if (level === "expired") return `Expired · ${formatDate(dateStr)}`;
  if (level === "soon") {
    const days = daysUntil(dateStr);
    return `${days <= 0 ? "Expires today" : `Expiring in ${days} days`} · ${formatDate(dateStr)}`;
  }
  return `Valid · ${formatDate(dateStr)}`;
}

function complianceValueClass(dateStr: string): string {
  const level = complianceLevel(dateStr);
  if (level === "expired") return "text-red-700";
  if (level === "soon") return "text-amber-700";
  return "text-slate-800";
}

const COMPLIANCE_COPY: Record<ComplianceLevel, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "OK", cls: "text-slate-500", icon: CheckCircle2 },
  soon: { label: "Expiring soon", cls: "text-amber-700", icon: AlertTriangle },
  expired: { label: "Expired", cls: "text-red-700", icon: XCircle },
};

function ComplianceBadge({ vehicle }: { vehicle: Vehicle }) {
  const nearest = nearestExpiry(vehicle);
  const level = complianceLevel(nearest.date);
  const copy = COMPLIANCE_COPY[level];
  const Icon = copy.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${copy.cls}`}>
      <Icon size={13} strokeWidth={2} />
      {copy.label}
    </span>
  );
}

function VehicleInfoRow({ label, value, valueClassName = "text-slate-800" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`ml-auto max-w-[68%] text-right text-xs font-medium ${valueClassName}`}>{value}</span>
    </div>
  );
}

function VehicleBookingIdRow({ bookingId, onClick }: { bookingId: string; onClick: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500">Booking ID</span>
      <button
        type="button"
        aria-label={`Open rental details for ${bookingId}`}
        onClick={onClick}
        className="ml-auto inline-flex max-w-[68%] cursor-pointer items-center gap-1 text-right text-xs font-medium text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent-ring)]"
      >
        {bookingId} <ExternalLink size={11} />
      </button>
    </div>
  );
}

// ── Create / edit form ──────────────────────────────────────────────────────

export type VehicleDraft = Pick<
  Vehicle,
  "plateNumber" | "vehicleClass" | "brand" | "model" | "year" | "capacityKg" | "homeDepot" | "financed" |
  "registrationExpiry" | "insuranceExpiry" | "voluntaryInsuranceExpiry" | "taxStickerExpiry"
>;

const emptyDraft: VehicleDraft = {
  plateNumber: "", vehicleClass: "Pickup", brand: "", model: "", year: new Date().getFullYear(),
  capacityKg: 1000, homeDepot: "", financed: false,
  registrationExpiry: "", insuranceExpiry: "", voluntaryInsuranceExpiry: "", taxStickerExpiry: "",
};

export function VehicleForm({ vehicle, onClose, onSave }: { vehicle?: Vehicle; onClose: () => void; onSave: (d: VehicleDraft) => void }) {
  const [form, setForm] = useState<VehicleDraft>(vehicle ?? emptyDraft);

  function set<K extends keyof VehicleDraft>(key: K, value: VehicleDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSave = form.plateNumber.trim() && form.brand.trim() && form.model.trim() && form.homeDepot.trim();

  return (
    <Modal onClose={onClose} overlayClassName="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" contentClassName="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">{vehicle ? "Edit Vehicle" : "Add Vehicle"}</h3></ModalTitle>
          <Button variant="close" size="icon" onClick={onClose}><X size={18} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Basic Info</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Plate Number</Label>
              <Input value={form.plateNumber} onChange={(e) => set("plateNumber", e.target.value)} placeholder="e.g. 1กข 2345" />
            </div>
            <div>
              <Label>Vehicle Class</Label>
              <Select value={form.vehicleClass} onValueChange={(value) => set("vehicleClass", value as VehicleClass)}>
                <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_CLASSES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Home Depot</Label>
              <Input value={form.homeDepot} onChange={(e) => set("homeDepot", e.target.value)} placeholder="e.g. Bangkok — Lat Krabang" />
            </div>
            <div>
              <Label>Brand</Label>
              <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Toyota" />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. Hilux Revo" />
            </div>
            <div>
              <Label>Year</Label>
              <Input type="number" value={form.year} onChange={(e) => set("year", Number(e.target.value))} />
            </div>
            <div>
              <Label>Capacity (kg)</Label>
              <Input type="number" value={form.capacityKg} onChange={(e) => set("capacityKg", Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Financed</label>
            <div className="flex gap-2">
              {[{ label: "Yes", value: true }, { label: "No", value: false }].map((o) => (
                <button key={o.label} type="button" onClick={() => set("financed", o.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    form.financed === o.value ? "border-[var(--portal-accent)] bg-[var(--portal-accent-light)] text-[var(--portal-accent)]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Compliance Documents</p>
          <div className="grid grid-cols-2 gap-3">
            {/* `as const` narrows `key` to this literal union instead of plain
                `string`, which is what lets form[key] and set(key, ...) below
                typecheck directly — they previously needed a
                `as Record<string, string>` read and an `as never` write to
                silence the widened type. */}
            {([
              ["Registration certificate expiry", "registrationExpiry"],
              ["Compulsory insurance expiry (พ.ร.บ.)", "insuranceExpiry"],
              ["Voluntary insurance expiry", "voluntaryInsuranceExpiry"],
              ["Annual vehicle tax expiry", "taxStickerExpiry"],
            ] as const).map(([label, key]) => (
              <div key={key}>
                <Label>{label}</Label>
                <DatePicker value={form[key] ?? ""} onChange={(v) => set(key, v)} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
          <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onClose}>Cancel</Button>
          <button disabled={!canSave} onClick={() => onSave(form)}
            className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {vehicle ? "Save Changes" : "Add Vehicle"}
          </button>
        </div>
      </Modal>
  );
}

// ── Change status ────────────────────────────────────────────────────────────

function ChangeStatusForm({ current, onCancel, onSave, hasCurrentAssignment }: {
  current: VehicleStatus;
  onCancel: () => void;
  onSave: (status: VehicleStatus, note: string) => void;
  hasCurrentAssignment: boolean;
}) {
  const [status, setStatus] = useState<VehicleStatus>(current);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const removesAvailability = status === "In Maintenance" || status === "Out of Service";
  const hasTransitionReason = current !== status;
  const blockedByAssignment = hasCurrentAssignment && status !== "On Rental";
  const canSubmit = status !== current && !blockedByAssignment && (!hasTransitionReason || note.trim().length > 0);

  function submit() {
    if (blockedByAssignment) return;
    if (removesAvailability && !confirming) {
      setConfirming(true);
      return;
    }
    onSave(status, note);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
        <span className="text-xs font-medium text-slate-500">Current status</span>
        <StatusBadge status={current} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-700">Set status to</p>
        <div className="grid grid-cols-3 gap-1.5">
          {MANUAL_STATUS_OPTIONS.map(({ status: s, icon: Icon, selected }) => {
            const disabled = hasCurrentAssignment && s !== "On Rental";
            const isSelected = status === s;
            return (
              <button key={s} type="button" disabled={disabled} aria-pressed={isSelected}
                title={disabled ? "Resolve the current rental before changing this status" : undefined}
                onClick={() => { setStatus(s); setConfirming(false); }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  isSelected ? selected : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                } disabled:cursor-not-allowed disabled:opacity-40`}>
                <Icon size={13} className={isSelected ? "" : "text-slate-400"} />
                {s}
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-slate-400">
          <Info size={12} className="mt-0.5 shrink-0" />
          Reserved and On Rental are applied automatically by the booking lifecycle.
        </p>
      </div>

      {hasCurrentAssignment && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
          This vehicle has a live rental assignment. Complete or update the booking before changing it to another status.
        </div>
      )}
      {hasTransitionReason && !blockedByAssignment && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          Add a reason so the next operator can understand this status change.
        </div>
      )}
      <Input value={note} onChange={(e) => { setNote(e.target.value); setConfirming(false); }} placeholder={hasTransitionReason ? "Reason (required)" : "Note (optional)"} />
      {removesAvailability && !blockedByAssignment && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          This removes the vehicle from assignment availability. Select the button again to confirm.
        </div>
      )}

      <div className="flex gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="md" className="flex-1 px-0 py-2" disabled={!canSubmit} onClick={submit}>
          {confirming ? "Confirm Status Update" : "Update Status"}
        </Button>
      </div>
    </div>
  );
}

// ── Vehicle detail content ──────────────────────────────────────────────────

function bookingHasVehicle(booking: Booking, vehicleId: string): boolean {
  return Boolean(booking.assignments?.some((assignment) => assignment.vehicleId === vehicleId));
}

function isOperationalBooking(booking: Booking): boolean {
  return booking.status === "Active" || booking.status === "Assigned";
}

function bookingPeriodLabel(booking: Booking): string {
  return booking.startDate === booking.endDate
    ? formatDate(booking.startDate)
    : formatDate(booking.startDate) + " – " + formatDate(booking.endDate);
}


export function VehicleDetailContent({ vehicle, onEdit }: { vehicle: Vehicle; onEdit: () => void }) {
  const openBooking = useOpenBookingFromContext();
  const bookings = useBookings();
  const drivers = useDrivers();
  const clients = useClients();
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  // Shared by both inline "needs review" actions below — only one of them
  // can ever be showing at once (a booking is either overdue to start or
  // overdue to complete, never both), so one slot is enough.
  const [actionError, setActionError] = useState<string | null>(null);

  function openRelatedBooking(bookingId: string) {
    openBooking(bookingId, { returnLabel: "Vehicle details", navPath: "/ops/fleet" });
  }

  function handleStatusSave(status: VehicleStatus, note: string) {
    try {
      transitionVehicleStatus(vehicle.id, {
        toStatus: status,
        source: "manual",
        actingUser: "Operations",
        reason: note,
      });
      setStatusError(null);
      setShowStatusForm(false);
      toastSuccess("Vehicle {plateNumber} status updated.", { plateNumber: vehicle.plateNumber });
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to change vehicle status.");
      toastError("Could not update vehicle {plateNumber}.", { plateNumber: vehicle.plateNumber });
    }
  }

  // Mirrors OpsBookingDetailPanel's handleStartRental — same two-step
  // transition (hold every vehicle on the booking, then flip the booking
  // itself Active) — just reachable from the vehicle side, where the
  // "needs review" warning actually lives, instead of requiring a trip to
  // the booking's own page to do the one thing that resolves it.
  function handleStartRental(booking: Booking) {
    try {
      const vehicleIds = [...new Set((booking.assignments ?? []).map((assignment) => assignment.vehicleId))];
      if (vehicleIds.length > 0) {
        transitionVehicleStatuses(vehicleIds, {
          toStatus: "On Rental",
          source: "booking",
          bookingId: booking.id,
          actingUser: "Operations",
          reason: "Rental started",
        });
      }
      const stamp = nowStamp();
      updateBooking(booking.id, { status: "Active", startedAt: stamp, updated: stamp });
      setActionError(null);
      toastSuccess("Rental {id} started.", { id: booking.id });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to start this rental.");
      toastError("Could not start rental {id}.", { id: booking.id });
    }
  }

  // Mirrors OpsBookingDetailPanel's handleCompleteRental — same two-step
  // transition (release every vehicle on the booking, then close the
  // booking out) — just reachable from the vehicle side, where the "needs
  // review" warning actually lives, instead of requiring a trip to the
  // booking's own page to do the one thing that resolves it.
  function handleCompleteRental(booking: Booking) {
    try {
      const vehicleIds = [...new Set((booking.assignments ?? []).map((assignment) => assignment.vehicleId))];
      if (vehicleIds.length > 0) {
        transitionVehicleStatuses(vehicleIds, {
          toStatus: "Available",
          source: "booking",
          bookingId: booking.id,
          actingUser: "Operations",
          reason: "Rental completed",
        });
      }
      const stamp = nowStamp();
      updateBooking(booking.id, { status: "Completed", completedAt: stamp, updated: stamp });
      setActionError(null);
      toastSuccess("Rental {id} completed.", { id: booking.id });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to complete this rental.");
      toastError("Could not complete rental {id}.", { id: booking.id });
    }
  }

  const today = localDateKey();
  const complianceDocuments = [
    { label: "Registration certificate", date: vehicle.registrationExpiry },
    { label: "Compulsory insurance (พ.ร.บ.)", date: vehicle.insuranceExpiry },
    { label: "Voluntary motor insurance", date: vehicle.voluntaryInsuranceExpiry },
    { label: "Annual vehicle tax", date: vehicle.taxStickerExpiry },
  ];
  const vehicleBookings = bookings
    .filter((booking) => bookingHasVehicle(booking, vehicle.id))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const operationalBookings = vehicleBookings.filter(isOperationalBooking);
  // Status is the source of truth for "is this the booking currently on this
  // vehicle" — Start Rental / Complete Rental are the human-confirmed events
  // that set it, a calendar date never does (see the Assignment section's
  // history: automating either transition purely off the schedule creates
  // false data, not real state). Dates here only check whether that status
  // still lines up with the booking's own scheduled window. A booking can be
  // "Active" and stuck in the past (never completed — staleBooking) just as
  // easily as "Active" and not due to start yet (started early — a real
  // click on a real booking is what surfaced this the first time), and both
  // are anomalies this card should name, not silently misfile as "Next".
  const activeBooking = operationalBookings.find((booking) => booking.status === "Active");
  const currentBooking = activeBooking && activeBooking.startDate <= today && activeBooking.endDate >= today ? activeBooking : undefined;
  const earlyBooking = activeBooking && activeBooking.startDate > today ? activeBooking : undefined;
  // The Start-side mirror of earlyBooking: an Assigned booking sitting inside
  // its own scheduled window right now, that nobody has confirmed as started.
  // Manual-only transitions cut both ways — the same reliance on a real click
  // that makes earlyBooking/staleBooking possible also means a due click can
  // just as easily never happen, and this card needs to say so rather than
  // let the booking quietly vanish from both "current" and "next".
  const overdueBooking = operationalBookings.find(
    (booking) => booking.status !== "Active" && booking.startDate <= today && booking.endDate >= today
  );
  const staleBooking = operationalBookings.find((booking) => booking.endDate < today);
  const nextBooking = operationalBookings
    .filter((booking) => booking.status !== "Active" && booking.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const linkedBooking = currentBooking ?? earlyBooking ?? overdueBooking ?? staleBooking;
  const linkedAssignment = linkedBooking?.assignments?.find((assignment) => assignment.vehicleId === vehicle.id);
  const assignedDriver = linkedAssignment ? drivers.find((driver) => driver.id === linkedAssignment.driverId) : undefined;
  const assignedClient = linkedBooking ? clients.find((client) => client.id === linkedBooking.clientId) : undefined;
  const nextAssignment = nextBooking?.assignments?.find((assignment) => assignment.vehicleId === vehicle.id);
  const nextDriver = nextAssignment ? drivers.find((driver) => driver.id === nextAssignment.driverId) : undefined;
  const nextClient = nextBooking ? clients.find((client) => client.id === nextBooking.clientId) : undefined;

  return (
    <div className="max-w-[1600px]">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-lg font-semibold text-slate-900">{vehicle.plateNumber}</h1>
            <StatusBadge status={vehicle.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{vehicle.id}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowStatusForm(true)}>
            Change status
          </Button>
        </div>
      </div>

      {showStatusForm && (
        <Modal
          onClose={() => { setShowStatusForm(false); setStatusError(null); }}
          overlayClassName="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          contentClassName="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
            <div>
              <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">Change vehicle status</h3></ModalTitle>
              <p className="mt-1 text-xs text-slate-500">Status changes affect assignment availability and are added to the history.</p>
            </div>
            <Button variant="close" size="icon" onClick={() => { setShowStatusForm(false); setStatusError(null); }}><X size={18} /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {statusError && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{statusError}</div>}
            <ChangeStatusForm current={vehicle.status} hasCurrentAssignment={Boolean(activeBooking || overdueBooking)} onCancel={() => setShowStatusForm(false)} onSave={handleStatusSave} />
          </div>
        </Modal>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle Details</h2>
              <Button variant="link" size="icon" className="flex shrink-0 items-center gap-1 text-xs" type="button" onClick={onEdit}>
                <Pencil size={12} /> Edit Vehicle
              </Button>
            </div>

            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><Info size={11} /> Basic Info</p>
            <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
              <VehicleInfoRow label="Make & Model" value={`${vehicle.brand} ${vehicle.model}`} />
              <VehicleInfoRow label="Vehicle Class" value={vehicle.vehicleClass} />
              <VehicleInfoRow label="Year" value={String(vehicle.year)} />
              <VehicleInfoRow label="Capacity" value={`${vehicle.capacityKg.toLocaleString()} kg`} />
              <VehicleInfoRow label="Home Depot" value={vehicle.homeDepot} />
              <VehicleInfoRow label="Financed" value={vehicle.financed ? "Yes" : "No"} />
            </div>

            <p className="mb-1.5 mt-5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><ShieldCheck size={11} /> Compliance Documents</p>
            <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
              {complianceDocuments.map((document) => (
                <VehicleInfoRow key={document.label} label={document.label} value={complianceDetail(document.date)} valueClassName={complianceValueClass(document.date)} />
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="assignment-heading">
            <h2 id="assignment-heading" className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Assignment</h2>

            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><Calendar size={11} /> Current Booking</span>
              {linkedBooking && <StatusBadge status={linkedBooking.status} />}
            </div>
            {currentBooking ? (
              <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
                <VehicleBookingIdRow bookingId={currentBooking.id} onClick={() => openRelatedBooking(currentBooking.id)} />
                <VehicleInfoRow label="Client" value={assignedClient?.name ?? currentBooking.clientId} />
                <VehicleInfoRow label="Driver" value={assignedDriver?.name ?? linkedAssignment?.driverId ?? "Not assigned"} />
                <VehicleInfoRow label="Rental period" value={bookingPeriodLabel(currentBooking)} />
                <VehicleInfoRow label="Delivery site" value={currentBooking.pickupLocation} />
              </div>
            ) : earlyBooking ? (
              <div className="space-y-3">
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  <p className="font-medium">Assignment needs review</p>
                  <p>Booking {earlyBooking.id} is marked Active, but its rental period doesn&apos;t start until {formatDate(earlyBooking.startDate)}.</p>
                </div>
                <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
                  <VehicleBookingIdRow bookingId={earlyBooking.id} onClick={() => openRelatedBooking(earlyBooking.id)} />
                  <VehicleInfoRow label="Client" value={assignedClient?.name ?? earlyBooking.clientId} />
                  <VehicleInfoRow label="Driver" value={assignedDriver?.name ?? linkedAssignment?.driverId ?? "Not assigned"} />
                  <VehicleInfoRow label="Rental period" value={bookingPeriodLabel(earlyBooking)} />
                </div>
              </div>
            ) : overdueBooking ? (
              <div className="space-y-3">
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  <p className="font-medium">Assignment needs review</p>
                  <p>Booking {overdueBooking.id} is still marked {overdueBooking.status}, but its rental period started on {formatDate(overdueBooking.startDate)}.</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="primary" size="sm" onClick={() => handleStartRental(overdueBooking)}>Start Rental</Button>
                    <span className="text-[11px] text-amber-700">Marks the rental in progress on this vehicle.</span>
                  </div>
                </div>
                {actionError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{actionError}</div>}
                <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
                  <VehicleBookingIdRow bookingId={overdueBooking.id} onClick={() => openRelatedBooking(overdueBooking.id)} />
                  <VehicleInfoRow label="Client" value={assignedClient?.name ?? overdueBooking.clientId} />
                  <VehicleInfoRow label="Driver" value={assignedDriver?.name ?? linkedAssignment?.driverId ?? "Not assigned"} />
                  <VehicleInfoRow label="Rental period" value={bookingPeriodLabel(overdueBooking)} />
                </div>
              </div>
            ) : staleBooking ? (
              <div className="space-y-3">
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  <p className="font-medium">Assignment needs review</p>
                  <p>Booking {staleBooking.id} is still marked {staleBooking.status}, but its rental period ended on {formatDate(staleBooking.endDate)}.</p>
                  {staleBooking.status === "Active" && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="primary" size="sm" onClick={() => handleCompleteRental(staleBooking)}>Complete Rental</Button>
                      <span className="text-[11px] text-amber-700">Closes the booking out and frees this vehicle.</span>
                    </div>
                  )}
                </div>
                {actionError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{actionError}</div>}
                <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
                  <VehicleBookingIdRow bookingId={staleBooking.id} onClick={() => openRelatedBooking(staleBooking.id)} />
                  <VehicleInfoRow label="Client" value={assignedClient?.name ?? staleBooking.clientId} />
                  <VehicleInfoRow label="Driver" value={assignedDriver?.name ?? linkedAssignment?.driverId ?? "Not assigned"} />
                  <VehicleInfoRow label="Rental period" value={bookingPeriodLabel(staleBooking)} />
                </div>
              </div>
            ) : vehicle.status === "On Rental" ? (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                This vehicle is marked On Rental, but no linked operational booking was found.
              </div>
            ) : (
              <p className="text-xs text-slate-400">No active booking.</p>
            )}

            <div className="my-4 border-t border-slate-100" />

            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><CalendarClock size={11} /> Next Booking</span>
              {nextBooking && (
                <StatusBadge status={nextBooking.status} />
              )}
            </div>
            {nextBooking ? (
              <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
                <VehicleBookingIdRow bookingId={nextBooking.id} onClick={() => openRelatedBooking(nextBooking.id)} />
                <VehicleInfoRow label="Client" value={nextClient?.name ?? nextBooking.clientId} />
                <VehicleInfoRow label="Driver" value={nextDriver?.name ?? nextAssignment?.driverId ?? "Not assigned"} />
                <VehicleInfoRow label="Rental period" value={bookingPeriodLabel(nextBooking)} />
                <VehicleInfoRow label="Delivery site" value={nextBooking.pickupLocation} />
              </div>
            ) : (
              <p className="text-xs text-slate-400">No upcoming booking.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Vehicles list ─────────────────────────────────────────────────────────────

type SortKey = "status" | "compliance" | "created" | "updated";
type SortDir = "asc" | "desc";

const VEH_HEADERS = ["Plate Number", "Class", "Brand", "Model", "Capacity (kg)", "Home Depot", "Status"];

function vehCSVRow(v: Vehicle): string[] {
  return [v.plateNumber, v.vehicleClass, v.brand, v.model, String(v.capacityKg), v.homeDepot, v.status];
}
function vehXLSXRow(v: Vehicle): (string | number)[] {
  return [v.plateNumber, v.vehicleClass, v.brand, v.model, v.capacityKg, v.homeDepot, v.status];
}

function MiniDash({ vehicles }: { vehicles: Vehicle[] }) {
  const total = vehicles.length;
  const available = vehicles.filter((v) => v.status === "Available").length;
  const onRental = vehicles.filter((v) => v.status === "On Rental").length;
  const issues = vehicles.filter((v) => complianceLevel(nearestExpiry(v).date) !== "ok").length;

  const cards = [
    { label: "Total Fleet", value: total, icon: <Truck size={16} className="text-[var(--portal-accent)]" />, bg: "bg-[var(--portal-accent-light)]" },
    { label: "Available", value: available, icon: <Gauge size={16} className="text-emerald-600" />, bg: "bg-emerald-50" },
    { label: "On Rental", value: onRental, icon: <Building2 size={16} className="text-sky-600" />, bg: "bg-sky-50" },
    { label: "Compliance Issues", value: issues, icon: <AlertTriangle size={16} className="text-amber-600" />, bg: "bg-amber-50" },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>{c.icon}</div>
          <div>
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-slate-900">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Vehicles() {
  const navigate = useNavigate();
  const vehicles = useVehicles();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Starts unsorted (sortKey null) until a header is clicked — the seeded
  // order is already meaningful here, unlike the booking lists.
  const { filters, setFilter, sortKey, sortDir, toggleSort, page, setPage } =
    useTableState<{ search: string; class: string; status: string; compliance: string }, SortKey>({
      storageKey: "opsVehicles",
      filters: { search: "", class: "", status: "", compliance: "" },
      defaultDirFor: () => "asc",
    });
  const { search, class: classFilter, status: statusFilter, compliance: complianceFilter } = filters;

  const editing = editingId ? (vehicles.find((v) => v.id === editingId) ?? null) : null;

  function handleCreate(draft: VehicleDraft) {
    const id = `VEH-${String(vehicles.length + 1).padStart(3, "0")}`;
    const stamp = nowStamp();
    addVehicle({
      ...draft, id, status: "Available",
      statusHistory: [{ status: "Available", at: stamp, fromStatus: null, toStatus: "Available", actingUser: "Operations", reason: "Vehicle added to fleet" }],
      maintenanceLog: [],
      created: stamp, updated: stamp,
    });
    setShowCreate(false);
    toastSuccess("Vehicle {plateNumber} added.", { plateNumber: draft.plateNumber });
  }

  function handleEditSave(draft: VehicleDraft) {
    if (!editingId) return;
    updateVehicle(editingId, { ...draft, updated: nowStamp() });
    setEditingId(null);
    toastSuccess("Vehicle {plateNumber} updated.", { plateNumber: draft.plateNumber });
  }

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !search || v.plateNumber.toLowerCase().includes(q) || v.brand.toLowerCase().includes(q) || v.model.toLowerCase().includes(q);
    const matchClass = !classFilter || v.vehicleClass === classFilter;
    const matchStatus = !statusFilter || v.status === statusFilter;
    const matchCompliance = !complianceFilter || complianceLevel(nearestExpiry(v).date) === complianceFilter;
    return matchSearch && matchClass && matchStatus && matchCompliance;
  });

  const sorted = !sortKey
    ? filtered
    : sortKey === "status"
      ? sortByStatus(filtered, "status", STATUS_PRIORITY, sortDir)
      : sortKey === "compliance"
        ? [...filtered].sort((a, b) => {
            const cmp = nearestExpiry(a).date < nearestExpiry(b).date ? -1 : nearestExpiry(a).date > nearestExpiry(b).date ? 1 : 0;
            return sortDir === "asc" ? cmp : -cmp;
          })
        : sortByDatetime(filtered, sortKey, sortDir);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {showCreate && <VehicleForm onClose={() => setShowCreate(false)} onSave={handleCreate} />}
      {editing && <VehicleForm vehicle={editing} onClose={() => setEditingId(null)} onSave={handleEditSave} />}
      <MiniDash vehicles={vehicles} />

      <FilterBar
        showSearch
        searchableFields={["Plate Number", "Brand", "Model"]}
        showExport
        showCreate
        createLabel="Add Vehicle"
        onCreate={() => setShowCreate(true)}
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(VEH_HEADERS, sorted.map(vehCSVRow), `vehicles-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(VEH_HEADERS, sorted.map(vehXLSXRow), `vehicles-${exportDateTag()}.xlsx`)}
        onSearch={(q) => setFilter("search", q)}
        defaultSearch={search}
        extraFilters={
          <>
            <FilterDropdown value={classFilter} onChange={(v) => setFilter("class", v)} placeholder="All Classes"
              options={[{ label: "All Classes", value: "" }, ...VEHICLE_CLASSES.map((c) => ({ label: c, value: c }))]} />
            <FilterDropdown value={statusFilter} onChange={(v) => setFilter("status", v)} placeholder="All Statuses"
              options={[{ label: "All Statuses", value: "" }, ...VEHICLE_STATUSES.map((s) => ({ label: s, value: s }))]} />
            <FilterDropdown value={complianceFilter} onChange={(v) => setFilter("compliance", v)} placeholder="All Compliance"
              options={[{ label: "All Compliance", value: "" }, { label: "OK", value: "ok" }, { label: "Expiring Soon", value: "soon" }, { label: "Expired", value: "expired" }]} />
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "1100px" }}>
            <colgroup>
              <col style={{ width: "130px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "220px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "190px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Plate Number", "Class", "Vehicle", "Capacity", "Home Depot"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("compliance")}>
                  <span className="inline-flex items-center gap-1">Compliance<SortIndicator active={sortKey === "compliance"} direction={sortDir} /></span>
                </th>
                <th className="sticky right-0 bg-slate-50 border-l border-slate-100 z-10 text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("status")}>
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((v) => (
                <tr key={v.id} className="border-b border-slate-50 group hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/ops/fleet/${v.id}`)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium whitespace-nowrap">{v.plateNumber}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{v.vehicleClass}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 truncate">{v.brand} {v.model} ({v.year})</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{v.capacityKg.toLocaleString()} kg</td>
                  <td className="px-4 py-3 text-xs text-slate-600 truncate">{v.homeDepot}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><ComplianceBadge vehicle={v} /></td>
                  <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-100 px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={v.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No vehicles found</div>}
        <TablePagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
