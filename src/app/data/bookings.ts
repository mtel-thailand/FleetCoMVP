// Bookings — the central entity. Brief §3: "Every rental = one vehicle + one
// dedicated driver, booked as a single unit." One mock row per status so any
// screen built against this file can exercise the full chain immediately.
import { ALL_BOOKING_STATUSES, type BookingStatus } from "./bookingStatus";
import type { VehicleClass } from "./vehicles";
import type { Quotation } from "./quotations";
import type { Invoice } from "./invoices";
import type { TaxInvoice } from "./taxInvoices";
import { rebaseDemoDates } from "./demoDates";

export type RentalType = "Ad hoc / Daily" | "Short term" | "Medium term" | "Long term";

// One pair per unit — a quantity>1 booking (e.g. "Van × 2") assigns a
// *different* vehicle and driver to each unit; they don't share one. Kept as
// an explicit {vehicleId, driverId} pair rather than two parallel arrays so
// the two can't drift out of index-sync with each other.
export type VehicleDriverAssignment = { vehicleId: string; driverId: string };
export type CancellationActor = "client" | "fleetco";

export type Booking = {
  id: string;
  clientId: string;
  requestedByName: string;
  rentalType: RentalType;
  vehicleClassRequested: VehicleClass;
  quantity: number;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  // Legal tax-registration branch selected for billing documents. Separate
  // from pickupLocation, which is the physical vehicle delivery site.
  taxBranchId?: string;
  jobNotes: string;
  status: BookingStatus;
  // Length grows toward `quantity` as ops assigns each unit — a booking can
  // sit with e.g. 1 of 2 units assigned mid-flow, same as the single-pair
  // model before it, just no longer capped at exactly one pair. Undefined
  // (not an empty array) before the first unit is assigned, matching how
  // vehicleId/driverId were both simply absent pre-assignment.
  assignments?: VehicleDriverAssignment[];
  // Set once, the moment a booking first reaches "Assigned" (see
  // OpsBookingDetailPanel.tsx's handleAssign) — unlike `updated`, which gets
  // overwritten by every later transition, this stays put once written, so
  // RentalTimeline.tsx can show a real "Driver and Vehicle assigned" date
  // even for a booking that's since gone Active/Completed/Closed. Undefined
  // for anything that hasn't reached Assigned yet, same absent-until-it-
  // happens convention as assignments itself.
  // Invariant worth being deliberate about when hand-authoring seed data (the
  // live handleAssign flow already guarantees this for free, since assigning
  // is only reachable after a quotation is Accepted): assignedAt must be
  // strictly later than this booking's own quotation's acceptance timestamp
  // (quotation.updated when status is "Accepted") — a vehicle+driver can't be
  // assigned to a booking whose quotation hasn't been accepted yet.
  assignedAt?: string;
  // Same "survives later transitions" reasoning as assignedAt, for the same
  // reason: RentalTimeline needs the real moment Start Rental / Complete
  // Rental were actually confirmed, not booking.startDate/endDate (the
  // plan) — those used to double as this timeline's timestamps too, back
  // when Start/Complete were assumed to happen exactly on schedule. They
  // don't; both are manual-only precisely because a click, not a calendar
  // date, is what's trustworthy here (see the Assignment section's
  // "started early"/"overdue to start"/"overdue to complete" states, all of
  // which are evidence the two diverge in practice). completedAt in
  // particular can't just fall back on `updated` either, even though
  // Completed is terminal today and nothing currently mutates a booking
  // after it — that's a fact about today's call sites, not a guarantee this
  // field should depend on. Undefined for anything that hasn't reached
  // Active/Completed yet, or for older records from before this field
  // existed; RentalTimeline falls back to startDate/endDate for those.
  startedAt?: string;
  completedAt?: string;
  quotationId?: string;
  invoiceId?: string;
  taxInvoiceId?: string;
  isRecurringBilling: boolean;
  declineReason?: string;
  // Cancellation keeps its lifecycle origin because the same terminal
  // status can belong to either My Requests or My Rentals.
  cancelledFromStatus?: BookingStatus;
  cancelledBy?: CancellationActor;
  cancelledAt?: string;
  cancellationReason?: string;
  created: string;
  updated: string;
};

