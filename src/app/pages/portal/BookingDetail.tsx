import { useNavigate, useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useBookings } from "@/app/lib/bookingsStore";
import { useVehicles } from "@/app/lib/vehiclesStore";
import { useDrivers } from "@/app/lib/driversStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { CLIENT_ID } from "@/app/lib/currentClient";
import { clientNavSection } from "@/app/data/bookings";
import { ClientBookingDetail } from "@/app/components/portal/ClientBookingDetail";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// The routed landing spot for a single booking — reachable from My Requests,
// My Rentals, and Billing History (all three now navigate here on row click
// instead of holding local `selectedId` state + rendering ClientBookingDetail
// inline as a modal), and from useOpenBookingFromDocument's cross-page
// handoff (a Quotation/Invoice's "For BK-..." link). One real URL regardless
// of entry point, so it works with the browser's own Back button and can be
// shared/bookmarked/reloaded — none of which a modal could offer.
export function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookings = useBookings();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const quotations = useQuotations();
  const invoices = useInvoices();
  const taxInvoices = useTaxInvoices();

  const booking = bookings.find((b) => b.id === id && b.clientId === CLIENT_ID);

  // Top header shows the booking's own id, and — this is also what keeps
  // Sidebar.tsx's My Requests/My Rentals highlighted correctly while on
  // this page, see clientNavSection's own comment — whichever of the two
  // it currently belongs to, not a static "FleetCo Platform"/blank pair.
  // "My Requests"/"My Rentals", not the shortened "Requests"/"Rentals" —
  // matching the sidebar item's own real label exactly, since this
  // subtitle is standing in for "which page this belongs under."
  usePageHeader(booking?.id, booking ? (clientNavSection(booking.status) === "requests" ? "My Requests" : "My Rentals") : "");

  // Repeat exits to My Requests specifically (not back to wherever this page
  // was reached from) — that's the one place "New Request" actually lives,
  // regardless of whether the original booking is a request or a rental now.
  // MyRequests.tsx auto-opens that modal on mount when it finds this same
  // repeatBookingId key waiting, same handoff RequestVehicle.tsx already
  // reads once to prefill the form — set here, consumed there.
  function handleRepeat() {
    if (!booking) return;
    sessionStorage.setItem("repeatBookingId", booking.id);
    navigate("/portal/requests");
  }

  // Not plain navigate(-1) — real browser history is "wherever you came
  // from," and that can go stale while this page is open: arrive from My
  // Requests on a Quoted booking, accept its quotation from here, and
  // history-back would return to My Requests even though the booking no
  // longer appears there (it now lives in My Rentals). Same
  // clientNavSection question the header/sidebar already answer live
  // settles where Back actually goes, so it can't point at a list the
  // booking has since moved out of. Falls back to real history only when
  // there's no booking to derive a section from (the not-found case).
  function handleBack() {
    if (!booking) {
      navigate(-1);
      return;
    }
    navigate(clientNavSection(booking.status) === "requests" ? "/portal/requests" : "/portal/rentals");
  }

  return (
    <div>
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 mb-4 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {booking ? (
        <ClientBookingDetail
          booking={booking}
          vehicles={vehicles}
          drivers={drivers}
          quotations={quotations}
          invoices={invoices}
          taxInvoices={taxInvoices}
          onRepeat={handleRepeat}
        />
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Booking not found"
            subtitle={`${id ?? "This booking"} doesn't exist or isn't visible to your account.`}
            action={{ label: "Go to My Requests", to: "/portal/requests" }}
          />
        </div>
      )}
    </div>
  );
}
