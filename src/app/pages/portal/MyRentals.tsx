import { useState } from "react";
import { useNavigate } from "react-router";
import { Truck as TruckIcon, FilePlus2 } from "lucide-react";
import { usePersistentListState } from "@/app/hooks/usePersistentListState";
import { clientBookingStatusLabel, clientRentalStatusLabel, isRentalBooking, type Booking } from "@/app/data/bookings";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { FilterTabs } from "@/app/components/ui/FilterTabs";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { formatDate, sortByDatetime, sortByStatusWithDate } from "@/app/components/ui/utils";
import { useBookings } from "@/app/lib/bookingsStore";
import { RequestVehicle } from "@/app/pages/portal/RequestVehicle";

const CLIENT_ID = "CLI-001";
const RENTAL_TYPES = ["Ad hoc / Daily", "Short term", "Medium term", "Long term"];
// RENTAL_STATUSES itself now lives in data/bookings.ts, computed as the
// complement of REQUEST_STATUSES rather than duplicated here by hand — see
// its own comment there. Includes Accepted even though FleetCo hasn't
// necessarily assigned a real vehicle+driver yet: that's FleetCo's own
// internal to-do, not a separate phase the client is waiting through (see
// clientRentalStatusLabel, which folds Accepted and Assigned into one
// "Upcoming" badge below).
// Grouping priority for the default sort — deliberately the 3-value *label*
// a client actually sees (via clientRentalStatusLabel), not the raw 11-value
// BOOKING_STATUS_PRIORITY every other status-sorted table uses. Those two
// disagree here specifically: Accepted and Assigned both display as one
// "Upcoming" badge, but sit at different ranks in the raw priority list — so
// sorting on the raw field would silently split one visible group into two,
// in an order the client has no way to predict (nothing on this page shows
// the Accepted/Assigned distinction). Sorting on the label instead means the
// grouping sorted on is exactly the grouping shown.
const RENTAL_LABEL_PRIORITY = ["Upcoming", "Active", "Completed", "Cancelled"];

type SortKey = "startDate" | "status";
type SortDir = "asc" | "desc";

