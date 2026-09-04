import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/Button";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useQuotations } from "@/app/lib/quotationsStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { bookingNavPath } from "@/app/data/bookings";
import { CLIENT_ID } from "@/app/lib/currentClient";
import { QuotationDetail } from "@/app/components/documents/QuotationDetail";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// Routed landing spot for a single quotation — reachable from Quotations
// (row click) and from useOpenQuotation's cross-page handoff (a booking's
// own Documents list, or the header's "View Quotation" action). Same
// thin-page shape as BookingDetail.tsx: this owns the lookup, the
// presentational QuotationDetail stays a plain function of a resolved
// object.
//
// Scoped to this client's own quotations (id *and* clientId), not just id —
// without that check, editing the URL would let a client view another
// client's quotation. Ops's equivalent page has no such scoping, since ops
// already sees every client unfiltered.
export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const quotations = useQuotations();
  const bookings = useBookings();

  const quotation = quotations.find((q) => q.id === id && q.clientId === CLIENT_ID);
  const routeState = location.state as { fromBookingId?: string; navPath?: string; returnTo?: string; returnLabel?: string; returnState?: unknown } | null;
  const fallbackPath = bookingNavPath(quotation?.bookingId, bookings, "client") ?? "/portal/requests";
  const fallbackLabel = fallbackPath === "/portal/rentals" ? "My Rentals" : "My Requests";

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
    navigate(fallbackPath);
  }

  // Header leads with what kind of document this is rather than the
  // document's own id (the reverse of BookingDetail's header, one level
  // up) — subtitle is the booking it belongs to, matching the "For BK-..."
  // link QuotationDetail's own body already shows, just promoted into the
  // persistent header too.
  usePageHeader(quotation ? "Quotation" : undefined, quotation?.bookingId ?? "");

  return (
    <div>
      <Button variant="ghost" size="icon" className="flex items-center gap-1.5 text-xs mb-4"
        onClick={handleBack}
      >
        <ArrowLeft size={14} /> {routeState?.returnTo && routeState.returnLabel ? `Back to ${routeState.returnLabel}` : routeState?.fromBookingId ? "Back to Booking" : `Back to ${fallbackLabel}`}
      </Button>

      {quotation ? (
        <QuotationDetail quotation={quotation} />
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Quotation not found"
            subtitle={`${id ?? "This quotation"} doesn't exist or isn't visible to your account.`}
            action={{ label: "Go to My Requests", to: "/portal/requests" }}
          />
        </div>
      )}
    </div>
  );
}
