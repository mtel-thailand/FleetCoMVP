import { mockVehiclePositions } from "@/app/data/vehicleTracking";
import { useVehicles } from "@/app/lib/vehiclesStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { FleetMap } from "@/app/components/fleet/FleetMap";

// brief §4.6: "Fleet map: real-time GPS position of all on-rental vehicles
// — design for the map + list hybrid." §8: "map views degrade gracefully
// when GPS signal is stale — always show last-known position with
// timestamp." Rendering itself lives in FleetMap.tsx, shared with the
// client's own Live Map — ops just doesn't scope the position list at all,
// it sees every vehicle currently tracked.

export function LiveMap() {
  const vehicles = useVehicles();
  const bookings = useBookings();
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  return (
    <FleetMap
      positions={mockVehiclePositions}
      vehicleById={vehicleById}
      bookingById={bookingById}
      emptyMessage="No vehicles currently on rental."
    />
  );
}
