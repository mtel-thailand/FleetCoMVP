import { useNavigate } from "react-router";
import { Wallet } from "lucide-react";
import { usePersistentListState } from "@/app/hooks/usePersistentListState";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { useBookings } from "@/app/lib/bookingsStore";
import type { InvoiceStatus } from "@/app/data/invoices";
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

type SortKey = "dueDate" | "amountDue" | "status" | "created";
type SortDir = "asc" | "desc";

// Status column uses InvoiceStatusCell (the segmented-bar treatment, shared
// with DocumentChain's own Invoice rows via ui/InvoiceProgress.tsx), not the
// plain StatusBadge pill — this table went back and forth on that once
// already (see git history/session notes if curious), landing here for
// good this time. The table variant intentionally uses the wider treatment
// from the billing reference and repeats the due date beside actionable
// statuses for quick scanning.

// The client's-turn/not-the-client's-turn split FilterTabs groups by —
// Unpaid, Overdue, and Payment Issue are the statuses where paying (or
// re-paying) is actually this viewer's own next move; Payment Submitted
// and Paid both mean there's nothing further for them to do (verifying a
// submitted payment is FleetCo's job, not theirs — see the brief quote
// above on why "submitted" isn't "settled"). Each row's own status cell
// still shows the precise status either way; this only ever coarsens the
// *filter*, not what's displayed once a row is showing.
const NEEDS_ACTION_STATUSES: InvoiceStatus[] = ["Unpaid", "Overdue", "Payment Issue"];
const SETTLED_STATUSES: InvoiceStatus[] = ["Payment Submitted", "Paid"];

export function InvoiceInbox() {
  const navigate = useNavigate();
  const invoices = useInvoices().filter((i) => i.clientId === CLIENT_ID);
  const bookings = useBookings();
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  // Same "hangs off its Invoice" link InvoiceDetail's own header shows, one
  // level up — the one place a tax invoice's existence is worth a glance
  // without opening the invoice first.
  const invoicesWithTaxInvoice = new Set(useTaxInvoices().filter((t) => t.clientId === CLIENT_ID).map((t) => t.invoiceId));
  // Persisted (sessionStorage-backed), not plain useState — this page
  // unmounts on every navigation away (clicking a row, then Back), which
  // used to silently reset the tab/search/sort back to default each time.
  // See usePersistentListState's own comment for exactly when this clears.
  const [search, setSearch] = usePersistentListState("invoiceInbox.search", "");
  const [tabFilter, setTabFilter] = usePersistentListState("invoiceInbox.tab", "");
  const [sortKey, setSortKey] = usePersistentListState<SortKey>("invoiceInbox.sortKey", "created");
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
    { value: "", label: "All", count: invoices.length },
    { value: "needsAction", label: "Needs Action", count: invoices.filter((i) => NEEDS_ACTION_STATUSES.includes(i.status)).length, highlight: true },
    { value: "settled", label: "Settled", count: invoices.filter((i) => SETTLED_STATUSES.includes(i.status)).length },
  ];

  const query = search.trim().toLowerCase();
  const filtered = invoices.filter((item) => {
    const matchSearch = !query || item.id.toLowerCase().includes(query) || item.bookingId.toLowerCase().includes(query);
    const matchTab =
      !tabFilter ||
      (tabFilter === "needsAction" ? NEEDS_ACTION_STATUSES.includes(item.status) : SETTLED_STATUSES.includes(item.status));
    return matchSearch && matchTab;
  });
  const sorted = sortByDatetime(filtered, sortKey, sortDir);

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
          <FilterTabs options={tabOptions} value={tabFilter} onChange={setTabFilter} />
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
                    <InvoiceStatusCell status={inv.status} dueDate={inv.dueDate} align="end" variant="table" />
                  </div>
                  <p className="mt-3 text-base font-semibold text-slate-900">{formatCurrency(inv.amountDue)}</p>
                  <p className="mt-1 text-xs text-slate-500">Due {formatDate(inv.dueDate)}</p>
                  {booking && <p className="mt-2 text-xs text-slate-500">{booking.rentalType} · {booking.vehicleClassRequested}</p>}
                  {invoicesWithTaxInvoice.has(inv.id) && <p className="mt-2 text-[11px] font-medium text-emerald-600">Tax invoice available</p>}
                </button>
              );
            })}
            {sorted.length === 0 && <div className="rounded-xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">No invoices match your filters</div>}
          </div>

          <div className="hidden bg-white rounded-xl border border-slate-200 overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: "900px" }}>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Invoice", "Booking", "Vehicle"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                    ))}
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => handleSort("dueDate")} className="inline-flex items-center gap-1 hover:text-slate-600">
                        Due Date<SortIndicator active={sortKey === "dueDate"} direction={sortDir} />
                      </button>
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => handleSort("amountDue")} className="inline-flex items-center gap-1 hover:text-slate-600">
                        Amount Due<SortIndicator active={sortKey === "amountDue"} direction={sortDir} />
                      </button>
                    </th>
                    <th className="w-[170px] min-w-[170px] text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => handleSort("status")} className="inline-flex items-center gap-1 hover:text-slate-600">
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
                          {invoicesWithTaxInvoice.has(inv.id) && (
                            <p className="text-[10px] font-medium text-emerald-600 mt-0.5">Tax invoice available</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{inv.bookingId}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {booking ? `${booking.rentalType} · ${booking.vehicleClassRequested}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(inv.amountDue)}</td>
                        <td className="w-[170px] min-w-[170px] px-4 py-3 whitespace-nowrap">
                          <InvoiceStatusCell status={inv.status} dueDate={inv.dueDate} align="start" variant="table" />
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
