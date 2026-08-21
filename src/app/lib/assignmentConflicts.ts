// Assignment engine conflict detection — brief §4.3:
// "pair vehicle + driver to a booking; detect conflicts (double booking,
// driver on leave, license mismatch with vehicle class)."
//
// Availability is derived from the *other* bookings that currently hold a
// vehicle/driver (date-range overlap against Assigned/Active bookings), not
// from the vehicle/driver's own snapshot `status` field — a vehicle marked
// "Reserved" for a booking next month isn't actually unavailable today.
import type { Booking } from "@/app/data/bookings";
import type { Vehicle, VehicleClass } from "@/app/data/vehicles";
import type { Driver, LicenseClass } from "@/app/data/drivers";

const HEAVY_VEHICLE_CLASSES: VehicleClass[] = ["4-Wheel Truck", "6-Wheel Truck"];

export function licenseCompatible(vehicleClass: VehicleClass, licenseClass: LicenseClass): boolean {
  if (HEAVY_VEHICLE_CLASSES.includes(vehicleClass)) {
    return licenseClass === "Heavy Vehicle";
  }
  return true;
}

function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

// Booking statuses that currently "hold" a vehicle/driver against new clashes.
const HOLDING_STATUSES = ["Assigned", "Active"];

export type ConflictReason = "double-booked" | "on-leave" | "inactive" | "license-mismatch" | "vehicle-status";

export type Conflict = { reason: ConflictReason; detail: string };

export function getVehicleConflicts(vehicle: Vehicle, booking: Booking, allBookings: Booking[]): Conflict[] {
  const conflicts: Conflict[] = [];

  if (vehicle.status === "Out of Service" || vehicle.status === "In Maintenance") {
    conflicts.push({ reason: "vehicle-status", detail: `Currently ${vehicle.status.toLowerCase()}.` });
  }

  const clash = allBookings.find(
    (b) =>
      b.id !== booking.id &&
      b.assignments?.some((a) => a.vehicleId === vehicle.id) &&
      HOLDING_STATUSES.includes(b.status) &&
      datesOverlap(b.startDate, b.endDate, booking.startDate, booking.endDate),
  );
  if (clash) {
    conflicts.push({ reason: "double-booked", detail: `Already on ${clash.id} (${clash.startDate} → ${clash.endDate}).` });
  }

  return conflicts;
}

export function getDriverConflicts(
  driver: Driver,
  booking: Booking,
  allBookings: Booking[],
  vehicleClass: VehicleClass,
): Conflict[] {
  const conflicts: Conflict[] = [];

  if (driver.employmentStatus === "Inactive") {
    conflicts.push({ reason: "inactive", detail: "Driver is inactive." });
  } else if (driver.employmentStatus === "On Leave") {
    const overlapsLeave =
      !driver.leaveFrom || !driver.leaveTo || datesOverlap(driver.leaveFrom, driver.leaveTo, booking.startDate, booking.endDate);
    if (overlapsLeave) {
      conflicts.push({
        reason: "on-leave",
        detail: driver.leaveFrom && driver.leaveTo ? `On leave ${driver.leaveFrom} → ${driver.leaveTo}.` : "On leave.",
      });
    }
  }

  if (!licenseCompatible(vehicleClass, driver.licenseClass)) {
    conflicts.push({ reason: "license-mismatch", detail: `${driver.licenseClass} license does not cover ${vehicleClass}.` });
  }

  const clash = allBookings.find(
    (b) =>
      b.id !== booking.id &&
      b.assignments?.some((a) => a.driverId === driver.id) &&
      HOLDING_STATUSES.includes(b.status) &&
      datesOverlap(b.startDate, b.endDate, booking.startDate, booking.endDate),
  );
  if (clash) {
    conflicts.push({ reason: "double-booked", detail: `Already on ${clash.id} (${clash.startDate} → ${clash.endDate}).` });
  }

  return conflicts;
}
