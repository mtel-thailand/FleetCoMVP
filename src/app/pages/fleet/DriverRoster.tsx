import { useState, type ReactNode } from "react";
import { useTableState } from "@/app/hooks/useTableState";
import { Modal, ModalTitle } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { DatePicker } from "@/app/components/ui/DatePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Link } from "react-router";
import { X, AlertTriangle, IdCard, UserCheck, UserX, CalendarOff, CalendarClock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import type { Driver, DriverEmploymentStatus, LicenseClass } from "@/app/data/drivers";
import { useBookings } from "@/app/lib/bookingsStore";
import { useVehicles } from "@/app/lib/vehiclesStore";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate, localDateKey, sortByStatus, sortByDatetime } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, parseExcelDate, exportDateTag } from "@/app/components/ui/exportUtils";
import { useDrivers, addDriver, updateDriver } from "@/app/lib/driversStore";
import { toastSuccess } from "@/app/lib/toast";
import { demoNowStamp } from "@/app/data/demoDates";

// brief §4.3: "Driver roster: profile, license class and expiry, contact,
// employment status, assigned home vehicle (if any), leave calendar."

const LICENSE_CLASSES: LicenseClass[] = ["Standard", "Heavy Vehicle"];
const EMPLOYMENT_STATUSES: DriverEmploymentStatus[] = ["Active", "On Leave", "Inactive"];
const STATUS_PRIORITY = ["On Leave", "Active", "Inactive"];
const LICENSE_WARNING_DAYS = 30;

function nowStamp() {
  return demoNowStamp();
}

type LicenseLevel = "ok" | "soon" | "expired";

function licenseLevel(dateStr: string, today = new Date()): LicenseLevel {
  const diffDays = Math.floor((new Date(dateStr).getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= LICENSE_WARNING_DAYS) return "soon";
  return "ok";
}

const LICENSE_COPY: Record<LicenseLevel, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "OK", cls: "text-slate-500", icon: CheckCircle2 },
  soon: { label: "Expiring soon", cls: "text-amber-700", icon: AlertTriangle },
  expired: { label: "Expired", cls: "text-red-700", icon: XCircle },
};

