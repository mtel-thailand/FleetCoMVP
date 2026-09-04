import { useNavigate } from "react-router";
import { Wallet } from "lucide-react";
import { usePersistentListState } from "@/app/hooks/usePersistentListState";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { invoiceDisplayStatus, type InvoiceStatus } from "@/app/data/invoices";
import { InvoiceStatusCell } from "@/app/components/ui/InvoiceProgress";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterTabs } from "@/app/components/ui/FilterTabs";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { formatDate, sortByDatetime } from "@/app/components/ui/utils";
import { formatCurrency } from "@/app/data/formatters";
import { CLIENT_ID } from "@/app/lib/currentClient";

// brief §5.3: "Invoice inbox: view/download invoices, see amount due and due
// date, mark as paid with payment date, reference number, and optional
// payment slip upload." §6.1: marking paid is a *claim*, not a settlement.
//
// The one client-portal document type that keeps its own standalone list —
// see the "Quotations & Tax Invoices skip the inbox" card in Documentation.
// This stays a list of every invoice ever issued (including ones for
// bookings that have since closed out, which My Rentals would no longer
// surface in its "current" view), and clicking a row navigates to that
// invoice's own /documents/invoices/:id page (InvoiceDetailPage) — one
// Mark-as-Paid implementation, used everywhere an invoice can be opened
// from.
//
// Grouping this table by booking (chevron rows, expand/collapse) was tried
// and deliberately backed out once these FilterTabs replaced the old status
// FilterDropdown: tabs already solve the actual job ("what needs my
// attention") more simply, and "see every cycle for one specific booking"
// already has a better home — ClientBookingDetail's own Documents & Billing
// card, with the vehicle/timeline context a flat cross-booking ledger like
// this one can't offer. Stacking both a booking-grouped table AND urgency
// tabs on top of it was more structure than this list's actual size earns.

type SortKey = "dueDate" | "amountDue" | "status" | "issuedAt";
type SortDir = "asc" | "desc";
type InvoiceView = "needsAction" | "awaiting" | "paid" | "all";

// Status column uses InvoiceStatusCell (the segmented-bar treatment, shared
// with DocumentChain's own Invoice rows via ui/InvoiceProgress.tsx), not the
// plain StatusBadge pill — this table went back and forth on that once
// already (see git history/session notes if curious), landing here for
// good this time. The table variant intentionally uses the wider treatment
// from the billing reference.

// Tabs distinguish the client's next move from FleetCo's verification step
// and from genuinely paid invoices. Payment Submitted must not be grouped
// under Paid: it is still awaiting an operational decision by FleetCo.
const NEEDS_ACTION_STATUSES: InvoiceStatus[] = ["Unpaid", "Overdue", "Payment Issue"];
const STATUS_PRIORITY: InvoiceStatus[] = ["Overdue", "Payment Issue", "Unpaid", "Payment Submitted", "Paid"];

