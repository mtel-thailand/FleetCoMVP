import { useState } from "react";
import { useTableState } from "@/app/hooks/useTableState";
import { FileCheck2, Wallet } from "lucide-react";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { useOpenTaxInvoice } from "@/app/lib/documentNav";
import { useClients } from "@/app/lib/clientsStore";
import type { TaxInvoice } from "@/app/data/taxInvoices";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { TablePagination, PAGE_SIZE } from "@/app/components/ui/TablePagination";
import { formatDate, sortByDatetime } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, exportDateTag } from "@/app/components/ui/exportUtils";
import { formatCurrency } from "@/app/data/formatters";

// brief §9 IA — the ops-side "Tax Invoices" screen. No status filter here
// (unlike Quotations/Invoices): a tax invoice is immutable the moment it's
// issued (brief §6.2), so there's nothing to be "awaiting" or "overdue" on.

type SortKey = "issuedAt" | "total";
type SortDir = "asc" | "desc";

const TI_HEADERS = ["Tax Invoice ID", "Client", "Booking", "Total Amount", "Issued"];

function taxCSVRow(t: TaxInvoice, clientName: string): string[] {
  return [t.id, clientName, t.bookingId, String(t.totalAmount), formatDate(t.issuedAt)];
}
function taxXLSXRow(t: TaxInvoice, clientName: string): (string | number)[] {
  return [t.id, clientName, t.bookingId, t.totalAmount, formatDate(t.issuedAt)];
}

function MiniDash({ taxInvoices }: { taxInvoices: TaxInvoice[] }) {
  const totalValue = taxInvoices.reduce((sum, t) => sum + t.totalAmount, 0);
  return (
    <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
          <FileCheck2 size={16} className="text-violet-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Tax Invoices</p>
          <p className="text-xl font-semibold text-slate-900 mt-0.5">{taxInvoices.length}</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--portal-accent-light)] flex items-center justify-center shrink-0">
          <Wallet size={16} className="text-[var(--portal-accent)]" />
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Value</p>
          <p className="text-xl font-semibold text-slate-900 mt-0.5">{formatCurrency(totalValue)}</p>
        </div>
      </div>
    </div>
  );
}

export function OpsTaxInvoices() {
  const openTaxInvoice = useOpenTaxInvoice();
  const taxInvoices = useTaxInvoices();
  const clients = useClients();
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const { filters, setFilter, sortKey, sortDir, toggleSort, page, setPage } =
    useTableState<{ search: string; client: string }, SortKey>({
      storageKey: "opsTaxInvoices",
      filters: { search: "", client: "" },
      sort: { key: "issuedAt", dir: "desc" },
    });
  const { search, client: clientFilter } = filters;

  const filtered = taxInvoices.filter((t) => {
    const client = clientById.get(t.clientId);
    const s = search.toLowerCase();
    const matchSearch = !search || t.id.toLowerCase().includes(s) || t.bookingId.toLowerCase().includes(s) || (client?.name.toLowerCase().includes(s) ?? false);
    const matchClient = !clientFilter || t.clientId === clientFilter;
    return matchSearch && matchClient;
  });

  const sorted =
    sortKey === "total"
      ? [...filtered].sort((a, b) => (sortDir === "asc" ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount))
      : sortByDatetime(filtered, "issuedAt", sortDir);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <MiniDash taxInvoices={taxInvoices} />

      <FilterBar
        showSearch
        searchableFields={["Tax Invoice ID", "Booking ID", "Client"]}
        showExport
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(TI_HEADERS, sorted.map((t) => taxCSVRow(t, clientById.get(t.clientId)?.name ?? t.clientId)), `tax-invoices-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(TI_HEADERS, sorted.map((t) => taxXLSXRow(t, clientById.get(t.clientId)?.name ?? t.clientId)), `tax-invoices-${exportDateTag()}.xlsx`)}
        onSearch={(v) => setFilter("search", v)}
        defaultSearch={search}
        extraFilters={
          <FilterDropdown value={clientFilter} onChange={(v) => setFilter("client", v)} placeholder="All Clients"
            options={[{ label: "All Clients", value: "" }, ...clients.map((c) => ({ label: c.name, value: c.id }))]} />
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "820px" }}>
            <colgroup>
              <col style={{ width: "140px" }} />
              <col style={{ width: "200px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Tax Invoice ID</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Client</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Booking</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("total")}>
                  <span className="inline-flex items-center gap-1">Total Amount<SortIndicator active={sortKey === "total"} direction={sortDir} /></span>
                </th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("issuedAt")}>
                  <span className="inline-flex items-center gap-1">Issued<SortIndicator active={sortKey === "issuedAt"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openTaxInvoice(t.id)}>
                  <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium truncate">{t.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 truncate">{clientById.get(t.clientId)?.name ?? t.clientId}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{t.bookingId}</td>
                  <td className="px-4 py-3 text-xs text-slate-800 font-medium whitespace-nowrap">{formatCurrency(t.totalAmount)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(t.issuedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No tax invoices issued yet</div>}
        <TablePagination total={sorted.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
