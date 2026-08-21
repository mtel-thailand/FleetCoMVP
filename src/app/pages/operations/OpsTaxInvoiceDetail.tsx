import { useNavigate, useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { TaxInvoiceDetail } from "@/app/components/documents/TaxInvoiceDetail";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// Ops-side equivalent of TaxInvoiceDetailPage.tsx (client) — same thin-page
// shape as OpsQuotationDetail.tsx/OpsInvoiceDetail.tsx, reachable from Tax
// Invoices (row click) and from useOpenTaxInvoice's cross-page handoff.
// TaxInvoiceDetail itself was already portal-agnostic before this file
// existed (no client-scoping, useOpenBookingFromDocument already handles
// both portals) — this was flagged as deliberately deferred, not
// forgotten, in that component's own header comment. No client-scoping
// needed here either — ops already sees every client's tax invoices
// unfiltered.
export function OpsTaxInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const taxInvoices = useTaxInvoices();

  const taxInvoice = taxInvoices.find((t) => t.id === id);

  // Same header pattern as QuotationDetailPage/InvoiceDetailPage (client) —
  // doc type as the title, the booking it belongs to as the subtitle.
  usePageHeader(taxInvoice ? "Tax Invoice" : undefined, taxInvoice?.bookingId ?? "");

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 mb-4 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {taxInvoice ? (
        <TaxInvoiceDetail taxInvoice={taxInvoice} />
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Tax invoice not found"
            subtitle={`${id ?? "This tax invoice"} doesn't exist.`}
            action={{ label: "Go to Tax Invoices", to: "/ops/documents/tax-invoices" }}
          />
        </div>
      )}
    </div>
  );
}