export function InvoiceInbox() {
  const navigate = useNavigate();
  const invoices = useInvoices().filter((i) => i.clientId === CLIENT_ID);
  const bookings = useBookings();
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  // Persisted (sessionStorage-backed), not plain useState — this page
  // unmounts on every navigation away (clicking a row, then Back), which
  // used to silently reset the tab/search/sort back to default each time.
  // See usePersistentListState's own comment for exactly when this clears.
  const [search, setSearch] = usePersistentListState("invoiceInbox.search", "");
  const [tabFilter, setTabFilter] = usePersistentListState<InvoiceView>("invoiceInbox.tab.v2", "needsAction");
  const [sortKey, setSortKey] = usePersistentListState<SortKey>("invoiceInbox.sortKey.v2", "issuedAt");
  const [sortDir, setSortDir] = usePersistentListState<SortDir>("invoiceInbox.sortDir", "desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // Counts driven by the full client-scoped set, not the search-filtered
  // view — same "don't make the number fluctuate while someone's mid-
  // search" principle MyRentals/MyRequests already follow for their own
  // tabs. highlight on Needs Action mirrors ops's own "needs FleetCo
  // action" amber treatment for the tab that means "your move."
  const tabOptions = [
    { value: "needsAction", label: "Needs Action", count: invoices.filter((i) => NEEDS_ACTION_STATUSES.includes(invoiceDisplayStatus(i))).length, highlight: true },
    { value: "awaiting", label: "Awaiting Verification", count: invoices.filter((i) => i.status === "Payment Submitted").length },
    { value: "paid", label: "Paid", count: invoices.filter((i) => i.status === "Paid").length },
    { value: "all", label: "All", count: invoices.length },
  ];

  const query = search.trim().toLowerCase();
  const filtered = invoices.filter((item) => {
    const matchSearch = !query || item.id.toLowerCase().includes(query) || item.bookingId.toLowerCase().includes(query);
    const matchTab =
      tabFilter === "all" ||
      (tabFilter === "needsAction" && NEEDS_ACTION_STATUSES.includes(invoiceDisplayStatus(item))) ||
      (tabFilter === "awaiting" && item.status === "Payment Submitted") ||
      (tabFilter === "paid" && item.status === "Paid");
    return matchSearch && matchTab;
  });
  const sorted =
    sortKey === "status" ? [...filtered].sort((a, b) => {
      const cmp = STATUS_PRIORITY.indexOf(invoiceDisplayStatus(a)) - STATUS_PRIORITY.indexOf(invoiceDisplayStatus(b));
      return sortDir === "asc" ? cmp : -cmp;
    })
    : sortKey === "amountDue" ? [...filtered].sort((a, b) => (sortDir === "asc" ? a.amountDue - b.amountDue : b.amountDue - a.amountDue))
    : sortByDatetime(filtered, sortKey, sortDir);

  return (
    <div>
      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={Wallet}
            title="No invoices yet"
            subtitle="FleetCo issues an invoice once a rental is completed — it'll appear here with the amount due and due date."
          />
        </div>
      ) : (
        <>
          <FilterTabs options={tabOptions} value={tabFilter} onChange={(value) => setTabFilter(value as InvoiceView)} />
          <FilterBar
            searchableFields={["Invoice ID", "Booking ID"]}
            onSearch={setSearch}
            defaultSearch={search}
          />
          <div className="space-y-2 md:hidden">
            {sorted.map((inv) => {
              const booking = bookingById.get(inv.bookingId);
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => navigate(`/portal/documents/invoices/${inv.id}`)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--portal-accent)]">{inv.id}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{inv.bookingId}</p>
                    </div>
                    <InvoiceStatusCell status={invoiceDisplayStatus(inv)} align="end" variant="table" />
                  </div>
                  <p className="mt-3 text-base font-semibold text-slate-900">{formatCurrency(inv.amountDue)}</p>
                  <p className="mt-1 text-xs text-slate-500">Issued {formatDate(inv.issuedAt.split(" ")[0])} · Due {formatDate(inv.dueDate)}</p>
                  {booking && <p className="mt-2 text-xs text-slate-500">{booking.rentalType} · {booking.vehicleClassRequested}</p>}
                </button>
              );
            })}
            {sorted.length === 0 && <div className="rounded-xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">No invoices match your filters</div>}
          </div>

          <div className="hidden bg-white rounded-xl border border-slate-200 overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm" style={{ minWidth: "1050px" }}>
                <colgroup>
                  <col style={{ width: "125px" }} />
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "195px" }} />
                  <col style={{ width: "150px" }} />
                  <col style={{ width: "140px" }} />
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "180px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Invoice ID", "Booking ID", "Rental"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                    ))}
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => handleSort("issuedAt")} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
                        Issued Date<SortIndicator active={sortKey === "issuedAt"} direction={sortDir} />
                      </button>
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => handleSort("dueDate")} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
                        Due Date<SortIndicator active={sortKey === "dueDate"} direction={sortDir} />
                      </button>
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => handleSort("amountDue")} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
                        Amount Due<SortIndicator active={sortKey === "amountDue"} direction={sortDir} />
                      </button>
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => handleSort("status")} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
                        Invoice Status<SortIndicator active={sortKey === "status"} direction={sortDir} />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((inv) => {
                    const booking = bookingById.get(inv.bookingId);
                    return (
                      <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/portal/documents/invoices/${inv.id}`)}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); navigate(`/portal/documents/invoices/${inv.id}`); }}
                            className="text-xs font-medium text-[var(--portal-accent)] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
                          >
                            {inv.id}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{inv.bookingId}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 truncate">
                          {booking ? `${booking.rentalType} · ${booking.vehicleClassRequested}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(inv.issuedAt.split(" ")[0])}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(inv.amountDue)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <InvoiceStatusCell status={invoiceDisplayStatus(inv)} align="start" variant="table" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sorted.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No invoices match your filters</div>}
          </div>
        </>
      )}
    </div>
  );
}
