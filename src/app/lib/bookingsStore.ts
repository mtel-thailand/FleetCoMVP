// A tiny external store for bookings, shared across the whole app.
//
// Why this exists: the FleetCo Operations Portal and the Client Self-Service
// Portal are two route trees in *one* app reading the *same* records (that
// was the architecture call — see memory). If each page just seeded its own
// `useState(() => [...mockBookings])`, a request submitted on the client
// side would never show up in ops's own All Requests in the same running
// session. No backend exists yet, so this is a deliberately small
// subscribe/notify store rather than pulling in a state-management library
// for one shared array.
import { useEffect, useState } from "react";
import { mockBookings, type Booking } from "@/app/data/bookings";
import { mockQuotations } from "@/app/data/quotations";
import { loadPersisted, mergeSeedRecords, savePersisted, scopeToThailandPost, subscribePersisted } from "@/app/lib/persistence";
import { demoNowStamp } from "@/app/data/demoDates";

type Listener = () => void;

const QUOTATION_REQUIRED_STATUSES = new Set<Booking["status"]>(["Accepted", "Assigned", "Active", "Completed"]);

// A previous demo seed accidentally added BK-2026-0024 directly as Assigned
// without its quotation pointer. Repair only this invariant when loading
// persisted demo data; unrelated user edits remain untouched.
function repairBookingRecord(booking: Booking): Booking {
  if (booking.id === "BK-2026-0008" && booking.startDate === "2026-07-05" && booking.endDate === "2026-07-05") {
    return {
      ...booking,
      startDate: "2026-07-07",
      endDate: "2026-07-07",
      startedAt: booking.startedAt === "2026-07-05 08:00" ? "2026-07-07 08:00" : booking.startedAt,
      completedAt: booking.completedAt === "2026-07-05 18:00" ? "2026-07-07 18:00" : booking.completedAt,
    };
  }
  if (!booking.quotationId && QUOTATION_REQUIRED_STATUSES.has(booking.status)) {
    const acceptedQuotation = mockQuotations.find(
      (quotation) => quotation.bookingId === booking.id && quotation.status === "Accepted",
    );
    if (acceptedQuotation) return { ...booking, quotationId: acceptedQuotation.id };
  }
  return booking;
}

function scopeBookings(records: Booking[]): Booking[] {
  return scopeToThailandPost(records).map((booking) =>
    booking.requestedByName === "Ekapop Meesuk" ? { ...booking, requestedByName: "Suphaporn Wongsa" } : booking,
  ).map(repairBookingRecord);
}

let bookings: Booking[] = scopeBookings(mergeSeedRecords(loadPersisted("bookings", [...mockBookings]), mockBookings));
const listeners = new Set<Listener>();

function notify() {
  savePersisted("bookings", bookings);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts. Fires when a *different* tab
// changes bookings (e.g. the client portal open in another window).
subscribePersisted<Booking[]>("bookings", (value) => {
  bookings = scopeBookings(value);
  notify();
});

export function getBookings(): Booking[] {
  return bookings;
}

export function addBooking(booking: Booking) {
  bookings = [booking, ...bookings];
  notify();
}

export function updateBooking(id: string, patch: Partial<Booking>) {
  bookings = bookings.map((b) => (b.id === id ? { ...b, ...patch } : b));
  notify();
}

export function nextBookingId(): string {
  const year = new Date().getFullYear();
  const nums = bookings
    .map((b) => parseInt(b.id.split("-").pop() ?? "", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `BK-${year}-${String(next).padStart(4, "0")}`;
}

export function nowStamp(): string {
  return demoNowStamp();
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetBookings(): void {
  bookings = [...mockBookings];
  notify();
}

/** Subscribes the calling component to the shared bookings array. */
export function useBookings(): Booking[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return bookings;
}
