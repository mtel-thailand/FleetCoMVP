// Notification center — brief §4.8/§8: "in-app notification center + email
// for every step of the commercial chain; design a consistent notification
// anatomy." Event-type catalog below is the "anatomy"; mockNotificationLog
// is the seed a fresh session starts from — notificationsStore.ts is what
// actually keeps it live from here, appending a real entry every time one
// of these events actually happens (see documentActions.ts, RequestVehicle.tsx,
// OpsBookingDetailPanel.tsx, and ClientBookingDetail.tsx's handleCancelBooking
// for the call sites).
//
// compliance_expiry is the one event still catalogued but never fired live —
// it would need a derived/cron-style check rather than a single user action
// to trigger it. Stays in the catalog anyway so Settings still has something
import { rebaseDemoDates } from "./demoDates";
// to display for it. booking_cancelled used to be in the same boat (its
// only trigger, Cancel Booking, existed but never actually called
// addNotification) — that's fixed now; NTF-007 below is a real example, not
// a stand-in. Declining a quotation deliberately fires quotation_decided
// instead, not this one — see NTF-003's own comment below.

export type NotificationEventType = {
  id: string;
  label: string;
  description: string;
  defaultInApp: boolean;
  defaultEmail: boolean;
};

export type NotificationPreferences = Record<string, { inApp: boolean; email: boolean }>;

export const NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  { id: "new_request", label: "New Vehicle Request", description: "A client submits a new booking request.", defaultInApp: true, defaultEmail: true },
  { id: "quotation_issued", label: "Quotation Issued", description: "FleetCo issues a quotation to a client.", defaultInApp: true, defaultEmail: true },
  { id: "quotation_decided", label: "Quotation Accepted / Declined", description: "A client accepts or declines a quotation.", defaultInApp: true, defaultEmail: true },
  { id: "assignment_made", label: "Vehicle & Driver Assigned", description: "A vehicle and driver are assigned to a booking.", defaultInApp: true, defaultEmail: false },
  { id: "invoice_issued", label: "Invoice Issued", description: "FleetCo issues an invoice to a client.", defaultInApp: true, defaultEmail: true },
  { id: "payment_submitted", label: "Payment Submitted", description: "A client marks an invoice as paid.", defaultInApp: true, defaultEmail: true },
  { id: "payment_verified", label: "Payment Verified / Tax Invoice Issued", description: "FleetCo finance verifies payment and issues the tax invoice.", defaultInApp: true, defaultEmail: true },
  { id: "compliance_expiry", label: "Compliance Document Expiring", description: "A vehicle or driver document is expiring soon.", defaultInApp: true, defaultEmail: false },
  { id: "booking_cancelled", label: "Booking Cancelled / Declined", description: "A booking is cancelled, or a quotation declined.", defaultInApp: true, defaultEmail: false },
];

export type NotificationLogEntry = {
  id: string;
  eventTypeId: string;
  message: string;
  recipient: string;
  // Which portal's bell/center this belongs in — the source of truth the
  // live store and NotificationBell now filter on directly, replacing the
  // old recipient.startsWith("Thailand Post"/"FleetCo") string-matching.
  portal: "fleetco" | "client";
  // Lets a notification row navigate straight to the booking it's about
  // (NotificationBell). Absent for the one event type that isn't
  // booking-scoped (compliance_expiry — a vehicle, not a booking).
  bookingId?: string;
  channels: ("in_app" | "email")[];
  sentAt: string;
  read: boolean;
};

export const mockNotificationLog: NotificationLogEntry[] = rebaseDemoDates<NotificationLogEntry[]>([
  { id: "NTF-001", eventTypeId: "payment_submitted", message: "Thailand Post submitted payment for INV-2026-0005 (KBank20260812-0077).", recipient: "FleetCo Finance", portal: "fleetco", bookingId: "BK-2026-0004", channels: ["in_app", "email"], sentAt: "2026-08-12 10:15", read: false },
  { id: "NTF-002", eventTypeId: "quotation_decided", message: "Thailand Post accepted QT-2026-0017 (฿26,215.00).", recipient: "FleetCo Account Team", portal: "fleetco", bookingId: "BK-2026-0023", channels: ["in_app", "email"], sentAt: "2026-08-22 15:30", read: false },
  // Reclassified from booking_cancelled to quotation_decided — that event
  // type's own label already covers "Accepted / Declined," so a decline
  // belongs here with NTF-002, not under a separate cancellation category.
  { id: "NTF-003", eventTypeId: "quotation_decided", message: "Thailand Post declined QT-2026-0010 — rate above approved budget.", recipient: "FleetCo Account Team", portal: "fleetco", bookingId: "BK-2026-0011", channels: ["in_app", "email"], sentAt: "2026-08-13 09:00", read: true },
  { id: "NTF-004", eventTypeId: "new_request", message: "New request BK-2026-0001 — 2× Van, ad hoc, 18 Aug 2026.", recipient: "FleetCo Operations", portal: "fleetco", bookingId: "BK-2026-0001", channels: ["in_app", "email"], sentAt: "2026-08-14 08:10", read: true },
  { id: "NTF-005", eventTypeId: "compliance_expiry", message: "Vehicle 8กฌ 4455 (Toyota Camry) — registration, insurance, and tax sticker all expire 18 Aug 2026.", recipient: "FleetCo Operations", portal: "fleetco", channels: ["in_app"], sentAt: "2026-08-13 06:00", read: true },
  { id: "NTF-006", eventTypeId: "assignment_made", message: "Pickup truck 3กง 7788 and driver Prasert Boonmee assigned to BK-2026-0006.", recipient: "Thailand Post — Pakawat Chuenjai", portal: "client", bookingId: "BK-2026-0006", channels: ["in_app"], sentAt: "2026-08-10 11:00", read: true },
  { id: "NTF-007", eventTypeId: "booking_cancelled", message: "BK-2026-0013 was cancelled by the client: Event postponed by the organizer — no longer needed for these dates.", recipient: "FleetCo Operations", portal: "fleetco", bookingId: "BK-2026-0013", channels: ["in_app"], sentAt: "2026-08-15 09:00", read: true },
  { id: "NTF-008", eventTypeId: "invoice_issued", message: "Invoice INV-2026-0001 issued — ฿2,354.00 due 6 Aug 2026.", recipient: "Thailand Post — Suphaporn Wongsa", portal: "client", bookingId: "BK-2026-0008", channels: ["in_app", "email"], sentAt: "2026-07-07 09:00", read: true },
  { id: "NTF-009", eventTypeId: "payment_verified", message: "Payment verified for INV-2026-0003 — tax invoice TI-2026-0001 issued.", recipient: "Thailand Post — Suphaporn Wongsa", portal: "client", bookingId: "BK-2026-0010", channels: ["in_app", "email"], sentAt: "2026-07-11 09:30", read: true },
  // quotation_issued previously had zero sample entries in this log despite
  // being a cataloged event type — added so "what does a New Quotation
  // notification look like" has an actual answer, and it's the natural
  // predecessor of NTF-002 above (same quotation, accepted a day later).
  { id: "NTF-010", eventTypeId: "quotation_issued", message: "Quotation QT-2026-0001 is ready for your review — ฿11,984.00.", recipient: "Thailand Post — Pakawat Chuenjai", portal: "client", bookingId: "BK-2026-0002", channels: ["in_app", "email"], sentAt: "2026-08-12 10:00", read: true },
]);
