import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ClipboardList, FilePlus2 } from "lucide-react";
import { usePersistentListState } from "@/app/hooks/usePersistentListState";
import { bookingStatusLabel, REQUEST_STATUSES, type Booking } from "@/app/data/bookings";
import { BOOKING_STATUS_PRIORITY } from "@/app/data/bookingStatus";
import { quotationTotals, type Quotation } from "@/app/data/quotations";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { FilterTabs } from "@/app/components/ui/FilterTabs";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { formatDate, sortByDatetime, sortByStatusWithDate } from "@/app/components/ui/utils";
import { formatCurrency } from "@/app/data/formatters";
import { useBookings } from "@/app/lib/bookingsStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { RequestVehicle } from "@/app/pages/portal/RequestVehicle";

const CLIENT_ID = "CLI-001";
const RENTAL_TYPES = ["Ad hoc / Daily", "Short term", "Medium term", "Long term"];

// REQUEST_STATUSES now lives in bookings.ts (see its own comment there) —
// Sidebar.tsx and BookingDetail.tsx need the same partition, and a page
// component isn't the right place for other files to import a shared
// constant from.

type SortKey = "startDate" | "status" | "updated";
type SortDir = "asc" | "desc";
type RequestView = "open" | "action" | "closed" | "all";

function matchesRequestView(booking: Booking, view: RequestView) {
  if (view === "open") return booking.status === "Requested" || booking.status === "Quoted";
  if (view === "action") return booking.status === "Quoted";
  if (view === "closed") return booking.status === "Declined" || booking.status === "Cancelled";
  return true;
}

