// Shared client-account store — same reasoning as vehiclesStore.ts. Client
// Accounts (rate cards, contract status, users) can now be edited by
// FleetCo staff, and needs to be live everywhere a client org is read from
// (RequestInbox's client lookup, the client portal's own rate card, etc.)
import { useEffect, useState } from "react";
import { mockClients, mockClientUsers, type ClientAccount, type ClientUser, type OrgBranch, type TaxFieldChange } from "@/app/data/clients";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";
import { demoNowStamp } from "@/app/data/demoDates";

function nowStamp() {
  return demoNowStamp();
}

// Which fields on each record are tax-relevant enough to need a "who/when/
// previous value" trail — everything else on ClientAccount (paymentTerms,
// status, rateCard, contractFileName) goes through the
// ordinary unaudited updateClient/updateOrgBranch-adjacent paths instead.
const CLIENT_TAX_FIELDS = ["name", "taxId", "registeredAddress"] as const;
const ORG_BRANCH_TAX_FIELDS = ["code", "isHeadOffice", "legalNameTh", "legalNameEn", "addressTh", "addressEn"] as const;

// Shared by updateClientTaxFields and updateOrgBranch below — diffs only
// the fields the caller actually passed in patch (so calling with a
// one-field patch doesn't spuriously "change" every other tracked field
// against itself), and only records an entry when the value actually
// differs, so re-saving a form with nothing edited doesn't pad the history
// with no-op entries.
function recordTaxFieldChanges<T extends object>(
  current: T,
  patch: Partial<T>,
  fields: readonly (keyof T)[],
  changedBy: string,
  stamp: string,
): TaxFieldChange[] {
  const entries: TaxFieldChange[] = [];
  for (const field of fields) {
    if (!(field in patch)) continue;
    const nextValue = patch[field];
    const prevValue = current[field];
    if (nextValue === prevValue) continue;
    entries.push({ field: String(field), previousValue: String(prevValue), changedBy, changedAt: stamp });
  }
  return entries;
}

// Sequential, gap-free per this demo's single-store scope (no per-client
// scoping needed — OrgBranch ids aren't shown to users the way document
// numbers are, they just need to be stable and unique).
function nextOrgBranchId(): string {
  const nums = clients
    .flatMap((c) => c.orgBranches)
    .map((b) => parseInt(b.id.replace("OB-", ""), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `OB-${String(next).padStart(3, "0")}`;
}

type Listener = () => void;

let clients: ClientAccount[] = loadPersisted("clients", [...mockClients]);
let clientUsers: ClientUser[] = loadPersisted("clientUsers", [...mockClientUsers]);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("clients", clients);
  savePersisted("clientUsers", clientUsers);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts. Two independent keys, since
// clients and clientUsers are two independent arrays here.
subscribePersisted<ClientAccount[]>("clients", (value) => {
  clients = value;
  notify();
});
subscribePersisted<ClientUser[]>("clientUsers", (value) => {
  clientUsers = value;
  notify();
});

export function getClients(): ClientAccount[] {
  return clients;
}

export function addClient(client: ClientAccount) {
  clients = [client, ...clients];
  notify();
}

export function updateClient(id: string, patch: Partial<ClientAccount>) {
  clients = clients.map((c) => (c.id === id ? { ...c, ...patch } : c));
  notify();
}

// The one path allowed to touch name/taxId/registeredAddress — every other
// caller should go through updateClient for the rest of the record, or
// through this function for these three, never both mixed into one patch,
// so the audit trail can't be bypassed by routing a tax-field edit through
// the unaudited function instead. changedBy is the acting user's display
// name (see TaxFieldChange's own comment on why that's what's available).
export function updateClientTaxFields(
  id: string,
  patch: Partial<Pick<ClientAccount, "name" | "taxId" | "registeredAddress">>,
  changedBy: string,
) {
  const stamp = nowStamp();
  clients = clients.map((c) => {
    if (c.id !== id) return c;
    const changes = recordTaxFieldChanges(c, patch, CLIENT_TAX_FIELDS, changedBy, stamp);
    return { ...c, ...patch, taxFieldHistory: [...changes, ...c.taxFieldHistory], updated: stamp };
  });
  notify();
}

// New branches start Active with an empty history — there's no "previous
// value" to record for a field that didn't exist a moment ago. code/
// legalName*/address* come from the caller (the client's actual ภ.พ.20
// paperwork), never generated here — see OrgBranch's own comment.
export function addOrgBranch(clientId: string, branch: Omit<OrgBranch, "id" | "fieldHistory">) {
  const newBranch: OrgBranch = { ...branch, id: nextOrgBranchId(), fieldHistory: [] };
  clients = clients.map((c) => (c.id === clientId ? { ...c, orgBranches: [...c.orgBranches, newBranch], updated: nowStamp() } : c));
  notify();
}

// Corrections (brief... this card's own Flow step 4: "Corrections are
// requested by the client and applied by FleetCo") land here, audited the
// same way updateClientTaxFields audits the organisation's own fields —
// per-branch, via OrgBranch.fieldHistory, not mixed into the client's own
// taxFieldHistory (see OrgBranch's comment on why).
export function updateOrgBranch(
  clientId: string,
  branchId: string,
  patch: Partial<Pick<OrgBranch, "code" | "isHeadOffice" | "legalNameTh" | "legalNameEn" | "addressTh" | "addressEn">>,
  changedBy: string,
) {
  const stamp = nowStamp();
  clients = clients.map((c) => {
    if (c.id !== clientId) return c;
    const orgBranches = c.orgBranches.map((b) => {
      if (b.id !== branchId) return b;
      const changes = recordTaxFieldChanges(b, patch, ORG_BRANCH_TAX_FIELDS, changedBy, stamp);
      return { ...b, ...patch, fieldHistory: [...changes, ...b.fieldHistory] };
    });
    return { ...c, orgBranches, updated: stamp };
  });
  notify();
}

// Deactivate only — see OrgBranch's own comment and this card's acceptance
// criterion 3. No corresponding deleteOrgBranch exists anywhere in this
// file, on purpose: a tax branch that's ever appeared on a real document
// has to stay a resolvable record for as long as that document exists.
export function deactivateOrgBranch(clientId: string, branchId: string, changedBy: string) {
  const stamp = nowStamp();
  clients = clients.map((c) => {
    if (c.id !== clientId) return c;
    const orgBranches = c.orgBranches.map((b) => {
      if (b.id !== branchId || b.status === "Deactivated") return b;
      return {
        ...b,
        status: "Deactivated" as const,
        fieldHistory: [{ field: "status", previousValue: "Active", changedBy, changedAt: stamp }, ...b.fieldHistory],
      };
    });
    return { ...c, orgBranches, updated: stamp };
  });
  notify();
}

export function getClientUsers(): ClientUser[] {
  return clientUsers;
}

export function addClientUser(user: ClientUser) {
  clientUsers = [user, ...clientUsers];
  notify();
}

export function updateClientUser(id: string, patch: Partial<ClientUser>) {
  clientUsers = clientUsers.map((u) => (u.id === id ? { ...u, ...patch } : u));
  notify();
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetClients(): void {
  clients = [...mockClients];
  clientUsers = [...mockClientUsers];
  notify();
}

export function useClients(): ClientAccount[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return clients;
}

export function useClientUsers(): ClientUser[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return clientUsers;
}
