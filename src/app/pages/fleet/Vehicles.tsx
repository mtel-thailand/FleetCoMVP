import { useState } from "react";
import { X, Plus, AlertTriangle, Wrench, Truck, Gauge, Building2 } from "lucide-react";
import type { Vehicle, VehicleClass, VehicleStatus, MaintenanceLogEntry } from "@/app/data/vehicles";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate, sortByStatus, sortByDatetime } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, parseExcelDate, exportDateTag } from "@/app/components/ui/exportUtils";
import { formatCurrency } from "@/app/data/formatters";
import { useBodyScrollLock } from "@/app/hooks/useBodyScrollLock";
import { useVehicles, addVehicle, updateVehicle } from "@/app/lib/vehiclesStore";

const VEHICLE_CLASSES: VehicleClass[] = ["Pickup", "Van", "4-Wheel Truck", "6-Wheel Truck", "Sedan"];
const VEHICLE_STATUSES: VehicleStatus[] = ["Available", "Reserved", "On Rental", "In Maintenance", "Out of Service"];
const STATUS_PRIORITY = ["Out of Service", "In Maintenance", "Reserved", "On Rental", "Available"];
const COMPLIANCE_WARNING_DAYS = 30;

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

// ── Compliance — brief §4.2: "Compliance documents with expiry alerts" ─────

type ComplianceLevel = "ok" | "soon" | "expired";

function nearestExpiry(v: Vehicle): { label: string; date: string } {
  const docs: [string, string][] = [
    ["Registration", v.registrationExpiry],
    ["Insurance (compulsory)", v.insuranceExpiry],
    ["Insurance (voluntary)", v.voluntaryInsuranceExpiry],
    ["Tax sticker", v.taxStickerExpiry],
  ];
  // .reduce() over tuples returns a tuple, not {label, date} — destructure
  // it into the object this function actually promises to return.
  const [label, date] = docs.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { label, date };
}

function complianceLevel(dateStr: string, today = new Date()): ComplianceLevel {
  const diffDays = Math.floor((new Date(dateStr).getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= COMPLIANCE_WARNING_DAYS) return "soon";
  return "ok";
}

const COMPLIANCE_COPY: Record<ComplianceLevel, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-slate-100 text-slate-500" },
  soon: { label: "Expiring soon", cls: "bg-amber-100 text-amber-700" },
  expired: { label: "Expired", cls: "bg-red-100 text-red-700" },
};

