import { useState } from "react";
import { useNavigate } from "react-router";
import { fleetCoBookingStatusLabel, RENTAL_STATUSES, type Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import { BOOKING_STATUS_PRIORITY } from "@/app/data/bookingStatus";
import { usePersistentListState } from "@/app/hooks/usePersistentListState";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { FilterTabs } from "@/app/components/ui/FilterTabs";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate, sortByStatusWithDate, sortByDatetime } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, parseExcelDate, exportDateTag } from "@/app/components/ui/exportUtils";
import { useBookings } from "@/app/lib/bookingsStore";
import { useClients } from "@/app/lib/clientsStore";
import { needsFleetCoRentalAction } from "@/app/lib/fleetCoActions";

// ── All Rentals — the complement of AllRequests.tsx (see its own header
// comment and RENTAL_STATUSES in bookings.ts for the shared partition this
// mirrors from the client portal's My Requests/My Rentals split). A booking
// lands here the moment it's Accepted — nothing left for the client to
// decide — through Assigned, Active, and Completed. This page deliberately
// stays on the physical rental track; invoice issuance, payments, and tax
// invoices belong to the dedicated billing pages.

const RENTAL_TYPES = ["Ad hoc / Daily", "Short term", "Medium term", "Long term"];

type SortKey = "status" | "startDate" | "created" | "updated";
type SortDir = "asc" | "desc";
type RentalView = "all" | "action" | "upcoming" | "active" | "completed";

// Action Required is deliberately narrow: only accepted rentals still
// waiting for FleetCo to assign a vehicle and driver. Starting/completing
// remain available from their normal Scheduled/Active views, while billing
// work belongs to Invoices.
function matchesRentalView(booking: Booking, view: RentalView) {
  if (view === "action") return needsFleetCoRentalAction(booking);
  if (view === "upcoming") return booking.status === "Assigned";
  if (view === "active") return booking.status === "Active";
  if (view === "completed") return booking.status === "Completed";
  return true;
}

const BK_HEADERS = [
  "ID", "Client", "Rental Type", "Vehicle Class", "Quantity",
  "Start Date", "End Date", "Branch Location", "Status",
];

function bkCSVRow(b: Booking, clientById: Map<string, ClientAccount>): string[] {
  return [
    b.id, clientById.get(b.clientId)?.name ?? b.clientId, b.rentalType,
    b.vehicleClassRequested, String(b.quantity), formatDate(b.startDate), formatDate(b.endDate),
    b.pickupLocation, fleetCoBookingStatusLabel(b),
  ];
}

function bkXLSXRow(b: Booking, clientById: Map<string, ClientAccount>): (string | number | Date | null)[] {
  return [
    b.id, clientById.get(b.clientId)?.name ?? b.clientId, b.rentalType,
    b.vehicleClassRequested, b.quantity, parseExcelDate(b.startDate) as Date | string, parseExcelDate(b.endDate) as Date | string,
    b.pickupLocation, fleetCoBookingStatusLabel(b),
  ];
}

export function AllRentals() {
  const navigate = useNavigate();
  const allBookings = useBookings();
  const clientById = new Map(useClients().map((c) => [c.id, c]));
  // Persisted — same reasoning as AllRequests.tsx: this page unmounts on
  // every row click into /ops/bookings/:id, and Back used to silently
  // reset the tab/search/filter/sort each time.
  const [search, setSearch] = usePersistentListState("opsRentals.search", "");
  // Defaults to the first tab (Action Required), not All — same
  // convention AllRequests.tsx and MyRequests.tsx already use, so landing
  // on this page opens straight onto what actually needs attention rather
  // than the full, undifferentiated list.
  const [view, setView] = usePersistentListState<RentalView>("opsRentals.view", "action");
  const [typeFilter, setTypeFilter] = usePersistentListState("opsRentals.type", "");
  const [sortKey, setSortKey] = usePersistentListState<SortKey>("opsRentals.sortKey", "created");
  const [sortDir, setSortDir] = usePersistentListState<SortDir>("opsRentals.sortDir", "desc");
  // Not persisted — see AllRequests.tsx's matching comment.
  const [page, setPage] = useState(1);

  const rows = allBookings.filter((b) => RENTAL_STATUSES.includes(b.status));

  const tabOptions = [
    { value: "action", label: "Action Required", count: rows.filter((b) => matchesRentalView(b, "action")).length, highlight: true },
    { value: "upcoming", label: "Scheduled", count: rows.filter((b) => matchesRentalView(b, "upcoming")).length },
    { value: "active", label: "Active", count: rows.filter((b) => matchesRentalView(b, "active")).length },
    { value: "completed", label: "Completed", count: rows.filter((b) => matchesRentalView(b, "completed")).length },
    { value: "all", label: "All", count: rows.length },
  ];

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "status" ? "asc" : "desc");
    }
    setPage(1);
  }

  const filtered = rows.filter((b) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      b.id.toLowerCase().includes(q) ||
      (clientById.get(b.clientId)?.name.toLowerCase().includes(q) ?? false);
    const matchView = matchesRentalView(b, view);
    const matchType = !typeFilter || b.rentalType === typeFilter;
    return matchSearch && matchView && matchType;
  });

  const sorted =
    sortKey === "status"
      ? sortByStatusWithDate(filtered, "status", BOOKING_STATUS_PRIORITY, sortDir, "created")
      : sortByDatetime(filtered, sortKey, sortDir);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <FilterTabs options={tabOptions} value={view} onChange={(v) => { setView(v as RentalView); setPage(1); }} />

      <FilterBar
        showSearch
        searchableFields={["ID", "Client"]}
        showPeriod
        showExport
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(BK_HEADERS, sorted.map((b) => bkCSVRow(b, clientById)), `rentals-${view}-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(BK_HEADERS, sorted.map((b) => bkXLSXRow(b, clientById)), `rentals-${view}-${exportDateTag()}.xlsx`)}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        defaultSearch={search}
        extraFilters={
          <>
            <FilterDropdown
              value={typeFilter}
              onChange={(value) => { setTypeFilter(value); setPage(1); }}
              placeholder="All Rental Types"
              options={[{ label: "All Rental Types", value: "" }, ...RENTAL_TYPES.map((t) => ({ label: t, value: t }))]}
            />
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "1130px" }}>
            <colgroup>
              <col style={{ width: "110px" }} />
              <col style={{ width: "170px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "70px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "160px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["ID", "Client"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Rental Type</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Vehicle Class</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Qty</th>
                <th
                  className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600"
                  onClick={() => handleSort("startDate")}
                >
                  <span className="inline-flex items-center gap-1">Start Date<SortIndicator active={sortKey === "startDate"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">End Date</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Branch Location</th>
                <th
                  className="sticky right-0 bg-slate-50 border-l border-slate-100 z-10 text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600"
                  onClick={() => handleSort("status")}
                >
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((b) => (
                <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/ops/bookings/${b.id}`)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium whitespace-nowrap">{b.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 truncate">{clientById.get(b.clientId)?.name ?? b.clientId}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{b.rentalType}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{b.vehicleClassRequested}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{b.quantity}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(b.startDate)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(b.endDate)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 truncate">{b.pickupLocation}</td>
                  <td className="sticky right-0 bg-white border-l border-slate-100 px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={fleetCoBookingStatusLabel(b)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No rentals found</div>}
        <TablePagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
