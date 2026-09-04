// Client account / vendor management — brief §4.5
import type { VehicleClass } from "./vehicles";
import type { ClientRole } from "@/app/lib/auth";
import { rebaseDemoDates } from "./demoDates";

export type ClientStatus = "Active" | "Inactive";
export type DurationTier = "Ad hoc / Daily" | "Short term" | "Medium term" | "Long term";
export const PAYMENT_TERM_DAYS = [7, 14, 15, 30, 45, 60] as const;
export type PaymentTermDays = (typeof PAYMENT_TERM_DAYS)[number];

export function formatPaymentTerms(days: number): string {
  return `Net ${days} from invoice date`;
}

export function getPaymentTermsDays(paymentTerms: string, fallback = 30): number {
  const match = paymentTerms.match(/\b(?:net|within)\s+(\d+)\b/i);
  return match ? Number(match[1]) : fallback;
}

export type RateCardEntry = {
  vehicleClass: VehicleClass;
  durationTier: DurationTier;
  pricePerDay: number; // THB
};

export type ClientUser = {
  id: string;
  clientId: string;
  name: string;
  email: string;
  role: ClientRole;
  status: ClientStatus;
};

// A client's branch/site — phone and address exist so FleetCo (and the
// driver on the day) knows who to call and where to actually go, not just
// what to label the dropdown option. Deliberately just these three fields,
// no separate id/status — a branch is owned entirely by its client account,
// edited in place from Client Accounts, never referenced from anywhere
// outside that client's own request flow.
export type Branch = {
  name: string;
  phone: string;
  address: string;
};

// One entry per edit to a tax-relevant field — legal name, tax ID,
// registered address on the organisation itself, or any field on one of
// its OrgBranches. Recorded BEFORE the new value overwrites the old one
// (see updateClientTaxFields/updateOrgBranch in clientsStore.ts), so
// previousValue is always what the field said a moment before this change,
// not the current value repeated. changedBy is a display name/role label —
// this demo has no real user-account system beyond ROLE_LABELS/ClientUser
// names, so that's what's actually available to attribute a change to.
export type TaxFieldChange = {
  field: string;
  previousValue: string;
  changedBy: string;
  changedAt: string;
};

export type OrgBranchStatus = "Active" | "Deactivated";

// A client organisation's own legal tax branch, per Thai VAT registration
// (ภ.พ.20) — one สำนักงานใหญ่ (head office) plus zero or more numbered
// สาขา. NOT the same thing as Branch above: Branch is a delivery/pickup
// site for the Request a Vehicle picker (disposable, no id, freely
// editable); an OrgBranch is a formal registry entry that a real tax
// invoice names as the buyer's branch, so it carries its own stable id
// (a bare array index can't survive edits/reordering the way a document
// reference needs to) and is deactivated rather than deleted — see
// deactivateOrgBranch in clientsStore.ts. code/legalName*/address* are
// entered from the client's actual ภ.พ.20 paperwork, not system-generated —
// a real branch code can skip numbers (a closed branch's code is never
// reused), so this app has no business inventing the next one.
export type OrgBranch = {
  id: string;
  code: string; // "00000" for head office, "00001" onward for numbered branches
  isHeadOffice: boolean;
  legalNameTh: string;
  legalNameEn: string;
  addressTh: string;
  addressEn: string;
  status: OrgBranchStatus;
  // Per-branch history, not merged into the organisation's own
  // taxFieldHistory below — a branch's edits are about that branch, and
  // should travel with it (survive being deactivated, read back in one
  // place) rather than being interleaved with every other branch's and the
  // org's own changes in one long undifferentiated list.
  fieldHistory: TaxFieldChange[];
};

// Resolve the tax registration branch captured on a booking. Older bookings
// have no taxBranchId yet, so they fall back to the active head office while
// the migration is still represented by the existing client data.
export function getTaxBranch(client: ClientAccount | undefined, taxBranchId?: string): OrgBranch | undefined {
  if (!client) return undefined;
  return client.orgBranches.find((branch) => branch.id === taxBranchId && branch.status === "Active")
    ?? client.orgBranches.find((branch) => branch.isHeadOffice && branch.status === "Active")
    ?? client.orgBranches.find((branch) => branch.status === "Active");
}

