// Shared vehicle store — same reasoning as bookingsStore.ts: the Vehicles
// page (status changes, maintenance log) and the assignment engine (reached
// from All Rentals) both need to see the same live vehicle records, not two
// independent copies.
import { useEffect, useState } from "react";
import { mockVehicles, type Vehicle, type VehicleStatus, type VehicleStatusEvent } from "@/app/data/vehicles";
import { getBookings } from "@/app/lib/bookingsStore";
import { getFinancingRecords } from "@/app/lib/financingStore";
import { loadPersisted, mergeSeedRecords, savePersisted, subscribePersisted } from "@/app/lib/persistence";
import { demoNowStamp } from "@/app/data/demoDates";

type Listener = () => void;

export type VehicleStatusSource = "manual" | "booking";

export type VehicleStatusTransition = {
  toStatus: VehicleStatus;
  source: VehicleStatusSource;
  actingUser: string;
  reason: string;
  bookingId?: string;
  at?: string;
};

export type VehicleStatusTransitionRequest = {
  id: string;
  transition: VehicleStatusTransition;
};

const BOOKING_OWNED_STATUSES: VehicleStatus[] = ["Reserved", "On Rental"];
const MANUAL_OWNED_STATUSES: VehicleStatus[] = ["In Maintenance", "Out of Service"];

function nowStamp(): string {
  return demoNowStamp();
}

function isVehicleStatus(value: unknown): value is VehicleStatus {
  return value === "Available" || value === "Reserved" || value === "On Rental" || value === "In Maintenance" || value === "Out of Service";
}

function normalizeStatusHistory(vehicle: Vehicle): VehicleStatusEvent[] {
  const rawHistory = Array.isArray(vehicle.statusHistory) ? vehicle.statusHistory : [];
  let previousStatus: VehicleStatus | null = null;
  const history = rawHistory.map((event, index) => {
    const toStatus = isVehicleStatus(event.toStatus) ? event.toStatus : event.status;
    const normalizedToStatus = isVehicleStatus(toStatus) ? toStatus : vehicle.status;
    const fromStatus = isVehicleStatus(event.fromStatus) || event.fromStatus === null ? event.fromStatus : previousStatus;
    const at = event.at || vehicle.updated || nowStamp();
    const actingUser = event.actingUser?.trim() || event.changedBy?.trim() || "System";
    const reason = event.reason?.trim() || event.note?.trim() || (index === 0 ? "Vehicle added to fleet" : "Status recorded");
    previousStatus = normalizedToStatus;
    return {
      ...event,
      status: normalizedToStatus,
      at,
      fromStatus,
      toStatus: normalizedToStatus,
      actingUser,
      reason,
    };
  });

  if (history.length > 0) return history;
  return [{
    status: vehicle.status,
    at: vehicle.updated || nowStamp(),
    fromStatus: null,
    toStatus: vehicle.status,
    actingUser: "System",
    reason: "Vehicle record imported",
  }];
}

