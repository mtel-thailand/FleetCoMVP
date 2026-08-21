// Quotations — brief §6. First step of the Quotation → Invoice → Tax Invoice chain.
import type { VehicleClass } from "./vehicles";

export type QuotationStatus = "Draft" | "Issued" | "Accepted" | "Declined" | "Superseded";

export type QuotationLineItem = {
  description: string;
  vehicleClass: VehicleClass;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
};

export type Quotation = {
  id: string;
  version: number;
  bookingId: string;
  clientId: string;
  lineItems: QuotationLineItem[];
  discount: number;
  vatRate: number;
  remarks: string;
  paymentTerms: string;
  validUntil: string;
  status: QuotationStatus;
  issuedAt: string | null;
  // Captured on the split-screen editor at issue time (DocumentEditor's
  // SignaturePad) — a PNG data URL, not a real cryptographic signature.
  // Optional: only documents issued through that flow carry one; nothing
  // populates it for the historical mock quotations below.
  fleetcoSignature?: string;
  // The client's counterpart, same shape — captured at Accept time
  // (QuotationDetail's own SignaturePad) rather than at issue time, since
  // the client obviously doesn't have anything to sign until FleetCo's
  // side exists first. Optional for the same reason fleetcoSignature is:
  // absent on every historical mock quotation, and on any quotation that
  // was Declined rather than Accepted.
  clientSignature?: string;
  created: string;
  updated: string;
};

// Shared calc: quantity × unitPrice = amount at the line level (brief §6.2).
// Grand total = subtotal − discount, plus VAT on the discounted amount.
export function quotationTotals(q: Quotation) {
  const subtotal = q.lineItems.reduce((sum, li) => sum + li.amount, 0);
  const afterDiscount = subtotal - q.discount;
  const vat = Math.round(afterDiscount * q.vatRate);
  const grandTotal = afterDiscount + vat;
  return { subtotal, afterDiscount, vat, grandTotal };
}

