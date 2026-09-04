// Shared driver store — same reasoning as vehiclesStore.ts. The Driver
// Roster page can change a driver's employment/leave status, and the
// assignment engine (reached from All Rentals) has to see that immediately.
import { useEffect, useState } from "react";
import { mockDrivers, type Driver } from "@/app/data/drivers";
import { getBookings } from "@/app/lib/bookingsStore";
import { loadPersisted, mergeSeedRecords, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

function backfillPlanningFields(records: Driver[]): Driver[] {
  const seedById = new Map(mockDrivers.map((driver) => [driver.id, driver]));
  return records.map((driver) => {
    const seed = seedById.get(driver.id);
    return {
      ...driver,
      // Only fill fields introduced by this increment when an older
      // persisted demo record does not have them. Empty strings remain an
      // intentional user choice in the edit form.
      homeBase: driver.homeBase ?? seed?.homeBase,
      homeVehicleId: driver.homeVehicleId ?? seed?.homeVehicleId,
    };
  });
}

let drivers: Driver[] = backfillPlanningFields(mergeSeedRecords(loadPersisted("drivers", [...mockDrivers]), mockDrivers));
const listeners = new Set<Listener>();

function notify() {
  savePersisted("drivers", drivers);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<Driver[]>("drivers", (value) => {
  drivers = backfillPlanningFields(value);
  notify();
});

export function getDrivers(): Driver[] {
  return drivers;
}

export function addDriver(driver: Driver) {
  drivers = [driver, ...drivers];
  notify();
}

export function updateDriver(id: string, patch: Partial<Driver>) {
  const current = drivers.find((driver) => driver.id === id);
  if (!current) return;

  const next = { ...current, ...patch };
  const availabilityChange =
    patch.employmentStatus !== undefined ||
    patch.leaveFrom !== undefined ||
    patch.leaveTo !== undefined;
  const licenseChange = patch.licenseExpiry !== undefined;

  if ((availabilityChange && (next.employmentStatus === "Inactive" || next.employmentStatus === "On Leave")) || licenseChange) {
    const affectedBookings = getBookings().filter((booking) => {
      if (booking.status !== "Assigned" && booking.status !== "Active") return false;
      if (!booking.assignments?.some((assignment) => assignment.driverId === id)) return false;
      const unavailableForEmployment = next.employmentStatus === "Inactive" ||
        (next.employmentStatus === "On Leave" && (!next.leaveFrom || !next.leaveTo || next.leaveFrom <= booking.endDate && booking.startDate <= next.leaveTo));
      const unavailableForLicense = next.licenseExpiry < booking.endDate;
      return unavailableForEmployment || unavailableForLicense;
    });

    if (affectedBookings.length > 0) {
      const bookingIds = affectedBookings.map((booking) => booking.id).join(", ");
      throw new Error(`Driver is assigned to an active rental: ${bookingIds}. Reassign or complete the rental first.`);
    }
  }

  drivers = drivers.map((d) => (d.id === id ? next : d));
  notify();
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetDrivers(): void {
  drivers = [...mockDrivers];
  notify();
}

export function useDrivers(): Driver[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return drivers;
}
