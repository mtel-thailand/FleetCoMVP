// Demo-only utility. There's no backend here — every store is an in-memory
// module-level array (see bookingsStore.ts's comment for why). That means a
// full page reload silently wipes any test data back to the seed, which is
// confusing mid-walkthrough if it happens without warning (the dev server's
// WebSocket dropping and reconnecting triggers exactly this). This gives an
// explicit, intentional version of that reset instead, wired to a
// confirm-gated Sidebar link — same idea as FLCCMS's "Reset demo data".
import { resetBookings } from "./bookingsStore";
import { resetVehicles } from "./vehiclesStore";
import { resetDrivers } from "./driversStore";
import { resetClients } from "./clientsStore";
import { resetQuotations } from "./quotationsStore";
import { resetInvoices } from "./invoicesStore";
import { resetTaxInvoices } from "./taxInvoicesStore";
import { resetIssueReports } from "./issueReportsStore";
import { resetNotifications } from "./notificationsStore";
import { clearAllListState } from "@/app/hooks/usePersistentListState";
import { clearAllDrafts } from "@/app/lib/documentDrafts";

export function resetAllDemoData(): void {
  resetBookings();
  resetVehicles();
  resetDrivers();
  resetClients();
  resetQuotations();
  resetInvoices();
  resetTaxInvoices();
  resetIssueReports();
  resetNotifications();
  // A stale tab/search/sort selection referencing data that just got wiped
  // back to seed would be a strange thing to leave sitting there — reset
  // means reset, not "reset everything except whatever I happened to be
  // filtering by." Same reasoning for an in-progress quotation/invoice
  // draft for a booking Reset Demo Data just wiped back to seed.
  clearAllListState();
  clearAllDrafts();
}
