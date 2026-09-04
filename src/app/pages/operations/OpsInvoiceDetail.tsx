import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/Button";
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
  const location = useLocation();
  const invoices = useInvoices();

  const invoice = invoices.find((i) => i.id === id);
  const routeState = location.state as { fromBookingId?: string; navPath?: string; returnTo?: string; returnLabel?: string; returnState?: unknown } | null;

  function handleBack() {
    if (routeState?.returnTo?.startsWith("/ops/")) {
      navigate(routeState.returnTo, { state: routeState.returnState });
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

  // Same header pattern as InvoiceDetailPage.tsx (client) — doc type as the
  // title, the booking it belongs to as the subtitle.
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
            subtitle={`${id ?? "This invoice"} doesn't exist.`}
            action={{ label: "Go to Invoices & Payments", to: "/ops/documents/invoices" }}
          />
        </div>
      )}
    </div>
  );
}
