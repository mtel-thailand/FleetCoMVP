import { useNavigate, useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useQuotations } from "@/app/lib/quotationsStore";
import { QuotationDetail } from "@/app/components/documents/QuotationDetail";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// Ops-side equivalent of QuotationDetailPage.tsx — same thin-page shape,
// reachable from Quotations (row click) and useOpenQuotation's cross-page
// handoff. No client-scoping needed here (unlike the portal page): ops
// already sees every client's quotations unfiltered.
export function OpsQuotationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const quotations = useQuotations();

  const quotation = quotations.find((q) => q.id === id);

  // Same header pattern as QuotationDetailPage.tsx (client) — doc type as
  // the title, the booking it belongs to as the subtitle. Used to fall back
  // to the generic "FleetCo Platform" title here since nothing set it.
  usePageHeader(quotation ? "Quotation" : undefined, quotation?.bookingId ?? "");

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 mb-4 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {quotation ? (
        <QuotationDetail quotation={quotation} />
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Quotation not found"
            subtitle={`${id ?? "This quotation"} doesn't exist.`}
            action={{ label: "Go to Quotations", to: "/ops/documents/quotations" }}
          />
        </div>
      )}
    </div>
  );
}
