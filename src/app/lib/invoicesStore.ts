// Shared invoice store — same reasoning as bookingsStore.ts. The Client
// Portal writes to invoices ("mark as paid"), and that has to be visible
// immediately to anything else reading them.
import { useEffect, useState } from "react";
import { mockInvoices, type Invoice } from "@/app/data/invoices";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

let invoices: Invoice[] = loadPersisted("invoices", [...mockInvoices]);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("invoices", invoices);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<Invoice[]>("invoices", (value) => {
  invoices = value;
  notify();
});

export function getInvoices(): Invoice[] {
  return invoices;
}

export function addInvoice(invoice: Invoice) {
  invoices = [invoice, ...invoices];
  notify();
}

export function updateInvoice(id: string, patch: Partial<Invoice>) {
  invoices = invoices.map((i) => (i.id === id ? { ...i, ...patch } : i));
  notify();
}

/** Sequential, gap-free numbering per brief §6.3 — scoped to the current year. */
export function nextInvoiceId(): string {
  const year = new Date().getFullYear();
  const nums = invoices
    .filter((i) => i.id.startsWith(`INV-${year}-`))
    .map((i) => parseInt(i.id.split("-").pop() ?? "", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `INV-${year}-${String(next).padStart(4, "0")}`;
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetInvoices(): void {
  invoices = [...mockInvoices];
  notify();
}

export function useInvoices(): Invoice[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return invoices;
}
