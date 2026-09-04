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

export type ConflictReason = "double-booked" | "on-leave" | "inactive" | "license-mismatch" | "license-expired" | "vehicle-status" | "vehicle-compliance";

export type Conflict = { reason: ConflictReason; detail: string };

export function getVehicleConflicts(vehicle: Vehicle, booking: Booking, allBookings: Booking[]): Conflict[] {
  const conflicts: Conflict[] = [];

  if (vehicle.status === "Out of Service" || vehicle.status === "In Maintenance") {
    conflicts.push({ reason: "vehicle-status", detail: `Currently ${vehicle.status.toLowerCase()}.` });
  }

  // Vehicle compliance must cover the complete rental window. Expiry on the
  // end date is still valid for that rental day; anything earlier is a hard
  // assignment conflict, just like an expired driver license.
  const complianceDocuments = [
    { label: "Registration", date: vehicle.registrationExpiry },
    { label: "Compulsory insurance", date: vehicle.insuranceExpiry },
    { label: "Voluntary insurance", date: vehicle.voluntaryInsuranceExpiry },
    { label: "Vehicle tax", date: vehicle.taxStickerExpiry },
  ];
  const invalidDocuments = complianceDocuments.filter((document) => document.date < booking.endDate);
  if (invalidDocuments.length > 0) {
    const labels = invalidDocuments.map((document) => document.label).join(", ");
    const earliestExpiry = invalidDocuments.map((document) => document.date).sort()[0];
    conflicts.push({
      reason: "vehicle-compliance",
      detail: `${labels} ${invalidDocuments.length === 1 ? "expires" : "expire"} before the rental ends (${earliestExpiry}).`,
    });
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

  // A license must remain valid for the whole rental window, not merely on
  // the day the assignment is made. Expiry dates are inclusive, so a license
  // that expires on the booking's end date still covers that rental day.
  if (driver.licenseExpiry < booking.endDate) {
    conflicts.push({
      reason: "license-expired",
      detail: driver.licenseExpiry < booking.startDate
        ? `License expired ${driver.licenseExpiry}.`
        : `License expires before the rental ends (${driver.licenseExpiry}).`,
    });
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
