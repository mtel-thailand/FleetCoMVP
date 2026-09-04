import { useState } from "react";
import { useNavigate } from "react-router";
import { FileText } from "lucide-react";
import { bookingQuotations, bookingStatusLabel, isRequestBooking, type Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import { BOOKING_STATUS_PRIORITY } from "@/app/data/bookingStatus";
import { isQuotationExpired, quotationTotals, type Quotation } from "@/app/data/quotations";
import { useTableState } from "@/app/hooks/useTableState";
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
import { Button } from "@/app/components/ui/Button";

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
type RequestView = "all" | "needsQuotation" | "needsRevision" | "awaitingClient" | "closed";

// Request tabs intentionally group user work rather than treating every
// time-based condition as a new booking status. An expired quotation is an
// explicit revision queue: the offer ended, but the underlying request may
// still be commercially viable.
function matchesRequestView(booking: Booking, view: RequestView, quotations: Quotation[]) {
  const quotation = bookingQuotations(booking.id, quotations)[0];
  const quotationExpired = booking.status === "Quoted" && !!quotation && isQuotationExpired(quotation);
  if (view === "needsQuotation") return booking.status === "Requested";
  if (view === "needsRevision") return quotationExpired;
  if (view === "awaitingClient") return booking.status === "Quoted" && !quotationExpired;
  if (view === "closed") return booking.status === "Declined" || booking.status === "Cancelled";
  return true;
}

const BK_HEADERS = [
  "ID", "Client", "Rental Type", "Vehicle Class", "Quantity",
  "Start Date", "End Date", "Delivery Site", "Quotation", "Status",
];

function requestStatusLabel(booking: Booking, quotation: Quotation | undefined): string {
  // Expiry is derived from the quotation's validity window instead of
  // mutating BookingStatus to Cancelled: the offer expired, not necessarily
  // the customer's intent to rent.
  if (booking.status === "Quoted" && quotation && isQuotationExpired(quotation)) return "Expired";
  return bookingStatusLabel(booking);
}

function bkCSVRow(b: Booking, clientById: Map<string, ClientAccount>, quotations: Quotation[]): string[] {
  const quotation = bookingQuotations(b.id, quotations)[0];
  return [
    b.id, clientById.get(b.clientId)?.name ?? b.clientId, b.rentalType,
    b.vehicleClassRequested, String(b.quantity), formatDate(b.startDate), formatDate(b.endDate),
    b.pickupLocation, quotation?.id ?? "", requestStatusLabel(b, quotation),
  ];
}

function bkXLSXRow(b: Booking, clientById: Map<string, ClientAccount>, quotations: Quotation[]): (string | number | Date | null)[] {
  const quotation = bookingQuotations(b.id, quotations)[0];
  return [
    b.id, clientById.get(b.clientId)?.name ?? b.clientId, b.rentalType,
    b.vehicleClassRequested, b.quantity, parseExcelDate(b.startDate) as Date | string, parseExcelDate(b.endDate) as Date | string,
    b.pickupLocation, quotation?.id ?? "", requestStatusLabel(b, quotation),
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
  // View defaults to the first tab (Needs Quotation), not All — landing on
  // this page opens straight onto new requests rather than the full,
  // undifferentiated list.
  const { filters, setFilter, sortKey, sortDir, toggleSort, page, setPage } =
    useTableState<{ search: string; view: RequestView; type: string }, SortKey>({
      storageKey: "opsRequests",
      filters: { search: "", view: "needsQuotation", type: "" },
      sort: { key: "created", dir: "desc" },
      defaultDirFor: (key) => (key === "status" ? "asc" : "desc"),
    });
  const { search, view, type: typeFilter } = filters;

  const rows = allBookings.filter((b) => isRequestBooking(b));

  const tabOptions = [
    { value: "needsQuotation", label: "Needs Quotation", count: rows.filter((b) => matchesRequestView(b, "needsQuotation", quotations)).length, highlight: true },
    { value: "needsRevision", label: "Needs Revision", count: rows.filter((b) => matchesRequestView(b, "needsRevision", quotations)).length, highlight: true },
    { value: "awaitingClient", label: "Awaiting Client", count: rows.filter((b) => matchesRequestView(b, "awaitingClient", quotations)).length },
    { value: "closed", label: "Closed", count: rows.filter((b) => matchesRequestView(b, "closed", quotations)).length },
    { value: "all", label: "All", count: rows.length },
  ];

  const filtered = rows.filter((b) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      b.id.toLowerCase().includes(q) ||
      (bookingQuotations(b.id, quotations)[0]?.id.toLowerCase().includes(q) ?? false) ||
      (clientById.get(b.clientId)?.name.toLowerCase().includes(q) ?? false);
    const matchView = matchesRequestView(b, view, quotations);
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
      <FilterTabs options={tabOptions} value={view} onChange={(v) => setFilter("view", v as RequestView)} />

      <FilterBar
        showSearch
        searchableFields={["Request ID", "Quotation ID", "Client"]}
        showExport
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(BK_HEADERS, sorted.map((b) => bkCSVRow(b, clientById, quotations)), `requests-${view}-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(BK_HEADERS, sorted.map((b) => bkXLSXRow(b, clientById, quotations)), `requests-${view}-${exportDateTag()}.xlsx`)}
        onSearch={(v) => setFilter("search", v)}
        defaultSearch={search}
        trailing={
          <Button variant="outline" size="toolbar" onClick={() => navigate("/ops/documents/quotations")}>
            <FileText size={13} /> Quotation register
          </Button>
        }
        extraFilters={
          <>
            <FilterDropdown
              value={typeFilter}
              onChange={(value) => setFilter("type", value)}
              placeholder="All Rental Types"
              options={[{ label: "All Rental Types", value: "" }, ...RENTAL_TYPES.map((t) => ({ label: t, value: t }))]}
            />
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "1320px" }}>
            <colgroup>
              <col style={{ width: "110px" }} />
              <col style={{ width: "170px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "70px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "200px" }} />
              <col style={{ width: "100px" }} />
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
                  onClick={() => toggleSort("startDate")}
                >
                  <span className="inline-flex items-center gap-1">Start Date<SortIndicator active={sortKey === "startDate"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">End Date</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Delivery Site</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Quotation</th>
                <th
                  className="sticky right-0 bg-slate-50 border-l border-slate-100 z-10 text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600"
                  onClick={() => toggleSort("status")}
                >
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((b) => {
                const quotation = bookingQuotations(b.id, quotations)[0];
                return (
                  <tr key={b.id} className="border-b border-slate-50 group hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/ops/bookings/${b.id}`)}>
                    <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium whitespace-nowrap">{b.id}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 truncate">{clientById.get(b.clientId)?.name ?? b.clientId}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{b.rentalType}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{b.vehicleClassRequested}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{b.quantity}</td>
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
                    <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-100 px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={requestStatusLabel(b, quotation)} />
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
