import { useState } from "react";
import { useNavigate } from "react-router";
import { Wallet, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useClients } from "@/app/lib/clientsStore";
import type { Invoice, InvoiceStatus } from "@/app/data/invoices";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate, sortByStatus, sortByDatetime } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, exportDateTag } from "@/app/components/ui/exportUtils";
import { formatCurrency } from "@/app/data/formatters";

// brief §9 IA / §4.7's aging-adjacent needs — the ops-side "Invoices"
// screen, every invoice across every client. This is also Finance
// Officer's ROLE_DEFAULT landing page, which the audit flagged as a stub —
// closing that is the main point of this file. Clicking a row navigates to
// that invoice's own /documents/invoices/:id page; the booking is one click
// further via the "For {bookingId}" link inside that page.

const STATUSES: InvoiceStatus[] = ["Unpaid", "Payment Submitted", "Overdue", "Payment Issue", "Paid"];
// Payment Issue ranks right behind Overdue — a rejected claim needs
// following up on about as urgently as a missed deadline does.
const STATUS_PRIORITY = ["Overdue", "Payment Issue", "Payment Submitted", "Unpaid", "Paid"];

type SortKey = "status" | "dueDate" | "amountDue" | "issuedAt";
type SortDir = "asc" | "desc";

const INV_HEADERS = ["Invoice ID", "Client", "Booking", "Status", "Amount Due", "Due Date", "Issued"];

function invCSVRow(i: Invoice, clientName: string): string[] {
  return [i.id, clientName, i.bookingId, i.status, String(i.amountDue), formatDate(i.dueDate), formatDate(i.issuedAt)];
}
function invXLSXRow(i: Invoice, clientName: string): (string | number)[] {
  return [i.id, clientName, i.bookingId, i.status, i.amountDue, formatDate(i.dueDate), formatDate(i.issuedAt)];
}

function MiniDash({ invoices }: { invoices: Invoice[] }) {
  const outstanding = invoices.filter((i) => i.status === "Unpaid" || i.status === "Overdue" || i.status === "Payment Issue");
  const outstandingTotal = outstanding.reduce((sum, i) => sum + i.amountDue, 0);
  const submitted = invoices.filter((i) => i.status === "Payment Submitted").length;
  const overdue = invoices.filter((i) => i.status === "Overdue").length;

  const cards = [
    { label: "Outstanding", value: formatCurrency(outstandingTotal), sub: `${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"}`, icon: <Wallet size={16} className="text-[var(--portal-accent)]" />, bg: "bg-[var(--portal-accent-light)]" },
    { label: "Overdue", value: String(overdue), sub: "Needs follow-up", icon: <AlertCircle size={16} className="text-red-600" />, bg: "bg-red-50" },
    { label: "Payment Submitted", value: String(submitted), sub: "Awaiting verification", icon: <Clock size={16} className="text-indigo-600" />, bg: "bg-indigo-50" },
    { label: "Total Invoices", value: String(invoices.length), sub: "All time", icon: <CheckCircle2 size={16} className="text-emerald-600" />, bg: "bg-emerald-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>{c.icon}</div>
          <div>
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-xl font-semibold text-slate-900 mt-0.5">{c.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OpsInvoices() {
  const navigate = useNavigate();
  const invoices = useInvoices();
  const clients = useClients();
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }

  const filtered = invoices.filter((i) => {
    const client = clientById.get(i.clientId);
    const s = search.toLowerCase();
    const matchSearch = !search || i.id.toLowerCase().includes(s) || i.bookingId.toLowerCase().includes(s) || (client?.name.toLowerCase().includes(s) ?? false);
    const matchStatus = !statusFilter || i.status === statusFilter;
    const matchClient = !clientFilter || i.clientId === clientFilter;
    return matchSearch && matchStatus && matchClient;
  });

  const sorted =
    sortKey === "status" ? sortByStatus(filtered, "status", STATUS_PRIORITY, sortDir)
    : sortKey === "amountDue" ? [...filtered].sort((a, b) => (sortDir === "asc" ? a.amountDue - b.amountDue : b.amountDue - a.amountDue))
    : sortKey === "dueDate" ? sortByDatetime(filtered, "dueDate", sortDir)
    : sortByDatetime(filtered, "issuedAt", sortDir);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <MiniDash invoices={invoices} />

      <FilterBar
        showSearch
        searchableFields={["Invoice ID", "Booking ID", "Client"]}
        showExport
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(INV_HEADERS, sorted.map((i) => invCSVRow(i, clientById.get(i.clientId)?.name ?? i.clientId)), `invoices-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(INV_HEADERS, sorted.map((i) => invXLSXRow(i, clientById.get(i.clientId)?.name ?? i.clientId)), `invoices-${exportDateTag()}.xlsx`)}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        extraFilters={
          <>
            <FilterDropdown value={clientFilter} onChange={(v) => { setClientFilter(v); setPage(1); }} placeholder="All Clients"
              options={[{ label: "All Clients", value: "" }, ...clients.map((c) => ({ label: c.name, value: c.id }))]} />
            <FilterDropdown value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="All Statuses"
              options={[{ label: "All Statuses", value: "" }, ...STATUSES.map((s) => ({ label: s, value: s }))]} />
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "980px" }}>
            <colgroup>
              <col style={{ width: "120px" }} />
              <col style={{ width: "190px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Invoice ID</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Booking</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("status")}>
                  <span className="inline-flex items-center gap-1">Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("amountDue")}>
                  <span className="inline-flex items-center gap-1">Amount Due<SortIndicator active={sortKey === "amountDue"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("dueDate")}>
                  <span className="inline-flex items-center gap-1">Due Date<SortIndicator active={sortKey === "dueDate"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("issuedAt")}>
                  <span className="inline-flex items-center gap-1">Issued<SortIndicator active={sortKey === "issuedAt"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((i) => (
                <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/ops/documents/invoices/${i.id}`)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium truncate">{i.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 truncate">{clientById.get(i.clientId)?.name ?? i.clientId}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{i.bookingId}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={i.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-800 font-medium whitespace-nowrap">{formatCurrency(i.amountDue)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(i.dueDate)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(i.issuedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No invoices found</div>}
        <TablePagination total={sorted.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
