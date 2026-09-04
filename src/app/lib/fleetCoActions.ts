import { bookingInvoices, invoiceEligible, type Booking } from "@/app/data/bookings";
import { invoiceDisplayStatus, type Invoice } from "@/app/data/invoices";

export function daysFromToday(date: string, today: string) {
  const target = new Date(`${date}T00:00:00`).getTime();
  const base = new Date(`${today}T00:00:00`).getTime();
  return Math.ceil((target - base) / 86_400_000);
}

export function relativeDateLabel(date: string, today: string, verb: "Starts" | "Ends") {
  const days = daysFromToday(date, today);
  if (days === 0) return `${verb} today`;
  if (days === 1) return `${verb} tomorrow`;
  if (days > 1) return `${verb} in ${days} days`;
  return `${verb} ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
}

export type RentalReminder = "start_due" | "start_overdue" | "completion_due" | "completion_overdue";

// Planned dates create a reminder, not a status transition. The manual
// Start/Complete actions remain the source of truth for the actual rental
// lifecycle, so a late handover, no-show, extension, or early return cannot
// silently turn into false operational data.
export function getRentalReminder(booking: Booking, today: string): RentalReminder | null {
  if (booking.status === "Assigned") {
    const daysToStart = daysFromToday(booking.startDate, today);
    if (daysToStart < 0) return "start_overdue";
    if (daysToStart === 0) return "start_due";
  }
  if (booking.status === "Active") {
    const daysToEnd = daysFromToday(booking.endDate, today);
    if (daysToEnd < 0) return "completion_overdue";
    if (daysToEnd === 0) return "completion_due";
  }
  return null;
}

export function rentalReminderLabel(reminder: RentalReminder): string {
  if (reminder === "start_due") return "Start rental due today";
  if (reminder === "start_overdue") return "Start rental overdue";
  if (reminder === "completion_due") return "Complete rental due today";
  return "Complete rental overdue";
}

// The Rentals page's Action Required queue is intentionally limited to the
// assignment step. Date-driven start/end reminders live in the dashboard and
// booking detail, where they do not blur the meaning of this worklist.
export function needsFleetCoRentalAction(booking: Booking) {
  return booking.status === "Accepted";
}

export function fleetCoNextAction(booking: Booking, invoices: Invoice[], today: string) {
  const latestInvoice = bookingInvoices(booking.id, invoices)[0];
  const invoiceStatus = latestInvoice ? invoiceDisplayStatus(latestInvoice) : undefined;

  if (invoiceStatus === "Payment Submitted") return "Verify submitted payment";
  if (invoiceStatus === "Overdue") return "Follow up overdue payment";
  if (invoiceStatus === "Payment Issue") return "Await corrected payment claim";
  if (invoiceStatus === "Unpaid") return "Await client payment";

  const reminder = getRentalReminder(booking, today);
  if (reminder) return rentalReminderLabel(reminder);

  if (!latestInvoice && invoiceEligible(booking)) {
    return booking.status === "Completed" ? "Issue final invoice" : "Issue invoice";
  }

  if (booking.status === "Requested") return "Prepare quotation";
  if (booking.status === "Quoted") return "Await client decision";
  if (booking.status === "Accepted") return "Assign vehicle & driver";
  if (booking.status === "Assigned") return relativeDateLabel(booking.startDate, today, "Starts");
  if (booking.status === "Active") return relativeDateLabel(booking.endDate, today, "Ends");
  if (booking.status === "Completed") return "No immediate action";
  return "No immediate action";
}
