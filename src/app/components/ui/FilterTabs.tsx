// Underline tabs with an inline count badge — the same pattern already
// established twice elsewhere in this app (ops's own InboxTabs in
// RequestInbox.tsx, and this exact client portal's own former My Rentals
// tabs) rather than a third, different visual treatment for the same
// "quick filter + count" idea. No icons, matching both of those.
export type FilterTabOption = {
  value: string;
  label: string;
  count: number;
  // Inactive-state badge reads amber — matches ops's "Needs FleetCo Action"
  // treatment — for an option that means "this needs your attention,"
  // instead of the plain slate badge every other option gets.
  highlight?: boolean;
};

export function FilterTabs({
  options, value, onChange,
}: {
  options: FilterTabOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value || opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap cursor-pointer ${
              active ? "border-[var(--portal-accent)] text-[var(--portal-accent)]" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {opt.label}
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                active
                  ? "bg-[var(--portal-accent)] text-white"
                  : opt.highlight
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
