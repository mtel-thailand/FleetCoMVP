import { useState } from "react";
import { X, Building2, UserPlus, FileText, Plus, Trash2, ShieldCheck } from "lucide-react";
import type { ClientAccount, ClientStatus, DurationTier, RateCardEntry } from "@/app/data/clients";
import type { VehicleClass } from "@/app/data/vehicles";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatCurrency } from "@/app/data/formatters";
import { sortByStatus } from "@/app/components/ui/utils";
import { useBodyScrollLock } from "@/app/hooks/useBodyScrollLock";
import { useClients, addClient, updateClient, useClientUsers, addClientUser, updateClientUser } from "@/app/lib/clientsStore";

// brief §4.5: client org records, per-client rate cards, client user
// management, contract repository, data isolation.

const VEHICLE_CLASSES: VehicleClass[] = ["Pickup", "Van", "4-Wheel Truck", "6-Wheel Truck", "Sedan"];
const DURATION_TIERS: DurationTier[] = ["Ad hoc / Daily", "Short term", "Medium term", "Long term"];
const CLIENT_STATUSES: ClientStatus[] = ["Active", "Inactive"];
const CLIENT_ROLES = [
  { value: "client_admin", label: "Client Admin" },
  { value: "client_approver", label: "Client Approver / Manager" },
  { value: "client_requester", label: "Client Requester" },
  { value: "client_finance", label: "Client Finance" },
] as const;
const STATUS_PRIORITY = ["Active", "Inactive"];

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

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

// ── Create / edit client form ───────────────────────────────────────────────

type ClientDraft = Pick<ClientAccount, "name" | "taxId" | "registeredAddress" | "branch" | "billingTerms" | "creditTermsDays">;

const emptyDraft: ClientDraft = {
  name: "", taxId: "", registeredAddress: "", branch: "Head Office", billingTerms: "Net 30", creditTermsDays: 30,
};

