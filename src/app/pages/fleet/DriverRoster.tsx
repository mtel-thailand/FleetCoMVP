import { useState } from "react";
import { X, AlertTriangle, IdCard, UserCheck, UserX, CalendarOff } from "lucide-react";
import type { Driver, DriverEmploymentStatus, LicenseClass } from "@/app/data/drivers";
import type { Vehicle } from "@/app/data/vehicles";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate, sortByStatus, sortByDatetime } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, parseExcelDate, exportDateTag } from "@/app/components/ui/exportUtils";
import { useBodyScrollLock } from "@/app/hooks/useBodyScrollLock";
import { useDrivers, addDriver, updateDriver } from "@/app/lib/driversStore";
import { useVehicles } from "@/app/lib/vehiclesStore";

// brief §4.3: "Driver roster: profile, license class and expiry, contact,
// employment status, assigned home vehicle (if any), leave calendar."

const LICENSE_CLASSES: LicenseClass[] = ["Standard", "Heavy Vehicle"];
const EMPLOYMENT_STATUSES: DriverEmploymentStatus[] = ["Active", "On Leave", "Inactive"];
const STATUS_PRIORITY = ["On Leave", "Active", "Inactive"];
const LICENSE_WARNING_DAYS = 30;

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

type LicenseLevel = "ok" | "soon" | "expired";

function licenseLevel(dateStr: string, today = new Date()): LicenseLevel {
  const diffDays = Math.floor((new Date(dateStr).getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= LICENSE_WARNING_DAYS) return "soon";
  return "ok";
}

const LICENSE_COPY: Record<LicenseLevel, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-slate-100 text-slate-500" },
  soon: { label: "Expiring soon", cls: "bg-amber-100 text-amber-700" },
  expired: { label: "Expired", cls: "bg-red-100 text-red-700" },
};

