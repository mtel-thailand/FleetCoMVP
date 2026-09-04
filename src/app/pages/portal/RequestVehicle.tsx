import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Modal, ModalTitle } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { toast } from "sonner";
import { formatUiDate, translate } from "@/app/i18n";
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
  taxBranchId: string;
  jobNotes: string;
};

const emptyDraft: DraftBooking = {
  vehicleClass: "",
  quantity: 1,
  startDate: "",
  endDate: "",
  pickupLocation: "",
  taxBranchId: "",
  jobNotes: "",
};

// One combined range field instead of two separate date inputs — reuses the
// same Calendar-in-range-mode pattern (and the same classNames, so it looks
// like the same control) already built for the ops-side document filters in
// FilterBar.tsx. Also matches that one now: picking dates only edits a local
// draft, and nothing reaches the actual form (onChangeStart/onChangeEnd)
// until Apply — closing over an incomplete or accidental click used to
// silently commit it. Cancel (and clicking outside / Escape, which route
// through the same onOpenChange) discards the draft and reverts the trigger
// to whatever was last actually applied.
//
// Built on Radix Popover rather than a hand-rolled createPortal + manual
// outside-click listener (which this used to be, alongside a sibling Picker
// below sharing the same approach). That matters specifically because this
// whole form sits inside this app's Radix `Modal` (a Dialog): a hand-rolled
// portal is invisible to Dialog's dismissable-layer stack, so Dialog's own
// outside-pointer handling would swallow clicks on the calendar before the
// day's own onSelect ever fired — the popover looked open but nothing was
// selectable. Radix Popover registers on the same dismissable-layer stack
// Dialog uses, so Dialog correctly leaves its clicks alone. It also gets
// correct collision-aware positioning (flips above the trigger, escapes this
// modal's `overflow-y-auto` scroll clipping) for free.
function DateRangeField({ startDate, endDate, onChangeStart, onChangeEnd }: {
  startDate: string; endDate: string; onChangeStart: (v: string) => void; onChangeEnd: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const range: DateRange | undefined = startDate
    ? { from: new Date(startDate + "T00:00:00"), to: endDate ? new Date(endDate + "T00:00:00") : undefined }
    : undefined;

  const [draft, setDraft] = useState<DateRange | undefined>(range);

  // Fires on every open-state change Radix initiates itself — opening the
  // trigger, Escape, or an outside click — so re-seeding the draft here
  // covers both "just opened" (start from what's actually applied) and
  // "closed without Apply" (discard edits) in one place.
  function handleOpenChange(next: boolean) {
    setDraft(range);
    setOpen(next);
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
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`w-full flex items-center gap-2 border rounded-lg px-3 py-2 text-xs text-left bg-white hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)] cursor-pointer ${
            open ? "border-[var(--portal-accent)]" : "border-slate-200"
          }`}
        >
          <Calendar size={13} className="text-slate-400 shrink-0" />
          {range?.from ? (
            <span className="text-slate-800">
              {formatUiDate(format(range.from, "yyyy-MM-dd"), false)} – {range.to ? formatUiDate(format(range.to, "yyyy-MM-dd"), false) : <span className="text-slate-400">pick end date</span>}
            </span>
          ) : (
            <span className="text-slate-400">Select dates</span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        {/* data-portal="client" here isn't decorative — it's re-establishing
            the burgundy accent scope. [data-portal="client"] in theme.css is
            what overrides --portal-accent away from the FleetCo-blue
            default, and Radix Popover.Content portals straight to
            document.body, landing as a *sibling* of Layout.tsx's own
            data-portal div rather than a descendant of it. CSS custom
            properties only inherit down the DOM tree, not across siblings,
            so without this the calendar would silently fall back to blue —
            same root cause as the login page's RoleModal bug, different
            component. */}
        <Popover.Content
          data-portal="client"
          align="start"
          sideOffset={4}
          className="z-[60] w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <DayCalendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from ?? new Date()}
            numberOfMonths={1}
            classNames={{
              table: "w-full border-collapse",
              head_row: "grid grid-cols-7",
              head_cell: "text-slate-400 text-center text-[10px] font-semibold py-1",
              row: "grid grid-cols-7 mt-0.5",
              cell: "calendar-range-cell relative p-0 text-center",
              day: "mx-auto flex size-8 min-w-8 max-w-8 items-center justify-center rounded-lg text-[11px] font-medium text-slate-700 hover:bg-slate-100 aria-selected:opacity-100 transition-colors",
              day_range_start: "calendar-range-start day-range-start relative z-10 !size-8 !min-w-8 !max-w-8 bg-[var(--portal-accent)] text-white hover:!bg-[var(--portal-accent-hover)] rounded-lg shadow-sm",
              day_range_end: "calendar-range-end day-range-end relative z-10 !size-8 !min-w-8 !max-w-8 bg-[var(--portal-accent)] text-white hover:!bg-[var(--portal-accent-hover)] rounded-lg shadow-sm",
              day_selected: "bg-[var(--portal-accent)] text-white hover:bg-[var(--portal-accent)]",
              day_today: "text-[var(--portal-accent)] bg-[var(--portal-accent-light)] hover:bg-[var(--portal-accent-light-2)] font-semibold",
              day_outside: "!text-[#CAD5E2] aria-selected:!text-[#CAD5E2]",
              day_disabled: "text-slate-300 opacity-40 cursor-not-allowed",
              day_range_middle: "calendar-range-middle day-range-middle relative z-10 aria-selected:bg-[var(--portal-accent-light)] aria-selected:text-slate-700 rounded-none",
              day_hidden: "invisible",
            }}
          />
          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">{hint}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"
                type="button"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm"
                type="button"
                onClick={handleApply}
                disabled={!draft?.from || !draft?.to}
              >
                Apply
              </Button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Generic dropdown-from-a-fixed-list picker — originally built just for
// delivery location (picking from the client's known locations instead of
// free text, so what FleetCo sees stays consistent), now shared with
// vehicle type too: both are "choose one of a short known list," and this
// keeps that one interaction pattern written once instead of twice. Generic
// over `T extends string` rather than hardcoding `string` so callers with a
// literal union (VehicleClass) get the option list and onChange back
// narrowed to that union, no `as` cast needed at the call site. Built on
// Radix Popover for the same reason DateRangeField above is — see its
// comment.
function Picker<T extends string>({ value, options, onChange, placeholder }: {
  value: T | ""; options: T[]; onChange: (v: T) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-xs text-left bg-white hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)] cursor-pointer ${
            open ? "border-[var(--portal-accent)]" : "border-slate-200"
          }`}
        >
          <span className={value ? "text-slate-800" : "text-slate-400"}>
            {value || placeholder}
          </span>
          <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        {/* data-portal="client" — see the identical note in DateRangeField above. */}
        <Popover.Content
          data-portal="client"
          align="start"
          sideOffset={4}
          className="z-[60] w-[var(--radix-popover-trigger-width)] max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg"
        >
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
  const client = useClients().find((c) => c.id === CLIENT_ID) ?? staticClient;
  const rateCardClasses = [...new Set(client.rateCard.map((r) => r.vehicleClass))] as VehicleClass[];
  const deliveryLocations = client.branches ?? [];
  const taxBranches = client.orgBranches.filter((branch) => branch.status === "Active");
  const [draft, setDraft] = useState<DraftBooking>(emptyDraft);
  const selectedDeliveryLocation = deliveryLocations.find((location) => location.name === draft.pickupLocation);

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
        taxBranchId: source.taxBranchId ?? "",
        jobNotes: source.jobNotes,
      });
    }
  }, [client]);

  // No end date yet? Default to the start date — a same-day request
  // shouldn't make the client type the same date twice.
  const effectiveEndDate = draft.endDate || draft.startDate;
  const days = draft.startDate && effectiveEndDate ? daysBetween(draft.startDate, effectiveEndDate) : null;
  const rentalType = days !== null ? deriveRentalType(days) : null;

  const canSubmit =
    draft.vehicleClass !== "" && draft.startDate && effectiveEndDate && draft.pickupLocation.trim().length > 0 && draft.taxBranchId && draft.quantity > 0 && effectiveEndDate >= draft.startDate;

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
      taxBranchId: draft.taxBranchId,
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
    toast.success(translate("Request {id} submitted — you'll see a quotation in your inbox once it's issued.", { id }));
    onClose();
  }

  return (
    <Modal onClose={onClose} overlayClassName="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" contentClassName="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl shadow-xl max-h-[90vh] sm:min-h-[65vh] flex flex-col" overlayProps={{ "data-portal": "client" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <ModalTitle asChild><h3 className="text-sm font-semibold text-slate-900">Request a Vehicle</h3></ModalTitle>
          <Button variant="close" size="icon" onClick={onClose} aria-label="Close request form"><X size={18} /></Button>
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
                  <Label>Vehicle type</Label>
                  <Picker value={draft.vehicleClass} options={rateCardClasses} onChange={(v) => set("vehicleClass", v)} placeholder="Select a vehicle type" />
                </div>

                <div>
                  <Label>Quantity</Label>
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
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={draft.quantity}
                    onChange={(e) => set("quantity", Math.min(999, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                <div>
                  <Label>Rental dates</Label>
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
                      <Label>Delivery site</Label>
                  <Picker value={draft.pickupLocation} options={deliveryLocations.map((location) => location.name)} onChange={(v) => set("pickupLocation", v)} placeholder="Select a delivery site" />
                  {selectedDeliveryLocation && (selectedDeliveryLocation.phone || selectedDeliveryLocation.address) && (
                    <div className="text-[11px] text-slate-400 mt-1.5 flex flex-col gap-1">
                      {/* Phone and address are two different kinds of fact
                          glued together with a middle dot before — split
                          into their own icon-led lines now instead, since a
                          single icon can't honestly represent both at once. */}
                      {selectedDeliveryLocation.phone && (
                        <span className="flex items-center gap-1"><Phone size={11} className="text-slate-300 shrink-0" />{selectedDeliveryLocation.phone}</span>
                      )}
                      {selectedDeliveryLocation.address && (
                        <span className="flex items-center gap-1"><MapPin size={11} className="text-slate-300 shrink-0" />{selectedDeliveryLocation.address}</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Tax registration branch</Label>
                  <Picker
                    value={(() => {
                      const branch = taxBranches.find((candidate) => candidate.id === draft.taxBranchId);
                      return branch ? `${branch.code} · ${branch.isHeadOffice ? "Head Office" : branch.legalNameEn}` : "";
                    })()}
                    options={taxBranches.map((branch) => `${branch.code} · ${branch.isHeadOffice ? "Head Office" : branch.legalNameEn}`)}
                    onChange={(label) => set("taxBranchId", taxBranches.find((branch) => `${branch.code} · ${branch.isHeadOffice ? "Head Office" : branch.legalNameEn}` === label)?.id ?? "")}
                    placeholder="Select a tax registration branch"
                  />
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
                  <Label>
                    Job notes <span className="text-slate-400 font-normal">(optional)</span>
                  </Label>
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

                <Button variant="primary" size="lg"
                  type="submit"
                  disabled={!canSubmit}
                >
                  <Send size={13} /> Submit Request
                </Button>
            </div>
          </form>
        </div>
      </Modal>
  );
}
