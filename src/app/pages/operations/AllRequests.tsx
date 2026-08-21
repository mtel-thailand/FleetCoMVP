import { useState } from "react";
import { useNavigate } from "react-router";
import { bookingStatusLabel, REQUEST_STATUSES, type Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import { BOOKING_STATUS_PRIORITY } from "@/app/data/bookingStatus";
import { quotationTotals, type Quotation } from "@/app/data/quotations";
import { usePersistentListState } from "@/app/hooks/usePersistentListState";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { FilterTabs } from "@/app/components/ui/FilterTabs";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate, sortByStatusWithDate, sortByDatetime } from "@/app/components/ui/utils";
import { formatCurrency } from "@/app/data/formatters";
import { exportCSV, exportXLSX, parseExcelDate, exportDateTag } from "@/app/components/ui/exportUtils";
import { useBookings } from "@/app/lib/bookingsStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { useClients } from "@/app/lib/clientsStore";

// ── All Requests — ops's own half of the REQUEST_STATUSES/RENTAL_STATUSES
// partition (see bookings.ts) that already splits the client portal into My
// Requests/My Rentals. Same line, same reasoning: a request has nothing left
// for the *client* to decide once it's Accepted — but for ops that boundary
// matters just as much in reverse, since Requested/Quoted/Declined/Cancelled
// is the entire "is there a deal here at all" conversation, before a vehicle
// or driver ever enters the picture. AllRentals.tsx is the complement; a
// booking moves from this page to that one the moment it's Accepted, same
// as it does for the client.
//
// Was one page ("Request Inbox") covering the full booking lifecycle,
// Requested through Closed, in a single flat table. Split into this file
// plus AllRentals.tsx instead, so ops gets the same request/rental framing
// the client portal already uses — unlike the client's own Upcoming/
// Completed collapse (clientRentalStatusLabel), status granularity within
// each half stays exactly as detailed as before; only the bucket a booking
// lives in changed.

const RENTAL_TYPES = ["Ad hoc / Daily", "Short term", "Medium term", "Long term"];

type SortKey = "status" | "startDate" | "created" | "updated";
type SortDir = "asc" | "desc";
type RequestView = "all" | "needsQuotation" | "awaitingClient" | "closed";

// Ops's version of MyRequests.tsx's matchesRequestView — same shape, but
// split into two tabs where the client gets one ("Open"). Needs Quotation
// (Requested) and Awaiting Client (Quoted) are the same "not yet decided"
// window the client calls Open, but they're two completely different
// action items from ops's side — one is ops's own to-do, the other is
// pure wait — so collapsing them the way the client does would hide
// exactly the distinction this page exists to surface.
function matchesRequestView(booking: Booking, view: RequestView) {
  if (view === "needsQuotation") return booking.status === "Requested";
  if (view === "awaitingClient") return booking.status === "Quoted";
  if (view === "closed") return booking.status === "Declined" || booking.status === "Cancelled";
  return true;
}

const BK_HEADERS = [
  "ID", "Client", "Requested By", "Rental Type", "Vehicle Class", "Quantity",
  "Start Date", "End Date", "Branch Location", "Quotation", "Status",
];

function bkCSVRow(b: Booking, clientById: Map<string, ClientAccount>, quotations: Quotation[]): string[] {
  const quotation = b.quotationId ? quotations.find((q) => q.id === b.quotationId) : undefined;
  return [
    b.id, clientById.get(b.clientId)?.name ?? b.clientId, b.requestedByName, b.rentalType,
    b.vehicleClassRequested, String(b.quantity), formatDate(b.startDate), formatDate(b.endDate),
    b.pickupLocation, quotation?.id ?? "", bookingStatusLabel(b),
  ];
}

function bkXLSXRow(b: Booking, clientById: Map<string, ClientAccount>, quotations: Quotation[]): (string | number | Date | null)[] {
  const quotation = b.quotationId ? quotations.find((q) => q.id === b.quotationId) : undefined;
  return [
    b.id, clientById.get(b.clientId)?.name ?? b.clientId, b.requestedByName, b.rentalType,
    b.vehicleClassRequested, b.quantity, parseExcelDate(b.startDate) as Date | string, parseExcelDate(b.endDate) as Date | string,
    b.pickupLocation, quotation?.id ?? "", bookingStatusLabel(b),
  ];
}