function normalizeVehicle(vehicle: Vehicle): Vehicle {
  const normalized = { ...vehicle, statusHistory: normalizeStatusHistory(vehicle) };
  const seed = mockVehicles.find((item) => item.id === vehicle.id);
  if (!seed) return normalized;

  // Migrate the old demo records that predated booking-owned Reserved status
  // and the corrected compliance dates. These checks are deliberately tied
  // to the old seed shape so an operator's later edits are not overwritten.
  const legacyVehicleOne =
    vehicle.id === "VEH-001" &&
    vehicle.status === "Available" &&
    normalized.statusHistory.some((event) => event.note === "Rental completed — BK-2026-0005");
  const legacyVehicleFive =
    vehicle.id === "VEH-005" &&
    normalized.statusHistory.length === 1 &&
    normalized.statusHistory[0]?.at === "2026-07-15 08:00";
  const legacyVehicleSeven =
    vehicle.id === "VEH-007" &&
    vehicle.status === "Available" &&
    normalized.statusHistory.length > 0 &&
    normalized.statusHistory.every((event) => event.status === "Available");
  const legacyVehicleSixCompliance =
    vehicle.id === "VEH-006" &&
    vehicle.registrationExpiry === "2026-09-01" &&
    vehicle.insuranceExpiry === "2026-09-01";
  const legacyUnlinkedFinancing =
    (vehicle.id === "VEH-009" || vehicle.id === "VEH-010") &&
    vehicle.financed &&
    !getFinancingRecords().some((record) => record.vehicleId === vehicle.id) &&
    normalized.statusHistory.some((event) => event.note === "Ready for assignment demo");

  let repaired = legacyUnlinkedFinancing ? { ...normalized, financed: false } : normalized;
  if (legacyVehicleOne || legacyVehicleFive || legacyVehicleSeven) {
    repaired = {
      ...normalized,
      ...(legacyVehicleOne ? {
        status: seed.status,
        insuranceExpiry: seed.insuranceExpiry,
        voluntaryInsuranceExpiry: seed.voluntaryInsuranceExpiry,
      } : {}),
      statusHistory: normalizeStatusHistory({
        ...normalized,
        ...(legacyVehicleOne || legacyVehicleFive || legacyVehicleSeven ? { status: seed.status, statusHistory: seed.statusHistory } : {}),
      }),
    };
  } else if (legacyVehicleSixCompliance) {
    repaired = {
      ...normalized,
      registrationExpiry: seed.registrationExpiry,
      insuranceExpiry: seed.insuranceExpiry,
      voluntaryInsuranceExpiry: seed.voluntaryInsuranceExpiry,
      taxStickerExpiry: seed.taxStickerExpiry,
    };
  }

  // Reconcile stale persisted snapshots with the current booking lifecycle.
  // Reserved and On Rental are booking-owned states, so an old Available
  // snapshot must not make a vehicle with an Assigned/Active booking appear
  // free in the fleet table.
  const linkedBookings = getBookings()
    .filter((booking) =>
      (booking.status === "Assigned" || booking.status === "Active") &&
      booking.assignments?.some((assignment) => assignment.vehicleId === vehicle.id),
    )
    .sort((a, b) => (a.status === "Active" ? -1 : 1) - (b.status === "Active" ? -1 : 1));
  const linkedBooking = linkedBookings[0];
  const expectedStatus: VehicleStatus | undefined = linkedBooking
    ? linkedBooking.status === "Active" ? "On Rental" : "Reserved"
    : undefined;
  if (expectedStatus && repaired.status !== expectedStatus && ["Available", "Reserved", "On Rental"].includes(repaired.status)) {
    const at = linkedBooking.status === "Active"
      ? linkedBooking.startedAt ?? linkedBooking.assignedAt ?? linkedBooking.updated
      : linkedBooking.assignedAt ?? linkedBooking.updated;
    return {
      ...repaired,
      status: expectedStatus,
      statusHistory: [
        ...repaired.statusHistory,
        {
          status: expectedStatus,
          at,
          fromStatus: repaired.status,
          toStatus: expectedStatus,
          actingUser: "System",
          reason: expectedStatus === "On Rental" ? "Reconciled with active booking" : "Reconciled with assigned booking",
          bookingId: linkedBooking.id,
        },
      ],
    };
  }
  return repaired;
}

let vehicles: Vehicle[] = mergeSeedRecords(
  loadPersisted<Vehicle[]>("vehicles", [...mockVehicles]).map(normalizeVehicle),
  mockVehicles.map(normalizeVehicle),
);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("vehicles", vehicles);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<Vehicle[]>("vehicles", (value) => {
  vehicles = value.map(normalizeVehicle);
  notify();
});

export function getVehicles(): Vehicle[] {
  return vehicles;
}

export function addVehicle(vehicle: Vehicle) {
  if (vehicle.status !== "Available") {
    throw new Error("New vehicles must start as Available.");
  }
  vehicles = [normalizeVehicle(vehicle), ...vehicles];
  notify();
}

export function updateVehicle(id: string, patch: Partial<Vehicle>) {
  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    throw new Error("Vehicle status is transition-controlled. Use transitionVehicleStatus instead.");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "statusHistory")) {
    throw new Error("Vehicle status history is append-only and cannot be edited directly.");
  }
  vehicles = vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v));
  notify();
}

