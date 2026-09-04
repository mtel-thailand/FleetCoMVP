import { cn } from "@/app/components/ui/utils";

// Extracted from 42 near-identical hand-written <input>/<textarea> class
// strings. The only real variation across them was `bg-white`, present on 10
// and absent on 20 — every one of the 20 sat on an already-white surface, so
// stating it here is a no-op for them and removes the ambiguity for the rest.
//
// `invalid` drives the error treatment that ClientAccounts.tsx's tax-ID field
// previously spelled out inline; it is the only state that changes the
// border, so it lives here rather than being re-derived per form.
const field =
  "w-full rounded-lg border px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";
const ok = "border-slate-200 focus:ring-[var(--portal-accent)]";
const bad = "border-rose-300 focus:ring-rose-200";

type FieldProps = { invalid?: boolean };

export function Input({
  className, invalid = false, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  return <input className={cn(field, invalid ? bad : ok, className)} {...props} />;
}

export function Textarea({
  className, invalid = false, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  return (
    <textarea className={cn(field, "resize-none", invalid ? bad : ok, className)} {...props} />
  );
}
