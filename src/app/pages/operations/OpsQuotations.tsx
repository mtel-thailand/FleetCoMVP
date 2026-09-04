import { useState } from "react";
import { useTableState } from "@/app/hooks/useTableState";
import { useNavigate } from "react-router";
import { FileText, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useQuotations } from "@/app/lib/quotationsStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { useClients } from "@/app/lib/clientsStore";
import { isQuotationExpired, quotationDisplayStatus, quotationTotals, type Quotation, type QuotationDisplayStatus } from "@/app/data/quotations";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, exportDateTag } from "@/app/components/ui/exportUtils";
import { formatCurrency } from "@/app/data/formatters";

// brief §9 IA: the ops-side "Quotations" screen — every quotation FleetCo
// has ever issued, across every client, one list. This was the missing
// piece the audit flagged: issuing a quotation was already fully built
// (RequestInbox's per-booking flow + the split-screen editor), there was
// just no bird's-eye view of them afterward. Clicking a row navigates to
// that quotation's own /documents/quotations/:id page — the booking is one
// click further, via the "For {bookingId}" link inside that page.

const STATUSES: QuotationDisplayStatus[] = ["Draft", "Issued", "Expired", "Accepted", "Declined", "Superseded"];
const STATUS_PRIORITY = ["Expired", "Issued", "Draft", "Accepted", "Declined", "Superseded"];

type SortKey = "status" | "validUntil" | "total" | "issuedAt";
type SortDir = "asc" | "desc";

const Q_HEADERS = ["Quotation ID", "Client", "Booking", "Status", "Grand Total", "Valid Until", "Issued"];