export const mockQuotations: Quotation[] = [
  {
    id: "QT-2026-0001", version: 1, bookingId: "BK-2026-0002", clientId: "CLI-001",
    lineItems: [{ description: "Pickup truck — Bang Sue campaign support (7 days)", vehicleClass: "Pickup", quantity: 1, unit: "vehicle (7-day period)", unitPrice: 11200, amount: 11200 }],
    discount: 0, vatRate: 0.07, remarks: "Rate includes dedicated driver. Fuel excluded.",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-08-18",
    status: "Issued", issuedAt: "2026-08-12 10:00", created: "2026-08-12 10:00", updated: "2026-08-12 10:00",
  },
  {
    id: "QT-2026-0014", version: 1, bookingId: "BK-2026-0020", clientId: "CLI-001",
    lineItems: [{ description: "Van — two-vehicle ecommerce parcel surge (8 days)", vehicleClass: "Van", quantity: 2, unit: "vehicle (8-day period)", unitPrice: 15400, amount: 30800 }],
    discount: 800, vatRate: 0.07, remarks: "Includes dedicated drivers for both vans. Fuel excluded.",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-08-27",
    status: "Issued", issuedAt: "2026-08-20 14:30", created: "2026-08-20 14:30", updated: "2026-08-20 14:30",
  },
  {
    id: "QT-2026-0015", version: 1, bookingId: "BK-2026-0021", clientId: "CLI-001",
    lineItems: [{ description: "4-Wheel truck — Bangkok metro trunk route (monthly recurring)", vehicleClass: "4-Wheel Truck", quantity: 1, unit: "vehicle / month", unitPrice: 62000, amount: 62000 }],
    discount: 1500, vatRate: 0.07, remarks: "Monthly recurring rate; first invoice issued before pickup.",
    paymentTerms: "Net 30, invoiced monthly in arrears.", validUntil: "2026-08-26",
    status: "Issued", issuedAt: "2026-08-19 16:45", created: "2026-08-19 16:45", updated: "2026-08-19 16:45",
  },
  {
    id: "QT-2026-0002", version: 1, bookingId: "BK-2026-0003", clientId: "CLI-001",
    lineItems: [{ description: "4-Wheel truck — September peak capacity (28 days)", vehicleClass: "4-Wheel Truck", quantity: 1, unit: "vehicle (28-day period)", unitPrice: 64400, amount: 64400 }],
    discount: 2000, vatRate: 0.07, remarks: "Includes fuel card for FleetCo-managed refuelling.",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-08-20",
    status: "Accepted", issuedAt: "2026-08-06 10:00", created: "2026-08-06 10:00", updated: "2026-08-09 15:20",
  },
  {
    id: "QT-2026-0003", version: 1, bookingId: "BK-2026-0006", clientId: "CLI-001",
    lineItems: [{ description: "Pickup truck — 7 days", vehicleClass: "Pickup", quantity: 1, unit: "vehicle (7-day period)", unitPrice: 11200, amount: 11200 }],
    discount: 0, vatRate: 0.07, remarks: "",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-08-15",
    status: "Accepted", issuedAt: "2026-08-08 14:00", created: "2026-08-08 14:00", updated: "2026-08-10 11:00",
  },
  {
    id: "QT-2026-0004", version: 1, bookingId: "BK-2026-0004", clientId: "CLI-001",
    lineItems: [{ description: "Van — dedicated Nonthaburi loop (monthly recurring)", vehicleClass: "Van", quantity: 1, unit: "vehicle / month", unitPrice: 49500, amount: 49500 }],
    discount: 0, vatRate: 0.07, remarks: "Monthly recurring rate; renews automatically unless cancelled with 30 days' notice.",
    paymentTerms: "Net 30, invoiced monthly in arrears.", validUntil: "2026-06-05",
    status: "Accepted", issuedAt: "2026-05-22 09:00", created: "2026-05-22 09:00", updated: "2026-05-25 10:00",
  },
  {
    id: "QT-2026-0005", version: 1, bookingId: "BK-2026-0005", clientId: "CLI-002",
    lineItems: [{ description: "4-Wheel truck — same-day overflow delivery", vehicleClass: "4-Wheel Truck", quantity: 1, unit: "vehicle (1 day)", unitPrice: 2800, amount: 2800 }],
    discount: 0, vatRate: 0.07, remarks: "Same-day dispatch, subject to availability.",
    paymentTerms: "Net 15 from invoice date.", validUntil: "2026-08-14",
    status: "Accepted", issuedAt: "2026-08-13 17:00", created: "2026-08-13 17:00", updated: "2026-08-14 08:30",
  },
  {
    id: "QT-2026-0006", version: 1, bookingId: "BK-2026-0007", clientId: "CLI-001",
    lineItems: [{ description: "Pickup truck — 7 days", vehicleClass: "Pickup", quantity: 1, unit: "vehicle (7-day period)", unitPrice: 11200, amount: 11200 }],
    discount: 0, vatRate: 0.07, remarks: "",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-07-30",
    status: "Accepted", issuedAt: "2026-07-23 09:00", created: "2026-07-23 09:00", updated: "2026-07-26 10:00",
  },
  {
    id: "QT-2026-0007", version: 1, bookingId: "BK-2026-0008", clientId: "CLI-001",
    lineItems: [{ description: "Van — single-day delivery run", vehicleClass: "Van", quantity: 1, unit: "vehicle (1 day)", unitPrice: 2200, amount: 2200 }],
    discount: 0, vatRate: 0.07, remarks: "",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-08-10",
    status: "Accepted", issuedAt: "2026-07-06 08:30", created: "2026-07-06 08:30", updated: "2026-07-06 09:15",
  },
  {
    id: "QT-2026-0008", version: 1, bookingId: "BK-2026-0009", clientId: "CLI-002",
    lineItems: [{ description: "4-Wheel truck — 7 days", vehicleClass: "4-Wheel Truck", quantity: 1, unit: "vehicle (7-day period)", unitPrice: 17500, amount: 17500 }],
    discount: 500, vatRate: 0.07, remarks: "Repeat-client discount applied.",
    paymentTerms: "Net 15 from invoice date.", validUntil: "2026-07-22",
    status: "Accepted", issuedAt: "2026-07-15 09:30", created: "2026-07-15 09:30", updated: "2026-07-18 11:00",
  },
  {
    id: "QT-2026-0009", version: 1, bookingId: "BK-2026-0010", clientId: "CLI-001",
    lineItems: [{ description: "6-Wheel truck — 28 days", vehicleClass: "6-Wheel Truck", quantity: 1, unit: "vehicle (28-day period)", unitPrice: 98000, amount: 98000 }],
    discount: 3000, vatRate: 0.07, remarks: "Volume discount applied.",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-05-20",
    status: "Accepted", issuedAt: "2026-05-16 10:00", created: "2026-05-16 10:00", updated: "2026-05-19 09:00",
  },
  {
    id: "QT-2026-0010", version: 1, bookingId: "BK-2026-0011", clientId: "CLI-001",
    lineItems: [{ description: "Van — single-day delivery run", vehicleClass: "Van", quantity: 3, unit: "vehicle (1 day)", unitPrice: 2200, amount: 6600 }],
    discount: 0, vatRate: 0.07, remarks: "",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-08-14",
    status: "Declined", issuedAt: "2026-08-12 15:00", created: "2026-08-12 15:00", updated: "2026-08-13 09:00",
  },
  {
    // Matches BK-2026-0014 (quantity 2, two 4-Wheel Trucks) — line-item
    // quantity mirrors the booking's, same convention as every other
    // quotation here (see defaultLineItem in RequestInbox.tsx).
    id: "QT-2026-0011", version: 1, bookingId: "BK-2026-0014", clientId: "CLI-001",
    lineItems: [{ description: "4-Wheel truck — two-truck relief run (8 days)", vehicleClass: "4-Wheel Truck", quantity: 2, unit: "vehicle (8-day period)", unitPrice: 20000, amount: 40000 }],
    discount: 0, vatRate: 0.07, remarks: "Two trucks dispatched together for provincial distribution coverage.",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-09-10",
    status: "Accepted", issuedAt: "2026-08-15 10:00", created: "2026-08-15 10:00", updated: "2026-08-16 09:00",
  },
  {
    // Matches BK-2026-0016 — see bookings.ts's comment on that booking for
    // why this trio (booking/quotation/invoice) exists.
    id: "QT-2026-0012", version: 1, bookingId: "BK-2026-0016", clientId: "CLI-001",
    lineItems: [{ description: "4-Wheel truck — regional distribution run (5 days)", vehicleClass: "4-Wheel Truck", quantity: 1, unit: "vehicle (5-day period)", unitPrice: 1800, amount: 9000 }],
    discount: 0, vatRate: 0.07, remarks: "",
    paymentTerms: "Net 30 from invoice date.", validUntil: "2026-08-04",
    status: "Accepted", issuedAt: "2026-07-29 09:00", created: "2026-07-29 09:00", updated: "2026-07-30 10:00",
  },
  {
    // Matches BK-2026-0017 — see bookings.ts's comment on that booking.
    // unitPrice is one month's rate, same "quotation = per-cycle amount,
    // not the full-term sum" convention QT-2026-0004 already established
    // for its own recurring booking.
    id: "QT-2026-0013", version: 1, bookingId: "BK-2026-0017", clientId: "CLI-001",
    lineItems: [{ description: "Pickup — provincial route (monthly recurring)", vehicleClass: "Pickup", quantity: 1, unit: "vehicle / month", unitPrice: 40500, amount: 40500 }],
    discount: 0, vatRate: 0.07, remarks: "Monthly recurring rate; first cycle billed in advance, due before pickup.",
    paymentTerms: "Net 14 from invoice date — due before pickup.", validUntil: "2026-08-17",
    status: "Accepted", issuedAt: "2026-08-10 09:00", created: "2026-08-10 09:00", updated: "2026-08-12 11:00",
  },
];
