import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Send, X, Calendar, ChevronDown, Clock, Phone, MapPin } from "lucide-react";
import { mockClients, mockClientUsers } from "@/app/data/clients";
import type { VehicleClass } from "@/app/data/vehicles";
import type { RentalType, Booking } from "@/app/data/bookings";
import { getAdminRole } from "@/app/lib/auth";
import { addBooking, getBookings, nextBookingId, nowStamp } from "@/app/lib/bookingsStore";
import { addNotification } from "@/app/lib/notificationsStore";
import { useClients } from "@/app/lib/clientsStore";
import { useBodyScrollLock } from "@/app/hooks/useBodyScrollLock";
import { Calendar as DayCalendar } from "@/app/components/ui/calendar";
import { formatDate } from "@/app/components/ui/utils";

// Thailand Post is the only client on the platform at launch (brief §1) — the
// client portal operates as this client's users. A real build would resolve
// this from the authenticated account, not a constant.
const CLIENT_ID = "CLI-001";
// Snapshot at module load, just to seed a sensible default form value below —
// the live, reactive rate card (used for the actual dropdown options) is
// read inside the component via useClients() so a Client Accounts edit to
// the rate card shows up here without a reload.
const staticClient = mockClients.find((c) => c.id === CLIENT_ID)!;

function currentRequester() {
  const role = getAdminRole();
  return (
    mockClientUsers.find((u) => u.clientId === CLIENT_ID && u.role === role) ??
    mockClientUsers.find((u) => u.clientId === CLIENT_ID && u.role === "client_requester")
  );
}

// Rental type is derived from the date span the client picks, not a separate
// choice — brief §3's own table ties the two 1:1 (Ad hoc = single day, Short
// term = multiple days, Medium term = weeks, Long term = multiple months),
// so asking the client to pick both independently just invites a request
// where the two disagree (e.g. "Ad hoc" tagged on a 3-month span). Thresholds
// below are the same ones the seed data already follows.
function deriveRentalType(days: number): RentalType {
  if (days <= 1) return "Ad hoc / Daily";
  if (days <= 13) return "Short term";
  if (days <= 89) return "Medium term";
  return "Long term";
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.round((new Date(endDate + "T00:00:00").getTime() - new Date(startDate + "T00:00:00").getTime()) / 86400000) + 1;
}

type DraftBooking = {
  // "" is a real, distinct state here — not just "TypeScript wants a
  // string" — unlike quantity (1 is a genuine, almost-always-right
  // default), no vehicle class is more likely to be correct than any
  // other, so starting on the first one in the list risked a client
  // submitting a request for whatever happened to sort first without
  // ever having chosen it. Making the field genuinely empty until they
  // pick forces that choice instead of defaulting past it.
  vehicleClass: VehicleClass | "";
  quantity: number;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  jobNotes: string;
};

const emptyDraft: DraftBooking = {
  vehicleClass: "",
  quantity: 1,
  startDate: "",
  endDate: "",
  pickupLocation: "",
  jobNotes: "",
};

