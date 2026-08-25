import type { Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import type { Invoice } from "@/app/data/invoices";
import type { TaxInvoice } from "@/app/data/taxInvoices";
import { getAdminRole, ROLE_LABELS } from "@/app/lib/auth";
import { updateBooking } from "@/app/lib/bookingsStore";
import { updateInvoice } from "@/app/lib/invoicesStore";
import { addNotification } from "@/app/lib/notificationsStore";
import { addTaxInvoice } from "@/app/lib/taxInvoicesStore";
import { thaiBahtText } from "@/app/lib/thaiBahtText";

export function nowStamp(): string {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export function computeTaxInvoiceAmounts(invoice: Invoice) {
  if (invoice.lineItems) {
    const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const discount = invoice.discount ?? 0;
    const afterDiscount = Math.max(0, subtotal - discount);
    const vatAmount = Math.round(afterDiscount * (invoice.vatRate ?? 0.07));
    return { subtotal, discount, vatAmount, totalAmount: afterDiscount + vatAmount };
  }

  const subtotal = invoice.amountDue / 1.07;
  const vatAmount = invoice.amountDue - subtotal;
  return { subtotal, discount: 0, vatAmount, totalAmount: invoice.amountDue };
}

export function buildTaxInvoiceRecord({
  invoice,
  booking,
  client,
  docNumber,
  stamp,
}: {
  invoice: Invoice;
  booking: Booking;
  client: ClientAccount | undefined;
  docNumber: string;
  stamp: string;
}): TaxInvoice {
  const amounts = computeTaxInvoiceAmounts(invoice);
  const role = getAdminRole();

  return {
    id: docNumber,
    invoiceId: invoice.id,
    bookingId: booking.id,
    clientId: booking.clientId,
    sellerName: "FleetCo Operations Co., Ltd. (entity name pending)",
    sellerTaxId: "0000000000000",
    sellerAddress: "Registered address pending — FleetCo entity not yet finalized.",
    buyerName: client?.name ?? invoice.clientId,
    buyerTaxId: client?.taxId ?? "",
    buyerAddress: client?.registeredAddress ?? "",
    buyerBranch: client?.branch ?? "",
    lineItems: invoice.lineItems?.map((item) => ({ ...item })),
    subtotal: amounts.subtotal,
    discount: amounts.discount,
    vatRate: invoice.vatRate ?? 0.07,
    vatAmount: amounts.vatAmount,
    totalAmount: amounts.totalAmount,
    amountInWordsThai: thaiBahtText(amounts.totalAmount),
    issuedAt: stamp,
    created: stamp,
    verifiedByName: "FleetCo Finance",
    verifiedByRole: role ? ROLE_LABELS[role] : "Authorized FleetCo officer",
    verifiedAt: stamp,
    verificationMethod: "Manual review",
  };
}

export function verifyPaymentAndIssueTaxInvoice({
  invoice,
  booking,
  client,
  docNumber,
}: {
  invoice: Invoice;
  booking: Booking;
  client: ClientAccount | undefined;
  docNumber: string;
}): TaxInvoice {
  const stamp = nowStamp();
  const taxInvoice = buildTaxInvoiceRecord({ invoice, booking, client, docNumber, stamp });

  updateInvoice(invoice.id, { status: "Paid", updated: stamp });
  addTaxInvoice(taxInvoice);
  updateBooking(booking.id, { taxInvoiceId: docNumber, updated: stamp });
  addNotification({
    eventTypeId: "payment_verified",
    portal: "client",
    recipient: `Thailand Post — ${booking.requestedByName}`,
    bookingId: booking.id,
    message: `Payment verified — tax invoice ${docNumber} is available for download.`,
  });

  return taxInvoice;
}
