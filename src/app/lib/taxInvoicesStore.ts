// Shared tax-invoice store. Tax invoices are immutable once issued (brief
// §6.2) — this store only ever *adds* new ones (via "verify payment & issue
// tax invoice" in the document editor), never updates an existing record.
import { useEffect, useState } from "react";
import { mockTaxInvoices, type TaxInvoice } from "@/app/data/taxInvoices";
import { loadPersisted, mergeSeedRecords, savePersisted, scopeToThailandPost, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

function scopeTaxInvoices(records: TaxInvoice[]): TaxInvoice[] {
  return scopeToThailandPost(records).map((taxInvoice) =>
    taxInvoice.buyerName === "Siam Logistics Co., Ltd."
      ? {
          ...taxInvoice,
          buyerName: "Thailand Post Co., Ltd.",
          buyerTaxId: "0107536000174",
          buyerAddress: "111 Praram 9 Rd, Huai Khwang, Bangkok 10310, Thailand",
          buyerBranch: "Head Office",
        }
      : taxInvoice,
  );
}

let taxInvoices: TaxInvoice[] = scopeTaxInvoices(mergeSeedRecords(loadPersisted("taxInvoices", [...mockTaxInvoices]), mockTaxInvoices));
const listeners = new Set<Listener>();

function notify() {
  savePersisted("taxInvoices", taxInvoices);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<TaxInvoice[]>("taxInvoices", (value) => {
  taxInvoices = scopeTaxInvoices(value);
  notify();
});

export function getTaxInvoices(): TaxInvoice[] {
  return taxInvoices;
}

export function addTaxInvoice(taxInvoice: TaxInvoice) {
  taxInvoices = [taxInvoice, ...taxInvoices];
  notify();
}

/** Sequential, gap-free numbering per brief §6.3 — scoped to the current year. */
export function nextTaxInvoiceId(): string {
  const year = new Date().getFullYear();
  const nums = taxInvoices
    .filter((t) => t.id.startsWith(`TI-${year}-`))
    .map((t) => parseInt(t.id.split("-").pop() ?? "", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `TI-${year}-${String(next).padStart(4, "0")}`;
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetTaxInvoices(): void {
  taxInvoices = [...mockTaxInvoices];
  notify();
}

export function useTaxInvoices(): TaxInvoice[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return taxInvoices;
}
