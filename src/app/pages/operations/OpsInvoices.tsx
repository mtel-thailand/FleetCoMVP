import { useState } from "react";
import { useNavigate } from "react-router";
import { FileCheck2 } from "lucide-react";
import { fleetCoBookingStatusLabel, invoiceEligible, type Booking } from "@/app/data/bookings";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { useClients } from "@/app/lib/clientsStore";
import { invoiceDisplayStatus, type Invoice, type InvoiceStatus } from "@/app/data/invoices";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterTabs } from "@/app/components/ui/FilterTabs";
import { InvoiceStatusCell } from "@/app/components/ui/InvoiceProgress";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate, sortByDatetime } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, exportDateTag } from "@/app/components/ui/exportUtils";
import { formatCurrency } from "@/app/data/formatters";
import { useTableState } from "@/app/hooks/useTableState";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";

// brief §9 IA / §4.7's aging-adjacent needs — the ops-side "Invoices"
// screen, every invoice plus the small pre-invoice queue for rentals that
// are operationally ready to bill. This is also Finance
// Officer's ROLE_DEFAULT landing page, which the audit flagged as a stub —
// closing that is the main point of this file. The Ready to Issue queue is
// action-first; issued invoice rows navigate to their own detail pages.

// Payment Issue ranks right behind Overdue — a rejected claim needs
// following up on about as urgently as a missed deadline does.
const STATUS_PRIORITY = ["Overdue", "Payment Issue", "Payment Submitted", "Unpaid", "Paid"];
// Mutually exclusive with Payment Review (Payment Submitted) and Settled
// (Paid), so the three operational tab counts add up exactly to All.
const OUTSTANDING_STATUSES: InvoiceStatus[] = ["Unpaid", "Overdue", "Payment Issue"];

type SortKey = "status" | "dueDate" | "amountDue" | "issuedAt";
type SortDir = "asc" | "desc";
type InvoiceView = "ready" | "action" | "outstanding" | "settled" | "all";

const INV_HEADERS = ["Invoice ID", "Booking ID", "Client", "Issued Date", "Due Date", "Amount Due", "Invoice Status", "Tax Invoice ID"];

function invCSVRow(i: Invoice, clientName: string, taxInvoiceId?: string): string[] {
  return [i.id, i.bookingId, clientName, formatDate(i.issuedAt.split(" ")[0]), formatDate(i.dueDate), String(i.amountDue), invoiceDisplayStatus(i), taxInvoiceId ?? ""];
}
function invXLSXRow(i: Invoice, clientName: string, taxInvoiceId?: string): (string | number)[] {
  return [i.id, i.bookingId, clientName, formatDate(i.issuedAt.split(" ")[0]), formatDate(i.dueDate), i.amountDue, invoiceDisplayStatus(i), taxInvoiceId ?? ""];
}