// A booking's own quotationId/invoiceId/taxInvoiceId fields are a "most
// recent" convenience pointer, written whenever a new document is issued —
// not the source of truth for what documents actually exist. That matters
// specifically for invoices: isRecurringBilling bookings generate a new
// invoice every cycle, so a single forward pointer can only ever point at
// the latest one, silently dropping every earlier cycle the moment a new
// one is issued. These read from each document's own bookingId
// back-reference instead, so a recurring booking's full invoice history
// (and, eventually, multiple tax invoices) stays visible and actionable
// rather than disappearing behind whichever ID happened to be written last.
// Sorted newest-first — callers wanting "the current one" just take [0].
export function bookingQuotations(bookingId: string, quotations: Quotation[]): Quotation[] {
  return quotations.filter((q) => q.bookingId === bookingId).sort((a, b) => (b.issuedAt ?? b.created).localeCompare(a.issuedAt ?? a.created));
}
export function bookingInvoices(bookingId: string, invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => i.bookingId === bookingId).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}
export function bookingTaxInvoices(bookingId: string, taxInvoices: TaxInvoice[]): TaxInvoice[] {
  return taxInvoices.filter((t) => t.bookingId === bookingId).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

// ── Rental status vs. billing status ─────────────────────────────────────
// booking.status only ever tracks rental/operational progress (Requested
// through Completed, plus the terminal Declined/Cancelled) — nothing
// mutates it to reflect a billing milestone, and BookingStatus itself no
// longer has Invoiced/Paid/Closed members to mutate it to (see
// bookingStatus.ts's own header comment — they were retired once every
// seed booking that used to sit on them was migrated to "Completed").
// Billing progress lives entirely in the invoice/tax-invoice records,
// tracked independently, for every booking, recurring or not — a one-off
// booking invoiced early (see invoiceEligible) just stays "Active" or
// "Completed" for as long as it takes to get paid and closed out, the same
// way a recurring booking stays "Active" for its whole life. That's what
// lets a rental's physical progress and its money's progress move at
// different speeds, which is the actual point of tracking them separately
// rather than one shared field.

/** Once a booking has a vehicle+driver assigned, FleetCo can invoice it —
 *  billing doesn't have to wait for the rental to finish. A recurring
 *  booking bills in arrears (brief §3's "invoiced monthly"), so its first
 *  cycle isn't eligible until the rental has actually started. */
export function invoiceEligible(booking: Booking): boolean {
  if (booking.isRecurringBilling) return booking.status === "Active";
  return booking.status === "Assigned" || booking.status === "Active" || booking.status === "Completed";
}

/** Does this booking currently need FleetCo to do something, on either the
 *  rental track or the billing track? Powers the "Needs FleetCo Action" tab
 *  on both AllRequests.tsx and AllRentals.tsx — replaces a plain
 *  status-keyed lookup table, which can't express "the rental is Active
 *  but there's an unpaid invoice sitting on it" (client's turn) vs. "...and
 *  the invoice was just verified" (FleetCo's turn) from status alone. */
export function needsFleetCoAction(booking: Booking, invoices: Invoice[], taxInvoices: TaxInvoice[]): boolean {
  if (booking.status === "Requested" || booking.status === "Accepted") return true;
  if (booking.status === "Quoted" || booking.status === "Declined" || booking.status === "Cancelled") return false;

  const latest = bookingInvoices(booking.id, invoices)[0];
  if (latest?.status === "Payment Submitted") return true;
  if (latest?.status === "Paid") {
    return !bookingTaxInvoices(booking.id, taxInvoices).some((t) => t.invoiceId === latest.id);
  }
  // client's turn — Payment Issue included: a rejected claim is still
  // theirs to resubmit, not FleetCo's move again until they do.
  if (latest && (latest.status === "Unpaid" || latest.status === "Overdue" || latest.status === "Payment Issue")) return false;

  return invoiceEligible(booking);
}

/** Display-only split of terminal booking outcomes — FleetCo rejecting a raw request
 *  outright (no quotationId, never priced) reads as a different kind of "no"
 *  than a client declining an actual quotation, and the two are worth
 *  telling apart at a glance (capacity/fleet problem vs. a pricing one),
 *  not just in the reason text one click deeper (see the "Rejection
 *  reason:"/"Decline reason:" split in ClientBookingDetail.tsx/
 *  RequestInbox.tsx, which this mirrors). Deliberately NOT a new
 *  BookingStatus value — status itself, BOOKING_STATUS_PRIORITY,
 *  BOOKING_STATUS_TRANSITIONS, REQUEST_STATUSES, and every status filter
 *  stay exactly as they are; this only changes what StatusBadge renders.
 *  "Rejected" already has its own color in StatusBadge's map (orange,
 *  borrowed from the Insurance domain) distinct from "Declined" (rose), so
 *  the two read as different at a glance for free. */
export function bookingStatusLabel(booking: Booking): string {
  if (booking.status === "Declined" && !booking.quotationId) return "Rejected";
  return booking.status;
}

/** FleetCo-facing rental wording. Expose the operational state represented
 *  by Accepted/Assigned instead of the completed actions that produced it. */
export function fleetCoRentalStatusLabel(status: BookingStatus): string {
  if (status === "Accepted") return "Awaiting Assignment";
  if (status === "Assigned") return "Scheduled";
  return status;
}

export function fleetCoBookingStatusLabel(booking: Booking): string {
  const rejectedOrDeclined = bookingStatusLabel(booking);
  if (rejectedOrDeclined !== booking.status) return rejectedOrDeclined;
  return fleetCoRentalStatusLabel(booking.status);
}

/** My Rentals' own simplification, on top of (not instead of) the real
 *  status — client-facing only, ops's own AllRequests/AllRentals still show
 *  Accepted and Assigned as their own distinct statuses, since "is a vehicle
 *  physically assigned yet" is FleetCo's own to-do ("go assign a
 *  vehicle+driver"), not something the client is waiting through as a
 *  separate visible phase. Active and Completed both need no folding at all
 *  — they already read exactly right as-is, so they just fall through to
 *  the final `return status`. Billing progress past Completed is tracked
 *  entirely on its own (InvoiceProgress, Invoices, Billing History), never
 *  on this field — see bookingStatus.ts's own header comment. */
export function clientRentalStatusLabel(status: BookingStatus): string {
  if (status === "Accepted" || status === "Assigned") return "Upcoming";
  return status;
}

/** The full client-portal status label — layers clientRentalStatusLabel on
 *  top of bookingStatusLabel's Rejected/Declined split. Safe to always apply
 *  both in sequence: a booking is never in scope for both at once (Rejected/
 *  Declined only ever fires for status "Declined", which clientRentalStatusLabel
 *  passes straight through untouched; the Upcoming/Completed collapse only
 *  ever fires for statuses bookingStatusLabel already passed straight
 *  through unchanged). Used wherever a client-facing surface can show a
 *  booking from either side of the My Requests/My Rentals split — right now
 *  that's just ClientBookingDetail.tsx's own modal, shared by both lists —
 *  MyRequests.tsx's table keeps calling bookingStatusLabel directly since
 *  every status it can ever show is already a no-op for the Upcoming/
 *  Completed half. */
export function clientBookingStatusLabel(booking: Booking): string {
  const rejectedOrDeclined = bookingStatusLabel(booking);
  if (rejectedOrDeclined !== booking.status) return rejectedOrDeclined;
  return clientRentalStatusLabel(booking.status);
}

// A booking is a "request" only until the client decides on the quotation —
// brief §2 draws this line for the Client Requester role ("track status of
// requests AND active rentals" as two distinct things), and once accepted
// there's nothing left to decide, so it moves on immediately rather than
// waiting for FleetCo to actually assign a vehicle+driver (that boundary is
// FleetCo's own internal to-do, not something the client is waiting through
// as a separate visible phase — see clientRentalStatusLabel above, which
// folds Accepted into "Upcoming" alongside Assigned on the My Rentals side).
// MyRentals.tsx's own local statuses list used to be the complement of this
// one, kept in sync by hand; RENTAL_STATUSES below is now the non-terminal
// rental portion of that complement, computed rather than duplicated, so the
// two can never drift apart. Cancelled is intentionally handled by the
// booking-level predicates below because its destination depends on where it
// occurred in the lifecycle. Lives
// here rather than in MyRequests.tsx (where it used to be defined) because
// Sidebar.tsx and BookingDetail.tsx both need it too now, for the same
// underlying question — a page component isn't the right place for two
// other, unrelated files to import a shared constant from.
export const REQUEST_STATUSES: BookingStatus[] = ["Requested", "Quoted", "Declined"];

// The non-terminal rental statuses — everything from the moment a client has
// nothing left to decide (Accepted) through to Completed. Cancelled is not
// included here because a cancelled booking needs its lifecycle origin to
// decide whether it belongs to Requests or Rentals.
// Ops's own All Requests / All Rentals split (AllRequests.tsx / AllRentals.tsx)
// uses this directly, same partition as the client portal's My Requests / My
// Rentals — one line drawn once, not two definitions of the same line.
export const RENTAL_STATUSES: BookingStatus[] = ALL_BOOKING_STATUSES.filter(
  (s) => !REQUEST_STATUSES.includes(s) && s !== "Cancelled",
);

/** A cancelled booking before acceptance remains request history. Legacy
 * cancelled records without origin metadata default here, preserving the
 * prototype's existing placement until they are migrated. */
export function isRequestBooking(booking: Booking): boolean {
  if (booking.status === "Cancelled") {
    return !booking.cancelledFromStatus || booking.cancelledFromStatus === "Requested" || booking.cancelledFromStatus === "Quoted";
  }
  return REQUEST_STATUSES.includes(booking.status);
}

/** A cancelled booking after acceptance remains rental history. */
export function isRentalBooking(booking: Booking): boolean {
  if (booking.status === "Cancelled") return !isRequestBooking(booking);
  return RENTAL_STATUSES.includes(booking.status);
}

/** Which client-nav section a booking currently belongs to — used by the
 *  Sidebar (which of My Requests/My Rentals stays highlighted while viewing
 *  a specific booking, since /portal/bookings/:id doesn't match either
 *  list's own path) and by BookingDetail's page header (subtitle, next to
 *  the booking's own id as the title). Derived from REQUEST_STATUSES rather
 *  than tracking which list a booking was actually opened from, so it's
 *  correct regardless of entry point — a cross-page link, a bookmark, a
 *  direct URL — not just a direct click from one of the two lists. */
export function clientNavSection(booking: Booking): "requests" | "rentals" {
  return isRequestBooking(booking) ? "requests" : "rentals";
}

// Same status-derived question as clientNavSection, just resolved all the
// way to the sidebar's actual path and starting from an id instead of a
// status in hand — shared by routes.tsx (a route's default nav target) and
// Sidebar.tsx (overriding that default when a document was opened from
// inside its own booking's page — see the comment above that call). Takes
// a portal because both sides now have their own requests/rentals split —
// ops's AllRequests/AllRentals mirrors the client's My Requests/My Rentals,
// same REQUEST_STATUSES line, different base paths.
export function bookingNavPath(bookingId: string | undefined, bookings: Booking[], portal: "client" | "ops" = "client"): string | undefined {
  const booking = bookingId ? bookings.find((b) => b.id === bookingId) : undefined;
  if (!booking) return undefined;
  const isRequest = clientNavSection(booking) === "requests";
  if (portal === "ops") return isRequest ? "/ops/requests" : "/ops/rentals";
  return isRequest ? "/portal/requests" : "/portal/rentals";
}

export const mockBookings: Booking[] = rebaseDemoDates<Booking[]>([
  {
    id: "BK-2026-0001", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Ad hoc / Daily", vehicleClassRequested: "Van", quantity: 2,
    startDate: "2026-08-18", endDate: "2026-08-18",
    pickupLocation: "Bangkok GPO, Charoen Krung Rd", jobNotes: "Overflow parcel run, north Bangkok routes.",
    status: "Requested", isRecurringBilling: false,
    created: "2026-08-14 08:10", updated: "2026-08-14 08:10",
  },
  {
    id: "BK-2026-0002", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Short term", vehicleClassRequested: "Pickup", quantity: 1,
    // Keep the demo's expired quotation actionable: its offer has lapsed,
    // while the requested rental window is still far enough ahead to revise.
    startDate: "2026-09-05", endDate: "2026-09-12",
    pickupLocation: "Bang Sue Distribution Center", jobNotes: "Campaign support, last-mile.",
    status: "Quoted", quotationId: "QT-2026-0001", isRecurringBilling: false,
    created: "2026-08-11 09:30", updated: "2026-08-12 10:00",
  },
  {
    id: "BK-2026-0018", clientId: "CLI-001", requestedByName: "Naruemon Srisai",
    rentalType: "Medium term", vehicleClassRequested: "6-Wheel Truck", quantity: 1,
    startDate: "2026-09-08", endDate: "2026-09-21",
    pickupLocation: "Chaeng Watthana", jobNotes: "Inter-hub mail transfer during system migration week.",
    status: "Requested", isRecurringBilling: false,
    created: "2026-08-20 09:20", updated: "2026-08-20 09:20",
  },
  {
    id: "BK-2026-0019", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Ad hoc / Daily", vehicleClassRequested: "Van", quantity: 1,
    startDate: "2026-08-25", endDate: "2026-08-25",
    pickupLocation: "Bangkok GPO, Charoen Krung Rd", jobNotes: "Same-day registered parcel overflow route.",
    status: "Requested", isRecurringBilling: false,
    created: "2026-08-19 15:10", updated: "2026-08-19 15:10",
  },
  {
    id: "BK-2026-0020", clientId: "CLI-001", requestedByName: "Suphaporn Wongsa",
    rentalType: "Short term", vehicleClassRequested: "Van", quantity: 2,
    startDate: "2026-09-10", endDate: "2026-09-17",
    pickupLocation: "Bang Sue Distribution Center", jobNotes: "Two vans for ecommerce parcel surge after campaign launch.",
    status: "Quoted", quotationId: "QT-2026-0014", isRecurringBilling: false,
    created: "2026-08-18 11:40", updated: "2026-08-20 14:30",
  },
  {
    id: "BK-2026-0021", clientId: "CLI-001", requestedByName: "Naruemon Srisai",
    rentalType: "Long term", vehicleClassRequested: "4-Wheel Truck", quantity: 1,
    startDate: "2026-09-25", endDate: "2026-12-24",
    pickupLocation: "Bangkok GPO, Charoen Krung Rd", jobNotes: "Quarterly trunk route coverage for Bangkok metro dispatch.",
    status: "Quoted", quotationId: "QT-2026-0015", isRecurringBilling: true,
    created: "2026-08-17 10:15", updated: "2026-08-19 16:45",
  },
  {
    id: "BK-2026-0022", clientId: "CLI-001", requestedByName: "Suphaporn Wongsa",
    rentalType: "Short term", vehicleClassRequested: "Van", quantity: 2,
    startDate: "2026-09-14", endDate: "2026-09-20",
    pickupLocation: "Bang Sue Distribution Center", jobNotes: "Two vans for regional parcel sorting support.",
    status: "Accepted", quotationId: "QT-2026-0016", isRecurringBilling: false,
    created: "2026-08-21 09:10", updated: "2026-08-23 11:30",
  },
  {
    id: "BK-2026-0023", clientId: "CLI-001", requestedByName: "Suphaporn Wongsa",
    rentalType: "Medium term", vehicleClassRequested: "Pickup", quantity: 1,
    startDate: "2026-09-18", endDate: "2026-10-02",
    pickupLocation: "Bang Na Distribution Hub", jobNotes: "Dedicated pickup for east Bangkok transfer routes.",
    status: "Accepted", quotationId: "QT-2026-0017", isRecurringBilling: false,
    created: "2026-08-20 13:45", updated: "2026-08-22 15:15",
  },
  {
    id: "BK-2026-0003", clientId: "CLI-001", requestedByName: "Naruemon Srisai",
    rentalType: "Medium term", vehicleClassRequested: "4-Wheel Truck", quantity: 1,
    startDate: "2026-09-01", endDate: "2026-09-28",
    pickupLocation: "Chaeng Watthana", jobNotes: "Seasonal peak capacity, September.",
    status: "Accepted", quotationId: "QT-2026-0002", isRecurringBilling: false,
    created: "2026-08-05 11:00", updated: "2026-08-09 15:20",
  },
  {
    id: "BK-2026-0006", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Short term", vehicleClassRequested: "Pickup", quantity: 1,
    startDate: "2026-08-16", endDate: "2026-08-23",
    pickupLocation: "Bang Sue Distribution Center", jobNotes: "",
    status: "Completed", assignments: [{ vehicleId: "VEH-003", driverId: "DRV-003" }], quotationId: "QT-2026-0003",
    // Assignment happens strictly after the quotation is accepted — QT-2026-0003
    // was accepted 2026-08-10 11:00, so this can't land at the same instant.
    assignedAt: "2026-08-10 11:15",
    startedAt: "2026-08-16 08:00", completedAt: "2026-08-23 17:00",
    invoiceId: "INV-2026-0008", isRecurringBilling: false,
    created: "2026-08-08 09:00", updated: "2026-08-23 17:00",
  },
  {
    id: "BK-2026-0004", clientId: "CLI-001", requestedByName: "Naruemon Srisai",
    rentalType: "Long term", vehicleClassRequested: "Van", quantity: 1,
    startDate: "2026-06-01", endDate: "2026-11-30",
    pickupLocation: "Chaeng Watthana", jobNotes: "Dedicated route, Nonthaburi loop.",
    status: "Active", assignments: [{ vehicleId: "VEH-005", driverId: "DRV-005" }], quotationId: "QT-2026-0004",
    assignedAt: "2026-05-28 10:00", startedAt: "2026-06-01 08:00",
    invoiceId: "INV-2026-0005", taxInvoiceId: "TI-2026-0002", isRecurringBilling: true,
    created: "2026-05-20 10:00", updated: "2026-07-15 08:00",
  },
  {
    id: "BK-2026-0005", clientId: "CLI-001", requestedByName: "Suphaporn Wongsa",
    rentalType: "Ad hoc / Daily", vehicleClassRequested: "4-Wheel Truck", quantity: 1,
    startDate: "2026-08-14", endDate: "2026-08-14",
    pickupLocation: "Bang Na Distribution Hub", jobNotes: "Same-day overflow delivery.",
    status: "Completed", assignments: [{ vehicleId: "VEH-001", driverId: "DRV-001" }], quotationId: "QT-2026-0005",
    // After QT-2026-0005's own acceptance (2026-08-14 08:30), not before it.
    assignedAt: "2026-08-14 08:45", startedAt: "2026-08-14 09:00", completedAt: "2026-08-14 18:00",
    invoiceId: "INV-2026-0010", isRecurringBilling: false,
    created: "2026-08-13 16:40", updated: "2026-08-15 16:20",
  },
  {
    id: "BK-2026-0007", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Short term", vehicleClassRequested: "Pickup", quantity: 1,
    startDate: "2026-07-28", endDate: "2026-08-04",
    pickupLocation: "Bang Sue Distribution Center", jobNotes: "",
    status: "Completed", assignments: [{ vehicleId: "VEH-007", driverId: "DRV-007" }], quotationId: "QT-2026-0006",
    // After QT-2026-0006's own acceptance (2026-07-26 10:00), not before it.
    assignedAt: "2026-07-27 10:00", startedAt: "2026-07-28 08:00", completedAt: "2026-08-04 17:00",
    invoiceId: "INV-2026-0009", isRecurringBilling: false,
    created: "2026-07-22 09:00", updated: "2026-08-13 11:00",
  },
  {
    id: "BK-2026-0008", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Ad hoc / Daily", vehicleClassRequested: "Van", quantity: 1,
    startDate: "2026-07-07", endDate: "2026-07-07",
    pickupLocation: "Bangkok GPO, Charoen Krung Rd", jobNotes: "",
    // Rental itself is fully done; billing has already run ahead to Paid —
    // that progress lives entirely on INV-2026-0001's own status now, not
    // duplicated onto this field (see bookingStatus.ts's header comment).
    status: "Completed", assignments: [{ vehicleId: "VEH-002", driverId: "DRV-002" }], quotationId: "QT-2026-0007",
    // After QT-2026-0007's own acceptance (2026-07-06 09:15), not before it.
    assignedAt: "2026-07-06 14:00", startedAt: "2026-07-07 08:00", completedAt: "2026-07-07 18:00",
    invoiceId: "INV-2026-0001", isRecurringBilling: false,
    created: "2026-07-04 08:00", updated: "2026-07-07 09:00",
  },
  {
    id: "BK-2026-0009", clientId: "CLI-001", requestedByName: "Naruemon Srisai",
    rentalType: "Short term", vehicleClassRequested: "4-Wheel Truck", quantity: 1,
    startDate: "2026-07-20", endDate: "2026-07-27",
    pickupLocation: "Bang Na Distribution Hub", jobNotes: "",
    // See BK-2026-0008's own comment above — INV-2026-0002's status is Paid.
    status: "Completed", assignments: [{ vehicleId: "VEH-006", driverId: "DRV-006" }], quotationId: "QT-2026-0008",
    // After QT-2026-0008's own acceptance (2026-07-18 11:00), not before it.
    assignedAt: "2026-07-19 09:00", startedAt: "2026-07-20 08:00", completedAt: "2026-07-27 17:00",
    invoiceId: "INV-2026-0002", taxInvoiceId: "TI-2026-0004", isRecurringBilling: false,
    created: "2026-07-14 09:00", updated: "2026-08-05 14:00",
  },
  {
    id: "BK-2026-0010", clientId: "CLI-001", requestedByName: "Naruemon Srisai",
    rentalType: "Medium term", vehicleClassRequested: "6-Wheel Truck", quantity: 1,
    startDate: "2026-06-01", endDate: "2026-06-28",
    pickupLocation: "Chaeng Watthana", jobNotes: "",
    // Fully wrapped up — invoice paid and tax invoice issued (see
    // BK-2026-0008's own comment above); nothing left on the billing side
    // either, but that's INV-2026-0003/TI-2026-0001's own status to carry.
    status: "Completed", assignments: [{ vehicleId: "VEH-004", driverId: "DRV-004" }], quotationId: "QT-2026-0009",
    assignedAt: "2026-05-20 09:00", startedAt: "2026-06-01 08:00", completedAt: "2026-06-28 17:00",
    invoiceId: "INV-2026-0003", taxInvoiceId: "TI-2026-0001", isRecurringBilling: false,
    created: "2026-05-15 09:00", updated: "2026-07-15 12:00",
  },
  {
    id: "BK-2026-0011", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Ad hoc / Daily", vehicleClassRequested: "Van", quantity: 3,
    startDate: "2026-08-19", endDate: "2026-08-19",
    pickupLocation: "Bangkok GPO, Charoen Krung Rd", jobNotes: "",
    status: "Declined", quotationId: "QT-2026-0010", declineReason: "Rate above client's approved budget for this route.",
    isRecurringBilling: false,
    created: "2026-08-12 10:00", updated: "2026-08-13 09:00",
  },
  {
    id: "BK-2026-0012", clientId: "CLI-001", requestedByName: "Kanyarat Phromsri",
    rentalType: "Short term", vehicleClassRequested: "Pickup", quantity: 1,
    startDate: "2026-08-25", endDate: "2026-09-01",
    pickupLocation: "Bang Na Distribution Hub", jobNotes: "Project postponed internally.",
    status: "Cancelled", cancelledFromStatus: "Requested", cancelledBy: "client", cancelledAt: "2026-08-08 09:00",
    cancellationReason: "Project postponed internally.", isRecurringBilling: false,
    created: "2026-08-07 11:00", updated: "2026-08-08 09:00",
  },
  // Another Cancelled example for Thailand Post. Cancelled straight from
  // Requested (no quotation ever issued) —
  // the simplest of the three states cancellable covers (Requested/Accepted/
  // Assigned, see ClientBookingDetail.tsx), and self-contained: no matching
  // Quotation record needed since this booking never got one.
  {
    id: "BK-2026-0013", clientId: "CLI-001", requestedByName: "Naruemon Srisai",
    rentalType: "Short term", vehicleClassRequested: "Van", quantity: 1,
    startDate: "2026-09-05", endDate: "2026-09-12",
    pickupLocation: "Bang Sue Distribution Center", jobNotes: "Trade fair support run.",
    status: "Cancelled", cancelledFromStatus: "Requested", cancelledBy: "client", cancelledAt: "2026-08-15 09:00",
    cancellationReason: "Event postponed by the organizer — no longer needed for these dates.",
    isRecurringBilling: false,
    created: "2026-08-14 10:00", updated: "2026-08-15 09:00",
  },
  // Rental-history cancellation examples — both had already moved past the
  // quotation decision, so they belong in My Rentals rather than My Requests.
  // The first was cancelled after assignment; the second was cancelled while
  // FleetCo was preparing the rental but before a vehicle was assigned.
  {
    id: "BK-2026-0025", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Short term", vehicleClassRequested: "Pickup", quantity: 1,
    startDate: "2026-09-16", endDate: "2026-09-23",
    pickupLocation: "Bang Sue Distribution Center", jobNotes: "Regional overflow coverage.",
    status: "Cancelled", assignments: [{ vehicleId: "VEH-003", driverId: "DRV-003" }], quotationId: "QT-2026-0019",
    assignedAt: "2026-08-27 11:00",
    cancelledFromStatus: "Assigned", cancelledBy: "client", cancelledAt: "2026-08-29 14:00",
    cancellationReason: "Delivery volume was reduced after the client consolidated routes.",
    isRecurringBilling: false,
    created: "2026-08-24 09:15", updated: "2026-08-29 14:00",
  },
  {
    id: "BK-2026-0026", clientId: "CLI-001", requestedByName: "Suphaporn Wongsa",
    rentalType: "Medium term", vehicleClassRequested: "Van", quantity: 1,
    startDate: "2026-09-29", endDate: "2026-10-20",
    pickupLocation: "Chaeng Watthana", jobNotes: "Campaign support vehicle.",
    status: "Cancelled", quotationId: "QT-2026-0020",
    cancelledFromStatus: "Accepted", cancelledBy: "client", cancelledAt: "2026-08-30 10:00",
    cancellationReason: "The campaign schedule changed and the vehicle was no longer required.",
    isRecurringBilling: false,
    created: "2026-08-26 10:30", updated: "2026-08-30 10:00",
  },
  // quantity>1, fully assigned — each of the 2 trucks gets its own vehicle +
  // driver (VEH-001/DRV-001 and VEH-006/DRV-009), not one pair shared or
  // duplicated across both units. Both vehicles/drivers are genuinely free
  // for these dates against every other booking in this file (checked by
  // hand against assignmentConflicts.ts's own rules — VEH-001/DRV-001's other
  // holds are BK-2026-0005 (a single day in August, since completed) and
  // BK-2026-0024 (31 Aug – 4 Sept, well clear of this September window);
  // VEH-006/DRV-009's Active August booking ends before this September
  // rental begins).
  {
    id: "BK-2026-0014", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Short term", vehicleClassRequested: "4-Wheel Truck", quantity: 2,
    startDate: "2026-09-15", endDate: "2026-09-22",
    pickupLocation: "Bangkok GPO, Charoen Krung Rd", jobNotes: "Two-truck relief run, provincial distribution.",
    status: "Assigned",
    assignments: [
      { vehicleId: "VEH-001", driverId: "DRV-001" },
      { vehicleId: "VEH-006", driverId: "DRV-009" },
    ],
    quotationId: "QT-2026-0011",
    // Currently sitting AT "Assigned" — same "updated is still accurate"
    // reasoning as BK-2026-0006 above.
    assignedAt: "2026-08-16 09:30",
    isRecurringBilling: false,
    created: "2026-08-14 09:00", updated: "2026-08-16 09:30",
  },
  // Short, near-term booking so there's always at least one Assigned
  // booking whose start date has actually arrived — every other Assigned
  // booking in this file (BK-2026-0014, BK-2026-0017) starts weeks out, so
  // without this one there's no way to demo Start Rental actually firing
  // without either editing dates or hitting the "started early" warning on
  // purpose. Dates stay clear of BK-2026-0014 above (31 Aug – 4 Sept vs.
  // 15–22 Sept) so VEH-001/DRV-001 aren't double-booked.
  {
    id: "BK-2026-0024", clientId: "CLI-001", requestedByName: "Suphaporn Wongsa",
    rentalType: "Short term", vehicleClassRequested: "4-Wheel Truck", quantity: 1,
    startDate: "2026-08-31", endDate: "2026-09-04",
    pickupLocation: "Bang Na Distribution Hub", jobNotes: "Short relief run, city distribution.",
    status: "Assigned", assignments: [{ vehicleId: "VEH-001", driverId: "DRV-001" }], quotationId: "QT-2026-0018",
    assignedAt: "2026-08-29 09:00",
    isRecurringBilling: false,
    created: "2026-08-27 09:00", updated: "2026-08-29 09:00",
  },
  // Thailand Post's own "Rejected" example — FleetCo declining a raw request
  // outright, before ever pricing it (no quotationId), as opposed to
  // BK-2026-0011 above, where the client declined an actual quotation.
  // bookingStatusLabel() reads this one as "Rejected" and BK-2026-0011 as
  // "Declined" even though both are status: "Declined" underneath.
  {
    id: "BK-2026-0015", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Ad hoc / Daily", vehicleClassRequested: "6-Wheel Truck", quantity: 1,
    startDate: "2026-08-22", endDate: "2026-08-22",
    pickupLocation: "Bangkok GPO, Charoen Krung Rd", jobNotes: "Urgent same-week overflow run.",
    status: "Declined", declineReason: "No 6-Wheel Truck available in the fleet for these dates.",
    isRecurringBilling: false,
    created: "2026-08-16 09:00", updated: "2026-08-16 14:00",
  },
  // Active rental with a paid invoice — one of the three client-facing
  // Active billing examples (Due / Payment Submitted / Paid). Its 4-Wheel
  // Truck assignment uses VEH-006, which is free between its July booking
  // and BK-2026-0014 in September.
  {
    id: "BK-2026-0016", clientId: "CLI-001", requestedByName: "Naruemon Srisai",
    rentalType: "Short term", vehicleClassRequested: "4-Wheel Truck", quantity: 1,
    startDate: "2026-08-01", endDate: "2026-08-31",
    pickupLocation: "Chaeng Watthana", jobNotes: "Regional distribution run.",
    status: "Active", assignments: [{ vehicleId: "VEH-006", driverId: "DRV-009" }], quotationId: "QT-2026-0012", startedAt: "2026-08-01 08:00",
    // After QT-2026-0012's own acceptance (2026-07-30 10:00), not before it.
    assignedAt: "2026-07-30 14:00",
    invoiceId: "INV-2026-0006", taxInvoiceId: "TI-2026-0003", isRecurringBilling: false,
    created: "2026-07-28 09:00", updated: "2026-08-11 09:00",
  },
  // "Upcoming" (Assigned, rental hasn't started yet) with an invoice already
  // issued — the
  // opposite billing arrangement from BK-2026-0004's recurring booking
  // (that one bills monthly *in arrears*, after each month runs; this one
  // bills the first cycle *in advance*, due before pickup — see QT-2026-0013's
  // payment terms). Proves the two aren't coupled: nothing about
  // "Invoiced" requires the booking to have gone Active/Completed first —
  // that's just the *usual* order for a one-off booking, not a hard rule,
  // and isRecurringBilling bookings already break it by billing on their
  // own cadence regardless of booking.status (BK-2026-0004 stays "Active"
  // indefinitely while multiple invoices come and go). This is the one
  // Upcoming "Due" example; the other Upcoming rentals remain Not invoiced.
  {
    id: "BK-2026-0017", clientId: "CLI-001", requestedByName: "Pakawat Chuenjai",
    rentalType: "Long term", vehicleClassRequested: "Pickup", quantity: 1,
    startDate: "2026-09-01", endDate: "2027-02-28",
    pickupLocation: "Bang Sue Distribution Center", jobNotes: "Provincial route, prepaid monthly billing.",
    status: "Assigned", assignments: [{ vehicleId: "VEH-007", driverId: "DRV-007" }], quotationId: "QT-2026-0013",
    assignedAt: "2026-08-15 10:00",
    invoiceId: "INV-2026-0007", isRecurringBilling: true,
    created: "2026-08-08 09:00", updated: "2026-08-17 10:00",
  },
]);
