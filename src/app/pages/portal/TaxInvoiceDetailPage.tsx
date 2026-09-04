import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/Button";
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
  const location = useLocation();
  const taxInvoices = useTaxInvoices();

  const taxInvoice = taxInvoices.find((t) => t.id === id && t.clientId === CLIENT_ID);
  const routeState = location.state as {
    fromBookingId?: string;
    navPath?: string;
    returnTo?: string;
    returnLabel?: string;
    returnState?: unknown;
  } | null;
  const returnTo = routeState?.returnTo?.startsWith("/portal/") ? routeState.returnTo : undefined;

  function handleBack() {
    if (returnTo) {
      navigate(returnTo, { state: routeState?.returnState });
      return;
    }
    if (routeState?.fromBookingId) {
      navigate(`/portal/bookings/${routeState.fromBookingId}`, { state: routeState.returnState });
      return;
    }
    if (routeState?.navPath?.startsWith("/portal/")) {
      navigate(routeState.navPath);
      return;
    }
    navigate("/portal/documents/invoices");
  }

  // Same header pattern as QuotationDetailPage/InvoiceDetailPage.
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
            subtitle={`${id ?? "This tax invoice"} doesn't exist or isn't visible to your account.`}
            action={{ label: "Go to Invoices & Payments", to: "/portal/documents/invoices" }}
          />
        </div>
      )}
    </div>
  );
}
