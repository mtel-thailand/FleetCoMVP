import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Same click-to-open, custom-styled list as FilterDropdown.tsx, just sized
// and styled for a form field (w-full, matching this app's other inputs'
// border/padding/focus-ring) rather than a filter bar's compact button —
// a native <select>'s own closed box can be styled freely, but the open
// dropdown itself is OS/browser chrome no amount of CSS reaches, so it's
// the one control on a form full of matching slate-bordered fields that
// suddenly looks like a different app the moment you click it.
export function FormSelect<T extends string>({
  value, options, onChange,
}: {
  value: T; options: readonly T[]; onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] cursor-pointer"
      >
        <span className="text-slate-800">{value}</span>
        <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => { onChange(option); setOpen(false); }}
              className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer ${
                option === value ? "text-[var(--portal-accent)] font-medium" : "text-slate-700"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
