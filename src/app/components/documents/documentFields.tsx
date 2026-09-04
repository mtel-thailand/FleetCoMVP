import type { ReactNode } from "react";

// Field primitives shared by the two document editors (DocumentEditor.tsx
// and InvoiceIssuanceReview.tsx). Both had grown their own private copies
// of these constants, which had already drifted apart by a couple of pixels
// of vertical padding — small enough that nobody would file it, big enough
// that the two panels didn't quite look like the same product.
export const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]";
export const LABEL_CLASS = "mb-1 block text-xs font-medium text-slate-600";

export function Field({ label, id, children }: { label: string; id?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
      {children}
    </div>
  );
}

// A read-only term/value row, for the facts a panel states rather than
// edits (source quotation, line-item count).
export function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

// Numeric inputs display "" instead of a literal 0 — a value of 0 is still
// what's stored, but a "0" character sitting in the field is what caused
// the actual bug this replaces: typing into a field that already reads "0"
// can land the new digits on either side of it (e.g. "0500" instead of
// "500") depending on where the cursor lands, since there was always a real
// character there to type around. An empty field has nothing to type around.
export function numberOrEmpty(n: number): string | number {
  return n === 0 ? "" : n;
}

export function parseNumber(raw: string): number {
  return Number(raw) || 0;
}