function LicenseBadge({ driver }: { driver: Driver }) {
  const level = licenseLevel(driver.licenseExpiry);
  const copy = LICENSE_COPY[level];
  const Icon = copy.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${copy.cls}`}>
      <Icon size={13} strokeWidth={2} />
      {copy.label}
    </span>
  );
}

function Section({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h4>
      <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <span className="text-xs text-slate-500 shrink-0">{label}</span>
            <span className="text-xs font-medium text-slate-800 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create / edit form ──────────────────────────────────────────────────────

type DriverDraft = Pick<Driver, "name" | "phone" | "licenseNumber" | "licenseClass" | "licenseExpiry" | "homeBase" | "homeVehicleId">;

const emptyDraft: DriverDraft = {
  name: "", phone: "", licenseNumber: "", licenseClass: "Standard", licenseExpiry: "", homeBase: "", homeVehicleId: undefined,
};

function DriverForm({ driver, onClose, onSave }: {
  driver?: Driver; onClose: () => void; onSave: (d: DriverDraft) => void;
}) {
  const [form, setForm] = useState<DriverDraft>(driver ?? emptyDraft);
  const vehicles = useVehicles();

  function set<K extends keyof DriverDraft>(key: K, value: DriverDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSave = form.name.trim() && form.phone.trim() && form.licenseNumber.trim() && form.licenseExpiry;

  return (
    <Modal onClose={onClose} overlayClassName="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" contentClassName="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">{driver ? "Edit Driver" : "Add Driver"}</h3></ModalTitle>
          <Button variant="close" size="icon" onClick={onClose}><X size={18} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Somchai Jaidee" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+66-xx-xxx-xxxx" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>License Number</Label>
              <Input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} placeholder="TH-DL-xxxxx" />
            </div>
            <div>
              <Label>License Class</Label>
              <Select value={form.licenseClass} onValueChange={(value) => set("licenseClass", value as LicenseClass)}>
                <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LICENSE_CLASSES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>License Expiry</Label>
            <DatePicker value={form.licenseExpiry} onChange={(v) => set("licenseExpiry", v)} />
          </div>
          <div>
            <Label>Base Location <span className="font-normal text-slate-400">(planning reference)</span></Label>
            <Input value={form.homeBase ?? ""} onChange={(e) => set("homeBase", e.target.value)} placeholder="e.g. Bangkok — Lat Krabang" />
            <p className="mt-1 text-[11px] leading-4 text-slate-400">Does not restrict where this driver may work.</p>
          </div>
          <div>
            <Label>Usual Vehicle <span className="font-normal text-slate-400">(preference only)</span></Label>
            <Select
              value={form.homeVehicleId ?? "none"}
              onValueChange={(value) => set("homeVehicleId", value === "none" ? "" : value)}
            >
              <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]">
                <SelectValue placeholder="No usual vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">No usual vehicle</SelectItem>
                {vehicles
                  .slice()
                  .sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
                  .map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id} className="text-xs">
                      {vehicle.plateNumber} · {vehicle.vehicleClass}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">Used to improve suggestions; it never reserves the vehicle.</p>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
          <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onClose}>Cancel</Button>
          <button disabled={!canSave} onClick={() => onSave(form)}
            className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {driver ? "Save Changes" : "Add Driver"}
          </button>
        </div>
      </Modal>
  );
}

// ── Employment status / leave ───────────────────────────────────────────────

function StatusLeaveForm({ driver, onCancel, onSave }: {
  driver: Driver; onCancel: () => void; onSave: (patch: Partial<Driver>) => void;
}) {
  const [status, setStatus] = useState<DriverEmploymentStatus>(driver.employmentStatus);
  const [leaveFrom, setLeaveFrom] = useState(driver.leaveFrom ?? "");
  const [leaveTo, setLeaveTo] = useState(driver.leaveTo ?? "");

  const needsLeaveDates = status === "On Leave";
  const canSave = !needsLeaveDates || (leaveFrom && leaveTo && leaveFrom <= leaveTo);

  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {EMPLOYMENT_STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={`py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              status === s ? "border-[var(--portal-accent)] bg-[var(--portal-accent-light)] text-[var(--portal-accent)]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}>
            {s}
          </button>
        ))}
      </div>
      {needsLeaveDates && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Leave From</Label>
            <DatePicker value={leaveFrom} onChange={setLeaveFrom} />
          </div>
          <div>
            <Label>Leave To</Label>
            <DatePicker value={leaveTo} onChange={setLeaveTo} />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onCancel}>Cancel</Button>
        <button
          disabled={!canSave}
          onClick={() => onSave(
            status === "On Leave"
              ? { employmentStatus: status, leaveFrom, leaveTo }
              : { employmentStatus: status, leaveFrom: undefined, leaveTo: undefined },
          )}
          className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ── Driver detail panel ─────────────────────────────────────────────────────

