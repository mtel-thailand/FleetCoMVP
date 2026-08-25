import { bookingInvoices, invoiceEligible, type Booking } from "@/app/data/bookings";
import type { Invoice } from "@/app/data/invoices";
import type { TaxInvoice } from "@/app/data/taxInvoices";

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

export function invoiceHasTaxInvoice(invoice: Invoice, taxInvoices: TaxInvoice[]) {
  return taxInvoices.some((taxInvoice) => taxInvoice.invoiceId === invoice.id);
}

export function needsFleetCoRentalAction(booking: Booking) {
  return booking.status === "Accepted";
}

export function fleetCoInvoiceAction(invoice: Invoice, taxInvoices: TaxInvoice[]) {
  if (invoice.status === "Payment Submitted") return "Verify submitted payment";
  if (invoice.status === "Paid") return invoiceHasTaxInvoice(invoice, taxInvoices) ? "Settled" : "Issue tax invoice";
  if (invoice.status === "Overdue") return "Follow up overdue payment";
  if (invoice.status === "Payment Issue") return "Await corrected payment claim";
  return "Await client payment";
}

export function fleetCoNextAction(booking: Booking, invoices: Invoice[], taxInvoices: TaxInvoice[], today: string) {
  const latestInvoice = bookingInvoices(booking.id, invoices)[0];

  if (latestInvoice?.status === "Payment Submitted") return "Verify submitted payment";
  if (latestInvoice?.status === "Paid" && !invoiceHasTaxInvoice(latestInvoice, taxInvoices)) return "Issue tax invoice";
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
