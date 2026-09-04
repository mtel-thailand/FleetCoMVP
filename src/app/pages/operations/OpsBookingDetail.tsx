import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/Button";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useBookings } from "@/app/lib/bookingsStore";
import { useVehicles } from "@/app/lib/vehiclesStore";
import { useDrivers } from "@/app/lib/driversStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { useClients } from "@/app/lib/clientsStore";
import { clientNavSection } from "@/app/data/bookings";
import { OpsBookingDetailPanel } from "@/app/components/operations/OpsBookingDetailPanel";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// Routed landing spot for a single booking on the ops side — reachable from
// All Requests or All Rentals (row click, whichever the booking's current
// status belongs to) and from useOpenBookingFromDocument's cross-page
// handoff (a quotation/invoice's "For {bookingId}" link), FleetCalendar,
// and OpsTaxInvoices. Same thin-page shape as
// BookingDetail.tsx (the client-portal equivalent): this owns the lookup
// and data-fetching, OpsBookingDetailPanel stays a plain function of
// resolved props. No client-scoping needed — ops already sees every
// client's bookings unfiltered.
export function OpsBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const bookings = useBookings();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const quotations = useQuotations();
  const invoices = useInvoices();
  const taxInvoices = useTaxInvoices();
  const clients = useClients();

  const booking = bookings.find((b) => b.id === id);
  const client = booking ? clients.find((c) => c.id === booking.clientId) : undefined;
  const origin = location.state as { returnTo?: string; returnLabel?: string; returnState?: unknown } | null;
  const returnTo = origin?.returnTo?.startsWith("/ops/") ? origin.returnTo : undefined;
  const returnLabel = returnTo ? origin?.returnLabel : undefined;

  // Same treatment as BookingDetail.tsx's own usePageHeader call — the top
  // header used to just fall back to the generic "FleetCo Platform" title
  // on this page, since nothing here ever set it. "All Requests"/"All
  // Rentals", matching the sidebar items' own real labels exactly, same
  // reasoning as that file's own comment on why it's the full name and not
  // a shortened one.
  usePageHeader(
    booking?.id,
    booking ? (returnLabel ?? (clientNavSection(booking) === "requests" ? "All Requests" : "All Rentals")) : "",
  );

  // Same clientNavSection-derived destination as BookingDetail.tsx's own
  // handleBack, not raw navigate(-1) — real browser history can go stale
  // here exactly the same way it could there: reach this booking from All
  // Requests while it's still Requested, quote it, and by the time you
  // click Back it's Quoted (still Requests, fine) — but reach it some
  // other way (a document's "For {id}" link, a notification, a typed URL)
  // after it's since moved to Accepted/Assigned, and "-1" could land
  // anywhere, not necessarily the list it now actually belongs to.
  function handleBack() {
    if (returnTo) {
      navigate(returnTo, { state: origin?.returnState });
      return;
    }
    if (!booking) {
      navigate(-1);
      return;
    }
    navigate(clientNavSection(booking) === "requests" ? "/ops/requests" : "/ops/rentals");
  }

  return (
    <div>
      <Button variant="ghost" size="icon" className="flex items-center gap-1.5 text-xs mb-4"
        onClick={handleBack}
      >
        <ArrowLeft size={14} /> {returnLabel ? `Back to ${returnLabel}` : "Back"}
      </Button>

      {booking ? (
        <OpsBookingDetailPanel
          booking={booking}
          vehicles={vehicles}
          drivers={drivers}
          quotations={quotations}
          invoices={invoices}
          taxInvoices={taxInvoices}
          client={client}
          allBookings={bookings}
        />
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Booking not found"
            subtitle={`${id ?? "This booking"} doesn't exist.`}
            action={{ label: "Go to All Requests", to: "/ops/requests" }}
          />
        </div>
      )}
    </div>
  );
}