function DriverDetailPanel({ driver, onClose, onEdit }: {
  driver: Driver; onClose: () => void; onEdit: () => void;
}) {
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const bookings = useBookings();
  const vehicles = useVehicles();
  const level = licenseLevel(driver.licenseExpiry);
  const today = localDateKey();
  const operationalAssignments = bookings.flatMap((booking) => {
    if (booking.status !== "Assigned" && booking.status !== "Active") return [];
    return (booking.assignments ?? [])
      .filter((assignment) => assignment.driverId === driver.id)
      .map((assignment) => ({ booking, vehicle: vehicles.find((vehicle) => vehicle.id === assignment.vehicleId) }));
  });
  const currentAssignments = operationalAssignments.filter(({ booking }) =>
    booking.status === "Active" || (booking.startDate <= today && booking.endDate >= today),
  );
  const upcomingAssignments = operationalAssignments
    .filter(({ booking }) => booking.startDate > today)
    .sort((a, b) => a.booking.startDate.localeCompare(b.booking.startDate));

  function assignmentLinks(items: typeof operationalAssignments): ReactNode {
    if (items.length === 0) return "None scheduled";
    return (
      <span className="flex flex-col items-end gap-1">
        {items.map(({ booking, vehicle }) => (
          <span key={booking.id} className="text-right text-xs font-medium text-slate-800">
            <Link
              to={`/ops/bookings/${booking.id}`}
              state={{ returnTo: "/ops/drivers", returnLabel: "Driver Roster", navPath: "/ops/drivers" }}
              aria-label={`Open rental details for ${booking.id}`}
              className="inline-flex items-center gap-1 text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] hover:underline"
            >
              {booking.id} <ExternalLink size={11} />
            </Link>
            <span> · {vehicle?.plateNumber ?? "Vehicle not found"}</span>
          </span>
        ))}
      </span>
    );
  }

  function handleStatusSave(patch: Partial<Driver>) {
    try {
      updateDriver(driver.id, { ...patch, updated: nowStamp() });
      setStatusError(null);
      setShowStatusForm(false);
      toastSuccess("Driver {name} status updated.", { name: driver.name });
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to update driver status.");
    }
  }

  return (
    <Modal onClose={onClose} overlayClassName="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" contentClassName="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">{driver.name}</h3></ModalTitle>
            <p className="text-xs text-slate-500">{driver.licenseNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="px-2.5" onClick={onEdit}>Edit</Button>
            <Button variant="close" size="icon" onClick={onClose}><X size={18} /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Employment Status</span>
            <StatusBadge status={driver.employmentStatus} />
            {level !== "ok" && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600">
                <AlertTriangle size={11} /> license {level === "expired" ? "expired" : "expiring soon"}
              </span>
            )}
          </div>

          <Section
            title="Profile"
            rows={[
              ["Phone", driver.phone],
              ["License Class", driver.licenseClass],
              ["License Expiry", formatDate(driver.licenseExpiry)],
            ]}
          />

          {driver.employmentStatus === "On Leave" && driver.leaveFrom && driver.leaveTo && (
            <Section title="Leave Calendar" rows={[["Leave Period", `${formatDate(driver.leaveFrom)} → ${formatDate(driver.leaveTo)}`]]} />
          )}

          <Section
            title="Assignment Details"
            rows={[
              ["Base Location", driver.homeBase ?? "Not set"],
              ["Usual Vehicle (preference)", driver.homeVehicleId ? (vehicles.find((vehicle) => vehicle.id === driver.homeVehicleId)?.plateNumber ?? driver.homeVehicleId) : "Not set"],
              ["Current Rental", assignmentLinks(currentAssignments)],
              ["Next Rental", assignmentLinks(upcomingAssignments.slice(0, 1))],
            ]}
          />

          <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-4 text-slate-500">
            <CalendarClock size={13} className="mt-0.5 shrink-0 text-slate-400" />
            <span>Assignments are rental-specific. The base location and usual vehicle guide planning, but do not restrict future assignments.</span>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Employment / Leave</h4>
            {statusError && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">{statusError}</div>}
            {showStatusForm ? (
              <StatusLeaveForm driver={driver} onCancel={() => { setShowStatusForm(false); setStatusError(null); }} onSave={handleStatusSave} />
            ) : (
              <button onClick={() => { setStatusError(null); setShowStatusForm(true); }} className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                Update status / leave...
              </button>
            )}
          </div>
        </div>
      </Modal>
  );
}

// ── Roster list ──────────────────────────────────────────────────────────────

type SortKey = "status" | "license" | "created" | "updated";
type SortDir = "asc" | "desc";

const DRV_HEADERS = ["Name", "Phone", "License Number", "License Class", "Base Location", "License Expiry", "Employment Status"];

function drvCSVRow(d: Driver): string[] {
  return [d.name, d.phone, d.licenseNumber, d.licenseClass, d.homeBase ?? "", formatDate(d.licenseExpiry), d.employmentStatus];
}
function drvXLSXRow(d: Driver): (string | number)[] {
  return [d.name, d.phone, d.licenseNumber, d.licenseClass, d.homeBase ?? "", parseExcelDate(d.licenseExpiry) as unknown as string, d.employmentStatus];
}

function MiniDash({ drivers }: { drivers: Driver[] }) {
  const active = drivers.filter((d) => d.employmentStatus === "Active").length;
  const onLeave = drivers.filter((d) => d.employmentStatus === "On Leave").length;
  const licenseIssues = drivers.filter((d) => licenseLevel(d.licenseExpiry) !== "ok").length;

  const cards = [
    { label: "Total Drivers", value: drivers.length, icon: <IdCard size={16} className="text-[var(--portal-accent)]" />, bg: "bg-[var(--portal-accent-light)]" },
    { label: "Active", value: active, icon: <UserCheck size={16} className="text-emerald-600" />, bg: "bg-emerald-50" },
    { label: "On Leave", value: onLeave, icon: <CalendarOff size={16} className="text-amber-600" />, bg: "bg-amber-50" },
    { label: "License Issues", value: licenseIssues, icon: <UserX size={16} className="text-rose-600" />, bg: "bg-rose-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>{c.icon}</div>
          <div>
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-xl font-semibold text-slate-900 mt-0.5">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DriverRoster() {
  const drivers = useDrivers();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Starts unsorted (sortKey null) until a header is clicked — see Vehicles.tsx.
  const { filters, setFilter, sortKey, sortDir, toggleSort, page, setPage } =
    useTableState<{ search: string; status: string; class: string }, SortKey>({
      storageKey: "opsDrivers",
      filters: { search: "", status: "", class: "" },
      defaultDirFor: () => "asc",
    });
  const { search, status: statusFilter, class: classFilter } = filters;

  const selected = selectedId ? (drivers.find((d) => d.id === selectedId) ?? null) : null;
  const editing = editingId ? (drivers.find((d) => d.id === editingId) ?? null) : null;

  function handleCreate(draft: DriverDraft) {
    const id = `DRV-${String(drivers.length + 1).padStart(3, "0")}`;
    addDriver({ ...draft, id, employmentStatus: "Active", created: nowStamp(), updated: nowStamp() });
    setShowCreate(false);
    toastSuccess("Driver {name} added.", { name: draft.name });
  }

  function handleEditSave(draft: DriverDraft) {
    if (!editingId) return;
    updateDriver(editingId, { ...draft, updated: nowStamp() });
    setEditingId(null);
    toastSuccess("Driver {name} updated.", { name: draft.name });
  }

  const filtered = drivers.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch = !search || d.name.toLowerCase().includes(q) || d.phone.includes(q) || d.licenseNumber.toLowerCase().includes(q);
    const matchStatus = !statusFilter || d.employmentStatus === statusFilter;
    const matchClass = !classFilter || d.licenseClass === classFilter;
    return matchSearch && matchStatus && matchClass;
  });

  const sorted = !sortKey
    ? filtered
    : sortKey === "status"
      ? sortByStatus(filtered, "employmentStatus", STATUS_PRIORITY, sortDir)
      : sortKey === "license"
        ? [...filtered].sort((a, b) => {
            const cmp = a.licenseExpiry < b.licenseExpiry ? -1 : a.licenseExpiry > b.licenseExpiry ? 1 : 0;
            return sortDir === "asc" ? cmp : -cmp;
          })
        : sortByDatetime(filtered, sortKey, sortDir);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {showCreate && <DriverForm onClose={() => setShowCreate(false)} onSave={handleCreate} />}
      {editing && <DriverForm driver={editing} onClose={() => setEditingId(null)} onSave={handleEditSave} />}
      {selected && !editing && (
        <DriverDetailPanel driver={selected} onClose={() => setSelectedId(null)} onEdit={() => setEditingId(selected.id)} />
      )}

      <MiniDash drivers={drivers} />

      <FilterBar
        showSearch
        searchableFields={["Name", "Phone", "License Number"]}
        showExport
        showCreate
        createLabel="Add Driver"
        onCreate={() => setShowCreate(true)}
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(DRV_HEADERS, sorted.map(drvCSVRow), `drivers-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(DRV_HEADERS, sorted.map(drvXLSXRow), `drivers-${exportDateTag()}.xlsx`)}
        onSearch={(q) => setFilter("search", q)}
        defaultSearch={search}
        extraFilters={
          <>
            <FilterDropdown value={classFilter} onChange={(v) => setFilter("class", v)} placeholder="All License Classes"
              options={[{ label: "All License Classes", value: "" }, ...LICENSE_CLASSES.map((c) => ({ label: c, value: c }))]} />
            <FilterDropdown value={statusFilter} onChange={(v) => setFilter("status", v)} placeholder="All Statuses"
              options={[{ label: "All Statuses", value: "" }, ...EMPLOYMENT_STATUSES.map((s) => ({ label: s, value: s }))]} />
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "1180px" }}>
            <colgroup>
              <col style={{ width: "160px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "180px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "140px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Name", "Phone", "License Number", "License Class", "Base Location"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("license")}>
                  <span className="inline-flex items-center gap-1">License<SortIndicator active={sortKey === "license"} direction={sortDir} /></span>
                </th>
                <th className="sticky right-0 bg-slate-50 border-l border-slate-100 z-10 text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("status")}>
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 group hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(d.id)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium truncate">{d.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{d.phone}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{d.licenseNumber}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{d.licenseClass}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 truncate">{d.homeBase ?? "Not set"}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><LicenseBadge driver={d} /></td>
                  <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-100 px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={d.employmentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No drivers found</div>}
        <TablePagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