function LicenseBadge({ driver }: { driver: Driver }) {
  const level = licenseLevel(driver.licenseExpiry);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LICENSE_COPY[level].cls}`}>
      {LICENSE_COPY[level].label}
    </span>
  );
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
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

type DriverDraft = Pick<Driver, "name" | "phone" | "licenseNumber" | "licenseClass" | "licenseExpiry" | "homeVehicleId">;

const emptyDraft: DriverDraft = {
  name: "", phone: "", licenseNumber: "", licenseClass: "Standard", licenseExpiry: "", homeVehicleId: undefined,
};

function DriverForm({ driver, vehicles, onClose, onSave }: {
  driver?: Driver; vehicles: Vehicle[]; onClose: () => void; onSave: (d: DriverDraft) => void;
}) {
  useBodyScrollLock();
  const [form, setForm] = useState<DriverDraft>(driver ?? emptyDraft);

  function set<K extends keyof DriverDraft>(key: K, value: DriverDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSave = form.name.trim() && form.phone.trim() && form.licenseNumber.trim() && form.licenseExpiry;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-semibold text-slate-900">{driver ? "Edit Driver" : "Add Driver"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Full Name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Somchai Jaidee"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+66-xx-xxx-xxxx"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">License Number</label>
              <input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} placeholder="TH-DL-xxxxx"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">License Class</label>
              <select value={form.licenseClass} onChange={(e) => set("licenseClass", e.target.value as LicenseClass)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]">
                {LICENSE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">License Expiry</label>
            <input type="date" value={form.licenseExpiry} onChange={(e) => set("licenseExpiry", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Home Vehicle (optional)</label>
            <select value={form.homeVehicleId ?? ""} onChange={(e) => set("homeVehicleId", e.target.value || undefined)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]">
              <option value="">— None —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber} · {v.brand} {v.model}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button disabled={!canSave} onClick={() => onSave(form)}
            className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {driver ? "Save Changes" : "Add Driver"}
          </button>
        </div>
      </div>
    </div>
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
              status === s ? "bg-[var(--portal-accent)] text-white border-[var(--portal-accent)]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}>
            {s}
          </button>
        ))}
      </div>
      {needsLeaveDates && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Leave From</label>
            <input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Leave To</label>
            <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer">Cancel</button>
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

function DriverDetailPanel({ driver, vehicles, onClose, onEdit }: {
  driver: Driver; vehicles: Vehicle[]; onClose: () => void; onEdit: () => void;
}) {
  useBodyScrollLock();
  const [showStatusForm, setShowStatusForm] = useState(false);
  const homeVehicle = driver.homeVehicleId ? vehicles.find((v) => v.id === driver.homeVehicleId) : undefined;
  const level = licenseLevel(driver.licenseExpiry);

  function handleStatusSave(patch: Partial<Driver>) {
    updateDriver(driver.id, { ...patch, updated: nowStamp() });
    setShowStatusForm(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{driver.name}</h3>
            <p className="text-xs text-slate-500">{driver.licenseNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer">Edit</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
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
              ["Home Vehicle", homeVehicle ? `${homeVehicle.plateNumber} · ${homeVehicle.brand} ${homeVehicle.model}` : "— None —"],
            ]}
          />

          {driver.employmentStatus === "On Leave" && driver.leaveFrom && driver.leaveTo && (
            <Section title="Leave Calendar" rows={[["Leave Period", `${formatDate(driver.leaveFrom)} → ${formatDate(driver.leaveTo)}`]]} />
          )}

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Employment / Leave</h4>
            {showStatusForm ? (
              <StatusLeaveForm driver={driver} onCancel={() => setShowStatusForm(false)} onSave={handleStatusSave} />
            ) : (
              <button onClick={() => setShowStatusForm(true)} className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                Update status / leave...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Roster list ──────────────────────────────────────────────────────────────

type SortKey = "status" | "license" | "created" | "updated";
type SortDir = "asc" | "desc";

const DRV_HEADERS = ["Name", "Phone", "License Number", "License Class", "License Expiry", "Employment Status"];

function drvCSVRow(d: Driver): string[] {
  return [d.name, d.phone, d.licenseNumber, d.licenseClass, formatDate(d.licenseExpiry), d.employmentStatus];
}
function drvXLSXRow(d: Driver): (string | number)[] {
  return [d.name, d.phone, d.licenseNumber, d.licenseClass, parseExcelDate(d.licenseExpiry) as unknown as string, d.employmentStatus];
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
  const vehicles = useVehicles();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const selected = selectedId ? (drivers.find((d) => d.id === selectedId) ?? null) : null;
  const editing = editingId ? (drivers.find((d) => d.id === editingId) ?? null) : null;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  function handleCreate(draft: DriverDraft) {
    const id = `DRV-${String(drivers.length + 1).padStart(3, "0")}`;
    addDriver({ ...draft, id, employmentStatus: "Active", created: nowStamp(), updated: nowStamp() });
  }

  function handleEditSave(draft: DriverDraft) {
    if (!editingId) return;
    updateDriver(editingId, { ...draft, updated: nowStamp() });
    setEditingId(null);
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
      {showCreate && <DriverForm vehicles={vehicles} onClose={() => setShowCreate(false)} onSave={(d) => { handleCreate(d); setShowCreate(false); }} />}
      {editing && <DriverForm driver={editing} vehicles={vehicles} onClose={() => setEditingId(null)} onSave={handleEditSave} />}
      {selected && !editing && (
        <DriverDetailPanel driver={selected} vehicles={vehicles} onClose={() => setSelectedId(null)} onEdit={() => setEditingId(selected.id)} />
      )}

      <MiniDash drivers={drivers} />

      <FilterBar
        showSearch
        searchableFields={["Name", "Phone", "License Number"]}
        showPeriod
        showExport
        showCreate
        createLabel="Add Driver"
        onCreate={() => setShowCreate(true)}
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(DRV_HEADERS, sorted.map(drvCSVRow), `drivers-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(DRV_HEADERS, sorted.map(drvXLSXRow), `drivers-${exportDateTag()}.xlsx`)}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        extraFilters={
          <>
            <FilterDropdown value={classFilter} onChange={(v) => { setClassFilter(v); setPage(1); }} placeholder="All License Classes"
              options={[{ label: "All License Classes", value: "" }, ...LICENSE_CLASSES.map((c) => ({ label: c, value: c }))]} />
            <FilterDropdown value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="All Statuses"
              options={[{ label: "All Statuses", value: "" }, ...EMPLOYMENT_STATUSES.map((s) => ({ label: s, value: s }))]} />
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "1050px" }}>
            <colgroup>
              <col style={{ width: "160px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "140px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Name", "Phone", "License Number", "License Class"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("license")}>
                  <span className="inline-flex items-center gap-1">License<SortIndicator active={sortKey === "license"} direction={sortDir} /></span>
                </th>
                <th className="sticky right-0 bg-slate-50 border-l border-slate-100 z-10 text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("status")}>
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(d.id)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium truncate">{d.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{d.phone}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{d.licenseNumber}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{d.licenseClass}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><LicenseBadge driver={d} /></td>
                  <td className="sticky right-0 bg-white border-l border-slate-100 px-4 py-3 whitespace-nowrap">
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