function RequestsTable({
  requests, quotations, onOpen, sortKey, sortDir, onSort,
}: {
  requests: Booking[]; quotations: Quotation[]; onOpen: (id: string) => void;
  sortKey: SortKey; sortDir: SortDir; onSort: (key: SortKey) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto relative">
        {/* table-fixed + colgroup, same as RequestInbox.tsx on the FleetCo
            side — sticky positioning on the Status column needs fixed,
            predictable column widths to stay lined up while scrolling. */}
        <table className="w-full table-fixed text-sm" style={{ minWidth: "1090px" }}>
          <colgroup>
            <col style={{ width: "110px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "60px" }} />
            <col style={{ width: "190px" }} />
            <col style={{ width: "200px" }} />
            <col style={{ width: "200px" }} />
            <col style={{ width: "110px" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {/* "ID", not "Request ID" — the row's own status can move it
                  into My Rentals later with the same BK-prefixed value, so
                  a status-specific label here would go stale in place. The
                  page title already says what kind of row this is. */}
              {["ID", "Rental Type", "Vehicle Class", "Qty"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
              ))}
              <th
                className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600"
                onClick={() => onSort("startDate")}
              >
                <span className="inline-flex items-center gap-1">Rental Period<SortIndicator active={sortKey === "startDate"} direction={sortDir} /></span>
              </th>
              {["Branch Location", "Quotation"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
              ))}
              <th
                className="sticky right-0 bg-slate-50 border-l border-slate-100 z-10 text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600"
                onClick={() => onSort("status")}
              >
                <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((booking) => {
              const quotation = booking.quotationId ? quotations.find((q) => q.id === booking.quotationId) : undefined;
              return (
                <tr key={booking.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(booking.id)}>
                  <td className="px-4 py-3 text-xs font-medium text-[var(--portal-accent)] whitespace-nowrap">{booking.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{booking.rentalType}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{booking.vehicleClassRequested}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{booking.quantity}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 truncate">{booking.pickupLocation}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {quotation ? (
                      <span className="text-slate-600">
                        {quotation.id} · <span className="font-semibold text-slate-800">{formatCurrency(quotationTotals(quotation).grandTotal)}</span>
                      </span>
                    ) : booking.status === "Requested" ? (
                      <span className="text-slate-300">Awaiting quotation</span>
                    ) : (
                      // Declined-outright (FleetCo rejected the raw request,
                      // no quotation ever existed) or Cancelled before one
                      // was issued — nothing "awaiting" anymore, and the
                      // reason itself belongs on the detail page, not
                      // spilled into this column. Same dash convention
                      // InvoiceInbox uses for "nothing here."
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="sticky right-0 bg-white border-l border-slate-100 px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={bookingStatusLabel(booking)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {requests.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No requests match your filters</div>}
    </div>
  );
}

export function MyRequests() {
  const navigate = useNavigate();
  const allBookings = useBookings();
  const quotations = useQuotations();
  const [showRequestModal, setShowRequestModal] = useState(false);
  // Persisted (sessionStorage-backed), not plain useState — this page
  // unmounts every time you open a booking's detail page and click Back,
  // which used to silently reset the tab/search/type/sort back to default
  // each time. See usePersistentListState's own comment for when it clears.
  const [search, setSearch] = usePersistentListState("myRequests.search", "");
  const [requestView, setRequestView] = usePersistentListState<RequestView>("myRequests.view", "open");
  const [typeFilter, setTypeFilter] = usePersistentListState("myRequests.type", "");
  const [sortKey, setSortKey] = usePersistentListState<SortKey>("myRequests.sortKey", "updated");
  const [sortDir, setSortDir] = usePersistentListState<SortDir>("myRequests.sortDir", "desc");

  // BookingDetail.tsx's "Repeat this request" exits to this page and leaves
  // repeatBookingId waiting in sessionStorage — same key RequestVehicle.tsx
  // already reads once (and clears) to prefill the form, previously set by
  // this page's own local handleRepeat right before opening the modal
  // in-place. Now that Booking Detail is a separate route, opening the modal
  // has to happen here, on arrival, instead.
  useEffect(() => {
    if (sessionStorage.getItem("repeatBookingId")) setShowRequestModal(true);
  }, []);

  const requests = allBookings.filter((b) => b.clientId === CLIENT_ID && REQUEST_STATUSES.includes(b.status));

  // Keep the default view focused on live work while preserving completed
  // history in Closed and the full audit trail in All.
  const tabOptions = [
    { value: "open", label: "Open", count: requests.filter((b) => matchesRequestView(b, "open")).length },
    { value: "action", label: "Action Required", count: requests.filter((b) => matchesRequestView(b, "action")).length, highlight: true },
    { value: "closed", label: "Closed", count: requests.filter((b) => matchesRequestView(b, "closed")).length },
    { value: "all", label: "All", count: requests.length },
  ];

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "status" ? "asc" : "desc");
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = requests.filter((b) => {
    const matchSearch = !query || b.id.toLowerCase().includes(query) || b.pickupLocation.toLowerCase().includes(query);
    const matchView = matchesRequestView(b, requestView);
    const matchType = !typeFilter || b.rentalType === typeFilter;
    return matchSearch && matchView && matchType;
  });
  // "updated" (this list's default order) has no column of its own to sort
  // by, same as RequestInbox.tsx on the FleetCo side — only the two real
  // headers below (Rental Period, Status) are actually clickable. Defaults
  // to most-recently-changed first rather than most-recently-submitted, so
  // a request that was just quoted today surfaces even if it's weeks old.
  //
  // No more "Quoted floats to the top of Open regardless of recency" bump
  // here — that's what the Action Required tab is for now. A plain,
  // consistent recency order across every tab means a client who just
  // submitted a new request actually sees it land at the top, instead of
  // finding it buried under an older Quoted one they can already reach in
  // one click via Action Required.
  const sorted =
    sortKey === "status"
      ? sortByStatusWithDate(filtered, "status", BOOKING_STATUS_PRIORITY, sortDir, "updated")
      : sortByDatetime(filtered, sortKey, sortDir);

  // Defined once, used in two places below — always visible regardless of
  // whether the list is empty, just relocated: sits in its own header row
  // when there's no FilterBar to share (empty state), and inline with
  // Search/filters via FilterBar's trailing slot once there's a real list.
  const newRequestButton = (
    <button
      onClick={() => setShowRequestModal(true)}
      className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] cursor-pointer"
    >
      <FilePlus2 size={13} /> New Request
    </button>
  );

  return (
    <div>
      {showRequestModal && <RequestVehicle onClose={() => setShowRequestModal(false)} />}

      {requests.length === 0 ? (
        <>
          {/* No FilterBar in this branch to carry the button, so it gets its
              own row here — still always visible, just relocated below once
              there's a real list to share a row with. */}
          <div className="flex items-center justify-end mb-4">{newRequestButton}</div>
          <div className="bg-white rounded-xl border border-slate-200">
            <EmptyState
              icon={ClipboardList}
              title="No requests yet"
              subtitle="Submit your first vehicle request and track its status here through quotation and acceptance."
            />
          </div>
        </>
      ) : (
        <>
          <FilterTabs
            options={tabOptions}
            value={requestView}
            onChange={(value) => setRequestView(value as RequestView)}
          />
          <FilterBar
            showPeriod={false}
            searchableFields={["ID", "Branch Location"]}
            onSearch={setSearch}
            defaultSearch={search}
            trailing={newRequestButton}
            extraFilters={
              <>
                <FilterDropdown
                  value={typeFilter}
                  onChange={setTypeFilter}
                  placeholder="All Rental Types"
                  options={[{ label: "All Rental Types", value: "" }, ...RENTAL_TYPES.map((t) => ({ label: t, value: t }))]}
                />
              </>
            }
          />
          <RequestsTable
            requests={sorted}
            quotations={quotations}
            onOpen={(id) => navigate(`/portal/bookings/${id}`)}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </>
      )}
    </div>
  );
}