// Exactly one head office is the rule (acceptance criterion, not yet
// enforced by any form — this is just the shared check every future save
// path calls, so the rule lives in one place instead of being re-implemented
// per form). Deactivated branches don't count: once the head office branch
// itself is deactivated, the organisation is back to "needs a head office."
export function hasActiveHeadOffice(branches: OrgBranch[]): boolean {
  return branches.some((b) => b.isHeadOffice && b.status === "Active");
}

// Thai tax IDs (เลขประจำตัวผู้เสียภาษี) are exactly 13 digits — no
// letters, no dashes/spaces even though they're sometimes displayed with
// separators (X-XXXX-XXXXX-XX-X). This checks the raw stored value, so any
// display-only formatting has to happen separately, at render time.
export function isValidThaiTaxId(taxId: string): boolean {
  return /^\d{13}$/.test(taxId);
}

export type ClientAccount = {
  id: string;
  name: string;
  taxId: string;
  registeredAddress: string;
  // Legacy display label kept for older records; new requests use taxBranchId
  // and resolve against orgBranches instead.
  branch: string;
  // Structured default selected in Client Accounts. New quotations capture
  // this value, and invoices inherit the accepted quotation's snapshot.
  paymentTermsDays?: PaymentTermDays;
  // Legacy display value retained while persisted demo data migrates to the
  // structured default above.
  paymentTerms: string;
  // Legacy fields remain optional so older saved demo records can still load.
  billingTerms?: string;
  creditTermsDays?: number;
  status: ClientStatus;
  rateCard: RateCardEntry[];
  // This client's known branches — the Request a Vehicle form picks from
  // this list rather than free text, so FleetCo ops sees a consistent,
  // filterable set of sites instead of every client typing the same
  // distribution center a different way each time, and gets a real phone
  // number + address for the site rather than just a label. Managed from
  // Client Accounts (ClientDetailPanel's "Branch Locations" section), not
  // something a requester can add inline while filling out a request.
  // Optional: only the client the portal actually operates as (CLI-001,
  // brief §1) needs one populated. Booking.pickupLocation itself stays a
  // plain string (the branch's name) — the richer Branch record is only
  // ever looked up at request time to show its phone/address inline; nothing
  // downstream (My Requests, ops's booking detail, documents) needed to
  // change to consume a whole object where a display string already worked.
  branches?: Branch[];
  // The organisation's own formal tax-branch registry — see OrgBranch's own
  // comment for why this is a separate concept from `branches` above.
  // Non-optional (unlike `branches`): every client account is expected to
  // eventually carry its own registry, even if it starts as `[]` (the
  // card's "no branches yet" state) right after the org itself is created,
  // before FleetCo has entered its ภ.พ.20 branches as a separate step.
  orgBranches: OrgBranch[];
  // Audit trail for the organisation's own tax fields (name/taxId/
  // registeredAddress) — NOT paymentTerms/status/rateCard/
  // contractFileName, which aren't tax fields and go through the ordinary
  // unaudited updateClient. See updateClientTaxFields in clientsStore.ts,
  // the only path that's supposed to touch this array.
  taxFieldHistory: TaxFieldChange[];
  contractFileName: string | null;
  created: string;
  updated: string;
};

export function getRateCardEntry(
  client: Pick<ClientAccount, "rateCard"> | undefined,
  vehicleClass: VehicleClass,
  durationTier: DurationTier,
): RateCardEntry | undefined {
  return client?.rateCard.find((entry) => entry.vehicleClass === vehicleClass && entry.durationTier === durationTier);
}

