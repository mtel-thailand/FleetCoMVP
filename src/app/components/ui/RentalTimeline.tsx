import { Clock, ClipboardCheck, FileText, FileCheck2, XCircle, Truck, Calendar, CheckCircle2, type LucideIcon } from "lucide-react";
import { bookingStatusLabel, type Booking } from "@/app/data/bookings";
import { quotationTotals, type Quotation } from "@/app/data/quotations";
import { formatCurrency } from "@/app/data/formatters";
import { formatDate } from "./utils";

export type TimelineEntry = {
  label: string;
  detail?: string;
  timestamp: string;
  icon: LucideIcon;
  tone: "default" | "positive" | "negative" | "rejected" | "cancelled";
};

// A rental's own story — request through completion — not a mixed log of
// rental *and* billing events. Invoice/payment history used to live here
// too (issued/submitted/verified/rejected), but that's exactly what the
// Documents section and Invoices & Payments already show, one click away —
// repeating it here just meant the same status was stated twice, and it
// crowded out what this timeline is actually for. If a client wants "is
// this paid," Documents/Finance answers that; this answers "what's
// happened to the rental itself."
//
// Built ONLY from timestamps the data model actually tracks. Request
// submitted (booking.created), Quotation issued/accepted/declined
// (quotation.issuedAt/updated), Driver and Vehicle assigned
// (booking.assignedAt — written once, the one time a booking reaches
// "Assigned"; see that field's own comment on Booking). Rental Period
// started/completed reuse booking.startDate/endDate directly — those are
// already real, stable facts already shown throughout the app (the Rental
// Period column, Rental Details), not new tracking — gated on the booking
// having actually reached Active/Completed respectively, so a booking
// that's merely been *quoted* to start next month doesn't claim its rental
// period already started. Active/Completed are the only statuses that still
// qualify — a booking's own status is terminal at Completed (billing
// progress past that point lives on the Invoice record, not here — see
// bookingStatus.ts's own header comment), so there's no later status left
// to gate on.

export function buildRentalTimeline(booking: Booking, quotations: Quotation[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    // Vehicle class/qty/notes deliberately left out here — they're already
    // one scroll away in Rental Details, and this entry's job is just to say
    // who started the case, not restate the whole request.
    { label: "Request submitted", detail: `Requested by ${booking.requestedByName}.`, timestamp: booking.created, icon: ClipboardCheck, tone: "default" },
  ];

  for (const quotation of quotations) {
    const total = formatCurrency(quotationTotals(quotation).grandTotal);
    entries.push({
      label: "Quotation issued",
      detail: `${total} quoted.`,
      timestamp: quotation.issuedAt ?? quotation.created,
      icon: FileText,
      tone: "default",
    });
    if (quotation.status === "Accepted") {
      entries.push({ label: "Quotation accepted", detail: `Accepted at ${total}.`, timestamp: quotation.updated, icon: FileCheck2, tone: "default" });
    } else if (quotation.status === "Declined") {
      entries.push({ label: "Quotation declined", detail: booking.declineReason, timestamp: quotation.updated, icon: XCircle, tone: "negative" });
    }
  }

  const bookingLabel = bookingStatusLabel(booking);
  if (booking.status === "Cancelled") {
    entries.push({
      label: "Request cancelled",
      detail: booking.declineReason,
      timestamp: booking.updated,
      icon: XCircle,
      tone: "cancelled",
    });
  } else if (bookingLabel === "Rejected") {
    entries.push({
      label: "Request rejected",
      detail: booking.declineReason,
      timestamp: booking.updated,
      icon: XCircle,
      tone: "rejected",
    });
  }

  if (booking.assignedAt) {
    const count = booking.assignments?.length ?? 0;
    entries.push({
      label: "Driver and Vehicle assigned",
      // Always shown, not just for count > 1 — every other entry here
      // (Request submitted, Quotation issued/accepted) always carries a
      // detail line, so this one being conditional was the odd one out
      // sitting in the same list. "Vehicle and driver," not "vehicle+driver
      // unit" — plain English instead of the internal pairing term this
      // codebase uses for the {vehicleId, driverId} data shape.
      detail: count === 1 ? "1 vehicle and driver assigned." : `${count} vehicles and drivers assigned.`,
      timestamp: booking.assignedAt,
      icon: Truck,
      tone: "default",
    });
  }

  if (booking.status === "Active" || booking.status === "Completed") {
    entries.push({ label: "Rental Period started", timestamp: booking.startDate, icon: Calendar, tone: "default" });
  }
  if (booking.status === "Completed") {
    entries.push({ label: "Rental Period completed", timestamp: booking.endDate, icon: CheckCircle2, tone: "positive" });
  }

  // Newest first — reads like an activity feed (what just happened, right at
  // the top) rather than a story you have to scroll to the bottom to catch
  // up on. The connector line/spacing in RentalTimeline below don't care
  // which direction is "chronological," they just link whatever renders
  // adjacent.
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

const TONE_CLASSES: Record<TimelineEntry["tone"], string> = {
  default: "bg-slate-100 text-slate-500",
  positive: "bg-emerald-100 text-emerald-600",
  negative: "bg-rose-100 text-rose-600",
  rejected: "bg-orange-100 text-orange-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export function RentalTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div>
      {entries.map((entry, i) => {
        const Icon = entry.icon;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              {/* Smaller, quieter marker than before (was w-7/size-13) — the
                  icon still differentiates event *type* at a glance, it just
                  no longer out-competes the text next to it for attention. */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${TONE_CLASSES[entry.tone]}`}>
                <Icon size={10} />
              </div>
              {i < entries.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            {/* min-h-[50px], not just "however tall a 2-line entry's content
                is" — this div is border-box, so its own pb-4 (16px) counts
                toward that height too. A label-only entry (no detail line,
                e.g. "Rental Period started") is 1 line, ~34px including that
                padding; a label+detail entry (e.g. "Quotation accepted") is
                2 lines, ~50px including it. The connector line next to each
                entry stretches to match whatever this block ends up, so
                without the padding folded into the target, short entries
                still landed short and the gaps stayed uneven. Only applied
                alongside pb-4 itself (i.e. skipped on the last entry, which
                has no connector below it to balance). */}
            <div className={`flex-1 flex items-start justify-between gap-3 min-w-0 ${i < entries.length - 1 ? "min-h-[50px] pb-4" : ""}`}>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800">{entry.label}</p>
                {entry.detail && <p className="text-xs text-slate-500 mt-0.5">{entry.detail}</p>}
              </div>
              <p className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap flex items-center gap-1 pt-0.5">
                <Clock size={10} />
                {formatDate(entry.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
