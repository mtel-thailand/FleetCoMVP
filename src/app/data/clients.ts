// Client account / vendor management — brief §4.5
import type { VehicleClass } from "./vehicles";
import type { ClientRole } from "@/app/lib/auth";

export type ClientStatus = "Active" | "Inactive";
export type DurationTier = "Ad hoc / Daily" | "Short term" | "Medium term" | "Long term";

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

export type ClientAccount = {
  id: string;
  name: string;
  taxId: string;
  registeredAddress: string;
  branch: string; // "Head Office" or a branch number
  billingTerms: string;
  creditTermsDays: number;
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
  contractFileName: string | null;
  created: string;
  updated: string;
};

export const mockClients: ClientAccount[] = [
  {
    id: "CLI-001",
    name: "Thailand Post Co., Ltd.",
    taxId: "0107536000174",
    registeredAddress: "111 Praram 9 Rd, Huai Khwang, Bangkok 10310, Thailand",
    branch: "Head Office",
    billingTerms: "Net 30",
    creditTermsDays: 30,
    status: "Active",
    branches: [
      { name: "Bangkok GPO, Charoen Krung Rd", phone: "02-613-1000", address: "1160 Charoen Krung Rd, Bang Rak, Bangkok 10500" },
      { name: "Bang Sue Distribution Center", phone: "02-831-2200", address: "111 Kamphaeng Phet 6 Rd, Chatuchak, Bangkok 10900" },
      { name: "Chaeng Watthana", phone: "02-575-8800", address: "120 Chaeng Watthana Rd, Lak Si, Bangkok 10210" },
      { name: "Bang Na Distribution Hub", phone: "02-399-4400", address: "587 Bang Na-Trat Rd, Bang Na, Bangkok 10260" },
      { name: "Lat Krabang Mail Center", phone: "02-326-7700", address: "99 Chalongkrung Rd, Lat Krabang, Bangkok 10520" },
      { name: "Hat Yai Regional Hub", phone: "074-230-100", address: "88 Phetkasem Rd, Hat Yai, Songkhla 90110" },
    ],
    rateCard: [
      { vehicleClass: "Pickup", durationTier: "Ad hoc / Daily", pricePerDay: 1800 },
      { vehicleClass: "Pickup", durationTier: "Long term", pricePerDay: 1350 },
      { vehicleClass: "Van", durationTier: "Ad hoc / Daily", pricePerDay: 2200 },
      { vehicleClass: "Van", durationTier: "Long term", pricePerDay: 1650 },
      { vehicleClass: "4-Wheel Truck", durationTier: "Ad hoc / Daily", pricePerDay: 2800 },
      { vehicleClass: "4-Wheel Truck", durationTier: "Long term", pricePerDay: 2100 },
      { vehicleClass: "6-Wheel Truck", durationTier: "Ad hoc / Daily", pricePerDay: 4200 },
      { vehicleClass: "6-Wheel Truck", durationTier: "Long term", pricePerDay: 3300 },
    ],
    contractFileName: "thailand-post-msa-2026.pdf",
    created: "2026-05-02 09:00",
    updated: "2026-08-01 10:00",
  },
];

export const mockClientUsers: ClientUser[] = [
  { id: "CU-001", clientId: "CLI-001", name: "Naruemon Srisai", email: "naruemon.s@thailandpost.co.th", role: "client_approver", status: "Active" },
  { id: "CU-002", clientId: "CLI-001", name: "Pakawat Chuenjai", email: "pakawat.c@thailandpost.co.th", role: "client_requester", status: "Active" },
  { id: "CU-003", clientId: "CLI-001", name: "Suphaporn Wongsa", email: "suphaporn.w@thailandpost.co.th", role: "client_finance", status: "Active" },
  { id: "CU-005", clientId: "CLI-001", name: "Kanyarat Phromsri", email: "kanyarat.p@thailandpost.co.th", role: "client_admin", status: "Active" },
];
