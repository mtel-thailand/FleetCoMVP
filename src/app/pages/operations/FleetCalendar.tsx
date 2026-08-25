import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBookings } from "@/app/lib/bookingsStore";
import { useVehicles } from "@/app/lib/vehiclesStore";
import type { VehicleClass } from "@/app/data/vehicles";
import { fleetCoRentalStatusLabel, type Booking } from "@/app/data/bookings";
import type { BookingStatus } from "@/app/data/bookingStatus";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";

// brief §4.4: "Fleet calendar / Gantt view: every vehicle as a row, rentals
// as bars across time — the core planning surface for multi-week and
// multi-month rentals." brief §8: "weeks start Monday."

const VEHICLE_CLASSES: VehicleClass[] = ["Pickup", "Van", "4-Wheel Truck", "6-Wheel Truck", "Sedan"];
const WINDOW_DAYS = 21;
const DAY_WIDTH = 34;
const LABEL_WIDTH = 200;

// Only these statuses have a vehicle actually assigned to a date range. A
// booking's own status is terminal at Completed (billing progress past that
// point lives on the Invoice record, not here — see bookingStatus.ts's own
// header comment), so this is the full remaining list.
const BAR_STATUSES: BookingStatus[] = ["Assigned", "Active", "Completed"];

const BAR_COLOR: Record<string, string> = {
  Assigned: "bg-[var(--portal-accent)]",
  Active: "bg-emerald-500",
  Completed: "bg-teal-500",
};

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: Date, dateStr: string): number {
  const b = new Date(dateStr + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function FleetCalendar() {
  const navigate = useNavigate();
  const bookings = useBookings();
  const vehicles = useVehicles();
  const [classFilter, setClassFilter] = useState("");
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateOnly(today);

  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    return d;
  });

  const filteredVehicles = classFilter ? vehicles.filter((v) => v.vehicleClass === classFilter) : vehicles;

  const barsByVehicle = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!b.assignments?.length || !BAR_STATUSES.includes(b.status)) continue;
    const startIdx = daysBetween(anchor, b.startDate);
    const endIdx = daysBetween(anchor, b.endDate);
    if (endIdx < 0 || startIdx >= WINDOW_DAYS) continue; // entirely outside the window
    // A multi-unit booking gets a bar on *every* vehicle it's holding, not
    // just one — otherwise the other unit's truck would show as free during
    // a window it's actually out.
    for (const a of b.assignments) {
      const list = barsByVehicle.get(a.vehicleId) ?? [];
      list.push(b);
      barsByVehicle.set(a.vehicleId, list);
    }
  }

  function openBooking(id: string) {
    navigate(`/ops/bookings/${id}`);
  }

  const rangeLabel = `${MONTH_NAMES[days[0].getMonth()]} ${days[0].getDate()} – ${MONTH_NAMES[days[WINDOW_DAYS - 1].getMonth()]} ${days[WINDOW_DAYS - 1].getDate()}, ${days[WINDOW_DAYS - 1].getFullYear()}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          <button
            onClick={() => setAnchor((a) => { const d = new Date(a); d.setDate(a.getDate() - 7); return d; })}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setAnchor(startOfWeek(new Date()))}
            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={() => setAnchor((a) => { const d = new Date(a); d.setDate(a.getDate() + 7); return d; })}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <span className="text-sm font-medium text-slate-700">{rangeLabel}</span>

        <div className="ml-auto flex items-center gap-2">
          <FilterDropdown
            value={classFilter}
            onChange={setClassFilter}
            placeholder="All Classes"
            options={[{ label: "All Classes", value: "" }, ...VEHICLE_CLASSES.map((c) => ({ label: c, value: c }))]}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-slate-500">
        {(["Assigned", "Active", "Completed"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${BAR_COLOR[s]}`} />
            {fleetCoRentalStatusLabel(s)}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: LABEL_WIDTH + WINDOW_DAYS * DAY_WIDTH }}>
            {/* Header row */}
            <div className="flex border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
              <div className="shrink-0 px-3 py-2 text-xs font-medium text-slate-400" style={{ width: LABEL_WIDTH }}>
                Vehicle
              </div>
              {days.map((d, i) => {
                const isToday = toDateOnly(d) === todayStr;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={`shrink-0 text-center py-2 text-[10px] font-medium border-l border-slate-100 ${
                      isToday ? "bg-[var(--portal-accent-light)] text-[var(--portal-accent-hover)]" : isWeekend ? "bg-slate-100/60 text-slate-400" : "text-slate-400"
                    }`}
                    style={{ width: DAY_WIDTH }}
                  >
                    <div>{WEEKDAY[d.getDay()]}</div>
                    <div className="font-semibold text-slate-600">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {/* Vehicle rows */}
            {filteredVehicles.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">No vehicles match this filter.</div>
            )}
            {filteredVehicles.map((v) => {
              const bars = barsByVehicle.get(v.id) ?? [];
              return (
                <div key={v.id} className="flex border-b border-slate-50 hover:bg-slate-50/50">
                  <div className="shrink-0 px-3 py-3" style={{ width: LABEL_WIDTH }}>
                    <p className="text-xs font-medium text-slate-800 truncate">{v.plateNumber}</p>
                    <p className="text-[11px] text-slate-400 truncate">{v.vehicleClass} · {v.brand} {v.model}</p>
                  </div>
                  <div className="relative shrink-0" style={{ width: WINDOW_DAYS * DAY_WIDTH, minHeight: 52 }}>
                    {/* day gridlines */}
                    <div className="absolute inset-0 flex">
                      {days.map((d, i) => {
                        const isToday = toDateOnly(d) === todayStr;
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div
                            key={i}
                            className={`shrink-0 border-l border-slate-100 h-full ${isToday ? "bg-[var(--portal-accent-light)]/50" : isWeekend ? "bg-slate-50/50" : ""}`}
                            style={{ width: DAY_WIDTH }}
                          />
                        );
                      })}
                    </div>
                    {/* bars */}
                    {bars.map((b) => {
                      const startIdx = Math.max(0, daysBetween(anchor, b.startDate));
                      const endIdx = Math.min(WINDOW_DAYS - 1, daysBetween(anchor, b.endDate));
                      const left = startIdx * DAY_WIDTH;
                      const width = (endIdx - startIdx + 1) * DAY_WIDTH;
                      return (
                        <button
                          key={b.id}
                          onClick={() => openBooking(b.id)}
                          title={`${b.id} · ${fleetCoRentalStatusLabel(b.status)} · ${b.startDate} → ${b.endDate}`}
                          className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-md ${BAR_COLOR[b.status]} text-white text-[10px] font-medium flex items-center px-1.5 overflow-hidden hover:opacity-90 cursor-pointer transition-opacity`}
                          style={{ left, width: Math.max(width - 2, 4) }}
                        >
                          <span className="truncate">{b.id.replace("BK-2026-", "#")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