function buildStatusEvent(vehicle: Vehicle, transition: VehicleStatusTransition): VehicleStatusEvent | null {
  const { toStatus, source, bookingId, actingUser, reason, at = nowStamp() } = transition;
  const trimmedActor = actingUser.trim();
  const trimmedReason = reason.trim();
  if (!isVehicleStatus(toStatus)) throw new Error("Invalid vehicle status.");
  if (!trimmedActor) throw new Error("A user is required to record a vehicle status transition.");
  if (!trimmedReason) throw new Error("A reason is required to record a vehicle status transition.");
  if (BOOKING_OWNED_STATUSES.includes(toStatus) && source !== "booking") {
    throw new Error(`${toStatus} is set by the booking lifecycle and cannot be set manually.`);
  }
  if (MANUAL_OWNED_STATUSES.includes(toStatus) && source !== "manual") {
    throw new Error(`${toStatus} is set manually and cannot be set by the booking lifecycle.`);
  }
  if (BOOKING_OWNED_STATUSES.includes(toStatus) && !bookingId?.trim()) {
    throw new Error(`${toStatus} requires a related booking reference.`);
  }
  // The two directions of the same rule, both provable from the vehicle's
  // own status alone — this function has no access to the bookings array,
  // so it can only validate what "On Rental"/"In Maintenance"/"Out of
  // Service" already say about the vehicle itself, not whether a specific
  // booking is overdue. That narrower cross-store check still belongs at
  // the UI layer (see Vehicles.tsx's hasCurrentAssignment); this is the
  // floor every caller gets for free, not a replacement for it.
  if (source === "manual" && (toStatus === "In Maintenance" || toStatus === "Out of Service") && vehicle.status === "On Rental") {
    throw new Error("This vehicle is currently On Rental. Complete the rental before changing its status.");
  }
  if (source === "booking" && BOOKING_OWNED_STATUSES.includes(toStatus) && (vehicle.status === "In Maintenance" || vehicle.status === "Out of Service")) {
    throw new Error(`This vehicle is currently ${vehicle.status} and cannot be reserved or started until it's back in service.`);
  }
  if (toStatus === vehicle.status) return null;

  return {
    status: toStatus,
    at,
    fromStatus: vehicle.status,
    toStatus,
    actingUser: trimmedActor,
    reason: trimmedReason,
    ...(bookingId?.trim() ? { bookingId: bookingId.trim() } : {}),
  };
}

/**
 * The only mutation path for a vehicle's status. Booking-owned statuses can
 * only be written by booking lifecycle events; maintenance/out-of-service
 * can only be written by an operator. Every successful transition appends a
 * complete audit event and persists it with the vehicle record.
 */
export function transitionVehicleStatus(id: string, transition: VehicleStatusTransition): Vehicle {
  return transitionVehicleStatusBatch([{ id, transition }])[0];
}

/** Applies one lifecycle transition to several vehicles atomically. */
export function transitionVehicleStatuses(ids: string[], transition: VehicleStatusTransition): Vehicle[] {
  return transitionVehicleStatusBatch(ids.map((id) => ({ id, transition })));
}

/** Applies per-vehicle lifecycle transitions atomically, for reassignment. */
export function transitionVehicleStatusBatch(requests: VehicleStatusTransitionRequest[]): Vehicle[] {
  const ids = requests.map((request) => request.id);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== ids.length) throw new Error("A vehicle can only appear once in a status transition batch.");
  const selected = requests.map(({ id }) => {
    const vehicle = vehicles.find((item) => item.id === id);
    if (!vehicle) throw new Error(`Vehicle ${id} was not found.`);
    return vehicle;
  });
  const events = selected.map((vehicle, index) => buildStatusEvent(vehicle, requests[index].transition));
  if (events.every((event) => event === null)) return selected;

  const updates = new Map(uniqueIds.map((id, index) => [id, events[index]]));
  vehicles = vehicles.map((vehicle) => {
    const event = updates.get(vehicle.id);
    if (!event) return vehicle;
    return {
      ...vehicle,
      status: event.toStatus!,
      statusHistory: [...normalizeStatusHistory(vehicle), event],
      updated: event.at,
    };
  });
  notify();
  return uniqueIds.map((id) => vehicles.find((vehicle) => vehicle.id === id)!);
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetVehicles(): void {
  vehicles = mockVehicles.map(normalizeVehicle);
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