// Portals a popover's content to document.body and positions it with
// fixed coordinates measured from the trigger, instead of a plain CSS
// `absolute` box nested inside the trigger's own wrapper. That matters here
// specifically because both consumers below sit inside this modal's
// scrollable content area (`overflow-y-auto`) — a plain absolute popover
// gets clipped by that container's boundary the moment it's taller than the
// space left below the trigger. Escaping via a portal + `position: fixed`
// sidesteps the clipping entirely, at the cost of needing to track the
// trigger's position by hand (recomputed on open, and on any scroll —
// capture-phase, since the scroll that moves the trigger is the modal's own
// inner content div, not the window). Flips to open upward when there
// isn't room below and there's more room above, so it also can't run off
// the bottom of the viewport on a short screen.
function PopoverPortal({ open, onClose, triggerRef, estimatedHeight, matchTriggerWidth, children }: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  estimatedHeight: number;
  matchTriggerWidth?: boolean;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    function update() {
      const rect = triggerRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      setStyle({
        position: "fixed",
        left: rect.left,
        zIndex: 60,
        ...(matchTriggerWidth ? { width: rect.width } : {}),
        ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef, estimatedHeight, matchTriggerWidth]);

  // Outside-click-to-close has to check both the trigger AND this portaled
  // content — they're no longer DOM neighbors once rendered via portal, so a
  // click inside the popover would otherwise look "outside" the trigger and
  // close itself immediately.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || contentRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, triggerRef, onClose]);

  // data-portal="client" here isn't decorative — it's re-establishing the
  // burgundy accent scope. [data-portal="client"] in theme.css is what
  // overrides --portal-accent away from the FleetCo-blue default, and this
  // content is portaled straight to document.body, landing as a *sibling*
  // of Layout.tsx's own data-portal div rather than a descendant of it.
  // CSS custom properties only inherit down the DOM tree, not across
  // siblings, so without this the calendar and location picker would
  // silently fall back to blue — same root cause as the login page's
  // RoleModal bug, different component.
  if (!open || !style) return null;
  return createPortal(
    <div ref={contentRef} style={style} data-portal="client">
      {children}
    </div>,
    document.body,
  );
}

// One combined range field instead of two separate date inputs — reuses the
// same Calendar-in-range-mode pattern (and the same classNames, so it looks
// like the same control) already built for the ops-side document filters in
// FilterBar.tsx. Also matches that one now: picking dates only edits a local
// draft, and nothing reaches the actual form (onChangeStart/onChangeEnd)
// until Apply — closing over an incomplete or accidental click used to
// silently commit it. Cancel (and clicking outside, which routes through the
// same handler) discards the draft and reverts the trigger to whatever was
// last actually applied.
function DateRangeField({ startDate, endDate, onChangeStart, onChangeEnd }: {
  startDate: string; endDate: string; onChangeStart: (v: string) => void; onChangeEnd: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const range: DateRange | undefined = startDate
    ? { from: new Date(startDate + "T00:00:00"), to: endDate ? new Date(endDate + "T00:00:00") : undefined }
    : undefined;

  const [draft, setDraft] = useState<DateRange | undefined>(range);

  function openPicker() {
    setDraft(range);
    setOpen(true);
  }
  function handleCancel() {
    setDraft(range);
    setOpen(false);
  }
  function handleApply() {
    if (!draft?.from || !draft?.to) return;
    onChangeStart(format(draft.from, "yyyy-MM-dd"));
    onChangeEnd(format(draft.to, "yyyy-MM-dd"));
    setOpen(false);
  }

  const draftDays = draft?.from && draft?.to ? Math.round((draft.to.getTime() - draft.from.getTime()) / 86400000) + 1 : 0;
  const hint = !draft?.from ? "Pick a start date" : !draft?.to ? "Pick an end date" : `${draftDays} day${draftDays === 1 ? "" : "s"} selected`;

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={() => (open ? handleCancel() : openPicker())}
        className={`w-full flex items-center gap-2 border rounded-lg px-3 py-2 text-xs text-left bg-white hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)] cursor-pointer ${
          open ? "border-[var(--portal-accent)]" : "border-slate-200"
        }`}
      >
        <Calendar size={13} className="text-slate-400 shrink-0" />
        {range?.from ? (
          <span className="text-slate-800">
            {format(range.from, "d MMM yyyy")} – {range.to ? format(range.to, "d MMM yyyy") : <span className="text-slate-400">pick end date</span>}
          </span>
        ) : (
          <span className="text-slate-400">Select dates</span>
        )}
      </button>

      <PopoverPortal open={open} onClose={handleCancel} triggerRef={triggerRef} estimatedHeight={410}>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72">
          <DayCalendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from ?? new Date()}
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
          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">{hint}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!draft?.from || !draft?.to}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--portal-accent)] hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </PopoverPortal>
    </div>
  );
}

// Generic dropdown-from-a-fixed-list picker — originally built just for
// branch location (picking from the client's known locations instead of
// free text, so what FleetCo sees stays consistent), now shared with
// vehicle type too: both are "choose one of a short known list," and this
// keeps that one interaction pattern (and its PopoverPortal escape-the-
// scroll-container plumbing) written once instead of twice. Generic over
// `T extends string` rather than hardcoding `string` so callers with a
// literal union (VehicleClass) get the option list and onChange back
// narrowed to that union, no `as` cast needed at the call site.
function Picker<T extends string>({ value, options, onChange, placeholder }: {
  value: T | ""; options: T[]; onChange: (v: T) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-xs text-left bg-white hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)] cursor-pointer ${
          open ? "border-[var(--portal-accent)]" : "border-slate-200"
        }`}
      >
        <span className={value ? "text-slate-800" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      <PopoverPortal open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} estimatedHeight={244} matchTriggerWidth>
        <div className="max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`block w-full text-left px-3 py-2 text-xs cursor-pointer ${
                opt === value ? "text-[var(--portal-accent)] font-medium bg-[var(--portal-accent-light)]" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </PopoverPortal>
    </div>
  );
}

