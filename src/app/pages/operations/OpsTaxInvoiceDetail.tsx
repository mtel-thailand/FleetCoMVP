import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/Button";
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
  const location = useLocation();
  const taxInvoices = useTaxInvoices();

  const taxInvoice = taxInvoices.find((t) => t.id === id);
  const routeState = location.state as {
    fromBookingId?: string;
    navPath?: string;
    returnTo?: string;
    returnLabel?: string;
    returnState?: unknown;
  } | null;
  const returnTo = routeState?.returnTo?.startsWith("/ops/") ? routeState.returnTo : undefined;

  function handleBack() {
    if (returnTo) {
      navigate(returnTo, { state: routeState?.returnState });
      return;
    }
    if (routeState?.fromBookingId) {
      navigate(`/ops/bookings/${routeState.fromBookingId}`, { state: routeState.returnState });
      return;
    }
    if (routeState?.navPath?.startsWith("/ops/")) {
      navigate(routeState.navPath);
      return;
    }
    navigate("/ops/documents/invoices");
  }

  // Same header pattern as QuotationDetailPage/InvoiceDetailPage (client) —
  // doc type as the title, the booking it belongs to as the subtitle.
  usePageHeader(taxInvoice ? "Tax Invoice" : undefined, taxInvoice?.bookingId ?? "");

  return (
    <div>
      <Button variant="ghost" size="icon" className="flex items-center gap-1.5 text-xs mb-4"
        onClick={handleBack}
      >
        <ArrowLeft size={14} /> {returnTo && routeState?.returnLabel ? `Back to ${routeState.returnLabel}` : routeState?.fromBookingId ? "Back to Booking" : "Back to Invoices & Payments"}
      </Button>

      {taxInvoice ? (
        <TaxInvoiceDetail taxInvoice={taxInvoice} />
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Tax invoice not found"
            subtitle={`${id ?? "This tax invoice"} doesn't exist.`}
            action={{ label: "Go to Invoices & Payments", to: "/ops/documents/invoices" }}
          />
        </div>
      )}
    </div>
  );
}
