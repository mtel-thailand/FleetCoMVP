import type { Quotation } from "@/app/data/quotations";
import type { Invoice } from "@/app/data/invoices";
import { updateQuotation } from "@/app/lib/quotationsStore";
import { updateInvoice } from "@/app/lib/invoicesStore";
import { updateBooking } from "@/app/lib/bookingsStore";
import { addNotification } from "@/app/lib/notificationsStore";

// The one implementation of each client decision — called from both the
// Booking Detail modal (quick action, for when you already know what
// you're deciding) and QuotationDetail/InvoiceDetail (the full document,
// reachable from the Quotations/Invoices lists or the same quick action).
// Two entry points, one mutation each, so they can never drift apart —
// same reasoning extends to the notification each one fires: one call
// site each, not duplicated at every place these get triggered from.

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Client accepts a quotation — this IS what advances the booking
 * Quoted → Accepted. clientSignature mirrors fleetcoSignature on the
 * issuing side (same SignaturePad component, same PNG-data-URL shape) —
 * captured on QuotationDetail's own Accept flow, not optional the way
 * fleetcoSignature is: there's exactly one place a client ever accepts,
 * so nothing else needs to tolerate a missing one the way historical mock
 * data does.
 */
export function acceptQuotation(quotation: Quotation, clientSignature: string) {
  updateQuotation(quotation.id, { status: "Accepted", clientSignature, updated: nowStamp() });
  updateBooking(quotation.bookingId, { status: "Accepted", updated: nowStamp() });
  addNotification({
    eventTypeId: "quotation_decided",
    portal: "fleetco",
    recipient: "FleetCo Account Team",
    bookingId: quotation.bookingId,
    message: `Thailand Post accepted ${quotation.id} for booking ${quotation.bookingId}.`,
  });
}

/** Client declines a quotation, with a reason FleetCo can act on. */
export function declineQuotation(quotation: Quotation, reason: string) {
  updateQuotation(quotation.id, { status: "Declined", updated: nowStamp() });
  updateBooking(quotation.bookingId, { status: "Declined", declineReason: reason, updated: nowStamp() });
  addNotification({
    eventTypeId: "quotation_decided",
    portal: "fleetco",
    recipient: "FleetCo Account Team",
    bookingId: quotation.bookingId,
    message: `Thailand Post declined ${quotation.id} for booking ${quotation.bookingId}${reason ? ` — ${reason}` : ""}.`,
  });
}

/**
 * Client marks an invoice as paid. Brief §6.1: this is a claim, not a
 * settlement — FleetCo finance verifies before the tax invoice is
 * released — so it only ever touches the invoice, never booking.status.
 * slipFiles is required (MarkPaidForm's own Submit button stays disabled
 * without at least one) — a bare boolean used to be enough to say "yes I
 * attached something," but the actual filenames are what FleetCo finance
 * needs to go check.
 */
export function markInvoicePaid(invoice: Invoice, date: string, reference: string, slipFiles: string[]) {
  updateInvoice(invoice.id, {
    status: "Payment Submitted", paymentDate: date, paymentReference: reference, paymentSlipFiles: slipFiles,
    // A fresh claim supersedes whatever FleetCo said was wrong with the
    // last one — leaving the old reason in place would misleadingly flag
    // a since-corrected submission as still having a problem.
    paymentRejectionReason: undefined,
    updated: nowStamp(),
  });
  addNotification({
    eventTypeId: "payment_submitted",
    portal: "fleetco",
    recipient: "FleetCo Finance",
    bookingId: invoice.bookingId,
    message: `Thailand Post marked ${invoice.id} as paid (${reference}, ${date}) — verification needed.`,
  });
}