// Modal, not a page — triggered from a "+ New Request" button on My Requests
// or My Rentals (or their "Repeat" action), not a standalone route. It used
// to be routed at /portal/request; that page-vs-modal call was a genuine
// toss-up, but a modal keeps the client on the list they were already
// looking at and — thanks to the reactive bookings store — their new
// request is simply *there* the moment they close it, no extra navigation
// required.
//
// Single-column now, not the old 2-column form + live-estimate-sidebar
// layout — the sidebar's own numbers (rate-card estimate, and a duplicate
// readout of what you'd already typed on the left) turned out to be more
// than this flow needed; FleetCo's quotation is the one price that ever
// mattered (brief §6.1), and showing an estimate ahead of it invited
// comparing the two. Rental type/duration still show up, just relocated as
// a plain info line under Rental dates; branch phone/address show the same
// way under Branch location once one's picked — see both below.
export function RequestVehicle({ onClose }: { onClose: () => void }) {
  useBodyScrollLock();
  const client = useClients().find((c) => c.id === CLIENT_ID) ?? staticClient;
  const rateCardClasses = [...new Set(client.rateCard.map((r) => r.vehicleClass))] as VehicleClass[];
  const branches = client.branches ?? [];
  const [draft, setDraft] = useState<DraftBooking>(emptyDraft);
  const selectedBranch = branches.find((b) => b.name === draft.pickupLocation);

  useEffect(() => {
    const repeatId = sessionStorage.getItem("repeatBookingId");
    if (!repeatId) return;
    sessionStorage.removeItem("repeatBookingId");
    const source = getBookings().find((b) => b.id === repeatId);
    if (source) {
      setDraft({
        vehicleClass: source.vehicleClassRequested,
        quantity: source.quantity,
        startDate: "",
        endDate: "",
        pickupLocation: source.pickupLocation,
        jobNotes: source.jobNotes,
      });
    }
  }, []);

  // No end date yet? Default to the start date — a same-day request
  // shouldn't make the client type the same date twice.
  const effectiveEndDate = draft.endDate || draft.startDate;
  const days = draft.startDate && effectiveEndDate ? daysBetween(draft.startDate, effectiveEndDate) : null;
  const rentalType = days !== null ? deriveRentalType(days) : null;

  const canSubmit =
    draft.vehicleClass !== "" && draft.startDate && effectiveEndDate && draft.pickupLocation.trim().length > 0 && draft.quantity > 0 && effectiveEndDate >= draft.startDate;

  function set<K extends keyof DraftBooking>(key: K, value: DraftBooking[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // !draft.vehicleClass here (not just !canSubmit, which already covers
    // it) is what narrows draft.vehicleClass from VehicleClass | "" down to
    // VehicleClass for the rest of this function — canSubmit is an opaque
    // boolean as far as the type-checker's concerned, it can't correlate
    // "canSubmit is true" with "this specific field is non-empty" the way
    // checking the field itself lets it.
    if (!canSubmit || !rentalType || !draft.vehicleClass) return;
    const requester = currentRequester();
    const id = nextBookingId();
    const booking: Booking = {
      id,
      clientId: CLIENT_ID,
      requestedByName: requester?.name ?? "Client User",
      rentalType,
      vehicleClassRequested: draft.vehicleClass,
      quantity: draft.quantity,
      startDate: draft.startDate,
      endDate: effectiveEndDate,
      pickupLocation: draft.pickupLocation.trim(),
      jobNotes: draft.jobNotes.trim(),
      status: "Requested",
      isRecurringBilling: rentalType === "Long term",
      created: nowStamp(),
      updated: nowStamp(),
    };
    addBooking(booking);
    addNotification({
      eventTypeId: "new_request",
      portal: "fleetco",
      recipient: "FleetCo Operations",
      bookingId: booking.id,
      message: `New request ${booking.id} — ${booking.quantity}× ${booking.vehicleClassRequested}, ${booking.rentalType}, ${formatDate(booking.startDate)}.`,
    });
    // Closes straight away rather than swapping to an inline "Request
    // submitted" success view — the toast is the confirmation now, and the
    // client's already looking at the list this booking just landed on
    // (bookingsStore is reactive), so there's nothing the old success
    // screen showed that isn't already visible the moment the modal's gone.
    toast.success(`Request ${id} submitted — you'll see a quotation in your inbox once it's issued.`);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      {/* sm:max-w-4xl used to fit a Request Summary panel that sat beside
          this form — once that panel was removed, the form became a
          single-column stack (Vehicle type, Quantity, Rental dates, Branch
          location, Job notes) with nothing left to justify that width, just
          a lot of empty margin on either side. max-w-md (the size every
          other compact form modal in this app uses — DeclineModal in
          QuotationDetail.tsx, MarkPaidModal in InvoiceDetail.tsx) read a
          little tight for this form specifically, so this one sits a step
          up at max-w-xl instead. */}
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl shadow-xl max-h-[90vh] sm:min-h-[65vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-semibold text-slate-900">Request a Vehicle</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col">
          {/* No grey section box / "REQUEST DETAILS" label here anymore —
              that box used to visually separate this form from a Request
              Summary panel that sat beside it (see the Rental dates comment
              below); now that the panel's gone this is the only section on
              the card, so the box wasn't grouping anything, just adding a
              layer. Matches how every other form modal in this app looks
              (DeclineModal in QuotationDetail.tsx, MarkPaidForm in
              InvoiceDetail.tsx) — fields sit directly on the card. */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-col gap-4 flex-1">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Vehicle type</label>
                  <Picker value={draft.vehicleClass} options={rateCardClasses} onChange={(v) => set("vehicleClass", v)} placeholder="Select a vehicle type" />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Quantity</label>
                  {/* 999 is a fat-finger guard, not a claimed fleet limit — the
                      fleet itself only has a handful of vehicles per class.
                      FleetCo's quotation is where a request actually gets
                      checked against what's really available.
                      type="text" + inputMode="numeric", not type="number" —
                      still gets the numeric keypad on mobile, but
                      type="number" silently doesn't support .select()/
                      selectionStart/selectionEnd in any major browser (it
                      no-ops, no error), which is what made overtyping the
                      default "1" concatenate instead of replace. min/max
                      are enforced in the onChange clamp below already, not
                      by browser-native number-input validation, so nothing
                      here actually depended on the HTML attributes. */}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={draft.quantity}
                    onChange={(e) => set("quantity", Math.min(999, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))}
                    onFocus={(e) => e.target.select()}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Rental dates</label>
                  <DateRangeField
                    startDate={draft.startDate}
                    endDate={draft.endDate}
                    onChangeStart={(v) => set("startDate", v)}
                    onChangeEnd={(v) => set("endDate", v)}
                  />
                  {/* Rental type and duration used to live in the Request
                      Summary panel that sat beside this form — now that the
                      panel's gone, this is the only place either shows up,
                      so it renders as soon as there's a date span to derive
                      them from, not just once the form is otherwise ready. */}
                  {rentalType && days !== null && (
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <Clock size={11} className="text-slate-300 shrink-0" />
                      {rentalType} · {days} day{days > 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Branch location</label>
                  <Picker value={draft.pickupLocation} options={branches.map((b) => b.name)} onChange={(v) => set("pickupLocation", v)} placeholder="Select a branch location" />
                  {selectedBranch && (selectedBranch.phone || selectedBranch.address) && (
                    <div className="text-[11px] text-slate-400 mt-1.5 flex flex-col gap-1">
                      {/* Phone and address are two different kinds of fact
                          glued together with a middle dot before — split
                          into their own icon-led lines now instead, since a
                          single icon can't honestly represent both at once. */}
                      {selectedBranch.phone && (
                        <span className="flex items-center gap-1"><Phone size={11} className="text-slate-300 shrink-0" />{selectedBranch.phone}</span>
                      )}
                      {selectedBranch.address && (
                        <span className="flex items-center gap-1"><MapPin size={11} className="text-slate-300 shrink-0" />{selectedBranch.address}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* flex-1 + flex flex-col here (not on the card's other, fixed-
                    content fields) is what lets Job notes soak up whatever
                    vertical space the fields above don't use, instead of
                    leaving it as dead space at the card's bottom — the same
                    "grow into what's left" instinct as the form's own
                    flex-1 wrapper, one level up. The
                    textarea itself also needs flex-1 (a textarea is a
                    normal block-level flex item for sizing purposes, so
                    this stretches its actual rendered height, not just its
                    wrapper's) — rows is dropped since flex-1 now owns the
                    height entirely. */}
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Job notes <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Anything FleetCo should know about this job..."
                    value={draft.jobNotes}
                    onChange={(e) => set("jobNotes", e.target.value)}
                    className="w-full flex-1 min-h-[72px] border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] resize-none"
                  />
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  FleetCo reviews every request against current fleet capacity. You’ll receive a quotation or an availability update once the review is complete.
                </p>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-2.5 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--portal-accent)] cursor-pointer"
                >
                  <Send size={13} /> Submit Request
                </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
