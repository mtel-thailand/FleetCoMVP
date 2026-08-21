// Shared tax-invoice store. Tax invoices are immutable once issued (brief
// §6.2) — this store only ever *adds* new ones (via "verify payment & issue
// tax invoice" in the document editor), never updates an existing record.
import { useEffect, useState } from "react";
import { mockTaxInvoices, type TaxInvoice } from "@/app/data/taxInvoices";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

let taxInvoices: TaxInvoice[] = loadPersisted("taxInvoices", [...mockTaxInvoices]);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("taxInvoices", taxInvoices);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<TaxInvoice[]>("taxInvoices", (value) => {
  taxInvoices = value;
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
