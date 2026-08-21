import { useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { MapPin, Gauge, Clock } from "lucide-react";
import type { VehiclePosition } from "@/app/data/vehicleTracking";
import type { Vehicle } from "@/app/data/vehicles";
import type { Booking } from "@/app/data/bookings";
import { formatDate } from "@/app/components/ui/utils";

// brief §4.6 / §5.2: the map + list hybrid, live GPS position of on-rental
// vehicles, graceful degradation on stale signal. Shared by the ops Live Map
// (every on-rental vehicle) and the client's own Live Map (their vehicles
// only) — the rendering logic is identical either way, only which
// `positions` get passed in differs, so this is the one implementation
// both wrap rather than two copies that could quietly drift apart.

const BANGKOK_CENTER: [number, number] = [13.76, 100.58];

function markerIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function colorFor(pos: VehiclePosition): string {
  if (pos.stale) return "#94a3b8"; // slate-400
  if (pos.speedKmh === 0) return "#f59e0b"; // amber-500 — idle
  return "#3b82f6"; // blue-500 — moving
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  map.flyTo([lat, lng], 13, { duration: 0.6 });
  return null;
}

function timeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp.replace(" ", "T")).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function FleetMap({
  positions, vehicleById, bookingById, emptyMessage,
}: {
  positions: VehiclePosition[];
  vehicleById: Map<string, Vehicle>;
  bookingById: Map<string, Booking>;
  emptyMessage: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(positions[0]?.vehicleId ?? null);
  const [showStale, setShowStale] = useState(true);

  const shown = positions.filter((p) => showStale || !p.stale);
  const selected = shown.find((p) => p.vehicleId === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="h-[520px] relative z-0">
          <MapContainer center={BANGKOK_CENTER} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {selected && <FlyTo lat={selected.lat} lng={selected.lng} />}
            {shown.map((pos) => {
              const vehicle = vehicleById.get(pos.vehicleId);
              return (
                <div key={pos.vehicleId}>
                  {pos.routeToday.length > 1 && (
                    <Polyline positions={pos.routeToday} pathOptions={{ color: colorFor(pos), weight: 3, opacity: 0.5 }} />
                  )}
                  <Marker
                    position={[pos.lat, pos.lng]}
                    icon={markerIcon(colorFor(pos))}
                    eventHandlers={{ click: () => setSelectedId(pos.vehicleId) }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <p className="font-semibold">{vehicle ? `${vehicle.plateNumber} · ${vehicle.brand} ${vehicle.model}` : pos.vehicleId}</p>
                        <p className="text-slate-500 mt-1">{pos.stale ? "Last known position" : "Live"} · {timeAgo(pos.timestamp)}</p>
                        <p className="text-slate-500">{pos.speedKmh} km/h</p>
                      </div>
                    </Popup>
                  </Marker>
                </div>
              );
            })}
          </MapContainer>
        </div>
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500">
          {/* Fixed blue regardless of portal — this is vehicle-movement data
              (matches colorFor()'s #3b82f6), not UI brand chrome. "Moving"
              should mean the same thing whichever portal is looking at it. */}
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Moving</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Idle</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Stale signal</span>
          <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showStale} onChange={(e) => setShowStale(e.target.checked)} />
            Show stale
          </label>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-2">
        {shown.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-400">
            {emptyMessage}
          </div>
        )}
        {shown.map((pos) => {
          const vehicle = vehicleById.get(pos.vehicleId);
          const booking = pos.bookingId ? bookingById.get(pos.bookingId) : undefined;
          const isSelected = selectedId === pos.vehicleId;
          return (
            <button
              key={pos.vehicleId}
              onClick={() => setSelectedId(pos.vehicleId)}
              className={`w-full text-left bg-white rounded-xl border p-4 transition-colors cursor-pointer ${
                isSelected ? "border-[var(--portal-accent-soft)] ring-2 ring-[var(--portal-accent-ring)]" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{vehicle ? `${vehicle.plateNumber} · ${vehicle.brand} ${vehicle.model}` : pos.vehicleId}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{booking ? `${booking.id} — ${booking.pickupLocation}` : "No active booking"}</p>
                </div>
                <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: colorFor(pos) }} />
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Gauge size={12} /> {pos.speedKmh} km/h</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(pos.timestamp)}</span>
                <span className="flex items-center gap-1"><MapPin size={12} /> {pos.lat.toFixed(3)}, {pos.lng.toFixed(3)}</span>
              </div>
              {pos.stale && (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-md px-2 py-1 mt-2">
                  Signal stale since {formatDate(pos.timestamp)} — showing last-known position.
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
