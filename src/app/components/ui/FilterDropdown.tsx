import { useEffect, useRef, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

type FilterDropdownOption = {
  label: string;
  value: string;
};

interface FilterDropdownProps {
  value: string;
  options: FilterDropdownOption[];
  onChange: (value: string) => void;
  icon?: LucideIcon;
  placeholder?: string;
  displayLabel?: string;
  className?: string;
}

export function FilterDropdown({
  value,
  options,
  onChange,
  icon: Icon,
  placeholder = "Select",
  displayLabel,
  className = "",
}: FilterDropdownProps) {
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

  const selected = options.find((option) => option.value === value);

  return (
    <div className={`relative ${className}`.trim()} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        {Icon && <Icon size={13} />}
        <span>{displayLabel ?? selected?.label ?? placeholder}</span>
        <ChevronDown size={11} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
          {options.map((option) => (
            <button
              key={option.value || option.label}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer ${
                option.value === value ? "text-[var(--portal-accent)] font-medium" : "text-slate-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