function ComplianceBadge({ vehicle }: { vehicle: Vehicle }) {
  const nearest = nearestExpiry(vehicle);
  const level = complianceLevel(nearest.date);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COMPLIANCE_COPY[level].cls}`}>
      {COMPLIANCE_COPY[level].label}
    </span>
  );
}

// ── Small shared bits ────────────────────────────────────────────────────────

function Section({ title, rows, action }: { title: string; rows: [string, string][]; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h4>
        {action}
      </div>
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

type VehicleDraft = Pick<
  Vehicle,
  "plateNumber" | "vehicleClass" | "brand" | "model" | "year" | "capacityKg" | "homeDepot" | "financed" |
  "registrationExpiry" | "insuranceExpiry" | "voluntaryInsuranceExpiry" | "taxStickerExpiry" | "lastInspection" | "odometerKm"
>;

const emptyDraft: VehicleDraft = {
  plateNumber: "", vehicleClass: "Pickup", brand: "", model: "", year: new Date().getFullYear(),
  capacityKg: 1000, homeDepot: "", financed: false,
  registrationExpiry: "", insuranceExpiry: "", voluntaryInsuranceExpiry: "", taxStickerExpiry: "", lastInspection: "",
  odometerKm: 0,
};

function VehicleForm({ vehicle, onClose, onSave }: { vehicle?: Vehicle; onClose: () => void; onSave: (d: VehicleDraft) => void }) {
  useBodyScrollLock();
  const [form, setForm] = useState<VehicleDraft>(vehicle ?? emptyDraft);

  function set<K extends keyof VehicleDraft>(key: K, value: VehicleDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSave = form.plateNumber.trim() && form.brand.trim() && form.model.trim() && form.homeDepot.trim();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-semibold text-slate-900">{vehicle ? "Edit Vehicle" : "Add Vehicle"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Basic Info</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Plate Number</label>
              <input value={form.plateNumber} onChange={(e) => set("plateNumber", e.target.value)} placeholder="e.g. 1กข 2345"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Vehicle Class</label>
              <select value={form.vehicleClass} onChange={(e) => set("vehicleClass", e.target.value as VehicleClass)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]">
                {VEHICLE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Home Depot</label>
              <input value={form.homeDepot} onChange={(e) => set("homeDepot", e.target.value)} placeholder="e.g. Bangkok — Lat Krabang"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Brand</label>
              <input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Toyota"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Model</label>
              <input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. Hilux Revo"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Year</label>
              <input type="number" value={form.year} onChange={(e) => set("year", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Capacity (kg)</label>
              <input type="number" value={form.capacityKg} onChange={(e) => set("capacityKg", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Odometer (km)</label>
              <input type="number" value={form.odometerKm} onChange={(e) => set("odometerKm", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Financed</label>
            <div className="flex gap-2">
              {[{ label: "Yes", value: true }, { label: "No", value: false }].map((o) => (
                <button key={o.label} type="button" onClick={() => set("financed", o.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    form.financed === o.value ? "bg-[var(--portal-accent)] text-white border-[var(--portal-accent)]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Compliance Documents</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Registration Expiry", "registrationExpiry"],
              ["Insurance Expiry (compulsory)", "insuranceExpiry"],
              ["Insurance Expiry (voluntary)", "voluntaryInsuranceExpiry"],
              ["Tax Sticker Expiry", "taxStickerExpiry"],
              ["Last Inspection", "lastInspection"],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
                <input type="date" value={(form as Record<string, string>)[key]} onChange={(e) => set(key as keyof VehicleDraft, e.target.value as never)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button disabled={!canSave} onClick={() => onSave(form)}
            className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {vehicle ? "Save Changes" : "Add Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change status ────────────────────────────────────────────────────────────

function ChangeStatusForm({ current, onCancel, onSave }: { current: VehicleStatus; onCancel: () => void; onSave: (status: VehicleStatus, note: string) => void }) {
  const [status, setStatus] = useState<VehicleStatus>(current);
  const [note, setNote] = useState("");
  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {VEHICLE_STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={`py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              status === s ? "bg-[var(--portal-accent)] text-white border-[var(--portal-accent)]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}>
            {s}
          </button>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer">Cancel</button>
        <button disabled={status === current} onClick={() => onSave(status, note)}
          className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
          Update Status
        </button>
      </div>
    </div>
  );
}

// ── Maintenance log ──────────────────────────────────────────────────────────

