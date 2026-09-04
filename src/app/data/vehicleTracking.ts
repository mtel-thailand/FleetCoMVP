// Live vehicle tracking — brief §4.6: "Fleet map: real-time GPS position of
// all on-rental vehicles (assume GPS box/telematics integration)."
// §8: "map views degrade gracefully when GPS signal is stale — always show
// last-known position with timestamp."
//
// Separate from vehicles.ts on purpose — GPS position is live telemetry, not
// a static vehicle attribute, and only exists for vehicles that have ever
// been out on a trip (most of the fleet has no position at all, which is
// itself realistic, not a gap).

export type VehiclePosition = {
  vehicleId: string;
  bookingId: string | null;
  lat: number;
  lng: number;
  speedKmh: number;
  headingDeg: number;
  timestamp: string;
  stale: boolean;
  routeToday: [number, number][]; // [lat, lng] breadcrumb for today's trip
};

// The live (stale: false) position below stamps its timestamp
// relative to page-load time rather than a hardcoded string. A fixed string
// reads fine the day it's written, but a few real days of wall-clock time
// later it quietly turns into "stale-looking data flagged as fresh" — e.g.
// an amber Idle dot next to a 2-day-old time, right beside a legend that has
// its own distinct gray Stale state for exactly that case. Computing it at
// load time keeps every demo session's "live" data actually reading as live.
// VEH-007 below is the deliberate opposite case — genuinely stale on
// purpose — so it keeps its static timestamp.
function minutesAgo(mins: number): string {
  const d = new Date(Date.now() - mins * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const mockVehiclePositions: VehiclePosition[] = [
  {
    // VEH-001 — last known position from completed BK-2026-0005. It is now
    // reserved for a later assignment, so this must not appear as live GPS.
    vehicleId: "VEH-001",
    bookingId: null,
    lat: 13.6690,
    lng: 100.6050,
    speedKmh: 42,
    headingDeg: 135,
    timestamp: "2026-08-14 17:55",
    stale: true,
    routeToday: [],
  },
  {
    // VEH-005 — on BK-2026-0004, long-term dedicated Nonthaburi loop.
    vehicleId: "VEH-005",
    bookingId: "BK-2026-0004",
    lat: 13.8750,
    lng: 100.5480,
    speedKmh: 0,
    headingDeg: 210,
    timestamp: minutesAgo(23),
    stale: false,
    routeToday: [
      [13.8898, 100.5623],
      [13.8820, 100.5560],
      [13.8780, 100.5510],
      [13.8750, 100.5480],
    ],
  },
  {
    // VEH-007 — last trip ended 4 Aug (BK-2026-0007, Completed); signal is
    // stale on purpose, to demonstrate graceful degradation. It is now
    // reserved for a later assignment, so there is no active booking link.
    vehicleId: "VEH-007",
    bookingId: null,
    lat: 13.8140,
    lng: 100.5380,
    speedKmh: 0,
    headingDeg: 0,
    timestamp: "2026-08-04 17:55",
    stale: true,
    routeToday: [],
  },
];
