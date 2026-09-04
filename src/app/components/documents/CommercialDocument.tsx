/** @jsxImportSource react */
import type { Booking } from "@/app/data/bookings";
import type { ClientAccount } from "@/app/data/clients";
import { getTaxBranch } from "@/app/data/clients";
import { formatCurrency } from "@/app/data/formatters";
import type { QuotationLineItem } from "@/app/data/quotations";
import { formatBilingualDocumentDate as formatDate } from "@/app/i18n";
import { thaiBahtText } from "@/app/lib/thaiBahtText";
import fleetcoLogo from "@/assets/fleetco-logo.svg";
// Shared with the two editors' sidebars, which show this total before the
// sheet below has rendered it — one definition, so they cannot disagree.
import { computeDocumentTotals } from "@/app/lib/documentTotals";
import { A4Document } from "@/app/components/documents/A4Document";
import { demoToday } from "@/app/data/demoDates";

export type CommercialDocumentMode = "quotation" | "invoice";

interface PaymentInfo {
  date?: string | null;
  reference?: string | null;
  slipFiles?: string[];
}

interface CommercialDocumentProps {
  mode: CommercialDocumentMode;
  docNumber: string;
  client: ClientAccount | undefined;
  booking: Booking | undefined;
  bookingId: string;
  lineItems?: QuotationLineItem[];
  discount?: number;
  vatRate?: number;
  remarks?: string;
  paymentTerms?: string;
  validUntilOrDue?: string;
  issueDate?: string | null;
  version?: number;
  draft?: boolean;
  fleetcoSignature?: string | null;
  clientSignature?: string | null;
  amountDueOverride?: number;
  paymentInfo?: PaymentInfo;
}