export function OpsInvoices() {
  const navigate = useNavigate();
  const invoices = useInvoices();
  const bookings = useBookings();
  const quotations = useQuotations();
  const taxInvoices = useTaxInvoices();
  const clients = useClients();
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const taxInvoiceByInvoiceId = new Map(taxInvoices.map((taxInvoice) => [taxInvoice.invoiceId, taxInvoice]));

  const { filters, setFilter, sortKey, sortDir, toggleSort, page, setPage } =
    useTableState<{ search: string; view: InvoiceView }, SortKey>({
      storageKey: "opsInvoices",
      filters: { search: "", view: "ready" },
      sort: { key: "dueDate", dir: "asc" },
      // Due dates read best soonest-first; everything else newest-first.
      defaultDirFor: (key) => (key === "dueDate" ? "asc" : "desc"),
    });
  const { search, view } = filters;
  const invoiceTableMinWidth = "1050px";

  const invoiceNeedsAction = (invoice: Invoice) => invoice.status === "Payment Submitted";
  const invoicedBookingIds = new Set(invoices.map((invoice) => invoice.bookingId));
  const acceptedQuotationBookingIds = new Set(
    quotations.filter((quotation) => quotation.status === "Accepted").map((quotation) => quotation.bookingId),
  );
  const readyToIssue = bookings.filter(
    (booking) =>
      invoiceEligible(booking) &&
      !invoicedBookingIds.has(booking.id) &&
      acceptedQuotationBookingIds.has(booking.id),
  );

  const tabOptions = [
    { value: "ready", label: "Ready to Issue", count: readyToIssue.length, highlight: true },
    { value: "action", label: "Payment Review", count: invoices.filter(invoiceNeedsAction).length, highlight: true },
    { value: "outstanding", label: "Outstanding", count: invoices.filter((invoice) => OUTSTANDING_STATUSES.includes(invoiceDisplayStatus(invoice))).length },
    { value: "settled", label: "Settled", count: invoices.filter((invoice) => invoice.status === "Paid").length },
    { value: "all", label: "All", count: invoices.length },
  ];

  const query = search.trim().toLowerCase();
  const filteredReadyToIssue = readyToIssue.filter((booking) => {
    const client = clientById.get(booking.clientId);
    return (
      !query ||
      booking.id.toLowerCase().includes(query) ||
      booking.rentalType.toLowerCase().includes(query) ||
      booking.vehicleClassRequested.toLowerCase().includes(query) ||
      (client?.name.toLowerCase().includes(query) ?? false)
    );
  });
  const filtered = invoices.filter((i) => {
    const client = clientById.get(i.clientId);
    const matchSearch = !query || i.id.toLowerCase().includes(query) || i.bookingId.toLowerCase().includes(query) || (client?.name.toLowerCase().includes(query) ?? false);
    const matchView =
      view === "all" ||
      (view === "action" && invoiceNeedsAction(i)) ||
      (view === "outstanding" && OUTSTANDING_STATUSES.includes(invoiceDisplayStatus(i))) ||
      (view === "settled" && i.status === "Paid");
    return matchSearch && matchView;
  });

  const sorted =
    sortKey === "status" ? [...filtered].sort((a, b) => {
      const cmp = STATUS_PRIORITY.indexOf(invoiceDisplayStatus(a)) - STATUS_PRIORITY.indexOf(invoiceDisplayStatus(b));
      return sortDir === "asc" ? cmp : -cmp;
    })
    : sortKey === "amountDue" ? [...filtered].sort((a, b) => (sortDir === "asc" ? a.amountDue - b.amountDue : b.amountDue - a.amountDue))
    : sortKey === "dueDate" ? sortByDatetime(filtered, "dueDate", sortDir)
    : sortByDatetime(filtered, "issuedAt", sortDir);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedReadyToIssue = filteredReadyToIssue.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <FilterTabs options={tabOptions} value={view} onChange={(value) => setFilter("view", value as InvoiceView)} />

      <FilterBar
        showSearch
        searchableFields={view === "ready" ? ["Booking ID", "Client", "Rental Type", "Vehicle Class"] : ["Invoice ID", "Booking ID", "Client"]}
        defaultSearch={search}
        showExport
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(INV_HEADERS, sorted.map((i) => invCSVRow(i, clientById.get(i.clientId)?.name ?? i.clientId, taxInvoiceByInvoiceId.get(i.id)?.id)), `invoices-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(INV_HEADERS, sorted.map((i) => invXLSXRow(i, clientById.get(i.clientId)?.name ?? i.clientId, taxInvoiceByInvoiceId.get(i.id)?.id)), `invoices-${exportDateTag()}.xlsx`)}
        onSearch={(v) => setFilter("search", v)}
      />

      {view === "ready" ? (
        <ReadyToIssueTable
          rows={paginatedReadyToIssue}
          total={filteredReadyToIssue.length}
          page={page}
          onPageChange={setPage}
          onIssueInvoice={(bookingId) => navigate(`/ops/bookings/${bookingId}/invoice/new`, {
            state: {
              navPath: "/ops/documents/invoices",
              returnTo: "/ops/documents/invoices",
              returnLabel: "Invoices & Payments",
            },
          })}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm" style={{ minWidth: invoiceTableMinWidth }}>
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
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Invoice ID</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Booking ID</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("issuedAt")}>
                  <span className="inline-flex items-center gap-1">Issued Date<SortIndicator active={sortKey === "issuedAt"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("dueDate")}>
                  <span className="inline-flex items-center gap-1">Due Date<SortIndicator active={sortKey === "dueDate"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("amountDue")}>
                  <span className="inline-flex items-center gap-1">Amount Due<SortIndicator active={sortKey === "amountDue"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("status")}>
                  <span className="inline-flex items-center gap-1">Invoice Status<SortIndicator active={sortKey === "status"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((i) => (
                <tr key={i.id} className="border-b border-slate-50 group hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/ops/documents/invoices/${i.id}`)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium truncate">{i.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{i.bookingId}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 truncate">{clientById.get(i.clientId)?.name ?? i.clientId}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(i.issuedAt.split(" ")[0])}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(i.dueDate)}</td>
                  <td className="px-4 py-3 text-xs text-slate-800 font-medium whitespace-nowrap">{formatCurrency(i.amountDue)}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><InvoiceStatusCell status={invoiceDisplayStatus(i)} align="start" variant="table" /></td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          {sorted.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No invoices found</div>}
          <TablePagination total={sorted.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

function ReadyToIssueTable({
  rows,
  total,
  page,
  onPageChange,
  onIssueInvoice,
}: {
  rows: Booking[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onIssueInvoice: (bookingId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm" style={{ minWidth: "1050px" }}>
          <colgroup>
            <col style={{ width: "115px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "135px" }} />
            <col style={{ width: "55px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "180px" }} />
            <col style={{ width: "105px" }} />
            <col style={{ width: "120px" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">ID</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Rental Type</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Vehicle Class</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Qty</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Start Date</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">End Date</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Delivery Site</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Status</th>
              <th scope="col" className="sticky right-0 z-10 border-l border-slate-100 bg-slate-50 px-4 py-2.5 text-left text-xs font-medium text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((booking) => (
              // This is an action queue, so the whole row opens the invoice editor.
              <tr
                key={booking.id}
                className="border-b border-slate-50 group hover:bg-slate-50 cursor-pointer"
                onClick={() => onIssueInvoice(booking.id)}
              >
                <td className="truncate px-4 py-3 text-xs font-medium text-[var(--portal-accent)]">{booking.id}</td>
                <td className="truncate px-4 py-3 text-xs text-slate-600">{booking.rentalType}</td>
                <td className="truncate px-4 py-3 text-xs text-slate-700">{booking.vehicleClassRequested}</td>
                <td className="px-4 py-3 text-xs text-slate-700">{booking.quantity}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDate(booking.startDate)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDate(booking.endDate)}</td>
                <td className="truncate px-4 py-3 text-xs text-slate-600">{booking.pickupLocation}</td>
                <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={fleetCoBookingStatusLabel(booking)} /></td>
                <td className="sticky right-0 border-l border-slate-100 bg-white group-hover:bg-slate-50 px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onIssueInvoice(booking.id);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs font-medium text-[var(--portal-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)] focus-visible:ring-offset-2 cursor-pointer"
                  >
                    <FileCheck2 size={13} /> Issue Invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total === 0 && <div className="py-12 text-center text-sm text-slate-400">No rentals are waiting for an invoice</div>}
      <TablePagination total={total} page={page} pageSize={PAGE_SIZE} onPageChange={onPageChange} />
    </div>
  );
}
