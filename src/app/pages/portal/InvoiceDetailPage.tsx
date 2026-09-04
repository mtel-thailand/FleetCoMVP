import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/Button";
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
  const location = useLocation();
  const invoices = useInvoices();

  const invoice = invoices.find((i) => i.id === id && i.clientId === CLIENT_ID);
  const routeState = location.state as { fromBookingId?: string; navPath?: string; returnTo?: string; returnLabel?: string; returnState?: unknown } | null;

  function handleBack() {
    if (routeState?.returnTo?.startsWith("/portal/")) {
      navigate(routeState.returnTo, { state: routeState.returnState });
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

  // Same header pattern as QuotationDetailPage — doc type as the title,
  // the booking it belongs to as the subtitle.
  usePageHeader(invoice ? "Invoice" : undefined, invoice?.bookingId ?? "");

  return (
    <div>
      <Button variant="ghost" size="icon" className="flex items-center gap-1.5 text-xs mb-4"
        onClick={handleBack}
      >
        <ArrowLeft size={14} /> {routeState?.returnTo && routeState.returnLabel ? `Back to ${routeState.returnLabel}` : routeState?.fromBookingId ? "Back to Booking" : "Back to Invoices & Payments"}
      </Button>

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
