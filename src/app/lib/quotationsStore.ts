// Shared quotation store — same reasoning as bookingsStore.ts. The Client
// Portal now writes to quotations (Accept/Decline), and that has to be
// visible immediately to anything else reading them.
import { useEffect, useState } from "react";
import { mockQuotations, type Quotation } from "@/app/data/quotations";
import { loadPersisted, mergeSeedRecords, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

let quotations: Quotation[] = mergeSeedRecords(loadPersisted("quotations", [...mockQuotations]), mockQuotations);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("quotations", quotations);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<Quotation[]>("quotations", (value) => {
  quotations = value;
  notify();
});

export function getQuotations(): Quotation[] {
  return quotations;
}

export function addQuotation(quotation: Quotation) {
  quotations = [quotation, ...quotations];
  notify();
}

export function updateQuotation(id: string, patch: Partial<Quotation>) {
  quotations = quotations.map((q) => (q.id === id ? { ...q, ...patch } : q));
  notify();
}

/** Sequential, gap-free numbering per brief §6.3 — scoped to the current year. */
export function nextQuotationId(): string {
  const year = new Date().getFullYear();
  const nums = quotations
    .filter((q) => q.id.startsWith(`QT-${year}-`))
    .map((q) => parseInt(q.id.split("-").pop() ?? "", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `QT-${year}-${String(next).padStart(4, "0")}`;
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetQuotations(): void {
  quotations = [...mockQuotations];
  notify();
}

export function useQuotations(): Quotation[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return quotations;
}
