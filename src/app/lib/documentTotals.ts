import type { QuotationLineItem } from "@/app/data/quotations";

// One place that knows how a commercial document's money adds up.
//
// This math used to exist three times: privately inside
// CommercialDocument.tsx (what actually prints on the sheet), and again in
// DocumentEditor.tsx and InvoiceIssuanceReview.tsx, which each need a total
// to show in the sidebar *before* the document has rendered — and can't
// read one back out of it. Three copies of "subtotal, minus discount, plus
// rounded VAT" is three chances for the number in the sidebar and the
// number on the invoice to disagree, on the one screen where they must not.
export const VAT_RATE = 0.07;

export interface DocumentTotals {
  subtotal: number;
  afterDiscount: number;
  vat: number;
  grandTotal: number;
}

// `amountDueOverride` exists for already-issued documents, which carry the
// total they were issued with — that recorded figure wins over anything
// recomputed from the line items, so an old document never silently
// restates itself if the VAT rate or rounding ever changes.
export function computeDocumentTotals(
  lineItems: QuotationLineItem[],
  discount = 0,
  vatRate: number = VAT_RATE,
  amountDueOverride?: number,
): DocumentTotals {
  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const afterDiscount = Math.max(0, subtotal - discount);
  const vat = Math.round(afterDiscount * vatRate);
  return {
    subtotal,
    afterDiscount,
    vat,
    grandTotal: amountDueOverride ?? afterDiscount + vat,
  };
}
