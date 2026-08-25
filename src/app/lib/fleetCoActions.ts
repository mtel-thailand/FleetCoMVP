import { bookingInvoices, invoiceEligible, type Booking } from "@/app/data/bookings";
import type { Invoice } from "@/app/data/invoices";

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

export function needsFleetCoRentalAction(booking: Booking) {
  return booking.status === "Accepted";
}

export function fleetCoNextAction(booking: Booking, invoices: Invoice[], today: string) {
  const latestInvoice = bookingInvoices(booking.id, invoices)[0];

  if (latestInvoice?.status === "Payment Submitted") return "Verify submitted payment";
  if (latestInvoice?.status === "Overdue") return "Follow up overdue payment";
  if (latestInvoice?.status === "Payment Issue") return "Await corrected payment claim";
  if (latestInvoice?.status === "Unpaid") return "Await client payment";

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
