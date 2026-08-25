import { Printer } from "lucide-react";
import { useBookings } from "@/app/lib/bookingsStore";
import { type TaxInvoice } from "@/app/data/taxInvoices";
import { useOpenBookingFromDocument } from "@/app/lib/documentNav";
import { formatDate } from "@/app/components/ui/utils";
import { formatCurrency } from "@/app/data/formatters";
import { A4Document } from "@/app/components/documents/A4Document";

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

export function TaxInvoiceDocument({ taxInvoice }: { taxInvoice: TaxInvoice }) {
  const lineItems = taxInvoice.lineItems ?? [];
  const hasLineItems = lineItems.length > 0;
  const vatRate = taxInvoice.vatRate ?? 0.07;

  const head = (
    <div className="print:break-inside-avoid">
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">FC</div>
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
          <p className="text-slate-500">Branch / สาขา: {taxInvoice.buyerBranch}</p>
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
      <th className="w-6 py-2 text-left font-medium">#</th>
      <th className="py-2 text-left font-medium">Description / รายละเอียด</th>
      <th className="w-14 py-2 text-right font-medium">Qty</th>
      <th className="w-24 py-2 text-left font-medium">Unit / หน่วย</th>
      <th className="w-28 py-2 text-right font-medium">Unit Price</th>
      <th className="w-28 py-2 text-right font-medium">Amount</th>
    </tr>
  ) : undefined;

  const rows = lineItems.map((item, index) => (
    <tr key={index} className="border-b border-slate-100 align-top print:break-inside-avoid">
      <td className="py-2 text-slate-400">{index + 1}</td>
      <td className="py-2 pr-2">
        <p className="text-slate-800">{item.description || "—"}</p>
        <p className="text-[10px] text-slate-400">{item.vehicleClass}</p>
      </td>
      <td className="py-2 text-right text-slate-700">{item.quantity}</td>
      <td className="py-2 text-slate-700">{item.unit}</td>
      <td className="py-2 text-right text-slate-700">{formatCurrency(item.unitPrice)}</td>
      <td className="py-2 text-right font-medium text-slate-900">{formatCurrency(item.amount)}</td>
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
  const booking = useBookings().find((b) => b.id === taxInvoice.bookingId);
  const openBooking = useOpenBookingFromDocument();

  return (
    <div className="max-w-[1600px]">
      {/* Page header — full width of the page, not squeezed to the
          document's own width (see QuotationDetail's identical header for
          why). No primary action here (a tax invoice is read-only/
          immutable once issued) — Print used to live here as a result, but
          now lives in the toolbar below instead, matching where
          Quotation/InvoiceDetail keep theirs, so Print sits in the same
          place across all three document viewers. */}
      <div className="flex items-start justify-between gap-4 mb-5 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{taxInvoice.id}</h1>
          {/* Doc-type label dropped — see QuotationDetail.tsx's comment on
              the same line; identical redundancy, identical fix. text-xs on
              the button itself (not just this <p>) for the same reason too
              — theme.css's button font-size reset doesn't yield to a size
              class on an ancestor, only on the button itself. */}
          <p className="text-xs text-slate-500 mt-1">
            For <button onClick={() => openBooking(taxInvoice.bookingId)} className="text-xs underline decoration-dotted hover:text-slate-800 cursor-pointer">{booking?.id ?? taxInvoice.bookingId}</button>
          </p>
        </div>
      </div>

      {/* Document toolbar — just Print, right-aligned above the scrollable
          frame below rather than inside it (see QuotationDetail's identical
          toolbar for why, including why it's plain text rather than a
          boxed button, and why the id doesn't repeat here). */}
      <div className="flex justify-end mb-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          <Printer size={13} /> Print / Download PDF
        </button>
      </div>

      {/* Same A4 sheet and grey document desk used by quotations and
          invoices, so every commercial document has one consistent viewer
          on screen and the same print-accurate page geometry. */}
      <div className="bg-slate-200 rounded-2xl overflow-hidden print:bg-white print:rounded-none">
        <div className="p-4 sm:p-8 print:p-0 h-[75vh] print:h-auto overflow-y-auto print:overflow-visible">
          <TaxInvoiceDocument taxInvoice={taxInvoice} />
        </div>
      </div>
    </div>
  );
}
