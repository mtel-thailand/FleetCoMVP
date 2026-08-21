import { useNavigate, useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useInvoices } from "@/app/lib/invoicesStore";
import { InvoiceDetail } from "@/app/components/documents/InvoiceDetail";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// Ops-side equivalent of InvoiceDetailPage.tsx — same thin-page shape,
// reachable from Invoices (row click) and useOpenInvoice's cross-page
// handoff. No client-scoping needed (ops sees every client unfiltered).
export function OpsInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoices = useInvoices();

  const invoice = invoices.find((i) => i.id === id);

  // Same header pattern as InvoiceDetailPage.tsx (client) — doc type as the
  // title, the booking it belongs to as the subtitle.
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
            subtitle={`${id ?? "This invoice"} doesn't exist.`}
            action={{ label: "Go to Invoices", to: "/ops/documents/invoices" }}
          />
        </div>
      )}
    </div>
  );
}