function RentalsTable({
  bookings, onOpen, sortKey, sortDir, onSort,
}: {
  bookings: Booking[]; onOpen: (id: string) => void;
  sortKey: SortKey; sortDir: SortDir; onSort: (key: SortKey) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto relative">
        {/* Assigned vehicle/driver deliberately left off this row — a Qty>1
            booking can have a different vehicle+driver pair per unit, which
            doesn't reduce to one flat cell. Full assignment detail (however
            many pairs) lives in the booking detail modal on click, not
            summarized/truncated here.
            table-fixed + colgroup, same as RequestInbox.tsx on the FleetCo
            side — sticky positioning on the Status column needs fixed,
            predictable column widths to stay lined up while scrolling. */}
        <table className="w-full table-fixed text-sm" style={{ minWidth: "960px" }}>
          <colgroup>
            <col style={{ width: "110px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "60px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "240px" }} />
            <col style={{ width: "110px" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {/* "ID", not "Rental ID" — same BK-prefixed value a row had
                  back when it was still in My Requests; a status-specific
                  label here would just be wrong half the time. See
                  MyRequests.tsx's matching header for the fuller reasoning. */}
              {["ID", "Rental Type", "Vehicle Class", "Qty"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
              ))}
              <th
                className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600"
                onClick={() => onSort("startDate")}
              >
                <span className="inline-flex items-center gap-1">Start Date<SortIndicator active={sortKey === "startDate"} direction={sortDir} /></span>
              </th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">End Date</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Delivery Site</th>
              <th
                className="sticky right-0 bg-slate-50 border-l border-slate-100 z-10 text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600"
                onClick={() => onSort("status")}
              >
                <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => {
              return (
                <tr key={booking.id} className="border-b border-slate-50 group hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(booking.id)}>
                  <td className="px-4 py-3 text-xs font-medium text-[var(--portal-accent)] whitespace-nowrap">{booking.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{booking.rentalType}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{booking.vehicleClassRequested}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{booking.quantity}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(booking.startDate)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(booking.endDate)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 truncate">{booking.pickupLocation}</td>
                  <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-100 px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={clientBookingStatusLabel(booking)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {bookings.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No rentals match your filters</div>}
    </div>
  );
}

export function MyRentals() {
  const navigate = useNavigate();
  const allBookings = useBookings();
  const [showRequestModal, setShowRequestModal] = useState(false);
  // Persisted (sessionStorage-backed), not plain useState — this page
  // unmounts every time you open a booking's detail page and click Back,
  // which used to silently reset the tab/search/type/sort back to default
  // each time. See usePersistentListState's own comment for when it clears.
  const [search, setSearch] = usePersistentListState("myRentals.search", "");
  const [statusFilter, setStatusFilter] = usePersistentListState("myRentals.tab", "");
  const [typeFilter, setTypeFilter] = usePersistentListState("myRentals.type", "");
  // Status ascending is the default now, not Start Date — with no tabs
  // left to put "what's current" ahead of "what's done," the sort itself has
  // to do that job: RENTAL_LABEL_PRIORITY's own order already puts Upcoming
  // before Active before Completed, so ascending naturally reads top-to-
  // bottom exactly like the two tabs used to, just without a click to get
  // there. Tiebreak within a group is "updated" descending, not "startDate"
  // — matches MyRequests.tsx's own default (same reasoning applies here):
  // a booking that just moved into a group (e.g. a quotation just accepted,
  // landing it in Upcoming) surfaces at the top of that group immediately,
  // which is the more useful "did my action register" signal than where its
  // rental date happens to fall. Calendar order is still one click away —
  // it's exactly what clicking the Start Date header gives you.
  const [sortKey, setSortKey] = usePersistentListState<SortKey>("myRentals.sortKey", "status");
  const [sortDir, setSortDir] = usePersistentListState<SortDir>("myRentals.sortDir", "asc");

  const clientBookings = allBookings.filter((b) => b.clientId === CLIENT_ID && isRentalBooking(b));

  // Counts driven by the full client-scoped set, not the search/type-filtered
  // view — same "don't make the number fluctuate while someone's mid-search"
  // principle the old MiniDash stat row followed. Replaces both that row and
  // the status FilterDropdown at once: each tab is the count *and* the
  // filter trigger, so there's nothing left for a separate dropdown to do.
  const tabOptions = [
    { value: "", label: "All", count: clientBookings.length },
    { value: "Upcoming", label: "Upcoming", count: clientBookings.filter((b) => clientRentalStatusLabel(b.status) === "Upcoming").length },
    { value: "Active", label: "Active", count: clientBookings.filter((b) => clientRentalStatusLabel(b.status) === "Active").length },
    { value: "Completed", label: "Completed", count: clientBookings.filter((b) => clientRentalStatusLabel(b.status) === "Completed").length },
    { value: "Cancelled", label: "Cancelled", count: clientBookings.filter((b) => clientRentalStatusLabel(b.status) === "Cancelled").length },
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
  const filtered = clientBookings.filter((b) => {
    const matchSearch = !query || b.id.toLowerCase().includes(query) || b.pickupLocation.toLowerCase().includes(query);
    const matchStatus = !statusFilter || clientRentalStatusLabel(b.status) === statusFilter;
    const matchType = !typeFilter || b.rentalType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });
  const shown =
    sortKey === "status"
      ? sortByStatusWithDate(filtered, (b) => clientRentalStatusLabel(b.status), RENTAL_LABEL_PRIORITY, sortDir, "updated")
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

      {clientBookings.length === 0 ? (
        <>
          {/* No FilterBar in this branch to carry the button, so it gets its
              own row here — still always visible, just relocated below once
              there's a real list to share a row with. */}
          <div className="flex items-center justify-end mb-4">{newRequestButton}</div>
          <div className="bg-white rounded-xl border border-slate-200">
            <EmptyState
              icon={TruckIcon}
              title="No rentals yet"
              subtitle="Once you accept a quotation, it'll show up here — through assignment, pickup, and the rental itself."
            />
          </div>
        </>
      ) : (
        <>
          <FilterTabs options={tabOptions} value={statusFilter} onChange={setStatusFilter} />
          <FilterBar
            searchableFields={["ID", "Delivery Site"]}
            onSearch={setSearch}
            defaultSearch={search}
            trailing={newRequestButton}
            extraFilters={
              <FilterDropdown
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="All Rental Types"
                options={[{ label: "All Rental Types", value: "" }, ...RENTAL_TYPES.map((t) => ({ label: t, value: t }))]}
              />
            }
          />
          <RentalsTable
            bookings={shown}
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
