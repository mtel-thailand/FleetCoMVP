import { FileText, Receipt, FileCheck2, ChevronRight, type LucideIcon } from "lucide-react";
import { quotationDisplayStatus, quotationTotals, type Quotation } from "@/app/data/quotations";
import type { Invoice } from "@/app/data/invoices";
import type { TaxInvoice } from "@/app/data/taxInvoices";
import { InvoiceStatusCell } from "./InvoiceProgress";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency } from "@/app/data/formatters";
import { formatDate } from "./utils";
import { useOpenQuotation, useOpenInvoice } from "@/app/lib/documentNav";

function DocGroup({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Icon size={11} /> {label}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// Clickable rows get a border on top of a much lighter fill than the plain
// grey blocks around them (Assigned Vehicle & Driver, the "waiting for an
// invoice" placeholder below) — near-white at rest, so the border alone
// carries most of the definition, with a fill and a slightly stronger
// border on hover as the "you're about to click this" cue. The chevron is
// back (size 20, up from an earlier 14 that read as barely-there next to
// the row's own text) as a second, clearer cue on top of the border rather
// than instead of it. Non-clickable rows keep the plain grey fill with no
// border/chevron, so they still read as inert, not falsely promising an
// action they don't have.
function DocRow({ id, version, date, amount, statusSlot, onClick }: { id: string; version?: number; date: string; amount: number; statusSlot?: React.ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-3 flex items-center justify-between gap-3 ${
        onClick
          ? "bg-white border border-slate-100 text-left hover:bg-slate-50 hover:border-slate-200 transition-colors cursor-pointer"
          : "bg-slate-50"
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">
          {id}{version && version > 1 ? ` (v${version})` : ""}
        </p>
        <p className="text-[11px] text-slate-400">{formatDate(date)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right min-w-[7.5rem]">
          <p className="text-xs font-semibold text-slate-800">{formatCurrency(amount)}</p>
          {statusSlot && <div className="mt-1">{statusSlot}</div>}
        </div>
        {onClick && <ChevronRight size={20} className="text-slate-300 shrink-0" />}
      </div>
    </Tag>
  );
}

// Every document tied to a booking, grouped by type, newest first within
// each group — reads from the same reverse lookups as InvoiceProgress
// (bookings.ts's bookingQuotations/bookingInvoices/bookingTaxInvoices), so
// a recurring-billing booking's full invoice history shows up here even
// though only its latest cycle drives InvoiceProgress above it.
//
// Every row redirects to that document's own dedicated page rather than
// opening a second modal on top of whatever this is already rendered inside
// — same cross-page handoff Fleet Calendar and OpsQuotations/OpsInvoices
// already use for the reverse direction (jumping to a booking), just
// running both ways now. Quotation and invoice rows always pass their own
// bookingId as the origin, same reasoning both ways: a document opened from
// inside the booking it belongs to shouldn't jump the sidebar out from
// under a click that never left that booking's context — see each hook's
// own comment in documentNav.ts. Tax invoice rows are clickable only when
// onOpenTaxInvoice is passed; a caller with nowhere to send that click yet
// just leaves the prop unset and those rows stay plain.
export function DocumentChain({ quotations, invoices, taxInvoices, onOpenQuotation, onOpenTaxInvoice, expectingInvoice }: {
  quotations: Quotation[]; invoices: Invoice[]; taxInvoices: TaxInvoice[];
  onOpenQuotation?: (quotationId: string) => void;
  onOpenTaxInvoice?: (taxInvoiceId: string, fromBookingId?: string) => void;
  // Set once a booking is a confirmed rental (client caller only — see
  // ClientBookingDetail.tsx, !REQUEST_STATUSES.includes(booking.status),
  // same boundary the Assigned Vehicle & Driver card uses) so the Invoice
  // section says something instead of just vanishing while there's genuinely
  // one coming — the same silent-disappearance problem that card had.
  // Left unset on Ops's own DocumentChain usage: undefined here reads as
  // false, so that card's behavior is untouched, and "waiting for FleetCo to
  // issue" wouldn't make sense from FleetCo's own side of the screen anyway.
  expectingInvoice?: boolean;
}) {
  const openQuotation = useOpenQuotation();
  const openInvoice = useOpenInvoice();

  if (quotations.length === 0 && invoices.length === 0 && taxInvoices.length === 0) {
    return <p className="text-xs text-slate-400">No documents issued yet.</p>;
  }

  return (
    <div className="space-y-3">
      {quotations.length > 0 && (
        <DocGroup label="Quotation" icon={FileText}>
          {quotations.map((q) => (
            <DocRow
              key={q.id}
              id={q.id}
              version={q.version}
              date={q.issuedAt ?? q.created}
              amount={quotationTotals(q).grandTotal}
              statusSlot={<StatusBadge status={quotationDisplayStatus(q)} />}
              onClick={() => (onOpenQuotation ? onOpenQuotation(q.id) : openQuotation(q.id, q.bookingId))}
            />
          ))}
        </DocGroup>
      )}
      {(invoices.length > 0 || expectingInvoice) && (
        <DocGroup label="Invoice" icon={Receipt}>
          {invoices.length > 0 ? (
            invoices.map((i) => (
              <DocRow key={i.id} id={i.id} date={i.issuedAt} amount={i.amountDue} statusSlot={<InvoiceStatusCell status={i.status} dueDate={i.dueDate} />} onClick={() => openInvoice(i.id, i.bookingId)} />
            ))
          ) : (
            <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-xs text-slate-400">Waiting for FleetCo to issue an invoice.</div>
          )}
        </DocGroup>
      )}
      {taxInvoices.length > 0 && (
        <DocGroup label="Tax Invoice" icon={FileCheck2}>
          {taxInvoices.map((t) => (
            <DocRow key={t.id} id={t.id} date={t.issuedAt} amount={t.totalAmount} onClick={onOpenTaxInvoice ? () => onOpenTaxInvoice(t.id, t.bookingId) : undefined} />
          ))}
        </DocGroup>
      )}
    </div>
  );
}
