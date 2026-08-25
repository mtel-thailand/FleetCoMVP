import { useEffect, useRef, useState } from "react";
import { Calendar, Search, Download, Plus, ChevronDown, Loader2 } from "lucide-react";
import { FilterDropdown } from "./FilterDropdown";
import { Calendar as DayCalendar } from "./calendar";
import { format } from "date-fns";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { SHOW_EXPORTS } from "@/app/lib/featureFlags";

const periodOptions = ["All time", "Today", "Last 7 days", "Last 30 days", "This month", "Custom range"];

interface FilterBarProps {
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchableFields?: string[];
  showPeriod?: boolean;
  showCreate?: boolean;
  createLabel?: string;
  createDisabled?: boolean;
  onSearch?: (v: string) => void;
  // Seeds the search box's own internal state — for a caller restoring a
  // persisted search term (see usePersistentListState) after a remount.
  // Purely additive: every existing caller that doesn't pass this still
  // starts blank, exactly as before.
  defaultSearch?: string;
  onPeriodChange?: (v: string) => void;
  onCreate?: () => void;
  showExport?: boolean;
  onExportCSV?: () => void;
  onExportXLSX?: () => void;
  exportDisabled?: boolean;
  extraFilters?: React.ReactNode;
  // Arbitrary content in the same right-aligned slot as Export/Create —
  // for a page whose own primary action button doesn't fit showCreate's
  // fixed icon/label/sizing (e.g. a specifically-chosen icon, an exact
  // pixel height already tuned elsewhere). Purely additive: every existing
  // caller that doesn't pass this renders exactly as before.
  trailing?: React.ReactNode;
}