export const mockClients: ClientAccount[] = rebaseDemoDates<ClientAccount[]>([
  {
    id: "CLI-001",
    name: "Thailand Post Co., Ltd.",
    taxId: "0107536000174",
    registeredAddress: "111 Praram 9 Rd, Huai Khwang, Bangkok 10310, Thailand",
    branch: "Head Office",
    paymentTermsDays: 30,
    paymentTerms: "Net 30 from invoice date",
    status: "Active",
    branches: [
      { name: "Bangkok GPO, Charoen Krung Rd", phone: "02-613-1000", address: "1160 Charoen Krung Rd, Bang Rak, Bangkok 10500" },
      { name: "Bang Sue Distribution Center", phone: "02-831-2200", address: "111 Kamphaeng Phet 6 Rd, Chatuchak, Bangkok 10900" },
      { name: "Chaeng Watthana", phone: "02-575-8800", address: "120 Chaeng Watthana Rd, Lak Si, Bangkok 10210" },
      { name: "Bang Na Distribution Hub", phone: "02-399-4400", address: "587 Bang Na-Trat Rd, Bang Na, Bangkok 10260" },
      { name: "Lat Krabang Mail Center", phone: "02-326-7700", address: "99 Chalongkrung Rd, Lat Krabang, Bangkok 10520" },
      { name: "Hat Yai Regional Hub", phone: "074-230-100", address: "88 Phetkasem Rd, Hat Yai, Songkhla 90110" },
      { name: "Chiang Mai Mail Center", phone: "053-245-500", address: "99 Chiang Mai-Lamphun Rd, Mueang, Chiang Mai 50000" },
      { name: "Phuket Distribution Hub", phone: "076-212-300", address: "88 Thepkrasattri Rd, Thalang, Phuket 83110" },
      { name: "Nakhon Ratchasima Regional Hub", phone: "044-255-600", address: "555 Mittraphap Rd, Mueang, Nakhon Ratchasima 30000" },
    ],
    // Seeded with multiple tax branches so the registry has a realistic
    // multi-branch example to develop the UI against, not just the
    // always-trivial single-head-office case. Deliberately NOT the same list
    // as `branches` above —
    // these are Thailand Post's real tax-registered offices; the delivery
    // sites above are wherever a driver happens to pick up.
    orgBranches: [
      {
        id: "OB-001", code: "00000", isHeadOffice: true,
        legalNameTh: "บริษัท ไปรษณีย์ไทย จำกัด (สำนักงานใหญ่)",
        legalNameEn: "Thailand Post Co., Ltd. (Head Office)",
        addressTh: "111 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310",
        addressEn: "111 Praram 9 Rd, Huai Khwang, Bangkok 10310, Thailand",
        status: "Active", fieldHistory: [],
      },
      {
        id: "OB-002", code: "00001", isHeadOffice: false,
        legalNameTh: "บริษัท ไปรษณีย์ไทย จำกัด (สาขาหาดใหญ่)",
        legalNameEn: "Thailand Post Co., Ltd. (Hat Yai Branch)",
        addressTh: "88 ถนนเพชรเกษม ตำบลหาดใหญ่ อำเภอหาดใหญ่ สงขลา 90110",
        addressEn: "88 Phetkasem Rd, Hat Yai, Songkhla 90110, Thailand",
        status: "Active", fieldHistory: [],
      },
      {
        id: "OB-003", code: "00002", isHeadOffice: false,
        legalNameTh: "บริษัท ไปรษณีย์ไทย จำกัด (สาขาเชียงใหม่)",
        legalNameEn: "Thailand Post Co., Ltd. (Chiang Mai Branch)",
        addressTh: "99 ถนนเชียงใหม่-ลำพูน ตำบลวัดเกต อำเภอเมืองเชียงใหม่ เชียงใหม่ 50000",
        addressEn: "99 Chiang Mai-Lamphun Rd, Mueang, Chiang Mai 50000, Thailand",
        status: "Active", fieldHistory: [],
      },
      {
        id: "OB-004", code: "00003", isHeadOffice: false,
        legalNameTh: "บริษัท ไปรษณีย์ไทย จำกัด (สาขาภูเก็ต)",
        legalNameEn: "Thailand Post Co., Ltd. (Phuket Branch)",
        addressTh: "88 ถนนเทพกระษัตรี ตำบลเทพกระษัตรี อำเภอถลาง ภูเก็ต 83110",
        addressEn: "88 Thepkrasattri Rd, Thalang, Phuket 83110, Thailand",
        status: "Active", fieldHistory: [],
      },
    ],
    taxFieldHistory: [],
    rateCard: [
      { vehicleClass: "Pickup", durationTier: "Ad hoc / Daily", pricePerDay: 1800 },
      { vehicleClass: "Pickup", durationTier: "Short term", pricePerDay: 1650 },
      { vehicleClass: "Pickup", durationTier: "Medium term", pricePerDay: 1500 },
      { vehicleClass: "Pickup", durationTier: "Long term", pricePerDay: 1350 },
      { vehicleClass: "Van", durationTier: "Ad hoc / Daily", pricePerDay: 2200 },
      { vehicleClass: "Van", durationTier: "Short term", pricePerDay: 2000 },
      { vehicleClass: "Van", durationTier: "Medium term", pricePerDay: 1800 },
      { vehicleClass: "Van", durationTier: "Long term", pricePerDay: 1650 },
      { vehicleClass: "4-Wheel Truck", durationTier: "Ad hoc / Daily", pricePerDay: 2800 },
      { vehicleClass: "4-Wheel Truck", durationTier: "Short term", pricePerDay: 2600 },
      { vehicleClass: "4-Wheel Truck", durationTier: "Medium term", pricePerDay: 2350 },
      { vehicleClass: "4-Wheel Truck", durationTier: "Long term", pricePerDay: 2100 },
      { vehicleClass: "6-Wheel Truck", durationTier: "Ad hoc / Daily", pricePerDay: 4200 },
      { vehicleClass: "6-Wheel Truck", durationTier: "Short term", pricePerDay: 3900 },
      { vehicleClass: "6-Wheel Truck", durationTier: "Medium term", pricePerDay: 3600 },
      { vehicleClass: "6-Wheel Truck", durationTier: "Long term", pricePerDay: 3300 },
    ],
    contractFileName: "thailand-post-msa-2026.pdf",
    created: "2026-05-02 09:00",
    updated: "2026-08-01 10:00",
  },
]);

