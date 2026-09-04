"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import type { DropdownProps } from "react-day-picker";
import { enGB, th } from "date-fns/locale";

import { cn } from "./utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { useI18n } from "@/app/i18n";

// Keep the quick-select range broad enough for both historical records and
// future bookings. Callers can still provide narrower bounds when a calendar
// is meant to be constrained to a particular date range.
const DEFAULT_FROM_YEAR = 1900;
const DEFAULT_TO_YEAR = 2100;

// Inlined from the vendored shadcn `button.tsx` this file used to import.
// That file was deleted along with the other 43 unused shadcn components;
// calendar.tsx is one of only two that survived the cleanup, and it needed
// the vendored `ghost` day-cell styling. The strings below are the verbatim
// cva output, composed in cva's own order (base, variant, size), so the date
// picker keeps its established day-cell treatment. This is vendored styling,
// deliberately NOT routed through the app's own Button primitive: Button
// encodes FleetCo's design decisions, react-day-picker's internals are not
// one of them.
const DP_BASE = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive";
const DP_SIZE = "h-9 px-4 py-2 has-[>svg]:px-3";
const DP_GHOST = "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50";

function CalendarDropdown({
  name,
  children,
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: DropdownProps) {
  const label = ariaLabel?.replace(/:\s*$/, "") || name || "Select";
  const width = name === "months" ? "w-[6rem]" : "w-[4.5rem]";
  const options = React.Children.toArray(children).filter(React.isValidElement);

  return (
    <div className={cn("inline-flex", width, className)}>
      <Select
        value={String(value)}
        onValueChange={(nextValue) => {
          onChange?.({ target: { value: nextValue } } as React.ChangeEvent<HTMLSelectElement>);
        }}
      >
        <SelectTrigger
          aria-label={label}
          size="sm"
          className="h-8 w-full gap-1 rounded-lg border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-white focus-visible:border-[var(--portal-accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--portal-accent-ring)] [&>svg]:size-3 [&>svg]:opacity-60"
        >
          <SelectValue className="min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side="bottom"
          sideOffset={4}
          portal={false}
          className="z-[70] !max-h-56 min-w-[var(--radix-select-trigger-width)] rounded-lg border-slate-200 bg-white shadow-lg"
        >
          {options.map((option) => {
            const optionProps = option.props as React.OptionHTMLAttributes<HTMLOptionElement>;
            const optionValue = String(optionProps.value ?? "");
            return (
              <SelectItem key={optionValue} value={optionValue} className="text-xs">
                {optionProps.children}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  // Pads every month out to a constant 6-week grid instead of the 4-6 rows a
  // month's own length and start day would otherwise produce. Without this,
  // the calendar's height changes as you page between months, which shifts
  // the prev/next nav buttons under the cursor and makes fast repeated
  // clicking (e.g. paging several months back) land on the wrong control.
  fixedWeeks = true,
  // The dropdowns make jumping to a distant month or year a one-step action,
  // while retaining the arrow buttons for nearby navigation.
  captionLayout = "dropdown-buttons",
  fromYear = DEFAULT_FROM_YEAR,
  toYear = DEFAULT_TO_YEAR,
  locale,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const { language } = useI18n();
  const rangeSelection = props.mode === "range" ? props.selected : undefined;
  const hasCompleteRange = Boolean(
    rangeSelection?.from &&
      rangeSelection?.to &&
      (rangeSelection.from.getFullYear() !== rangeSelection.to.getFullYear() ||
        rangeSelection.from.getMonth() !== rangeSelection.to.getMonth() ||
        rangeSelection.from.getDate() !== rangeSelection.to.getDate()),
  );
  return (
    <DayPicker
      {...props}
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      captionLayout={captionLayout}
      fromYear={fromYear}
      toYear={toYear}
      locale={locale ?? (language === "th" ? th : enGB)}
      className={cn("w-full p-3", hasCompleteRange && "calendar-has-range", className)}
      classNames={{
        months: "flex w-full flex-col gap-2 sm:flex-row",
        month: "flex min-w-0 flex-1 flex-col gap-4",
        caption:
          "relative grid min-h-10 w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center",
        caption_label: "text-sm font-medium",
        vhidden: "sr-only",
        caption_dropdowns:
          "col-start-2 row-start-1 flex min-w-0 items-center justify-center gap-2",
        dropdown_month: "w-[6rem]",
        dropdown_year: "w-[4.5rem]",
        nav: "pointer-events-none absolute inset-0 z-10 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center",
        nav_button: cn(
          "pointer-events-auto inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors",
          "hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]",
          "disabled:cursor-not-allowed disabled:opacity-30",
        ),
        nav_button_previous: "static col-start-1 row-start-1 justify-self-start",
        nav_button_next: "static col-start-3 row-start-1 justify-self-end",
        table: "w-full border-collapse space-x-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cn(
          DP_BASE, DP_GHOST, DP_SIZE,
          "mx-auto size-8 min-w-8 max-w-8 p-0 font-normal aria-selected:opacity-100",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        ...components,
        Dropdown: components?.Dropdown ?? CalendarDropdown,
        IconLeft: components?.IconLeft ?? (({ className, ...props }) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        )),
        IconRight: components?.IconRight ?? (({ className, ...props }) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        )),
      }}
    />
  );
}

export { Calendar };
