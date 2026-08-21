import { mockVehiclePositions } from "@/app/data/vehicleTracking";
import { useVehicles } from "@/app/lib/vehiclesStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { FleetMap } from "@/app/components/fleet/FleetMap";
import { CLIENT_ID } from "@/app/lib/currentClient";

// brief §5.2: "Live tracking of vehicles currently on rental to Thailand
// Post (their vehicles only)." Scoped to bookings that are actually Active —
// Assigned means a vehicle's been earmarked but the rental hasn't started,
// and Completed means it's already back at FleetCo's depot; "currently on
// rental" is the Active window specifically, same reasoning brief §4.6
// itself uses for the ops map.
export function ClientLiveMap() {
  const vehicles = useVehicles();
  const bookings = useBookings();
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  const positions = mockVehiclePositions.filter((p) => {
    const booking = p.bookingId ? bookingById.get(p.bookingId) : undefined;
    return booking?.clientId === CLIENT_ID && booking.status === "Active";
  });

  return (
    <FleetMap
      positions={positions}
      vehicleById={vehicleById}
      bookingById={bookingById}
      emptyMessage="No vehicles currently on rental to Thailand Post."
    />
  );
}
