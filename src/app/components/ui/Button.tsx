import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/app/components/ui/utils";

// The styled-primitive layer this app was missing.
//
// Every variant below was reverse-engineered from the 68 hand-written
// <button className="..."> strings that existed across the live pages — this
// component does not introduce a single new visual decision, it just gives
// the ones already in use a name. Where the audit found genuine drift
// (three different hover fills on outline buttons, two different rose stops
// for destructive actions), the *most-used* value won and the alternatives
// are listed in the comment on that variant, so the choice is visible and
// reversible rather than silently averaged away.
//
// Note on font-weight: theme.css's base layer already sets
// `button { font-weight: var(--font-weight-medium) }`, so every button in
// this app has always rendered at 500 whether or not its class string said
// `font-medium`. Stating it here is a no-op that makes the real value
// readable instead of inherited from three files away.

const button = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--portal-accent-ring)]",
  {
    variants: {
      variant: {
        // 12 occurrences — the primary action on every screen.
        primary:
          "bg-[var(--portal-accent)] text-white hover:bg-[var(--portal-accent-hover)] disabled:hover:bg-[var(--portal-accent)]",
        // 20 occurrences — the most common button in the app. Drift found:
        // hover:bg-slate-50 (10), hover:bg-white (6), hover:bg-slate-100 (2).
        // slate-50 wins on count; see the migration note in the handoff docs.
        outline:
          "border border-slate-200 text-slate-600 hover:bg-slate-50",
        // Destructive confirm. Drift found: rose-600/700 (2) vs rose-500/600
        // (1). The darker pair wins — it is the one used inside modals,
        // where the confirm button carries the most weight.
        danger: "bg-rose-600 text-white hover:bg-rose-700",
        // Single use today (Suspend/void-style actions).
        warning: "bg-amber-500 text-white hover:bg-amber-600",
        // Text-only affordance: back links, inline row actions.
        ghost: "text-slate-500 hover:text-slate-800",
        // Text-only but branded: "View all", "Add another", drill-downs.
        link: "text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)]",
        // 9 occurrences — the modal/panel dismiss X. Squarer hit area, no fill.
        close: "text-slate-400 hover:text-slate-600",
      },
      size: {
        // Toolbar / table-row scale.
        sm: "px-3 py-1.5 text-xs",
        // Default. Modal footers use this with `fullWidth`.
        md: "px-4 py-2 text-xs",
        // Full-width form submits.
        lg: "w-full py-2.5 text-xs",
        // Fixed-height toolbar button that must line up with inputs.
        toolbar: "h-8 px-3 text-xs",
        // Icon-only: no padding, no fill, sized by its own child.
        icon: "p-0",
      },
      fullWidth: { true: "w-full", false: "" },
    },
    compoundVariants: [
      // Text-only variants carry no box, so box padding would misalign them
      // against adjacent text.
      { variant: ["ghost", "link", "close"], class: "px-0 py-0 rounded-none" },
    ],
    defaultVariants: { variant: "outline", size: "md", fullWidth: false },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export function Button({ className, variant, size, fullWidth, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(button({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

export { button as buttonVariants };
