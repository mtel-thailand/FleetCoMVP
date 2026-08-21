import { Check } from "lucide-react";
import { BOOKING_STATUS_FLOW, type BookingStatus } from "@/app/data/bookingStatus";

// Horizontal step tracker for the booking's own status (Requested→Completed
// — see bookingStatus.ts's own header comment for why it never goes further
// than that). Billing status is InvoiceProgress's job, driven by the
// invoice's own status, not this component's. Shared by
// the ops Booking Detail panel and the client's booking detail modal so
// "where is this rental right now" reads identically on both sides.
// Declined/Cancelled are branches off the main chain, not a stop along it —
// showing them as a half-finished stepper would misrepresent what happened,
// so they get a distinct, non-stepper treatment instead.
export function BookingProgress({ status }: { status: BookingStatus }) {
  if (status === "Declined" || status === "Cancelled") {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
        {/* Deliberately not "by client" — Declined now also covers FleetCo
            rejecting a raw request outright (no quotation ever existed),
            not just a client declining an issued quotation. */}
        <p className="text-xs font-medium text-slate-500">
          {status} — this booking did not proceed further.
        </p>
      </div>
    );
  }

  const currentIndex = BOOKING_STATUS_FLOW.indexOf(status);

  return (
    <div className="bg-white border border-slate-200 rounded-xl py-4 overflow-x-auto" aria-label="Rental progress">
      <div className="grid grid-cols-6 min-w-[420px] px-3 sm:px-4">
        {BOOKING_STATUS_FLOW.map((step, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;
          return (
            <div key={step} className="relative flex flex-col items-center min-w-0">
              {index < BOOKING_STATUS_FLOW.length - 1 && (
                <div
                  className={`absolute top-3 left-[calc(50%+12px)] right-[calc(-50%+12px)] h-0.5 ${
                    index < currentIndex ? "bg-[var(--portal-accent)]" : "bg-slate-200"
                  }`}
                />
              )}
              <div
                className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ring-4 ring-white ${
                  complete
                    ? "bg-[var(--portal-accent)] text-white"
                    : current
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {complete ? <Check size={12} strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={`mt-2 text-[9px] sm:text-[10px] font-medium text-center truncate max-w-full ${
                  current ? "text-slate-900" : complete ? "text-[var(--portal-accent)]" : "text-slate-400"
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
