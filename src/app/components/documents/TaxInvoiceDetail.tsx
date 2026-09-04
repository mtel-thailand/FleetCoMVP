/** @jsxImportSource react */
import { useBookings } from "@/app/lib/bookingsStore";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import type { Booking } from "@/app/data/bookings";
import { type TaxInvoice } from "@/app/data/taxInvoices";
import { useOpenBookingFromDocument, useOpenInvoice } from "@/app/lib/documentNav";
import { ArrowRight, Receipt } from "lucide-react";
import { formatBilingualDocumentDate as formatDate, useI18n } from "@/app/i18n";
import { formatCurrency } from "@/app/data/formatters";
import { A4Document } from "@/app/components/documents/A4Document";
import { DOCUMENT_PREVIEW_FRAME_CLASS, DocumentPreviewFrame } from "@/app/components/documents/DocumentWorkspace";
import fleetcoLogo from "@/assets/fleetco-logo.svg";

// The primary place a tax invoice is viewed — promoted out of
// TaxInvoiceInbox.tsx (where it used to be a local, unexported modal
// component) into a shared components/documents/ component, matching
// QuotationDetail/InvoiceDetail's convention: takes the resolved record
// itself, not a pre-resolved label string, and looks up what it needs
// (here, just the booking, for the "For {bookingId}" link — seller/buyer
// details are snapshotted directly onto the record at issue time, so no
// client lookup is needed the way Quotation/InvoiceDetail need one).
//
// Read-only, always — no role gating, no actions, since a tax invoice is
// immutable the moment it's issued (brief §6.2). Reused as-is by ops's own
// OpsTaxInvoiceDetail.tsx — this component never needed portal-specific
// logic to begin with (useOpenBookingFromDocument already handles both).

export function TaxInvoiceDocument({ taxInvoice, booking }: { taxInvoice: TaxInvoice; booking?: Booking }) {
  const lineItems = taxInvoice.lineItems ?? [];
  const hasLineItems = lineItems.length > 0;
  const vatRate = taxInvoice.vatRate ?? 0.07;
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
          <p className="text-lg font-bold tracking-tight text-slate-900">TAX INVOICE</p>
          <p className="text-[12px] text-slate-500">ใบกำกับภาษี</p>
        </div>
      </div>

      <div className="flex gap-8 py-4 text-[12px]">
        <div className="flex-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">From (Seller) / ผู้ขาย</p>
          <p className="font-semibold text-slate-900">{taxInvoice.sellerName}</p>
          <p className="mt-1 max-w-[260px] leading-snug text-slate-500">{taxInvoice.sellerAddress}</p>
          <p className="mt-1 text-slate-500">Tax ID / เลขผู้เสียภาษี: {taxInvoice.sellerTaxId}</p>
        </div>
        <div className="flex-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">To (Buyer) / ผู้ซื้อ</p>
          <p className="font-semibold text-slate-900">{taxInvoice.buyerName}</p>
          <p className="mt-1 max-w-[260px] leading-snug text-slate-500">{taxInvoice.buyerAddress}</p>
          <p className="mt-1 text-slate-500">Tax ID / เลขผู้เสียภาษี: {taxInvoice.buyerTaxId}</p>
          <p className="text-slate-500">Tax registration branch / สาขาภาษี: {taxInvoice.buyerBranch}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 border-y border-slate-100 py-2.5 text-[12px]">
        <div>
          <p className="text-slate-400">Document No.</p>
          <p className="font-semibold text-slate-800">{taxInvoice.id}</p>
        </div>
        <div>
          <p className="text-slate-400">Version</p>
          <p className="font-semibold text-slate-800">v1</p>
        </div>
        <div>
          <p className="text-slate-400">Date / วันที่</p>
          <p className="font-semibold text-slate-800">{formatDate(taxInvoice.issuedAt)}</p>
        </div>
        <div>
          <p className="text-slate-400">Invoice reference</p>
          <p className="font-semibold text-slate-800">{taxInvoice.invoiceId}</p>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">Rental ID / เลขที่การเช่า: {taxInvoice.bookingId}</p>
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

  const rows = lineItems.map((item, index) => (
    <tr key={index} className="border-b border-slate-100 align-top print:break-inside-avoid">
      <td className="py-2.5 text-slate-400">{index + 1}</td>
      <td className="py-2.5 pr-3">
        <p className="text-slate-800">{item.description || "—"}</p>
        <p className="text-[10px] text-slate-400">{item.vehicleClass}</p>
      </td>
      <td className="py-2.5 pr-2 text-right text-slate-700">{item.quantity}</td>
      <td className="py-2.5 pl-3 text-slate-700">
        {rentalPeriodDates ? (
          <>
            <p className="whitespace-nowrap text-[10px]">{rentalPeriodDates.en}</p>
            <p className="whitespace-nowrap text-[9px] text-slate-400">{rentalPeriodDates.th}</p>
          </>
        ) : <p>—</p>}
        {rentalPeriodDays && <p className="text-[10px] text-slate-400">{rentalPeriodDays} days</p>}
      </td>
      <td className="py-2.5 text-right text-slate-700">{formatCurrency(item.unitPrice)}</td>
      <td className="py-2.5 text-right font-medium text-slate-900">{formatCurrency(item.amount)}</td>
    </tr>
  ));

  const tail = (
    <div className="print:break-inside-avoid">
      <div className={`${hasLineItems ? "pt-3" : "mt-8"} flex justify-end`}>
        <div className="w-72 space-y-1.5 text-[12px]">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal / ยอดรวม</span><span>{formatCurrency(taxInvoice.subtotal)}</span></div>
          {taxInvoice.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount / ส่วนลด</span><span>−{formatCurrency(taxInvoice.discount)}</span></div>}
          <div className="flex justify-between"><span className="text-slate-500">VAT / ภาษีมูลค่าเพิ่ม ({Math.round(vatRate * 100)}%)</span><span>{formatCurrency(taxInvoice.vatAmount)}</span></div>
          <div className="mt-2 flex justify-between border-t border-slate-800 pt-2 text-base font-bold">
            <span>Total Amount</span>
            <span>{formatCurrency(taxInvoice.totalAmount)}</span>
          </div>
        </div>
      </div>
      <p className="mt-1 text-right text-[11px] italic text-slate-400">({taxInvoice.amountInWordsThai})</p>

      <div className="mt-8 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
        <p><span className="text-slate-400">Issued / วันที่ออก:</span> {formatDate(taxInvoice.issuedAt)}</p>
        <p className="mt-1"><span className="text-slate-400">Reference invoice / อ้างอิงใบแจ้งหนี้:</span> {taxInvoice.invoiceId}</p>
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2.5">
          <p className="font-semibold text-slate-700">Verification record / บันทึกการตรวจสอบ</p>
          <p className="mt-1">Verified and issued by {taxInvoice.verifiedByName ?? "FleetCo Finance"} · {taxInvoice.verifiedByRole ?? "Authorized FleetCo officer"}</p>
          <p>{formatDate(taxInvoice.verifiedAt ?? taxInvoice.issuedAt)} · Method: {taxInvoice.verificationMethod ?? "Historical record"}</p>
        </div>
      </div>

      <p className="mt-7 text-[10px] text-slate-400">
        This tax invoice is immutable once issued. Corrections are made through a credit note.
        <br />ใบกำกับภาษีนี้ไม่สามารถแก้ไขได้หลังออกเอกสาร การแก้ไขทำผ่านใบลดหนี้
      </p>

    </div>
  );

  return (
    <A4Document
      docNumber={taxInvoice.id}
      docTypeLabel="TAX INVOICE"
      head={head}
      columns={columns}
      rows={rows}
      tail={tail}
    />
  );
}