function MiniDash({ quotations }: { quotations: Quotation[] }) {
  const awaiting = quotations.filter((q) => q.status === "Issued" && !isQuotationExpired(q)).length;
  const expired = quotations.filter((q) => isQuotationExpired(q)).length;
  const accepted = quotations.filter((q) => q.status === "Accepted").length;
  const declined = quotations.filter((q) => q.status === "Declined").length;

  const cards = [
    { label: "Total Quotations", value: quotations.length, icon: <FileText size={16} className="text-[var(--portal-accent)]" />, bg: "bg-[var(--portal-accent-light)]" },
    { label: "Awaiting Client Decision", value: awaiting, icon: <Clock size={16} className="text-sky-600" />, bg: "bg-sky-50" },
    { label: "Accepted", value: accepted, icon: <CheckCircle2 size={16} className="text-emerald-600" />, bg: "bg-emerald-50" },
    { label: "Declined", value: declined, icon: <XCircle size={16} className="text-rose-600" />, bg: "bg-rose-50" },
    { label: "Expired", value: expired, icon: <AlertTriangle size={16} className="text-amber-600" />, bg: "bg-amber-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>{c.icon}</div>
          <div>
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-xl font-semibold text-slate-900 mt-0.5">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OpsQuotations() {
  const navigate = useNavigate();
  const quotations = useQuotations();
  const bookings = useBookings();
  const clients = useClients();
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  const { filters, setFilter, sortKey, sortDir, toggleSort, page, setPage } =
    useTableState<{ search: string; status: string; client: string }, SortKey>({
      storageKey: "opsQuotations",
      filters: { search: "", status: "", client: "" },
      sort: { key: "issuedAt", dir: "desc" },
    });
  const { search, status: statusFilter, client: clientFilter } = filters;

  const filtered = quotations.filter((q) => {
    const client = clientById.get(q.clientId);
    const s = search.toLowerCase();
    const matchSearch = !search || q.id.toLowerCase().includes(s) || q.bookingId.toLowerCase().includes(s) || (client?.name.toLowerCase().includes(s) ?? false);
    const matchStatus = !statusFilter || quotationDisplayStatus(q) === statusFilter;
    const matchClient = !clientFilter || q.clientId === clientFilter;
    return matchSearch && matchStatus && matchClient;
  });

  // quotationTotals() is a derived number, not a field on Quotation itself,
  // so this sorts the {q, total} pairs directly rather than routing through
  // the shared sortByStatus/sortByDatetime helpers (built for sorting a
  // plain field on the record).
  const withTotals = filtered.map((q) => ({ q, total: quotationTotals(q).grandTotal }));
  const rows = withTotals.sort((a, b) => {
    let cmp = 0;
    if (sortKey === "status") cmp = STATUS_PRIORITY.indexOf(quotationDisplayStatus(a.q)) - STATUS_PRIORITY.indexOf(quotationDisplayStatus(b.q));
    else if (sortKey === "validUntil") cmp = a.q.validUntil < b.q.validUntil ? -1 : a.q.validUntil > b.q.validUntil ? 1 : 0;
    else if (sortKey === "issuedAt") cmp = (a.q.issuedAt ?? "") < (b.q.issuedAt ?? "") ? -1 : (a.q.issuedAt ?? "") > (b.q.issuedAt ?? "") ? 1 : 0;
    else cmp = a.total - b.total;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <MiniDash quotations={quotations} />

      <FilterBar
        showSearch
        searchableFields={["Quotation ID", "Booking ID", "Client"]}
        showExport
        exportDisabled={rows.length === 0}
        onExportCSV={() => exportCSV(Q_HEADERS, rows.map(({ q, total }) => [
          q.id, clientById.get(q.clientId)?.name ?? q.clientId, q.bookingId, quotationDisplayStatus(q), String(total), formatDate(q.validUntil), q.issuedAt ? formatDate(q.issuedAt) : "—",
        ]), `quotations-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(Q_HEADERS, rows.map(({ q, total }) => [
          q.id, clientById.get(q.clientId)?.name ?? q.clientId, q.bookingId, quotationDisplayStatus(q), total, formatDate(q.validUntil), q.issuedAt ? formatDate(q.issuedAt) : "—",
        ]), `quotations-${exportDateTag()}.xlsx`)}
        onSearch={(v) => setFilter("search", v)}
        defaultSearch={search}
        extraFilters={
          <>
            <FilterDropdown value={clientFilter} onChange={(v) => setFilter("client", v)} placeholder="All Clients"
              options={[{ label: "All Clients", value: "" }, ...clients.map((c) => ({ label: c.name, value: c.id }))]} />
            <FilterDropdown value={statusFilter} onChange={(v) => setFilter("status", v)} placeholder="All Statuses"
              options={[{ label: "All Statuses", value: "" }, ...STATUSES.map((s) => ({ label: s, value: s }))]} />
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "980px" }}>
            <colgroup>
              <col style={{ width: "130px" }} />
              <col style={{ width: "190px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Quotation ID</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Booking</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("status")}>
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("total")}>
                  <span className="inline-flex items-center gap-1">Grand Total<SortIndicator active={sortKey === "total"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("validUntil")}>
                  <span className="inline-flex items-center gap-1">Valid Until<SortIndicator active={sortKey === "validUntil"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("issuedAt")}>
                  <span className="inline-flex items-center gap-1">Issued<SortIndicator active={sortKey === "issuedAt"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(({ q, total }) => (
                <tr key={q.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/ops/documents/quotations/${q.id}`, {
                  state: { navPath: "/ops/requests", returnTo: "/ops/documents/quotations", returnLabel: "Quotation register" },
                })}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium truncate">{q.id}{q.version > 1 ? ` (v${q.version})` : ""}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 truncate">{clientById.get(q.clientId)?.name ?? q.clientId}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{q.bookingId}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={quotationDisplayStatus(q)} /></td>
                  <td className="px-4 py-3 text-xs text-slate-800 font-medium whitespace-nowrap">{formatCurrency(total)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(q.validUntil)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{q.issuedAt ? formatDate(q.issuedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No quotations found</div>}
        <TablePagination total={rows.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
