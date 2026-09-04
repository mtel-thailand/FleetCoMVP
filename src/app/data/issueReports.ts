// Issue Reports — a client-side complaint/flag against a booking that's
// currently underway (vehicle problem, driver conduct, schedule slip,
// billing question). Deliberately minimal: two states only (Open →
// Resolved), no sub-statuses — this is a small supporting entity, not
// another full document type alongside Quotation/Invoice/Tax Invoice.

// Hidden for now, not deleted — brief §5.2 names it as real client-portal
// scope ("flag a problem on a rental... lands in FleetCo's operations
// inbox"), same as Billing History, just not part of either §9 hero flow.
// Single source of truth for every UI touchpoint that surfaces issue
// reports: the client's card + "Report an Issue" trigger on
// ClientBookingDetail.tsx, ops's card + "Mark Resolved" on
// OpsBookingDetailPanel.tsx, the Sidebar's open-issue badge on Request
// Inbox, and OperationsDashboard's alert row. Data model, store, and
// mock data below are untouched — flip this back to re-enable everywhere
// at once. Same "flag, don't delete" convention as
// ClientBookingDetail.tsx's own SHOW_BOOKING_UTILITY_ACTIONS.
import { rebaseDemoDates } from "./demoDates";
export const SHOW_ISSUE_REPORTS = false;

export type IssueCategory = "Vehicle" | "Driver" | "Schedule" | "Billing" | "Other";
export type IssueStatus = "Open" | "Resolved";

export type IssueReport = {
  id: string;
  bookingId: string;
  clientId: string;
  category: IssueCategory;
  description: string;
  reportedByName: string;
  reportedAt: string;
  status: IssueStatus;
  resolutionNotes?: string;
  resolvedAt?: string;
};

export const mockIssueReports: IssueReport[] = rebaseDemoDates<IssueReport[]>([
  {
    id: "ISS-2026-0001",
    bookingId: "BK-2026-0004",
    clientId: "CLI-001",
    category: "Vehicle",
    description: "Air conditioning intermittently not cooling in the cabin — driver has to keep windows down on the Nonthaburi loop.",
    reportedByName: "Naruemon Srisai",
    reportedAt: "2026-08-10 13:40",
    status: "Open",
  },
  {
    id: "ISS-2026-0002",
    bookingId: "BK-2026-0007",
    clientId: "CLI-001",
    category: "Driver",
    description: "Driver arrived about 40 minutes late on the first pickup day, no advance notice given.",
    reportedByName: "Pakawat Chuenjai",
    reportedAt: "2026-07-29 09:15",
    status: "Resolved",
    resolutionNotes: "Spoke with the driver — a genuine traffic incident on Vibhavadi Rd. Dispatch will text clients ahead next time there's a delay.",
    resolvedAt: "2026-07-30 11:00",
  },
]);