export function AllRequests() {
  const navigate = useNavigate();
  const allBookings = useBookings();
  const quotations = useQuotations();
  const clientById = new Map(useClients().map((c) => [c.id, c]));
  // Persisted (sessionStorage-backed) — this page unmounts every time a row
  // opens into /ops/bookings/:id and Back returns here, which would
  // otherwise silently reset the tab/search/filter/sort each time. Mirrors
  // the same fix already applied to the client portal's list pages.
  const [search, setSearch] = usePersistentListState("opsRequests.search", "");
  // Defaults to the first tab (Needs Quotation), not All — same convention
  // MyRequests.tsx already uses (defaults to "open", its own first tab),
  // so landing on this page opens straight onto what actually needs ops's
  // attention rather than the full, undifferentiated list.
  const [view, setView] = usePersistentListState<RequestView>("opsRequests.view", "needsQuotation");
  const [typeFilter, setTypeFilter] = usePersistentListState("opsRequests.type", "");
  const [statusFilter, setStatusFilter] = usePersistentListState("opsRequests.status", "");
  const [sortKey, setSortKey] = usePersistentListState<SortKey>("opsRequests.sortKey", "created");
  const [sortDir, setSortDir] = usePersistentListState<SortDir>("opsRequests.sortDir", "desc");
  // Page position isn't persisted, unlike the filters above — it's a
  // scroll-position-like detail, not a chosen view, and re-deriving it
  // against a row count that can shrink (Reset Demo Data, a status change
  // moving a row to AllRentals) is more likely to strand it out of range
  // than to help.
  const [page, setPage] = useState(1);

  const rows = allBookings.filter((b) => REQUEST_STATUSES.includes(b.status));

  const tabOptions = [
    { value: "needsQuotation", label: "Needs Quotation", count: rows.filter((b) => matchesRequestView(b, "needsQuotation")).length, highlight: true },
    { value: "awaitingClient", label: "Awaiting Client", count: rows.filter((b) => matchesRequestView(b, "awaitingClient")).length },
    { value: "closed", label: "Closed", count: rows.filter((b) => matchesRequestView(b, "closed")).length },
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
      b.requestedByName.toLowerCase().includes(q) ||
      (clientById.get(b.clientId)?.name.toLowerCase().includes(q) ?? false);
    const matchView = matchesRequestView(b, view);
    const matchStatus = !statusFilter || b.status === statusFilter;
    const matchType = !typeFilter || b.rentalType === typeFilter;
    return matchSearch && matchView && matchStatus && matchType;
  });

  const sorted =
    sortKey === "status"
      ? sortByStatusWithDate(filtered, "status", BOOKING_STATUS_PRIORITY, sortDir, "created")
      : sortByDatetime(filtered, sortKey, sortDir);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <FilterTabs options={tabOptions} value={view} onChange={(v) => { setView(v as RequestView); setPage(1); }} />

      <FilterBar
        showSearch
        searchableFields={["ID", "Client", "Requested By"]}
        showPeriod
        showExport
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(BK_HEADERS, sorted.map((b) => bkCSVRow(b, clientById, quotations)), `requests-${view}-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(BK_HEADERS, sorted.map((b) => bkXLSXRow(b, clientById, quotations)), `requests-${view}-${exportDateTag()}.xlsx`)}
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
            <FilterDropdown
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value); setPage(1); }}
              placeholder="All Statuses"
              options={[{ label: "All Statuses", value: "" }, ...REQUEST_STATUSES.map((s) => ({ label: s, value: s }))]}
            />
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "1380px" }}>
            <colgroup>
              <col style={{ width: "110px" }} />
              <col style={{ width: "170px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "200px" }} />
              <col style={{ width: "100px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["ID", "Client", "Requested By"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Rental Type</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Vehicle / Qty</th>
                <th
                  className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600"
                  onClick={() => handleSort("startDate")}
                >
                  <span className="inline-flex items-center gap-1">Start Date<SortIndicator active={sortKey === "startDate"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">End Date</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Branch Location</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Quotation</th>
                <th
                  className="sticky right-0 bg-slate-50 border-l border-slate-100 z-10 text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600"
                  onClick={() => handleSort("status")}
                >
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((b) => {
                const quotation = b.quotationId ? quotations.find((q) => q.id === b.quotationId) : undefined;
                return (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/ops/bookings/${b.id}`)}>
                    <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium whitespace-nowrap">{b.id}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 truncate">{clientById.get(b.clientId)?.name ?? b.clientId}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 truncate">{b.requestedByName}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{b.rentalType}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{b.vehicleClassRequested} × {b.quantity}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(b.startDate)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(b.endDate)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 truncate">{b.pickupLocation}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {quotation ? (
                        <span className="text-slate-600">
                          {quotation.id} · <span className="font-semibold text-slate-800">{formatCurrency(quotationTotals(quotation).grandTotal)}</span>
                        </span>
                      ) : b.status === "Requested" ? (
                        <span className="text-slate-300">Not yet quoted</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="sticky right-0 bg-white border-l border-slate-100 px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={bookingStatusLabel(b)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No requests found</div>}
        <TablePagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
