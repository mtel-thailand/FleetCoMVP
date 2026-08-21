import { useNavigate, useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useInvoices } from "@/app/lib/invoicesStore";
import { CLIENT_ID } from "@/app/lib/currentClient";
import { InvoiceDetail } from "@/app/components/documents/InvoiceDetail";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// Routed landing spot for a single invoice — same shape as
// QuotationDetailPage.tsx, reachable from Invoices (row click) and from
// useOpenInvoice's cross-page handoff. Scoped to this client's own invoices
// (id *and* clientId) so a URL edit can't reach another client's invoice.
export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoices = useInvoices();

  const invoice = invoices.find((i) => i.id === id && i.clientId === CLIENT_ID);

  // Same header pattern as QuotationDetailPage — doc type as the title,
  // the booking it belongs to as the subtitle.
  usePageHeader(invoice ? "Invoice" : undefined, invoice?.bookingId ?? "");

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 mb-4 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {invoice ? (
        <InvoiceDetail invoice={invoice} />
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Invoice not found"
            subtitle={`${id ?? "This invoice"} doesn't exist or isn't visible to your account.`}
            action={{ label: "Go to Invoices & Payments", to: "/portal/documents/invoices" }}
          />
        </div>
      )}
    </div>
  );
}
