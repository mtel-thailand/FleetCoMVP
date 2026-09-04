// Tax invoices — brief §6 / §6.3. Final step of the document chain, issued
// only after FleetCo finance verifies payment. Immutable once issued.
//
// Demo seller identity used until FleetCo's legal entity registration is finalized.

import type { QuotationLineItem } from "./quotations";
import { rebaseDemoDates } from "./demoDates";

export type TaxInvoice = {
  id: string;
  invoiceId: string;
  bookingId: string;
  clientId: string;
  sellerName: string;
  sellerTaxId: string;
  sellerAddress: string;
  buyerName: string;
  buyerTaxId: string;
  buyerAddress: string;
  buyerBranch: string;
  lineItems?: QuotationLineItem[];
  subtotal: number;
  discount: number;
  vatRate?: number;
  vatAmount: number;
  totalAmount: number;
  amountInWordsThai: string;
  issuedAt: string;
  created: string;
  // Verification metadata records the FleetCo approval event
  // without pretending the prototype has issued a certificate-backed legal
  // signature. A production e-Tax integration can replace this method with
  // the real certificate and signature reference.
  verifiedByName?: string;
  verifiedByRole?: string;
  verifiedAt?: string;
  verificationMethod?: string;
};

export const mockTaxInvoices: TaxInvoice[] = rebaseDemoDates<TaxInvoice[]>([
  {
    id: "TI-2026-0004", invoiceId: "INV-2026-0002", bookingId: "BK-2026-0009", clientId: "CLI-001",
    sellerName: "FleetCo Operations Co., Ltd.",
    sellerTaxId: "0105568123456",
    sellerAddress: "99 Ratchadaphisek Rd, Huai Khwang, Bangkok 10310, Thailand",
    buyerName: "Thailand Post Co., Ltd.",
    buyerTaxId: "0107536000174",
    buyerAddress: "111 Praram 9 Rd, Huai Khwang, Bangkok 10310, Thailand",
    buyerBranch: "Head Office",
    subtotal: 17000, discount: 0, vatAmount: 1190, totalAmount: 18190,
    amountInWordsThai: "หนึ่งหมื่นแปดพันหนึ่งร้อยเก้าสิบบาทถ้วน",
    issuedAt: "2026-08-05 14:00", created: "2026-08-05 14:00",
  },
  {
    id: "TI-2026-0001", invoiceId: "INV-2026-0003", bookingId: "BK-2026-0010", clientId: "CLI-001",
    sellerName: "FleetCo Operations Co., Ltd.",
    sellerTaxId: "0105568123456",
    sellerAddress: "99 Ratchadaphisek Rd, Huai Khwang, Bangkok 10310, Thailand",
    buyerName: "Thailand Post Co., Ltd.",
    buyerTaxId: "0107536000174",
    buyerAddress: "111 Praram 9 Rd, Huai Khwang, Bangkok 10310, Thailand",
    buyerBranch: "Head Office",
    subtotal: 98000, discount: 3000, vatAmount: 6650, totalAmount: 101650,
    amountInWordsThai: "หนึ่งแสนหนึ่งพันหกร้อยห้าสิบบาทถ้วน",
    issuedAt: "2026-07-11 09:30", created: "2026-07-11 09:30",
  },
  {
    id: "TI-2026-0002", invoiceId: "INV-2026-0004", bookingId: "BK-2026-0004", clientId: "CLI-001",
    sellerName: "FleetCo Operations Co., Ltd.",
    sellerTaxId: "0105568123456",
    sellerAddress: "99 Ratchadaphisek Rd, Huai Khwang, Bangkok 10310, Thailand",
    buyerName: "Thailand Post Co., Ltd.",
    buyerTaxId: "0107536000174",
    buyerAddress: "111 Praram 9 Rd, Huai Khwang, Bangkok 10310, Thailand",
    buyerBranch: "Head Office",
    subtotal: 49500, discount: 0, vatAmount: 3465, totalAmount: 52965,
    amountInWordsThai: "ห้าหมื่นสองพันเก้าร้อยหกสิบห้าบาทถ้วน",
    issuedAt: "2026-07-06 10:00", created: "2026-07-06 10:00",
  },
  {
    id: "TI-2026-0003", invoiceId: "INV-2026-0006", bookingId: "BK-2026-0016", clientId: "CLI-001",
    sellerName: "FleetCo Operations Co., Ltd.",
    sellerTaxId: "0105568123456",
    sellerAddress: "99 Ratchadaphisek Rd, Huai Khwang, Bangkok 10310, Thailand",
    buyerName: "Thailand Post Co., Ltd.",
    buyerTaxId: "0107536000174",
    buyerAddress: "111 Praram 9 Rd, Huai Khwang, Bangkok 10310, Thailand",
    buyerBranch: "Head Office",
    subtotal: 9000, discount: 0, vatAmount: 630, totalAmount: 9630,
    amountInWordsThai: "เก้าพันหกร้อยสามสิบบาทถ้วน",
    issuedAt: "2026-08-11 09:00", created: "2026-08-11 09:00",
  },
]);