export function CommercialDocument({
  mode,
  docNumber,
  client,
  booking,
  bookingId,
  lineItems = [],
  discount = 0,
  vatRate = 0.07,
  remarks,
  paymentTerms,
  validUntilOrDue,
  issueDate,
  version = 1,
  draft,
  fleetcoSignature,
  clientSignature,
  amountDueOverride,
  paymentInfo,
}: CommercialDocumentProps) {
  const title = mode === "quotation" ? "QUOTATION" : "INVOICE";
  const titleTh = mode === "quotation" ? "ใบเสนอราคา" : "ใบแจ้งหนี้";
  const validLabel = mode === "quotation" ? "Valid until / ใช้ได้ถึง:" : "Due / ครบกำหนด:";
  const hasLineItems = lineItems.length > 0;
  const totals = computeDocumentTotals(lineItems, discount, vatRate, amountDueOverride);
  const showPaymentInfo = !!paymentInfo?.date && (mode === "invoice");
  const taxBranch = getTaxBranch(client, booking?.taxBranchId);
  const rentalPeriodDates = booking
    ? {
        en: `${formatDate(booking.startDate).split(" / ")[0]} – ${formatDate(booking.endDate).split(" / ")[0]}`,
        th: `${formatDate(booking.startDate).split(" / ")[1]} – ${formatDate(booking.endDate).split(" / ")[1]}`,
      }
    : null;
  const rentalPeriodDays = booking
    ? Math.round((new Date(`${booking.endDate}T00:00:00`).getTime() - new Date(`${booking.startDate}T00:00:00`).getTime()) / 86400000) + 1
    : null;

  const head = (
    <div className="print:break-inside-avoid">
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <img src={fleetcoLogo} alt="FleetCo" className="h-11 w-16 shrink-0 object-contain object-left" />
          <div>
            <p className="font-semibold text-slate-900">FleetCo Operations Co., Ltd.</p>
            <p className="text-[12px] text-slate-500">บริษัท ฟลีทโค โอเปอเรชั่นส์ จำกัด</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tracking-tight text-slate-900">{title}</p>
          <p className="text-[12px] text-slate-500">{titleTh}</p>
        </div>
      </div>

      <div className="flex gap-8 py-4 text-[12px]">
        <div className="flex-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">From (Seller) / ผู้ขาย</p>
          <p className="font-semibold text-slate-900">FleetCo Operations Co., Ltd.</p>
          <p className="mt-1 max-w-[220px] leading-snug text-slate-500">99 Ratchadaphisek Rd, Huai Khwang, Bangkok 10310, Thailand</p>
          <p className="mt-1 text-slate-500">Tax ID / เลขผู้เสียภาษี: 0105568123456</p>
        </div>
        <div className="flex-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">To (Buyer) / ผู้ซื้อ</p>
          <p className="font-semibold text-slate-900">{client?.name ?? booking?.clientId ?? "Client"}</p>
          {(taxBranch?.addressEn || client?.registeredAddress) && <p className="mt-1 max-w-[260px] leading-snug text-slate-500">{taxBranch?.addressEn ?? client?.registeredAddress}</p>}
          {client?.taxId && <p className="mt-1 text-slate-500">Tax ID / เลขผู้เสียภาษี: {client.taxId}</p>}
          {(taxBranch || client?.branch) && <p className="text-slate-500">Tax registration branch / สาขาภาษี: {taxBranch ? `${taxBranch.code} · ${taxBranch.isHeadOffice ? "Head Office" : taxBranch.legalNameEn}` : client?.branch}</p>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 border-y border-slate-100 py-2.5 text-[12px]">
        <div>
          <p className="text-slate-400">Document No.</p>
          <p className="font-semibold text-slate-800">{docNumber}</p>
        </div>
        <div>
          <p className="text-slate-400">Version</p>
          <p className="font-semibold text-slate-800">v{version}</p>
        </div>
        <div>
          <p className="text-slate-400">Date / วันที่</p>
          <p className="font-semibold text-slate-800">{formatDate(issueDate || demoToday())}</p>
        </div>
        <div>
          <p className="text-slate-400">{validLabel}</p>
          <p className="font-semibold text-slate-800">{validUntilOrDue ? formatDate(validUntilOrDue) : "—"}</p>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">Rental ID / เลขที่การเช่า: {bookingId}</p>
    </div>
  );

  const columns = hasLineItems ? (
    <tr className="border-b-2 border-slate-800 text-slate-500">
      <th className="w-6 py-2.5 text-left font-medium">#</th>
      <th className="py-2.5 pr-3 text-left font-medium">Description / รายละเอียด</th>
      <th className="w-16 whitespace-nowrap py-2.5 pr-2 text-right font-medium"><span className="block">Qty</span><span className="text-[9px]">จำนวน</span></th>
      <th className="w-40 py-2.5 pl-3 text-left font-medium"><span className="block">Rental period</span><span className="text-[9px]">ระยะเวลาเช่า</span></th>
      <th className="w-32 whitespace-nowrap py-2.5 text-right font-medium">Unit Price</th>
      <th className="w-32 whitespace-nowrap py-2.5 text-right font-medium">Amount</th>
    </tr>
  ) : undefined;

  const rows = lineItems.map((li, i) => (
    <tr key={i} className="border-b border-slate-100 align-top print:break-inside-avoid">
      <td className="py-2.5 text-slate-400">{i + 1}</td>
      <td className="py-2.5 pr-3">
        <p className="text-slate-800">{li.description || "—"}</p>
        <p className="text-[10px] text-slate-400">{li.vehicleClass}</p>
      </td>
      <td className="py-2.5 pr-2 text-right text-slate-700">{li.quantity}</td>
      <td className="py-2.5 pl-3 text-slate-700">
        {rentalPeriodDates ? (
          <>
            <p className="whitespace-nowrap text-[10px]">{rentalPeriodDates.en}</p>
            <p className="whitespace-nowrap text-[9px] text-slate-400">{rentalPeriodDates.th}</p>
          </>
        ) : <p>—</p>}
        {rentalPeriodDays && <p className="text-[10px] text-slate-400">{rentalPeriodDays} days</p>}
      </td>
      <td className="py-2.5 text-right text-slate-700">{formatCurrency(li.unitPrice)}</td>
      <td className="py-2.5 text-right font-medium text-slate-900">{formatCurrency(li.amount)}</td>
    </tr>
  ));

  const tail = (
    <div className="print:break-inside-avoid">
      <div className="flex justify-end pt-3">
        <div className="w-64 space-y-1 text-[12px]">
          {hasLineItems && (
            <>
              <div className="flex justify-between"><span className="text-slate-500">Subtotal / ยอดรวม</span><span>{formatCurrency(totals.subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount / ส่วนลด</span><span>−{formatCurrency(discount)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">VAT / ภาษีมูลค่าเพิ่ม ({Math.round(vatRate * 100)}%)</span><span>{formatCurrency(totals.vat)}</span></div>
            </>
          )}
          <div className="mt-1.5 flex justify-between border-t border-slate-800 pt-1.5 text-base font-bold">
            <span>{mode === "invoice" ? "Amount Due" : "Grand Total"}</span>
            <span>{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>
      </div>
      <p className="mt-0.5 text-right text-[11px] italic text-slate-400">({thaiBahtText(totals.grandTotal)})</p>

      {(paymentTerms || remarks || showPaymentInfo) && (
        <div className="mt-6 space-y-1 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
          {paymentTerms && <p><span className="text-slate-400">Payment Terms / เงื่อนไขการชำระเงิน:</span> {paymentTerms}</p>}
          {remarks && <p><span className="text-slate-400">Remarks / หมายเหตุ:</span> {remarks}</p>}
          {showPaymentInfo && <p><span className="text-slate-400">Payment Date:</span> {formatDate(paymentInfo.date)}</p>}
          {showPaymentInfo && paymentInfo.reference && <p><span className="text-slate-400">Reference:</span> {paymentInfo.reference}</p>}
          {showPaymentInfo && <p><span className="text-slate-400">Payment Slip:</span> {paymentInfo.slipFiles && paymentInfo.slipFiles.length > 0 ? paymentInfo.slipFiles.join(", ") : "Not attached"}</p>}
        </div>
      )}

      {mode === "quotation" ? (
        <div className="mt-14 flex justify-between text-[11px] text-slate-400">
          <div className="w-44 text-center">
            <div className="flex h-12 items-end justify-center border-b border-slate-300">
              {fleetcoSignature && <img src={fleetcoSignature} alt="FleetCo signature" className="mb-0.5 h-11 object-contain" />}
            </div>
            <p className="mt-1">Authorized Signature — FleetCo</p>
            <p>ลายมือชื่อผู้มีอำนาจ — ฟลีทโค</p>
          </div>
          <div className="w-44 text-center">
            <div className="flex h-12 items-end justify-center border-b border-slate-300">
              {clientSignature && <img src={clientSignature} alt="Client signature" className="mb-0.5 h-11 object-contain" />}
            </div>
            <p className="mt-1">Authorized Signature — Client</p>
            <p>ลายมือชื่อผู้มีอำนาจ — ลูกค้า</p>
          </div>
        </div>
      ) : (
        <div className="mt-14 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
          <p><span className="text-slate-400">Issuer / ผู้ออกเอกสาร:</span> FleetCo Operations Co., Ltd.</p>
          {draft ? (
            <p className="mt-1 text-slate-400">Draft — not yet issued</p>
          ) : issueDate ? (
            <p className="mt-1"><span className="text-slate-400">Issued / วันที่ออก:</span> {formatDate(issueDate)}</p>
          ) : null}
        </div>
      )}
    </div>
  );

  return <A4Document docNumber={docNumber} docTypeLabel={title} draft={draft} head={head} columns={columns} rows={rows} tail={tail} />;
}
