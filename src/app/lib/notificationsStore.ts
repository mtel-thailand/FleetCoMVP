// A tiny external store for notifications — same subscribe/notify +
// cross-tab localStorage pattern as bookingsStore.ts (see that file's own
// comment for why this pattern exists instead of a state-management
// library). mockNotificationLog (data/notifications.ts) is just the seed a
// fresh session starts from; addNotification() below is what actually
// keeps this live, called from the same handlers that already mutate
// bookings/quotations/invoices — see documentActions.ts, RequestVehicle.tsx,
// and OpsBookingDetailPanel.tsx for the 7 real call sites.
import { useEffect, useState } from "react";
import { mockNotificationLog, NOTIFICATION_EVENT_TYPES, type NotificationLogEntry } from "@/app/data/notifications";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

let log: NotificationLogEntry[] = loadPersisted("notifications", [...mockNotificationLog]);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("notifications", log);
  listeners.forEach((l) => l());
}

// Derived from whatever's actually in a given log (seed entries use
// NTF-001..009, see data/notifications.ts), not hardcoded — a fixed
// starting number reset to the same value on every reload/tab, which
// collided the moment two live notifications were created across separate
// page loads (both landing on the same "next" id). Scanning the log
// instead means the next id always lands past whatever's already there,
// live or seeded — called again below whenever `log` is replaced wholesale
// (cross-tab sync, reset) so this tab's counter never falls behind.
function nextSeq(entries: NotificationLogEntry[]): number {
  const nums = entries.map((n) => parseInt(n.id.split("-").pop() ?? "", 10)).filter((n) => !isNaN(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

let seq = nextSeq(log);

// Cross-tab live sync — see persistence.ts. Fires when a *different* tab
// (e.g. the other portal, open side by side) sends a notification.
subscribePersisted<NotificationLogEntry[]>("notifications", (value) => {
  log = value;
  seq = Math.max(seq, nextSeq(log));
  notify();
});

function nowStamp(): string {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export function getNotifications(): NotificationLogEntry[] {
  return log;
}

/**
 * Fires one live notification. `channels` defaults to the event type's own
 * catalog defaults (data/notifications.ts) so every call site doesn't have
 * to repeat "in-app + email or just in-app" — pass channels explicitly only
 * when one specific send needs to differ from its type's default.
 */
export function addNotification(entry: {
  eventTypeId: string;
  portal: "fleetco" | "client";
  message: string;
  recipient: string;
  bookingId?: string;
  channels?: ("in_app" | "email")[];
}) {
  const eventType = NOTIFICATION_EVENT_TYPES.find((e) => e.id === entry.eventTypeId);
  const channels: ("in_app" | "email")[] =
    entry.channels ?? [
      ...(eventType?.defaultInApp ? (["in_app"] as const) : []),
      ...(eventType?.defaultEmail ? (["email"] as const) : []),
    ];
  log = [
    {
      id: `NTF-${String(seq++).padStart(3, "0")}`,
      eventTypeId: entry.eventTypeId,
      message: entry.message,
      recipient: entry.recipient,
      portal: entry.portal,
      bookingId: entry.bookingId,
      channels,
      sentAt: nowStamp(),
      read: false,
    },
    ...log,
  ];
  notify();
}

export function markAllRead(portal: "fleetco" | "client") {
  log = log.map((n) => (n.portal === portal ? { ...n, read: true } : n));
  notify();
}

export function markNotificationRead(id: string) {
  log = log.map((n) => (n.id === id ? { ...n, read: true } : n));
  notify();
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetNotifications(): void {
  log = [...mockNotificationLog];
  seq = nextSeq(log);
  notify();
}

/** Subscribes the calling component to the shared notification log. */
export function useNotifications(): NotificationLogEntry[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return log;
}
