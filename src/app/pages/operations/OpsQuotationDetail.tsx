import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/Button";
import { ArrowLeft, FileQuestion, FilePlus2 } from "lucide-react";
import { isQuotationExpired } from "@/app/data/quotations";
import { useBookings } from "@/app/lib/bookingsStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { QuotationDetail } from "@/app/components/documents/QuotationDetail";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";
import { formatDate, localDateKey } from "@/app/components/ui/utils";

// Ops-side equivalent of QuotationDetailPage.tsx — same thin-page shape,
// reachable from Quotations (row click) and useOpenQuotation's cross-page
// handoff. No client-scoping needed here (unlike the portal page): ops
// already sees every client's quotations unfiltered.
export function OpsQuotationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const bookings = useBookings();
  const quotations = useQuotations();

  const quotation = quotations.find((q) => q.id === id);
  const booking = quotation ? bookings.find((candidate) => candidate.id === quotation.bookingId) : undefined;
  const canIssueRevision = !!quotation && !!booking && isQuotationExpired(quotation) && booking.startDate >= localDateKey();
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
    navigate("/ops/requests");
  }

  const expiredNotice = quotation && isQuotationExpired(quotation) ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
      <span>
        This quotation expired on {formatDate(quotation.validUntil)}.
        {canIssueRevision ? " Issue a new version before asking the client to approve it." : " The rental start date has passed, so this request is closed."}
      </span>
      {canIssueRevision && (
        <button
          type="button"
          onClick={() => navigate(`/ops/bookings/${quotation.bookingId}/quotation/new`, {
            state: {
              returnTo: `/ops/documents/quotations/${quotation.id}`,
              returnLabel: "Quotation",
              ...(routeState?.navPath?.startsWith("/ops/") ? { navPath: routeState.navPath } : {}),
              ...(location.state ? { returnState: location.state } : {}),
            },
          })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 cursor-pointer"
        >
          <FilePlus2 size={13} /> Issue revision
        </button>
      )}
    </div>
  ) : undefined;

  // Same header pattern as QuotationDetailPage.tsx (client) — doc type as
  // the title, the booking it belongs to as the subtitle. Used to fall back
  // to the generic "FleetCo Platform" title here since nothing set it.
  usePageHeader(quotation ? "Quotation" : undefined, quotation?.bookingId ?? "");

  return (
    <div>
      <Button variant="ghost" size="icon" className="flex items-center gap-1.5 text-xs mb-4"
        onClick={handleBack}
      >
        <ArrowLeft size={14} /> {routeState?.returnTo && routeState.returnLabel ? `Back to ${routeState.returnLabel}` : routeState?.fromBookingId ? "Back to Booking" : "Back to All Requests"}
      </Button>

      {quotation ? (
        <>
          <QuotationDetail quotation={quotation} showExpiredNotice={false} headerNotice={expiredNotice} />
        </>
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Quotation not found"
            subtitle={`${id ?? "This quotation"} doesn't exist.`}
            action={{ label: "Go to All Requests", to: "/ops/requests" }}
          />
        </div>
      )}
    </div>
  );
}
