import { useEffect, useRef, useState } from "react";
import { useTableState } from "@/app/hooks/useTableState";
import { Modal, ModalTitle } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Input, Textarea } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Ban, Building2, CalendarClock, FileQuestion, Hash, MapPin, MoreHorizontal, Pencil, Plus, Power, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { formatPaymentTerms, getClientPaymentDays, getClientPaymentTerms, PAYMENT_TERM_DAYS, type Branch, type ClientAccount, type ClientStatus, type DurationTier, type OrgBranch, type PaymentTermDays, hasActiveHeadOffice, isValidThaiTaxId } from "@/app/data/clients";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatCurrency } from "@/app/data/formatters";
import { sortByStatus } from "@/app/components/ui/utils";
import {
  useClients, addClient, updateClient, updateClientTaxFields,
  addOrgBranch, updateOrgBranch, deactivateOrgBranch,
  useClientUsers, addClientUser, updateClientUser,
} from "@/app/lib/clientsStore";
import { getAdminRole, ROLE_LABELS } from "@/app/lib/auth";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { toastSuccess } from "@/app/lib/toast";
import { demoNowStamp } from "@/app/data/demoDates";

// brief §4.5: client org records, per-client rate cards, client user
// management, contract repository, data isolation.

const DURATION_TIERS: DurationTier[] = ["Ad hoc / Daily", "Short term", "Medium term", "Long term"];
const CLIENT_STATUSES: ClientStatus[] = ["Active", "Inactive"];
const CLIENT_ROLES = [
  { value: "client_admin", label: "Client Admin" },
  { value: "client_approver", label: "Client Approver / Manager" },
  { value: "client_requester", label: "Client Requester" },
  { value: "client_finance", label: "Client Finance" },
] as const;
const STATUS_PRIORITY = ["Active", "Inactive"];
type ClientDetailTab = "info" | "taxBranches" | "deliveryBranches" | "pricing";

function nowStamp() {
  return demoNowStamp();
}

// TaxFieldChange.changedBy needs a display name, and this demo has no real
// signed-in-user identity beyond an AdminRole — ROLE_LABELS is the closest
// thing to "who" actually available on the ops side (see TaxFieldChange's
// own comment in clients.ts).
function actingUserLabel(): string {
  const role = getAdminRole();
  return role ? ROLE_LABELS[role] : "Unknown";
}

