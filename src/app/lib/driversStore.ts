// Shared driver store — same reasoning as vehiclesStore.ts. The Driver
// Roster page can change a driver's employment/leave status, and the
// assignment engine (reached from All Rentals) has to see that immediately.
import { useEffect, useState } from "react";
import { mockDrivers, type Driver } from "@/app/data/drivers";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

let drivers: Driver[] = loadPersisted("drivers", [...mockDrivers]);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("drivers", drivers);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<Driver[]>("drivers", (value) => {
  drivers = value;
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
  drivers = drivers.map((d) => (d.id === id ? { ...d, ...patch } : d));
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