type ClientTermsSource = Pick<ClientAccount, "paymentTermsDays" | "paymentTerms" | "billingTerms" | "creditTermsDays">;

export function getClientPaymentTerms(client: Partial<ClientTermsSource> | undefined): string {
  if (typeof client?.paymentTermsDays === "number" && client.paymentTermsDays > 0) {
    return formatPaymentTerms(client.paymentTermsDays);
  }
  if (client?.paymentTerms?.trim()) return client.paymentTerms;
  if (client?.billingTerms?.trim()) {
    return typeof client.creditTermsDays === "number" && client.creditTermsDays > 0
      ? `${client.billingTerms} from invoice date`
      : client.billingTerms;
  }
  return "Net 30 from invoice date";
}

export function getClientPaymentDays(client: Partial<ClientTermsSource> | undefined): number {
  if (typeof client?.paymentTermsDays === "number" && client.paymentTermsDays > 0) return client.paymentTermsDays;
  if (typeof client?.creditTermsDays === "number" && client.creditTermsDays > 0) return client.creditTermsDays;
  return getPaymentTermsDays(getClientPaymentTerms(client));
}

export const mockClientUsers: ClientUser[] = [
  { id: "CU-001", clientId: "CLI-001", name: "Naruemon Srisai", email: "naruemon.s@thailandpost.co.th", role: "client_approver", status: "Active" },
  { id: "CU-002", clientId: "CLI-001", name: "Pakawat Chuenjai", email: "pakawat.c@thailandpost.co.th", role: "client_requester", status: "Active" },
  { id: "CU-003", clientId: "CLI-001", name: "Suphaporn Wongsa", email: "suphaporn.w@thailandpost.co.th", role: "client_finance", status: "Active" },
  { id: "CU-005", clientId: "CLI-001", name: "Kanyarat Phromsri", email: "kanyarat.p@thailandpost.co.th", role: "client_admin", status: "Active" },
];
