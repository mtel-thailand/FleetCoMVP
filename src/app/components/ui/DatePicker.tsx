import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { Calendar as DayCalendar } from "@/app/components/ui/calendar";
import { useI18n, formatUiDate } from "@/app/i18n";
import { cn } from "@/app/components/ui/utils";
import { getAdminRole, ROLE_PORTAL } from "@/app/lib/auth";

// Single-date replacement for native <input type="date">. That control's own
// closed box can be styled freely, but the moment it's clicked the OS/browser
// draws its own calendar — no CSS reaches it, so it's a control that suddenly
// looks like a different app. This renders the same DayCalendar the range
// pickers already use (RequestVehicle.tsx's DateRangeField, FilterBar.tsx's
// DateRangePopover), just in single-day mode with no Apply step — picking a
// day commits and closes immediately, matching a native date input's own
// one-click feel.
//
// Built on Radix Popover rather than a hand-rolled portal + outside-click
// listener (which is what RequestVehicle.tsx's own PopoverPortal does). That
// matters specifically here: every call site of this component sits inside a
// form rendered through this app's Radix `Modal`. If a call site ever sets
// that Modal's `dismissOnOutsideClick={false}` (so an accidental click
// outside a long form doesn't discard it), Dialog.Content calls
// `preventDefault()` on any pointer-down it sees as "outside" itself. A
// hand-rolled portal is invisible to Dialog's dismissable-layer stack, so
// that preventDefault would swallow the click on a calendar day before the
// day's own onSelect ever fires — the picker closes but never commits.
// Radix Popover registers on the same dismissable-layer stack Dialog uses,
// so Dialog correctly recognises an open Popover as "not outside" and leaves
// its clicks alone, regardless of that setting. It also gets correct
// collision-aware positioning (flips above the trigger when there isn't room
// below) for free instead of the manual viewport-space estimate a hand-rolled
// version needs.
export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  invalid = false,
  disabled = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const { language } = useI18n();
  const [open, setOpen] = useState(false);
  const role = getAdminRole();
  const portal = role ? ROLE_PORTAL[role] : "fleetco";

  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-xs focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
            invalid ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:ring-[var(--portal-accent)]",
            className,
          )}
        >
          <Calendar size={13} className="shrink-0 text-slate-400" />
          <span className={value ? "text-slate-800" : "text-slate-400"}>
            {value ? formatUiDate(value, false) : placeholder}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        {/* The calendar is portalled to body, so restore the active portal
            scope here for selected/today states and focus rings. */}
        <Popover.Content
          data-portal={portal}
          align="start"
          sideOffset={4}
          avoidCollisions
          className="z-[60] w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <DayCalendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? new Date()}
            onSelect={(day) => {
              if (!day) return;
              onChange(format(day, "yyyy-MM-dd"));
              setOpen(false);
            }}
            classNames={{
              table: "w-full border-collapse",
              head_row: "grid grid-cols-7",
              head_cell: "text-slate-400 text-center text-[10px] font-semibold py-1",
              row: "grid grid-cols-7 mt-0.5",
              cell: "relative p-0 text-center",
              day: "mx-auto flex size-8 min-w-8 max-w-8 items-center justify-center rounded-lg text-[11px] font-medium text-slate-700 hover:bg-slate-100 aria-selected:opacity-100 transition-colors",
              day_selected: "relative z-10 !size-8 !min-w-8 !max-w-8 bg-[var(--portal-accent)] text-white hover:!bg-[var(--portal-accent-hover)] hover:text-white shadow-sm",
              day_today: "text-[var(--portal-accent)] bg-[var(--portal-accent-light)] hover:bg-[var(--portal-accent-light-2)] font-semibold",
              day_outside: "!text-[#CAD5E2] aria-selected:!text-[#CAD5E2]",
              day_disabled: "text-slate-300 opacity-40 cursor-not-allowed",
              day_hidden: "invisible",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