function DateRangePopover({
  onApply,
  onCancel,
  initialRange,
}: {
  onApply: (range: DateRange) => void;
  onCancel: () => void;
  initialRange?: DateRange;
}) {
  const [range, setRange] = useState<DateRange | undefined>(initialRange);

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72">
      <DayCalendar
        mode="range"
        selected={range}
        onSelect={setRange}
        numberOfMonths={1}
        classNames={{
          months: "flex flex-col gap-2",
          month: "flex flex-col gap-3",
          caption: "flex justify-center relative items-center",
          caption_label: "text-xs font-semibold text-slate-800",
          nav: "flex items-center gap-1",
          nav_button:
            "inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-30",
          nav_button_previous: "absolute left-0",
          nav_button_next: "absolute right-0",
          table: "w-full border-collapse",
          head_row: "grid grid-cols-7",
          head_cell: "text-slate-400 text-center text-[10px] font-semibold py-1",
          row: "grid grid-cols-7 mt-0.5",
          cell: "relative p-0 text-center [&:has([aria-selected])]:bg-[var(--portal-accent-light)] first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg [&:has(>.day-range-start)]:rounded-l-lg [&:has(>.day-range-end)]:rounded-r-lg",
          day: "h-8 w-full flex items-center justify-center rounded-lg text-[11px] font-medium text-slate-700 hover:bg-slate-100 aria-selected:opacity-100 transition-colors",
          day_range_start: "day-range-start bg-[var(--portal-accent)] text-white hover:!bg-[var(--portal-accent-hover)] rounded-lg shadow-sm",
          day_range_end: "day-range-end bg-[var(--portal-accent)] text-white hover:!bg-[var(--portal-accent-hover)] rounded-lg shadow-sm",
          day_selected: "bg-[var(--portal-accent)] text-white hover:bg-[var(--portal-accent)]",
          day_today: "text-[var(--portal-accent)] bg-[var(--portal-accent-light)] hover:bg-[var(--portal-accent-light-2)] font-semibold",
          day_outside: "!text-[#CAD5E2] aria-selected:!text-[#CAD5E2]",
          day_disabled: "text-slate-300 opacity-40 cursor-not-allowed",
          day_range_middle: "aria-selected:bg-[var(--portal-accent-light)] aria-selected:text-slate-700 rounded-none",
          day_hidden: "invisible",
        }}
      />
      <div className="flex items-center justify-between gap-2 pt-3 mt-1 border-t border-slate-100">
        <span className="text-xs text-slate-500 leading-relaxed">
          {range?.from && range?.to ? (
            <>
              {format(range.from, "d MMM yyyy")} –{" "}
              <br />
              {format(range.to, "d MMM yyyy")}
            </>
          ) : range?.from ? (
            <>
              {format(range.from, "d MMM yyyy")} –{" "}
              <br />
              pick end date
            </>
          ) : (
            "Pick a start date"
          )}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!range?.from || !range?.to}
            onClick={() => range?.from && range?.to && onApply(range)}
            className="px-3 py-1.5 text-xs text-white bg-[var(--portal-accent)] rounded-lg hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export function FilterBar({
  showSearch = true,
  searchPlaceholder = "Search",
  searchableFields,
  showPeriod = true,
  showCreate = false,
  createLabel = "Create",
  createDisabled = false,
  onSearch,
  defaultSearch = "",
  onPeriodChange,
  onCreate,
  showExport = false,
  onExportCSV,
  onExportXLSX,
  exportDisabled = false,
  extraFilters,
  trailing,
}: FilterBarProps) {
  const [period, setPeriod] = useState("All time");
  const [search, setSearch] = useState(defaultSearch);
  const [focused, setFocused] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [appliedRange, setAppliedRange] = useState<DateRange | undefined>();
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDatePicker) return;
    const handler = (e: MouseEvent) => {
      if (!datePickerRef.current?.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDatePicker]);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  function handleExport(type: "csv" | "xlsx") {
    if (exporting || exportDisabled) return;
    setExportOpen(false);
    setExporting(true);
    requestAnimationFrame(() => {
      try {
        if (type === "csv") onExportCSV?.();
        else onExportXLSX?.();
        toast.success("Export ready — downloading...");
      } finally {
        setTimeout(() => setExporting(false), 600);
      }
    });
  }

  const handlePeriod = (p: string) => {
    if (p === "Custom range") {
      setShowDatePicker(true);
      return;
    }
    setPeriod(p);
    setAppliedRange(undefined);
    onPeriodChange?.(p);
  };

  const handleApply = (range: DateRange) => {
    setAppliedRange(range);
    const label = `${format(range.from!, "d MMM")} – ${format(range.to!, "d MMM")}`;
    setPeriod(label);
    setShowDatePicker(false);
    onPeriodChange?.(`custom:${range.from!.toISOString()}|${range.to!.toISOString()}`);
  };

  const periodDisplayOptions = periodOptions.map((p) => ({ label: p, value: p }));

  const showTooltip = focused && !search && !!searchableFields?.length;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {showSearch && (
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); onSearch?.(e.target.value); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="h-8 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] focus:border-transparent"
          />
          {showTooltip && (
            <div className="absolute bottom-full left-0 mb-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 w-max max-w-xs pointer-events-none">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Search by</p>
              <p className="text-xs text-slate-700 leading-relaxed">
                {searchableFields!.join(", ")}
              </p>
              <div className="absolute top-full left-4 w-2 h-2 bg-white border-b border-r border-slate-200 rotate-45 -mt-1" />
            </div>
          )}
        </div>
      )}

      {showPeriod && (
        <div className="relative" ref={datePickerRef}>
          <FilterDropdown
            value={appliedRange ? "Custom range" : period}
            options={periodDisplayOptions}
            onChange={handlePeriod}
            icon={Calendar}
            displayLabel={appliedRange ? period : undefined}
          />
          {showDatePicker && (
            <DateRangePopover
              onApply={handleApply}
              onCancel={() => setShowDatePicker(false)}
              initialRange={appliedRange}
            />
          )}
        </div>
      )}

      {extraFilters}

      <div className="ml-auto flex items-center gap-2">
        {SHOW_EXPORTS && showExport && (
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => {
                if (!exportDisabled && !exporting) setExportOpen((v) => !v);
              }}
              disabled={exporting}
              title={exportDisabled ? "No data to export" : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs transition-colors select-none ${
                exportDisabled
                  ? "text-slate-300 cursor-not-allowed"
                  : exporting
                  ? "text-slate-500 opacity-70 cursor-not-allowed"
                  : "text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              {exporting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              Export
              <ChevronDown
                size={11}
                className={`transition-transform duration-150 ${exportOpen ? "rotate-180" : ""}`}
              />
            </button>

            {exportOpen && !exportDisabled && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[180px]">
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport("xlsx")}
                  className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Export as Excel (.xlsx)
                </button>
              </div>
            )}
          </div>
        )}
        {showCreate && (
          <button
            onClick={onCreate}
            disabled={createDisabled}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            {createLabel}
          </button>
        )}
        {trailing}
      </div>
    </div>
  );
}