export function TaxInvoiceDetail({ taxInvoice }: { taxInvoice: TaxInvoice }) {
  const { t } = useI18n();
  const booking = useBookings().find((b) => b.id === taxInvoice.bookingId);
  const sourceInvoice = useInvoices().find((invoice) => invoice.id === taxInvoice.invoiceId);
  const sourceQuotation = useQuotations().find((quotation) => quotation.id === sourceInvoice?.quotationId);
  // Some historical tax-invoice fixtures contain only their immutable
  // totals. Rehydrate the locked line details from the linked invoice or
  // accepted quotation so the document still shows quantity and rental
  // period, without replacing any tax-invoice amounts.
  const lineItems = taxInvoice.lineItems ?? sourceInvoice?.lineItems ?? sourceQuotation?.lineItems;
  const displayTaxInvoice = lineItems
    ? {
        ...taxInvoice,
        lineItems,
        discount: taxInvoice.lineItems ? taxInvoice.discount : sourceInvoice?.discount ?? sourceQuotation?.discount ?? taxInvoice.discount,
        vatRate: taxInvoice.lineItems ? taxInvoice.vatRate : sourceInvoice?.vatRate ?? sourceQuotation?.vatRate ?? taxInvoice.vatRate,
      }
    : taxInvoice;
  const openBooking = useOpenBookingFromDocument();
  const openInvoice = useOpenInvoice();

  return (
    <div className="max-w-[1600px]">
      {/* Page header — full width of the page, not squeezed to the
          document's own width (see QuotationDetail's identical header for
          why). No primary action here (a tax invoice is read-only/
          immutable once issued) — Download lives inside the document preview
          below, matching Quotation/InvoiceDetail, so the control sits in the
          same place across all three document viewers. */}
      <div className="flex items-start justify-between gap-4 mb-5 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{taxInvoice.id}</h1>
          {/* Doc-type label dropped — see QuotationDetail.tsx's comment on
              the same line; identical redundancy, identical fix. text-xs on
              the button itself (not just this <p>) for the same reason too
              — theme.css's button font-size reset doesn't yield to a size
              class on an ancestor, only on the button itself. */}
          <p className="text-xs text-slate-500 mt-1">
            {t("For")} <button onClick={() => openBooking(taxInvoice.bookingId)} className="text-xs underline decoration-dotted hover:text-slate-800 cursor-pointer">{booking?.id ?? taxInvoice.bookingId}</button>
          </p>
          <button
            type="button"
            onClick={() => openInvoice(taxInvoice.invoiceId)}
            className="mt-1.5 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <Receipt size={12} /> {t("Source invoice")} {taxInvoice.invoiceId} <ArrowRight size={11} />
          </button>
        </div>
      </div>

      {/* Same A4 sheet and grey document desk used by quotations and
          invoices, so every commercial document has one consistent viewer
          on screen and the same print-accurate page geometry. */}
      <DocumentPreviewFrame downloadFilename={`${taxInvoice.id}.pdf`} className={DOCUMENT_PREVIEW_FRAME_CLASS}>
        <div className="h-[75vh] print:h-auto overflow-y-auto print:overflow-visible">
          <TaxInvoiceDocument taxInvoice={displayTaxInvoice} booking={booking} />
        </div>
      </DocumentPreviewFrame>
    </div>
  );
}