function LogMaintenanceForm({ onCancel, onSave }: { onCancel: () => void; onSave: (entry: MaintenanceLogEntry, markInMaintenance: boolean) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("Scheduled service");
  const [cost, setCost] = useState(0);
  const [odometerKm, setOdometerKm] = useState(0);
  const [note, setNote] = useState("");
  const [markInMaintenance, setMarkInMaintenance] = useState(false);

  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Type</label>
          <input value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Repair" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Cost (THB)</label>
          <input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Odometer (km)</label>
          <input type="number" value={odometerKm} onChange={(e) => setOdometerKm(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
        </div>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
        <input type="checkbox" checked={markInMaintenance} onChange={(e) => setMarkInMaintenance(e.target.checked)} />
        Mark vehicle as In Maintenance (blocks availability)
      </label>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer">Cancel</button>
        <button
          disabled={!type.trim()}
          onClick={() => onSave({ date, type: type.trim(), cost, odometerKm, note: note.trim() }, markInMaintenance)}
          className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Log Entry
        </button>
      </div>
    </div>
  );
}

// ── Vehicle detail panel ─────────────────────────────────────────────────────

function VehicleDetailPanel({ vehicle, onClose, onEdit }: { vehicle: Vehicle; onClose: () => void; onEdit: () => void }) {
  useBodyScrollLock();
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [showMaintForm, setShowMaintForm] = useState(false);

  function handleStatusSave(status: VehicleStatus, note: string) {
    updateVehicle(vehicle.id, {
      status,
      statusHistory: [...vehicle.statusHistory, { status, at: nowStamp(), ...(note ? { note } : {}) }],
      updated: nowStamp(),
    });
    setShowStatusForm(false);
  }

  function handleMaintSave(entry: MaintenanceLogEntry, markInMaintenance: boolean) {
    const patch: Partial<Vehicle> = {
      maintenanceLog: [entry, ...vehicle.maintenanceLog],
      odometerKm: Math.max(vehicle.odometerKm, entry.odometerKm),
      updated: nowStamp(),
    };
    if (markInMaintenance && vehicle.status !== "In Maintenance") {
      patch.status = "In Maintenance";
      patch.statusHistory = [...vehicle.statusHistory, { status: "In Maintenance", at: nowStamp(), note: `Maintenance logged: ${entry.type}` }];
    }
    updateVehicle(vehicle.id, patch);
    setShowMaintForm(false);
  }

  const nearest = nearestExpiry(vehicle);
  const level = complianceLevel(nearest.date);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{vehicle.plateNumber}</h3>
            <p className="text-xs text-slate-500">{vehicle.brand} {vehicle.model} · {vehicle.vehicleClass}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer">Edit</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Status</span>
            <StatusBadge status={vehicle.status} />
            {level !== "ok" && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600">
                <AlertTriangle size={11} /> {nearest.label} {level === "expired" ? "expired" : "expiring soon"}
              </span>
            )}
          </div>

          <Section
            title="Vehicle Info"
            rows={[
              ["Year", String(vehicle.year)],
              ["Capacity", `${vehicle.capacityKg.toLocaleString()} kg`],
              ["Home Depot", vehicle.homeDepot],
              ["Odometer", `${vehicle.odometerKm.toLocaleString()} km`],
              ["Financed", vehicle.financed ? "Yes" : "No"],
            ]}
          />

          <Section
            title="Compliance Documents"
            rows={[
              ["Registration Expiry", formatDate(vehicle.registrationExpiry)],
              ["Insurance (compulsory)", formatDate(vehicle.insuranceExpiry)],
              ["Insurance (voluntary)", formatDate(vehicle.voluntaryInsuranceExpiry)],
              ["Tax Sticker Expiry", formatDate(vehicle.taxStickerExpiry)],
              ["Last Inspection", formatDate(vehicle.lastInspection)],
            ]}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Change Status</h4>
            </div>
            {showStatusForm ? (
              <ChangeStatusForm current={vehicle.status} onCancel={() => setShowStatusForm(false)} onSave={handleStatusSave} />
            ) : (
              <button onClick={() => setShowStatusForm(true)} className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                Update status...
              </button>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Status History</h4>
            <div className="space-y-2">
              {[...vehicle.statusHistory].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-[var(--portal-accent)]" />
                  <div>
                    <p className="text-xs font-medium text-slate-800">{h.status} <span className="text-slate-400 font-normal">· {h.at}</span></p>
                    {h.note && <p className="text-xs text-slate-500 mt-0.5">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Maintenance Log</h4>
              {!showMaintForm && (
                <button onClick={() => setShowMaintForm(true)} className="flex items-center gap-1 text-xs text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] font-medium cursor-pointer">
                  <Wrench size={11} /> Log Maintenance
                </button>
              )}
            </div>
            {showMaintForm && <LogMaintenanceForm onCancel={() => setShowMaintForm(false)} onSave={handleMaintSave} />}
            {vehicle.maintenanceLog.length === 0 ? (
              <p className="text-xs text-slate-400 mt-2">No maintenance logged yet.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {vehicle.maintenanceLog.map((m, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-xs font-medium text-slate-800">{m.type} <span className="text-slate-400 font-normal">· {formatDate(m.date)}</span></p>
                      {m.note && <p className="text-xs text-slate-500 mt-0.5">{m.note}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{m.odometerKm.toLocaleString()} km</p>
                    </div>
                    <span className="text-xs font-medium text-slate-700 shrink-0">{formatCurrency(m.cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vehicles list ─────────────────────────────────────────────────────────────

type SortKey = "status" | "compliance" | "created" | "updated";
type SortDir = "asc" | "desc";

const VEH_HEADERS = ["Plate Number", "Class", "Brand", "Model", "Home Depot", "Odometer (km)", "Status"];

function vehCSVRow(v: Vehicle): string[] {
  return [v.plateNumber, v.vehicleClass, v.brand, v.model, v.homeDepot, String(v.odometerKm), v.status];
}
function vehXLSXRow(v: Vehicle): (string | number)[] {
  return [v.plateNumber, v.vehicleClass, v.brand, v.model, v.homeDepot, v.odometerKm, v.status];
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

export function Vehicles() {
  const vehicles = useVehicles();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [complianceFilter, setComplianceFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const selected = selectedId ? (vehicles.find((v) => v.id === selectedId) ?? null) : null;
  const editing = editingId ? (vehicles.find((v) => v.id === editingId) ?? null) : null;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  function handleCreate(draft: VehicleDraft) {
    const id = `VEH-${String(vehicles.length + 1).padStart(3, "0")}`;
    addVehicle({
      ...draft, id, status: "Available",
      statusHistory: [{ status: "Available", at: nowStamp() }],
      maintenanceLog: [],
      created: nowStamp(), updated: nowStamp(),
    });
  }

  function handleEditSave(draft: VehicleDraft) {
    if (!editingId) return;
    updateVehicle(editingId, { ...draft, updated: nowStamp() });
    setEditingId(null);
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
      {showCreate && <VehicleForm onClose={() => setShowCreate(false)} onSave={(d) => { handleCreate(d); setShowCreate(false); }} />}
      {editing && <VehicleForm vehicle={editing} onClose={() => setEditingId(null)} onSave={handleEditSave} />}
      {selected && !editing && (
        <VehicleDetailPanel vehicle={selected} onClose={() => setSelectedId(null)} onEdit={() => { setEditingId(selected.id); }} />
      )}

      <MiniDash vehicles={vehicles} />

      <FilterBar
        showSearch
        searchableFields={["Plate Number", "Brand", "Model"]}
        showPeriod
        showExport
        showCreate
        createLabel="Add Vehicle"
        onCreate={() => setShowCreate(true)}
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(VEH_HEADERS, sorted.map(vehCSVRow), `vehicles-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(VEH_HEADERS, sorted.map(vehXLSXRow), `vehicles-${exportDateTag()}.xlsx`)}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        extraFilters={
          <>
            <FilterDropdown value={classFilter} onChange={(v) => { setClassFilter(v); setPage(1); }} placeholder="All Classes"
              options={[{ label: "All Classes", value: "" }, ...VEHICLE_CLASSES.map((c) => ({ label: c, value: c }))]} />
            <FilterDropdown value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="All Statuses"
              options={[{ label: "All Statuses", value: "" }, ...VEHICLE_STATUSES.map((s) => ({ label: s, value: s }))]} />
            <FilterDropdown value={complianceFilter} onChange={(v) => { setComplianceFilter(v); setPage(1); }} placeholder="All Compliance"
              options={[{ label: "All Compliance", value: "" }, { label: "OK", value: "ok" }, { label: "Expiring Soon", value: "soon" }, { label: "Expired", value: "expired" }]} />
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "1200px" }}>
            <colgroup>
              <col style={{ width: "130px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "200px" }} />
              <col style={{ width: "170px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Plate Number", "Class", "Vehicle", "Home Depot"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Odometer</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("compliance")}>
                  <span className="inline-flex items-center gap-1">Compliance<SortIndicator active={sortKey === "compliance"} direction={sortDir} /></span>
                </th>
                <th className="sticky right-0 bg-slate-50 border-l border-slate-100 z-10 text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("status")}>
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((v) => (
                <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(v.id)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium whitespace-nowrap">{v.plateNumber}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{v.vehicleClass}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 truncate">{v.brand} {v.model} ({v.year})</td>
                  <td className="px-4 py-3 text-xs text-slate-600 truncate">{v.homeDepot}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{v.odometerKm.toLocaleString()} km</td>
                  <td className="px-4 py-3 whitespace-nowrap"><ComplianceBadge vehicle={v} /></td>
                  <td className="sticky right-0 bg-white border-l border-slate-100 px-4 py-3 whitespace-nowrap">
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
