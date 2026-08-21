import { useNavigate, useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { CLIENT_ID } from "@/app/lib/currentClient";
import { TaxInvoiceDetail } from "@/app/components/documents/TaxInvoiceDetail";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// Routed landing spot for a single tax invoice — same shape as
// QuotationDetailPage.tsx/InvoiceDetailPage.tsx, reachable from Tax
// Invoices (row click). Scoped to this client's own tax invoices (id *and*
// clientId) so a URL edit can't reach another client's.
export function TaxInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const taxInvoices = useTaxInvoices();

  const taxInvoice = taxInvoices.find((t) => t.id === id && t.clientId === CLIENT_ID);

  // Same header pattern as QuotationDetailPage/InvoiceDetailPage.
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
            subtitle={`${id ?? "This tax invoice"} doesn't exist or isn't visible to your account.`}
            action={{ label: "Go to Invoices & Payments", to: "/portal/documents/invoices" }}
          />
        </div>
      )}
    </div>
  );
}