function ClientForm({ client, onClose, onSave }: { client?: ClientAccount; onClose: () => void; onSave: (d: ClientDraft) => void }) {
  useBodyScrollLock();
  const [form, setForm] = useState<ClientDraft>(client ?? emptyDraft);

  function set<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSave = form.name.trim() && form.taxId.trim() && form.registeredAddress.trim();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-semibold text-slate-900">{client ? "Edit Client Account" : "Add Client Account"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Company Name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Thailand Post Co., Ltd."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tax ID (13-digit)</label>
              <input value={form.taxId} onChange={(e) => set("taxId", e.target.value)} placeholder="0000000000000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Branch</label>
              <input value={form.branch} onChange={(e) => set("branch", e.target.value)} placeholder="Head Office"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Registered Address</label>
            <textarea rows={2} value={form.registeredAddress} onChange={(e) => set("registeredAddress", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Billing Terms</label>
              <input value={form.billingTerms} onChange={(e) => set("billingTerms", e.target.value)} placeholder="e.g. Net 30"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Credit Terms (days)</label>
              <input type="number" value={form.creditTermsDays} onChange={(e) => set("creditTermsDays", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button disabled={!canSave} onClick={() => onSave(form)}
            className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {client ? "Save Changes" : "Add Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rate card ────────────────────────────────────────────────────────────────

function AddRateCardEntryForm({ onCancel, onAdd }: { onCancel: () => void; onAdd: (entry: RateCardEntry) => void }) {
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>("Pickup");
  const [durationTier, setDurationTier] = useState<DurationTier>("Ad hoc / Daily");
  const [pricePerDay, setPricePerDay] = useState(0);

  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-lg p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <select value={vehicleClass} onChange={(e) => setVehicleClass(e.target.value as VehicleClass)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]">
          {VEHICLE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={durationTier} onChange={(e) => setDurationTier(e.target.value as DurationTier)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]">
          {DURATION_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" value={pricePerDay} onChange={(e) => setPricePerDay(Number(e.target.value))} placeholder="Price / day (THB)"
          className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
        <button onClick={onCancel} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
        <button
          disabled={pricePerDay <= 0}
          onClick={() => onAdd({ vehicleClass, durationTier, pricePerDay })}
          className="px-2.5 py-1.5 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Client detail panel ─────────────────────────────────────────────────────

function ClientDetailPanel({ client, onClose, onEdit }: { client: ClientAccount; onClose: () => void; onEdit: () => void }) {
  useBodyScrollLock();
  const clientUsers = useClientUsers().filter((u) => u.clientId === client.id);
  const [showRateForm, setShowRateForm] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationPhone, setNewLocationPhone] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof CLIENT_ROLES)[number]["value"]>("client_requester");

  function handleAddRate(entry: RateCardEntry) {
    updateClient(client.id, { rateCard: [...client.rateCard, entry], updated: nowStamp() });
    setShowRateForm(false);
  }

  function handleRemoveRate(idx: number) {
    updateClient(client.id, { rateCard: client.rateCard.filter((_, i) => i !== idx), updated: nowStamp() });
  }

  // Branches feed the client portal's Request-a-Vehicle picker (RequestVehicle.tsx)
  // — a fixed list per client rather than free text, so what a requester
  // picks always matches how FleetCo already refers to that site, and comes
  // with a real phone number + address FleetCo can actually use. Configuring
  // the list is an ops action, not something a requester does inline while
  // filling out a request.
  function handleAddLocation() {
    const name = newLocationName.trim();
    if (!name) return;
    updateClient(client.id, {
      branches: [...(client.branches ?? []), { name, phone: newLocationPhone.trim(), address: newLocationAddress.trim() }],
      updated: nowStamp(),
    });
    setNewLocationName(""); setNewLocationPhone(""); setNewLocationAddress("");
    setShowAddLocation(false);
  }

  function handleRemoveLocation(idx: number) {
    updateClient(client.id, { branches: (client.branches ?? []).filter((_, i) => i !== idx), updated: nowStamp() });
  }

  function handleInvite() {
    const id = `CU-${String(clientUsers.length + 1).padStart(3, "0")}-${client.id}`;
    addClientUser({ id, clientId: client.id, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole, status: "Active" });
    setInviteName(""); setInviteEmail(""); setShowInvite(false);
  }

  function toggleUserStatus(userId: string, current: ClientStatus) {
    updateClientUser(userId, { status: current === "Active" ? "Inactive" : "Active" });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--portal-accent-light)] flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-[var(--portal-accent)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{client.name}</h3>
              <p className="text-xs text-slate-500">{client.branch}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer">Edit</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Status</span>
            <StatusBadge status={client.status} />
          </div>

          <Section
            title="Company Profile"
            rows={[
              ["Tax ID", client.taxId],
              ["Registered Address", client.registeredAddress],
              ["Billing Terms", client.billingTerms],
              ["Credit Terms", `${client.creditTermsDays} days`],
            ]}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch Locations</h4>
              {!showAddLocation && (
                <button onClick={() => setShowAddLocation(true)} className="flex items-center gap-1 text-xs text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] font-medium cursor-pointer">
                  <Plus size={11} /> Add Branch
                </button>
              )}
            </div>
            {showAddLocation && (
              <div className="bg-white border border-dashed border-slate-300 rounded-lg p-3 space-y-2 mb-2">
                <input
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="Branch name — e.g. Sriracha Distribution Center"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
                />
                <input
                  value={newLocationPhone}
                  onChange={(e) => setNewLocationPhone(e.target.value)}
                  placeholder="Phone — e.g. 038-123-456"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
                />
                <input
                  value={newLocationAddress}
                  onChange={(e) => setNewLocationAddress(e.target.value)}
                  placeholder="Address"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
                />
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => { setShowAddLocation(false); setNewLocationName(""); setNewLocationPhone(""); setNewLocationAddress(""); }} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                  <button
                    disabled={!newLocationName.trim()}
                    onClick={handleAddLocation}
                    className="px-2.5 py-1.5 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
            {(client.branches ?? []).length === 0 ? (
              <p className="text-xs text-slate-400">No branch locations yet — the client can't submit a request until at least one exists.</p>
            ) : (
              <div className="space-y-1.5">
                {(client.branches ?? []).map((b, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700">{b.name}</p>
                      {(b.phone || b.address) && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{[b.phone, b.address].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                    <button onClick={() => handleRemoveLocation(i)} className="text-slate-300 hover:text-rose-500 cursor-pointer shrink-0"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate Card</h4>
              {!showRateForm && (
                <button onClick={() => setShowRateForm(true)} className="flex items-center gap-1 text-xs text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] font-medium cursor-pointer">
                  <Plus size={11} /> Add Entry
                </button>
              )}
            </div>
            {showRateForm && <AddRateCardEntryForm onCancel={() => setShowRateForm(false)} onAdd={handleAddRate} />}
            {client.rateCard.length === 0 ? (
              <p className="text-xs text-slate-400 mt-2">No rate card entries yet.</p>
            ) : (
              <div className="bg-slate-50 rounded-xl overflow-hidden mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left font-medium px-3 py-2">Vehicle Class</th>
                      <th className="text-left font-medium px-3 py-2">Duration Tier</th>
                      <th className="text-right font-medium px-3 py-2">Price / Day</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.rateCard.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-700">{r.vehicleClass}</td>
                        <td className="px-3 py-2 text-slate-600">{r.durationTier}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800">{formatCurrency(r.pricePerDay)}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => handleRemoveRate(i)} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Users</h4>
              {!showInvite && (
                <button onClick={() => setShowInvite(true)} className="flex items-center gap-1 text-xs text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] font-medium cursor-pointer">
                  <UserPlus size={11} /> Invite User
                </button>
              )}
            </div>
            {showInvite && (
              <div className="bg-white border border-dashed border-slate-300 rounded-lg p-3 space-y-2.5 mb-2">
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email"
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]">
                  {CLIENT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setShowInvite(false)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                  <button disabled={!inviteName.trim() || !inviteEmail.trim()} onClick={handleInvite}
                    className="flex-1 py-1.5 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                    Send Invite
                  </button>
                </div>
              </div>
            )}
            {clientUsers.length === 0 ? (
              <p className="text-xs text-slate-400">No client users yet.</p>
            ) : (
              <div className="space-y-2">
                {clientUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{u.name}</p>
                      <p className="text-xs text-slate-500 truncate">{u.email} · {CLIENT_ROLES.find((r) => r.value === u.role)?.label}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={u.status} />
                      <button onClick={() => toggleUserStatus(u.id, u.status)} className="text-xs text-[var(--portal-accent)] hover:underline cursor-pointer">
                        {u.status === "Active" ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Section
            title="Contract / Agreement"
            rows={[["File", client.contractFileName ?? "No contract uploaded yet"]]}
            action={<span className="flex items-center gap-1 text-xs text-slate-400"><FileText size={11} /></span>}
          />

          <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5">
            <ShieldCheck size={13} className="shrink-0 mt-0.5" />
            <span>Data isolation: {client.name} can only ever see its own bookings, documents, and pricing in the Client Portal — enforced by scoping every client-portal query to this account.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Client list ──────────────────────────────────────────────────────────────

export function ClientAccounts() {
  const clients = useClients();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"status" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const selected = selectedId ? (clients.find((c) => c.id === selectedId) ?? null) : null;
  const editing = editingId ? (clients.find((c) => c.id === editingId) ?? null) : null;

  function handleSort() {
    setSortKey("status");
    setSortDir((d) => (sortKey === "status" && d === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  function handleCreate(draft: ClientDraft) {
    const id = `CLI-${String(clients.length + 1).padStart(3, "0")}`;
    addClient({ ...draft, id, status: "Active", rateCard: [], contractFileName: null, created: nowStamp(), updated: nowStamp() });
  }

  function handleEditSave(draft: ClientDraft) {
    if (!editingId) return;
    updateClient(editingId, { ...draft, updated: nowStamp() });
    setEditingId(null);
  }

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !search || c.name.toLowerCase().includes(q) || c.taxId.includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sorted = sortKey ? sortByStatus(filtered, "status", STATUS_PRIORITY, sortDir) : filtered;
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {showCreate && <ClientForm onClose={() => setShowCreate(false)} onSave={(d) => { handleCreate(d); setShowCreate(false); }} />}
      {editing && <ClientForm client={editing} onClose={() => setEditingId(null)} onSave={handleEditSave} />}
      {selected && !editing && (
        <ClientDetailPanel client={selected} onClose={() => setSelectedId(null)} onEdit={() => setEditingId(selected.id)} />
      )}

      <FilterBar
        showSearch
        searchableFields={["Company Name", "Tax ID"]}
        showPeriod
        showCreate
        createLabel="Add Client"
        onCreate={() => setShowCreate(true)}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        extraFilters={
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
          >
            <option value="">All Statuses</option>
            {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Company Name", "Tax ID", "Branch", "Billing Terms"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={handleSort}>
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(c.id)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-mono">{c.taxId}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{c.branch}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{c.billingTerms}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No client accounts found</div>}
        <TablePagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