function Section({ title, rows, action }: { title: string; rows: [string, string, React.ReactNode?][]; action?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
        {action}
      </div>
      <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
        {rows.map(([label, value, icon]) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">{icon}<span>{label}</span></span>
            <span className="text-right text-xs font-medium text-slate-800">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create / edit client form ───────────────────────────────────────────────

type ClientDraft = Pick<ClientAccount, "name" | "taxId" | "registeredAddress"> & {
  paymentTermsDays: PaymentTermDays;
};

const emptyDraft: ClientDraft = {
  name: "", taxId: "", registeredAddress: "", paymentTermsDays: 30,
};

function ClientForm({ client, onClose, onSave }: { client?: ClientAccount; onClose: () => void; onSave: (d: ClientDraft) => void }) {
  const [form, setForm] = useState<ClientDraft>(client ? {
    name: client.name,
    taxId: client.taxId,
    registeredAddress: client.registeredAddress,
    paymentTermsDays: getClientPaymentDays(client) as PaymentTermDays,
  } : emptyDraft);

  function set<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const taxIdTouched = form.taxId.trim().length > 0;
  const taxIdValid = isValidThaiTaxId(form.taxId.trim());
  const canSave = form.name.trim() && form.registeredAddress.trim() && taxIdValid;

  return (
    <Modal onClose={onClose} overlayClassName="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" contentClassName="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">{client ? "Edit Client Account" : "Add Client Account"}</h3></ModalTitle>
          <Button variant="close" size="icon" onClick={onClose}><X size={18} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <Label>Company Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Thailand Post Co., Ltd." />
          </div>
          <div>
              <Label>Tax ID (13-digit)</Label>
              <input value={form.taxId} onChange={(e) => set("taxId", e.target.value)} placeholder="0000000000000"
                className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 ${
                  taxIdTouched && !taxIdValid ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:ring-[var(--portal-accent)]"
                }`} />
              {taxIdTouched && !taxIdValid && <p className="mt-1 text-[11px] text-rose-600">Must be exactly 13 digits.</p>}
          </div>
          <div>
            <Label>Payment Terms</Label>
            <Select value={String(form.paymentTermsDays)} onValueChange={(value) => set("paymentTermsDays", Number(value) as PaymentTermDays)}>
              <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERM_DAYS.map((days) => (
                  <SelectItem key={days} value={String(days)} className="text-xs">
                    {formatPaymentTerms(days)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-slate-400">Used for new quotations; issued documents keep their original terms.</p>
          </div>
          <div>
            <Label>Registered Address</Label>
            <Textarea rows={2} value={form.registeredAddress} onChange={(e) => set("registeredAddress", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
          <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onClose}>Cancel</Button>
          <button disabled={!canSave} onClick={() => onSave(form)}
            className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {client ? "Save Changes" : "Add Client"}
          </button>
        </div>
      </Modal>
  );
}

// ── Tax branch registry ──────────────────────────────────────────────────────
// NOT the same thing as the "Branch Locations" section further down — those
// are delivery/pickup sites (Branch, data/clients.ts); this is the client's
// actual registered tax branches (OrgBranch) — สำนักงานใหญ่ plus numbered
// สาขา — what a real tax invoice has to name as the buyer's branch.

type OrgBranchDraft = Pick<OrgBranch, "code" | "isHeadOffice" | "legalNameTh" | "legalNameEn" | "addressTh" | "addressEn">;

const emptyOrgBranchDraft: OrgBranchDraft = {
  code: "", isHeadOffice: false, legalNameTh: "", legalNameEn: "", addressTh: "", addressEn: "",
};

function TaxBranchForm({
  branch, canBeHeadOffice, onClose, onSave,
}: {
  branch?: OrgBranch;
  // Whether the "this is the head office" checkbox can be checked at all
  // right now — false whenever another branch already holds that spot
  // (computed by the caller via hasActiveHeadOffice, excluding this branch
  // itself when editing one that already has it — see ClientDetailPanel).
  canBeHeadOffice: boolean;
  onClose: () => void;
  onSave: (draft: OrgBranchDraft) => void;
}) {
  const [form, setForm] = useState<OrgBranchDraft>(branch ?? emptyOrgBranchDraft);

  function set<K extends keyof OrgBranchDraft>(key: K, value: OrgBranchDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // All required, both languages — AC6's bilingual requirement isn't
  // optional-in-practice if only one language ever gets filled in.
  const canSave = form.code.trim() && form.legalNameTh.trim() && form.legalNameEn.trim() && form.addressTh.trim() && form.addressEn.trim();

  return (
    <Modal onClose={onClose} overlayClassName="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" contentClassName="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">{branch ? "Edit Tax Branch" : "Add Tax Branch"}</h3></ModalTitle>
          <Button variant="close" size="icon" onClick={onClose}><X size={18} /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Branch Code</Label>
              <Input className="font-mono" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="00000" />
            </div>
            <div className="flex flex-col justify-end pb-2">
              <label className={`flex items-center gap-2 text-xs ${canBeHeadOffice ? "text-slate-600" : "text-slate-300"}`}>
                <input type="checkbox" disabled={!canBeHeadOffice} checked={form.isHeadOffice} onChange={(e) => set("isHeadOffice", e.target.checked)} />
                Head Office (สำนักงานใหญ่)
              </label>
              {!canBeHeadOffice && !form.isHeadOffice && (
                <p className="mt-1 text-[10px] text-slate-400">Already has an active head office.</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Legal Name (Thai)</Label>
              <Input value={form.legalNameTh} onChange={(e) => set("legalNameTh", e.target.value)} placeholder="ชื่อนิติบุคคล" />
            </div>
            <div>
              <Label>Legal Name (English)</Label>
              <Input value={form.legalNameEn} onChange={(e) => set("legalNameEn", e.target.value)} placeholder="Legal entity name" />
            </div>
          </div>
          <div>
            <Label>Registered Address (Thai)</Label>
            <Textarea rows={2} value={form.addressTh} onChange={(e) => set("addressTh", e.target.value)} />
          </div>
          <div>
            <Label>Registered Address (English)</Label>
            <Textarea rows={2} value={form.addressEn} onChange={(e) => set("addressEn", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
          <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onClose}>Cancel</Button>
          <button disabled={!canSave} onClick={() => onSave(form)}
            className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {branch ? "Save Changes" : "Add Branch"}
          </button>
        </div>
      </Modal>
  );
}

// A real confirm step, not an instant click-to-remove — deactivating a tax
// branch is meant to be a considered, one-way action (see AC3/deactivateOrgBranch's
// own comment: there's no reactivate function to undo this from), so it
// gets the same "explain the consequence, then confirm" treatment as
// Reset Demo Data / Logout elsewhere in this app, unlike the instant
// trash-can delete the (unrelated) delivery-location list still uses below.
function DeactivateBranchModal({ branch, onCancel, onConfirm }: { branch: OrgBranch; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal onClose={onCancel} overlayClassName="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" contentClassName="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl overflow-hidden">
        <div className="p-5">
          <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">Deactivate this branch?</h3></ModalTitle>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            <span className="font-medium text-slate-700">{branch.legalNameEn}</span> ({branch.code}) will no longer be
            selectable for new documents, but stays visible on anything that already references it.
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onCancel}>Cancel</Button>
            <Button variant="danger" size="md" className="flex-1 px-0 py-2" onClick={onConfirm}>Deactivate</Button>
          </div>
        </div>
      </Modal>
  );
}

function ClientStatusModal({ client, onCancel, onConfirm }: { client: ClientAccount; onCancel: () => void; onConfirm: () => void }) {
  const isActive = client.status === "Active";
  const action = isActive ? "Deactivate" : "Reactivate";

  return (
    <Modal onClose={onCancel} overlayClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" contentClassName="w-full overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-sm sm:rounded-2xl">
        <div className="p-5">
          <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">{action} client account?</h3></ModalTitle>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-700">{client.name}</span> will remain in your records and be marked {isActive ? "Inactive" : "Active"}.
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" size="md" className="flex-1 px-0 py-2" type="button" onClick={onCancel}>Cancel</Button>
            <button type="button" onClick={onConfirm} className={`flex-1 rounded-lg py-2 text-xs font-medium text-white cursor-pointer ${isActive ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>{action} account</button>
          </div>
        </div>
      </Modal>
  );
}

function RateCardSection({
  client, onSave,
}: {
  client: ClientAccount;
  onSave: (rateCard: ClientAccount["rateCard"]) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftRates, setDraftRates] = useState<ClientAccount["rateCard"]>([]);
  const [newRateValues, setNewRateValues] = useState<Record<string, string>>({});
  const rates = isEditing ? draftRates : client.rateCard;
  const rateGroups = [...new Set(rates.map((rate) => rate.vehicleClass))];
  const durationTiers = DURATION_TIERS;
  const configuredRateCount = rates.length;
  const totalRateSlots = rateGroups.length * durationTiers.length;
  const canSave = draftRates.every((rate) => rate.pricePerDay > 0)
    && Object.values(newRateValues).every((value) => !value.trim() || Number(value) > 0);

  function startEditing() {
    setDraftRates(client.rateCard.map((rate) => ({ ...rate })));
    setNewRateValues({});
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftRates([]);
    setNewRateValues({});
    setIsEditing(false);
  }

  function saveEditing() {
    const newRates = Object.entries(newRateValues).flatMap(([key, value]) => {
      if (!value.trim()) return [];
      const [vehicleClass, durationTier] = key.split("::") as [typeof rateGroups[number], DurationTier];
      const pricePerDay = Number(value);
      return Number.isFinite(pricePerDay) && pricePerDay > 0 ? [{ vehicleClass, durationTier, pricePerDay }] : [];
    });
    onSave([...draftRates, ...newRates]);
    setDraftRates([]);
    setNewRateValues({});
    setIsEditing(false);
  }

  function updateRate(index: number, value: string) {
    const pricePerDay = Number(value);
    setDraftRates((current) => current.map((rate, rateIndex) => (
      rateIndex === index ? { ...rate, pricePerDay: Number.isFinite(pricePerDay) ? pricePerDay : 0 } : rate
    )));
  }

  function removeRate(index: number) {
    setDraftRates((current) => current.filter((_, rateIndex) => rateIndex !== index));
  }

  function updateNewRate(vehicleClass: typeof rateGroups[number], durationTier: DurationTier, value: string) {
    setNewRateValues((current) => ({ ...current, [`${vehicleClass}::${durationTier}`]: value }));
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rate Card</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Default daily pricing used to prefill quotations · {configuredRateCount} of {totalRateSlots} rates configured</p>
        </div>
        {isEditing ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" type="button" onClick={cancelEditing}>Cancel</Button>
            <Button variant="primary" size="sm" type="button" disabled={!canSave} onClick={saveEditing}>Save changes</Button>
          </div>
        ) : (
          <Button variant="link" size="icon" className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs" type="button" onClick={startEditing}><Pencil size={12} /> Edit</Button>
        )}
      </div>
      {rates.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No rate card entries yet.</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-lg bg-slate-50 p-2.5">
          <div
            className="overflow-x-auto rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
            tabIndex={0}
            aria-label="Rate card duration tiers"
          >
            <table className="w-full min-w-[560px] table-fixed text-xs">
              <caption className="sr-only">Daily rate card by vehicle class and duration tier</caption>
              <colgroup>
                <col style={{ width: "28%" }} />
                {durationTiers.map((tier) => <col key={tier} style={{ width: "18%" }} />)}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  <th scope="col" className="px-2.5 py-2 text-left">Vehicle class</th>
                  {durationTiers.map((tier) => <th key={tier} scope="col" className="px-2.5 py-2 text-right leading-tight">{tier}</th>)}
                </tr>
              </thead>
              <tbody>
                {rateGroups.map((vehicleClass) => (
                  <tr key={vehicleClass} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="px-2.5 py-2.5 text-left align-top font-normal text-slate-700">{vehicleClass}</th>
                    {durationTiers.map((tier) => {
                      const matches = rates
                        .map((rate, index) => ({ rate, index }))
                        .filter(({ rate }) => rate.vehicleClass === vehicleClass && rate.durationTier === tier);
                      return (
                        <td key={tier} className="px-2.5 py-2.5 text-right align-top">
                          {matches.length > 0 ? (
                            <div className="space-y-1">
                              {matches.map(({ rate, index }) => (
                                <div key={`${rate.vehicleClass}-${rate.durationTier}-${index}`} className="flex items-center justify-end gap-1">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={rate.pricePerDay}
                                      onChange={(event) => updateRate(index, event.target.value)}
                                      aria-label={`${rate.vehicleClass} ${rate.durationTier} price per day`}
                                      className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-1 text-right text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
                                    />
                                  ) : (
                                    <span className="whitespace-nowrap font-medium text-slate-800">{formatCurrency(rate.pricePerDay)}</span>
                                  )}
                                  {isEditing && <button type="button" title="Remove rate" aria-label={`Remove ${rate.vehicleClass} ${rate.durationTier} rate`} onClick={() => removeRate(index)} className="shrink-0 text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 size={11} /></button>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            isEditing ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={newRateValues[`${vehicleClass}::${tier}`] ?? ""}
                                onChange={(event) => updateNewRate(vehicleClass, tier, event.target.value)}
                                aria-label={`${vehicleClass} ${tier} price per day`}
                                className="w-full min-w-0 rounded-md border border-dashed border-slate-300 px-2 py-1 text-right text-xs text-slate-500 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
                              />
                            ) : (
                              <span className="text-slate-300" title="No rate configured">—</span>
                            )
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function TaxBranchesSection({ client, onAdd, onEdit, onDeactivate }: {
  client: ClientAccount;
  onAdd: () => void;
  onEdit: (branch: OrgBranch) => void;
  onDeactivate: (branch: OrgBranch) => void;
}) {
  const { filters, setFilter, page, setPage } = useTableState({
    storageKey: `client-${client.id}.taxBranches`,
    filters: { search: "" },
  });
  const query = filters.search.trim().toLowerCase();
  const filtered = client.orgBranches.filter((branch) => (
    !query || [branch.code, branch.legalNameEn, branch.legalNameTh, branch.addressEn, branch.addressTh]
      .some((value) => value.toLowerCase().includes(query))
  ));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search tax branches" value={filters.search} onChange={(event) => setFilter("search", event.target.value)} placeholder="Search branches" className="pl-8" />
        </div>
        <Button variant="link" size="icon" className="ml-auto flex shrink-0 items-center justify-center gap-1 text-xs" type="button" onClick={onAdd}><Plus size={12} /> Add Tax Branch</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="relative overflow-x-auto">
        <table className="w-full table-fixed text-sm" style={{ minWidth: "760px" }}>
          <caption className="sr-only">Tax registration branches</caption>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th scope="col" className="w-[90px] px-4 py-2.5 text-left text-xs font-medium text-slate-400">Code</th>
              <th scope="col" className="w-[250px] px-4 py-2.5 text-left text-xs font-medium text-slate-400">Legal name</th>
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Registered address</th>
              <th scope="col" className="w-[110px] px-4 py-2.5 text-left text-xs font-medium text-slate-400">Status</th>
              <th scope="col" className="w-[90px] px-4 py-2.5 text-right text-xs font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((branch) => {
              const isDeactivated = branch.status === "Deactivated";
              return (
                <tr key={branch.id} className={`group border-b border-slate-50 hover:bg-slate-50 ${isDeactivated ? "opacity-60" : ""}`}>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-xs font-mono text-slate-500">{branch.code}</td>
                  <td className="px-4 py-3 align-top text-xs">
                    <p className="font-medium text-slate-800">{branch.legalNameEn}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{branch.legalNameTh}</p>
                    {branch.isHeadOffice && <span className="mt-1 inline-flex rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">Head Office</span>}
                  </td>
                  <td className="px-4 py-3 align-top text-xs leading-relaxed text-slate-500">
                    <p>{branch.addressEn}</p>
                    <p className="mt-0.5 text-slate-400">{branch.addressTh}</p>
                  </td>
                  <td className="px-4 py-3 align-top"><StatusBadge status={branch.status} /></td>
                  <td className="px-4 py-3 text-right align-top">
                    {!isDeactivated && (
                      <div className="flex justify-end gap-2">
                        <button type="button" title="Edit branch" aria-label={`Edit ${branch.legalNameEn}`} onClick={() => onEdit(branch)} className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><Pencil size={14} /></button>
                        <button type="button" title="Deactivate branch" aria-label={`Deactivate ${branch.legalNameEn}`} onClick={() => onDeactivate(branch)} className="rounded-md p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"><Ban size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-400">No tax branches match your search.</p>}
        <TablePagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </>
  );
}

function DeliveryBranchForm({
  newLocationName, newLocationPhone, newLocationAddress,
  title, submitLabel, onCancel, onNameChange, onPhoneChange, onAddressChange, onSubmit,
}: {
  newLocationName: string;
  newLocationPhone: string;
  newLocationAddress: string;
  title: string;
  submitLabel: string;
  onCancel: () => void;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onSubmit: () => void;
}) {

  return (
    <Modal onClose={onCancel} overlayClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" contentClassName="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">{title}</h3></ModalTitle>
          <Button variant="close" size="icon" type="button" onClick={onCancel}><X size={18} /></Button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div>
            <Label>Branch name</Label>
            <Input value={newLocationName} onChange={(e) => onNameChange(e.target.value)} placeholder="Branch name" autoFocus />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={newLocationPhone} onChange={(e) => onPhoneChange(e.target.value)} placeholder="Phone" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={newLocationAddress} onChange={(e) => onAddressChange(e.target.value)} placeholder="Address" />
          </div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4">
          <Button variant="outline" size="md" className="flex-1 px-0 py-2" type="button" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="md" className="flex-1 px-0 py-2" type="button" disabled={!newLocationName.trim()} onClick={onSubmit}>{submitLabel}</Button>
        </div>
      </Modal>
  );
}

function DeliveryBranchesSection({
  client, showAddLocation, editingLocationIndex, newLocationName, newLocationPhone, newLocationAddress,
  onStartAdd, onStartEdit, onCancelForm, onNameChange, onPhoneChange, onAddressChange, onAdd, onSaveEdit, onRemove,
}: {
  client: ClientAccount;
  showAddLocation: boolean;
  editingLocationIndex: number | null;
  newLocationName: string;
  newLocationPhone: string;
  newLocationAddress: string;
  onStartAdd: () => void;
  onStartEdit: (index: number) => void;
  onCancelForm: () => void;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onAdd: () => void;
  onSaveEdit: () => void;
  onRemove: (index: number) => void;
}) {
  const isEditingLocation = editingLocationIndex !== null;
  const { filters, setFilter, page, setPage } = useTableState({
    storageKey: `client-${client.id}.deliverySites`,
    filters: { search: "" },
  });
  const query = filters.search.trim().toLowerCase();
  const filtered = (client.branches ?? [])
    .map((branch, index) => ({ branch, index }))
    .filter(({ branch }) => (
      !query || [branch.name, branch.phone, branch.address]
        .some((value) => value.toLowerCase().includes(query))
    ));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search delivery sites" value={filters.search} onChange={(event) => setFilter("search", event.target.value)} placeholder="Search sites" className="pl-8" />
        </div>
        {!showAddLocation && !isEditingLocation && (
          <Button variant="link" size="icon" className="ml-auto flex shrink-0 items-center justify-center gap-1 text-xs" type="button" onClick={onStartAdd}><Plus size={12} /> Add Branch</Button>
        )}
      </div>
      {(showAddLocation || isEditingLocation) && (
        <DeliveryBranchForm
          newLocationName={newLocationName}
          newLocationPhone={newLocationPhone}
          newLocationAddress={newLocationAddress}
          title={isEditingLocation ? "Edit Delivery Branch" : "Add Delivery Branch"}
          submitLabel={isEditingLocation ? "Save Changes" : "Add Branch"}
          onCancel={onCancelForm}
          onNameChange={onNameChange}
          onPhoneChange={onPhoneChange}
          onAddressChange={onAddressChange}
          onSubmit={isEditingLocation ? onSaveEdit : onAdd}
        />
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="relative overflow-x-auto">
        <table className="w-full table-fixed text-sm" style={{ minWidth: "680px" }}>
          <caption className="sr-only">Delivery branches</caption>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th scope="col" className="w-[260px] px-4 py-2.5 text-left text-xs font-medium text-slate-400">Site name</th>
              <th scope="col" className="w-[150px] px-4 py-2.5 text-left text-xs font-medium text-slate-400">Phone</th>
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Address</th>
              <th scope="col" className="w-[90px] px-4 py-2.5 text-right text-xs font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ branch, index }) => (
              <tr key={`${branch.name}-${index}`} className="group border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 align-top text-xs font-medium text-slate-800">{branch.name}</td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-500">{branch.phone || "—"}</td>
                <td className="px-4 py-3 align-top text-xs leading-relaxed text-slate-500">{branch.address || "—"}</td>
                <td className="px-4 py-3 text-right align-top">
                  <div className="flex justify-end gap-2">
                    <button type="button" title="Edit branch" aria-label={`Edit ${branch.name}`} onClick={() => onStartEdit(index)} className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><Pencil size={14} /></button>
                    <button type="button" title="Remove branch" aria-label={`Remove ${branch.name}`} onClick={() => onRemove(index)} className="rounded-md p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-400">No delivery sites match your search.</p>}
        <TablePagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </>
  );
}

// ── Client detail panel ─────────────────────────────────────────────────────

function RemoveDeliveryBranchModal({ branch, onCancel, onConfirm }: { branch: Branch; onCancel: () => void; onConfirm: () => void }) {

  return (
    <Modal onClose={onCancel} overlayClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" contentClassName="w-full overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-sm sm:rounded-2xl">
        <div className="p-5">
          <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">Remove delivery branch?</h3></ModalTitle>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-700">{branch.name}</span> will no longer be available as a pickup or delivery site for new requests.
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" size="md" className="flex-1 px-0 py-2" type="button" onClick={onCancel}>Cancel</Button>
            <Button variant="danger" size="md" className="flex-1 px-0 py-2" type="button" onClick={onConfirm}>Remove branch</Button>
          </div>
        </div>
      </Modal>
  );
}

function ClientDetailPanel({ client, onEdit }: { client: ClientAccount; onEdit: () => void }) {
  const clientUsers = useClientUsers().filter((u) => u.clientId === client.id);
  const showClientUsers = false;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: ClientDetailTab = searchParams.get("tab") === "pricing"
    ? "pricing"
    : searchParams.get("tab") === "tax-branches"
      ? "taxBranches"
      : searchParams.get("tab") === "delivery-branches"
        ? "deliveryBranches"
        : "info";
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);
  const [removingLocation, setRemovingLocation] = useState<{ index: number; branch: Branch } | null>(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showAccountActions, setShowAccountActions] = useState(false);
  const accountActionsRef = useRef<HTMLDivElement | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationPhone, setNewLocationPhone] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof CLIENT_ROLES)[number]["value"]>("client_requester");
  const [showAddOrgBranch, setShowAddOrgBranch] = useState(false);
  const [editingOrgBranch, setEditingOrgBranch] = useState<OrgBranch | null>(null);
  const [deactivatingOrgBranch, setDeactivatingOrgBranch] = useState<OrgBranch | null>(null);

  function selectTab(tab: ClientDetailTab) {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === "pricing") nextParams.set("tab", "pricing");
    else if (tab === "taxBranches") nextParams.set("tab", "tax-branches");
    else if (tab === "deliveryBranches") nextParams.set("tab", "delivery-branches");
    else nextParams.delete("tab");
    setSearchParams(nextParams, { replace: true });
  }

  function handleSaveRateCard(rateCard: ClientAccount["rateCard"]) {
    updateClient(client.id, { rateCard, updated: nowStamp() });
    toastSuccess("Rate card saved.");
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
    resetLocationForm();
    toastSuccess("Delivery site {name} added.", { name });
  }

  function handleRemoveLocation(idx: number) {
    const branch = (client.branches ?? [])[idx];
    if (branch) setRemovingLocation({ index: idx, branch });
  }

  function resetLocationForm() {
    setNewLocationName(""); setNewLocationPhone(""); setNewLocationAddress("");
    setShowAddLocation(false);
    setEditingLocationIndex(null);
  }

  function handleStartAddLocation() {
    resetLocationForm();
    setShowAddLocation(true);
  }

  function handleStartEditLocation(idx: number) {
    const branch = (client.branches ?? [])[idx];
    if (!branch) return;
    setNewLocationName(branch.name);
    setNewLocationPhone(branch.phone);
    setNewLocationAddress(branch.address);
    setShowAddLocation(false);
    setEditingLocationIndex(idx);
  }

  function handleSaveLocation() {
    const index = editingLocationIndex;
    const name = newLocationName.trim();
    if (index === null || !name) return;
    updateClient(client.id, {
      branches: (client.branches ?? []).map((branch, branchIndex) => branchIndex === index
        ? { name, phone: newLocationPhone.trim(), address: newLocationAddress.trim() }
        : branch),
      updated: nowStamp(),
    });
    resetLocationForm();
    toastSuccess("Delivery site {name} updated.", { name });
  }

  function handleConfirmRemoveLocation() {
    if (!removingLocation) return;
    updateClient(client.id, { branches: (client.branches ?? []).filter((_, i) => i !== removingLocation.index), updated: nowStamp() });
    toastSuccess("Delivery site {name} removed.", { name: removingLocation.branch.name });
    setRemovingLocation(null);
  }

  function handleConfirmStatusChange() {
    updateClient(client.id, { status: client.status === "Active" ? "Inactive" : "Active", updated: nowStamp() });
    setShowStatusConfirm(false);
    toastSuccess("Client account status updated.");
  }

  useEffect(() => {
    if (!showAccountActions) return;
    function handleOutsideClick(event: PointerEvent) {
      if (accountActionsRef.current && !accountActionsRef.current.contains(event.target as Node)) setShowAccountActions(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setShowAccountActions(false);
    }
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showAccountActions]);

  function handleInvite() {
    const id = `CU-${String(clientUsers.length + 1).padStart(3, "0")}-${client.id}`;
    addClientUser({ id, clientId: client.id, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole, status: "Active" });
    setInviteName(""); setInviteEmail(""); setShowInvite(false);
    toastSuccess("Client user invited.");
  }

  function toggleUserStatus(userId: string, current: ClientStatus) {
    updateClientUser(userId, { status: current === "Active" ? "Inactive" : "Active" });
    toastSuccess("Client user status updated.");
  }

  function handleAddOrgBranch(draft: OrgBranchDraft) {
    addOrgBranch(client.id, { ...draft, status: "Active" });
    setShowAddOrgBranch(false);
    toastSuccess("Tax branch {name} added.", { name: draft.legalNameEn });
  }

  function handleSaveOrgBranch(draft: OrgBranchDraft) {
    if (!editingOrgBranch) return;
    // Picked field by field, not `draft` passed wholesale — same reason as
    // handleEditSave above: TaxBranchForm seeds its state from the full
    // OrgBranch when editing (id/status/fieldHistory included), even though
    // it's typed as the narrower OrgBranchDraft, so forwarding `draft`
    // as-is would carry a stale fieldHistory/status snapshot from whenever
    // the modal opened into this patch.
    updateOrgBranch(client.id, editingOrgBranch.id, {
      code: draft.code, isHeadOffice: draft.isHeadOffice,
      legalNameTh: draft.legalNameTh, legalNameEn: draft.legalNameEn,
      addressTh: draft.addressTh, addressEn: draft.addressEn,
    }, actingUserLabel());
    setEditingOrgBranch(null);
    toastSuccess("Tax branch {name} updated.", { name: draft.legalNameEn });
  }

  function handleConfirmDeactivate() {
    if (!deactivatingOrgBranch) return;
    deactivateOrgBranch(client.id, deactivatingOrgBranch.id, actingUserLabel());
    toastSuccess("Tax branch {name} deactivated.", { name: deactivatingOrgBranch.legalNameEn });
    setDeactivatingOrgBranch(null);
  }

  return (
    <div className="max-w-[1600px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-lg font-semibold text-slate-900">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Client ID · {client.id}</p>
        </div>
        <div ref={accountActionsRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Account actions"
            aria-expanded={showAccountActions}
            onClick={() => setShowAccountActions((visible) => !visible)}
            className="flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"
          >
            <MoreHorizontal size={17} />
          </button>
          {showAccountActions && (
            <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={() => { setShowAccountActions(false); setShowStatusConfirm(true); }}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs cursor-pointer ${client.status === "Active" ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"}`}
              >
                <Power size={13} /> {client.status === "Active" ? "Deactivate account" : "Reactivate account"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showAddOrgBranch && (
        <TaxBranchForm
          canBeHeadOffice={!hasActiveHeadOffice(client.orgBranches)}
          onClose={() => setShowAddOrgBranch(false)}
          onSave={handleAddOrgBranch}
        />
      )}
      {editingOrgBranch && (
        <TaxBranchForm
          branch={editingOrgBranch}
          canBeHeadOffice={editingOrgBranch.isHeadOffice || !hasActiveHeadOffice(client.orgBranches.filter((b) => b.id !== editingOrgBranch.id))}
          onClose={() => setEditingOrgBranch(null)}
          onSave={handleSaveOrgBranch}
        />
      )}
      {deactivatingOrgBranch && (
        <DeactivateBranchModal branch={deactivatingOrgBranch} onCancel={() => setDeactivatingOrgBranch(null)} onConfirm={handleConfirmDeactivate} />
      )}
      {removingLocation && (
        <RemoveDeliveryBranchModal branch={removingLocation.branch} onCancel={() => setRemovingLocation(null)} onConfirm={handleConfirmRemoveLocation} />
      )}
      {showStatusConfirm && (
        <ClientStatusModal client={client} onCancel={() => setShowStatusConfirm(false)} onConfirm={handleConfirmStatusChange} />
      )}

      <div className="mb-5 border-b border-slate-200" role="tablist" aria-label="Client account sections">
        <div className="flex gap-6">
          <button
            type="button"
            role="tab"
            id="client-info-tab"
            aria-controls="client-info-panel"
            aria-selected={activeTab === "info"}
            onClick={() => selectTab("info")}
            className={`border-b-2 px-0.5 pb-2.5 text-xs font-medium transition-colors cursor-pointer ${activeTab === "info" ? "border-[var(--portal-accent)] text-[var(--portal-accent)]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Info
          </button>
          <button
            type="button"
            role="tab"
            id="client-tax-branches-tab"
            aria-controls="client-tax-branches-panel"
            aria-selected={activeTab === "taxBranches"}
            onClick={() => selectTab("taxBranches")}
            className={`flex items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-xs font-medium transition-colors cursor-pointer ${activeTab === "taxBranches" ? "border-[var(--portal-accent)] text-[var(--portal-accent)]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Tax Branches
            <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none ${activeTab === "taxBranches" ? "bg-[var(--portal-accent)] text-white" : "bg-slate-100 text-slate-500"}`}>
              {client.orgBranches.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="client-delivery-branches-tab"
            aria-controls="client-delivery-branches-panel"
            aria-selected={activeTab === "deliveryBranches"}
            onClick={() => selectTab("deliveryBranches")}
            className={`flex items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-xs font-medium transition-colors cursor-pointer ${activeTab === "deliveryBranches" ? "border-[var(--portal-accent)] text-[var(--portal-accent)]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Delivery Branches
            <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none ${activeTab === "deliveryBranches" ? "bg-[var(--portal-accent)] text-white" : "bg-slate-100 text-slate-500"}`}>
              {client.branches?.length ?? 0}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="client-pricing-tab"
            aria-controls="client-pricing-panel"
            aria-selected={activeTab === "pricing"}
            onClick={() => selectTab("pricing")}
            className={`border-b-2 px-0.5 pb-2.5 text-xs font-medium transition-colors cursor-pointer ${activeTab === "pricing" ? "border-[var(--portal-accent)] text-[var(--portal-accent)]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Rate &amp; Pricing
          </button>
        </div>
      </div>

      <div
        id={activeTab === "info"
          ? "client-info-panel"
          : activeTab === "taxBranches"
            ? "client-tax-branches-panel"
            : activeTab === "deliveryBranches"
              ? "client-delivery-branches-panel"
              : "client-pricing-panel"}
        role="tabpanel"
        aria-labelledby={activeTab === "info"
          ? "client-info-tab"
          : activeTab === "taxBranches"
            ? "client-tax-branches-tab"
            : activeTab === "deliveryBranches"
              ? "client-delivery-branches-tab"
              : "client-pricing-tab"}
        className="grid grid-cols-1 gap-5"
      >
        <div className="space-y-5">
          {activeTab === "info" ? (
            <>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <Section
              title="Company Profile"
              action={(
                <Button variant="link" size="icon" className="flex shrink-0 items-center gap-1 text-xs" type="button" onClick={onEdit}>
                  <Pencil size={12} /> Edit Account
                </Button>
              )}
              rows={[
                ["Company Name", client.name, <Building2 size={12} className="text-slate-400" />],
                ["Tax ID", client.taxId, <Hash size={12} className="text-slate-400" />],
                ["Payment Terms", getClientPaymentTerms(client), <CalendarClock size={12} className="text-slate-400" />],
                ["Registered Address", client.registeredAddress, <MapPin size={12} className="text-slate-400" />],
              ]}
            />
            {client.taxFieldHistory.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[10px] font-medium text-slate-400 hover:text-slate-600">Tax field history ({client.taxFieldHistory.length})</summary>
                <ul className="mt-1.5 space-y-1 border-l border-slate-200 pl-3">
                  {client.taxFieldHistory.map((change, i) => (
                    <li key={i} className="text-[10px] leading-relaxed text-slate-400">
                      <span className="font-medium text-slate-500">{change.field}</span> was "{change.previousValue}" — {change.changedBy}, {change.changedAt}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {showClientUsers && <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Client Users</h4>
              {!showInvite && (
                <button type="button" onClick={() => setShowInvite(true)} className="flex items-center gap-1 text-xs font-medium text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] cursor-pointer"><UserPlus size={12} /> Invite User</button>
              )}
            </div>
            {showInvite && (
              <div className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-dashed border-slate-300 p-3 sm:grid-cols-2">
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" />
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" />
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as typeof inviteRole)}>
                  <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_ROLES.map((role) => <SelectItem key={role.value} value={role.value} className="text-xs">{role.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" size="md" className="flex-1 px-0 py-2" type="button" onClick={() => setShowInvite(false)}>Cancel</Button>
                  <Button variant="primary" size="md" className="flex-1 px-0 py-2" type="button" disabled={!inviteName.trim() || !inviteEmail.trim()} onClick={handleInvite}>Send Invite</Button>
                </div>
              </div>
            )}
            {clientUsers.length === 0 ? (
              <p className="text-xs text-slate-400">No client users yet.</p>
            ) : (
              <div className="space-y-2">
                {clientUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400"><Users size={14} /></div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-800">{user.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{user.email} · {CLIENT_ROLES.find((role) => role.value === user.role)?.label}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={user.status} />
                      <button type="button" onClick={() => toggleUserStatus(user.id, user.status)} className="text-xs text-[var(--portal-accent)] hover:underline cursor-pointer">{user.status === "Active" ? "Deactivate" : "Reactivate"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>}

            </>
          ) : activeTab === "taxBranches" ? (
            <TaxBranchesSection
              client={client}
              onAdd={() => setShowAddOrgBranch(true)}
              onEdit={setEditingOrgBranch}
              onDeactivate={setDeactivatingOrgBranch}
            />
          ) : activeTab === "deliveryBranches" ? (
            <DeliveryBranchesSection
              client={client}
              showAddLocation={showAddLocation}
              editingLocationIndex={editingLocationIndex}
              newLocationName={newLocationName}
              newLocationPhone={newLocationPhone}
              newLocationAddress={newLocationAddress}
              onStartAdd={handleStartAddLocation}
              onStartEdit={handleStartEditLocation}
              onCancelForm={resetLocationForm}
              onNameChange={setNewLocationName}
              onPhoneChange={setNewLocationPhone}
              onAddressChange={setNewLocationAddress}
              onAdd={handleAddLocation}
              onSaveEdit={handleSaveLocation}
              onRemove={handleRemoveLocation}
            />
          ) : (
            <RateCardSection
              client={client}
              onSave={handleSaveRateCard}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Client list ──────────────────────────────────────────────────────────────

export function ClientAccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const clients = useClients();
  const client = clients.find((account) => account.id === id);
  const [showEdit, setShowEdit] = useState(false);

  usePageHeader(client?.name, "Client Accounts");

  function handleEditSave(draft: ClientDraft) {
    if (!client) return;
    // Split so only the actual tax fields (name/taxId/registeredAddress) go
    // through the audited path — payment terms aren't tax fields and would
    // otherwise pad taxFieldHistory with irrelevant "changes" every time
    // only the payment setting got edited.
    // Keep the audited tax update separate from the ordinary account patch so
    // the two store paths cannot overwrite each other's history.
    updateClientTaxFields(client.id, { name: draft.name, taxId: draft.taxId, registeredAddress: draft.registeredAddress }, actingUserLabel());
    updateClient(client.id, {
      paymentTermsDays: draft.paymentTermsDays,
      paymentTerms: formatPaymentTerms(draft.paymentTermsDays),
      updated: nowStamp(),
    });
    setShowEdit(false);
    toastSuccess("Client account updated.");
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/ops/clients")}
        className="mb-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to Client Accounts
      </button>

      {client ? (
        <>
          {showEdit && <ClientForm client={client} onClose={() => setShowEdit(false)} onSave={handleEditSave} />}
          <ClientDetailPanel client={client} onEdit={() => setShowEdit(true)} />
        </>
      ) : (
        <div className="max-w-2xl rounded-xl border border-slate-200 bg-white">
          <EmptyState
            icon={FileQuestion}
            title="Client account not found"
            subtitle={`${id ?? "This account"} doesn't exist.`}
            action={{ label: "Go to Client Accounts", to: "/ops/clients" }}
          />
        </div>
      )}
    </div>
  );
}

export function ClientAccounts() {
  const navigate = useNavigate();
  const clients = useClients();
  const [showCreate, setShowCreate] = useState(false);
  // Status is this table's only sortable column, so toggleSort is always
  // called with it. Starts unsorted until the header is clicked.
  const { filters, setFilter, sortKey, sortDir, toggleSort, page, setPage } =
    useTableState<{ search: string; status: string }, "status">({
      storageKey: "opsClients",
      filters: { search: "", status: "" },
      defaultDirFor: () => "asc",
    });
  const { search, status: statusFilter } = filters;

  function handleCreate(draft: ClientDraft) {
    const id = `CLI-${String(clients.length + 1).padStart(3, "0")}`;
    addClient({
      ...draft,
      branch: "Head Office",
      paymentTerms: formatPaymentTerms(draft.paymentTermsDays),
      id,
      status: "Active",
      rateCard: [],
      orgBranches: [],
      taxFieldHistory: [],
      contractFileName: null,
      created: nowStamp(),
      updated: nowStamp(),
    });
    setShowCreate(false);
    toastSuccess("Client account {name} created.", { name: draft.name });
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
      {showCreate && <ClientForm onClose={() => setShowCreate(false)} onSave={handleCreate} />}

      <FilterBar
        showSearch
        searchableFields={["Company Name", "Tax ID"]}
        showCreate
        createLabel="Add Client"
        onCreate={() => setShowCreate(true)}
        onSearch={(q) => setFilter("search", q)}
        defaultSearch={search}
        extraFilters={
          <FilterDropdown value={statusFilter} onChange={(v) => setFilter("status", v)} placeholder="All Statuses"
            options={[{ label: "All Statuses", value: "" }, ...CLIENT_STATUSES.map((s) => ({ label: s, value: s }))]} />
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Company Name", "Tax ID", "Tax Branches", "Delivery Sites", "Payment Terms"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("status")}>
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/ops/clients/${c.id}`)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-mono">{c.taxId}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{c.orgBranches.filter((branch) => branch.status === "Active").length} active</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{(c.branches ?? []).length} {(c.branches ?? []).length === 1 ? "site" : "sites"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{getClientPaymentTerms(c)}</td>
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
