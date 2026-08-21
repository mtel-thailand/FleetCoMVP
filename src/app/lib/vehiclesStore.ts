// Shared vehicle store — same reasoning as bookingsStore.ts: the Vehicles
// page (status changes, maintenance log) and the assignment engine (reached
// from All Rentals) both need to see the same live vehicle records, not two
// independent copies.
import { useEffect, useState } from "react";
import { mockVehicles, type Vehicle } from "@/app/data/vehicles";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

let vehicles: Vehicle[] = loadPersisted("vehicles", [...mockVehicles]);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("vehicles", vehicles);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<Vehicle[]>("vehicles", (value) => {
  vehicles = value;
  notify();
});

export function getVehicles(): Vehicle[] {
  return vehicles;
}

export function addVehicle(vehicle: Vehicle) {
  vehicles = [vehicle, ...vehicles];
  notify();
}

export function updateVehicle(id: string, patch: Partial<Vehicle>) {
  vehicles = vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v));
  notify();
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetVehicles(): void {
  vehicles = [...mockVehicles];
  notify();
}

export function useVehicles(): Vehicle[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return vehicles;
}
