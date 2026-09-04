import { useState } from "react";
import { useNavigate } from "react-router";
import { useBookings } from "@/app/lib/bookingsStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { quotationDisplayStatus, quotationTotals, type Quotation } from "@/app/data/quotations";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { invoiceDisplayStatus, type Invoice } from "@/app/data/invoices";
import type { TaxInvoice } from "@/app/data/taxInvoices";
import { bookingInvoices, bookingQuotations, bookingTaxInvoices, type Booking } from "@/app/data/bookings";
import { FolderOpen, FileCheck2, Receipt, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { formatDate } from "@/app/components/ui/utils";
import { formatCurrency } from "@/app/data/formatters";
import { CLIENT_ID } from "@/app/lib/currentClient";
import { useOpenInvoice, useOpenQuotation, useOpenTaxInvoice } from "@/app/lib/documentNav";

// brief §5.3: "Billing history: full document trail per booking and per
// month." Read-only ledger — one row per *invoice cycle*, not per booking:
// a recurring-billing booking (isRecurringBilling) generates a new invoice
// every month, and "per month" in the brief's own wording is exactly that.
// A single row per booking would only ever show its most recent cycle,
// silently dropping every earlier month's invoice/tax-invoice — the same
// reverse-lookup gap fixed in ClientBookingDetail/RequestInbox, showing up
// here too. No store of its own; it just reads the three live stores.

type LedgerRow = {
  booking: Booking;
  invoice: Invoice | undefined;
  taxInvoice: TaxInvoice | undefined;
  showBookingCells: boolean; // first row of this booking's group only
};

// At-a-glance totals above the ledger — same MiniDash pattern as
// InvoiceInbox, so this reads as a summary of that screen rather than a
// second, disconnected view.
function MiniDash({
  bookings, quotations, invoices,
}: {
  bookings: Booking[]; quotations: Quotation[]; invoices: Invoice[];
}) {
  const quotedTotal = bookings.reduce((sum, b) => {
    const q = bookingQuotations(b.id, quotations)[0];
    if (!q || q.status === "Declined") return sum;
    return sum + quotationTotals(q).grandTotal;
  }, 0);

  // Every invoice across every booking, not booking.invoiceId's single
  // "most recent" pointer — otherwise a recurring booking's earlier,
  // already-settled cycles silently vanish from these totals too.
  const allInvoices = bookings.flatMap((b) => bookingInvoices(b.id, invoices));
  const invoicedTotal = allInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);
  const outstandingTotal = allInvoices.reduce((sum, inv) => (inv.status !== "Paid" ? sum + inv.amountDue : sum), 0);

  const cards = [
    { label: "Bookings", value: String(bookings.length), sub: "With at least a quotation", icon: <FolderOpen size={16} className="text-slate-600" />, bg: "bg-slate-100" },
    { label: "Quoted", value: formatCurrency(quotedTotal), sub: "Issued or accepted", icon: <FileCheck2 size={16} className="text-indigo-600" />, bg: "bg-indigo-50" },
    { label: "Invoiced", value: formatCurrency(invoicedTotal), sub: `${allInvoices.length} invoice${allInvoices.length === 1 ? "" : "s"}`, icon: <Receipt size={16} className="text-[var(--portal-accent)]" />, bg: "bg-[var(--portal-accent-light)]" },
    { label: "Outstanding", value: formatCurrency(outstandingTotal), sub: outstandingTotal > 0 ? "Not yet paid" : "All settled", icon: <AlertCircle size={16} className={outstandingTotal > 0 ? "text-amber-600" : "text-emerald-600"} />, bg: outstandingTotal > 0 ? "bg-amber-50" : "bg-emerald-50" },
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

export function BillingHistory() {
  const navigate = useNavigate();
  const bookings = useBookings().filter((b) => b.clientId === CLIENT_ID);
  const quotations = useQuotations();
  const invoices = useInvoices();
  const taxInvoices = useTaxInvoices();
  const openQuotation = useOpenQuotation();
  const openInvoice = useOpenInvoice();
  const openTaxInvoice = useOpenTaxInvoice();
  const [search, setSearch] = useState("");

  // Search only here, deliberately — no status filter or column sort. This
  // is a grouped ledger (one booking can own several rows, and every row
  // after the first leaves its Booking/Dates/Quotation cells blank to read
  // as a continuation, see showBookingCells below); filtering or sorting at
  // the row level would split a group across pages of results or leave an
  // orphaned continuation row with no header row above it. Filtering whole
  // booking-groups by search keeps that structure intact — every group that
  // matches shows up complete, every group that doesn't disappears whole.
  const query = search.trim().toLowerCase();
  const matchingBookings = bookings.filter(
    (b) => bookingQuotations(b.id, quotations).length > 0 &&
      (!query || b.id.toLowerCase().includes(query) || b.pickupLocation.toLowerCase().includes(query)),
  );
  const sortedBookings = matchingBookings.slice().sort((a, b) => (a.created < b.created ? 1 : -1));

  // Flatten to one row per invoice cycle. A booking with no invoice yet
  // still gets exactly one row (quotation-only); a booking with N invoices
  // (recurring billing) gets N rows, oldest cycle first — reads as a running
  // history rather than newest-first like the rest of this app, since these
  // rows are grouped under one booking rather than independent list items.
  const rows: LedgerRow[] = sortedBookings.flatMap((b): LedgerRow[] => {
    const bInvoices = bookingInvoices(b.id, invoices).slice().reverse();
    const bTaxInvoices = bookingTaxInvoices(b.id, taxInvoices);
    if (bInvoices.length === 0) {
      return [{ booking: b, invoice: undefined, taxInvoice: undefined, showBookingCells: true }];
    }
    return bInvoices.map((invoice, i) => ({
      booking: b,
      invoice,
      taxInvoice: bTaxInvoices.find((t) => t.invoiceId === invoice.id),
      showBookingCells: i === 0,
    }));
  });

  return (
    <div>
      {/* Driven by the full unfiltered bookings list, not rows — these are
          portfolio-level totals, not "totals for your current search", so
          they shouldn't fluctuate or disappear as you type. */}
      {bookings.length > 0 && <MiniDash bookings={bookings} quotations={quotations} invoices={invoices} />}
      {bookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FolderOpen}
            title="No billing activity yet"
            subtitle="Once a request turns into a quotation, its full document trail — quotation, invoice, tax invoice — will show up here."
            action={{ label: "Go to My Requests", to: "/portal/requests" }}
          />
        </div>
      ) : (
        <>
          <FilterBar searchableFields={["Booking ID", "Delivery Site"]} onSearch={setSearch} />
          {rows.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="text-center py-12 text-slate-400 text-sm">No bookings match your search</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: "900px" }}>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {["Booking", "Dates", "Quotation", "Invoice", "Tax Invoice"].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const { booking: b, invoice, taxInvoice, showBookingCells } = row;
                      const quotation = bookingQuotations(b.id, quotations)[0];
                      const qTotal = quotation ? quotationTotals(quotation).grandTotal : null;
                      return (
                        <tr key={`${b.id}-${invoice?.id ?? "none"}-${i}`} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/portal/bookings/${b.id}`, {
                          state: { returnTo: "/portal/billing-history", returnLabel: "Billing History" },
                        })}>
                          <td className="px-4 py-3 text-xs font-medium text-[var(--portal-accent)] whitespace-nowrap">{showBookingCells ? b.id : ""}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                            {showBookingCells ? `${formatDate(b.startDate)} → ${formatDate(b.endDate)}` : ""}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {showBookingCells ? (
                              quotation ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openQuotation(quotation.id, b.id);
                                    }}
                                    className="text-slate-700 hover:text-[var(--portal-accent)] cursor-pointer"
                                  >
                                    {quotation.id}
                                  </button>
                                  <StatusBadge status={quotationDisplayStatus(quotation)} />
                                  <span className="text-slate-500">{qTotal !== null ? formatCurrency(qTotal) : ""}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )
                            ) : (
                              ""
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {invoice ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openInvoice(invoice.id, b.id);
                                  }}
                                  className="text-slate-700 hover:text-[var(--portal-accent)] cursor-pointer"
                                >
                                  {invoice.id}
                                </button>
                                <StatusBadge status={invoiceDisplayStatus(invoice)} />
                                <span className="text-slate-500">{formatCurrency(invoice.amountDue)}</span>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {taxInvoice ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openTaxInvoice(taxInvoice.id, b.id);
                                  }}
                                  className="text-slate-700 hover:text-[var(--portal-accent)] cursor-pointer"
                                >
                                  {taxInvoice.id}
                                </button>
                                <span className="text-slate-500">{formatCurrency(taxInvoice.totalAmount)}</span>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
