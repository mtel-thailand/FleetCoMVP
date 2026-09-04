// A tiny external store for notifications — same subscribe/notify +
// cross-tab localStorage pattern as bookingsStore.ts (see that file's own
// comment for why this pattern exists instead of a state-management
// library). mockNotificationLog (data/notifications.ts) is just the seed a
// fresh session starts from; addNotification() below is what actually
// keeps this live, called from the same handlers that already mutate
// bookings/quotations/invoices — see documentActions.ts, RequestVehicle.tsx,
// and OpsBookingDetailPanel.tsx for the 7 real call sites.
import { useEffect, useState } from "react";
import { mockNotificationLog, NOTIFICATION_EVENT_TYPES, type NotificationLogEntry, type NotificationPreferences } from "@/app/data/notifications";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";
import { demoNowStamp } from "@/app/data/demoDates";

type Listener = () => void;

let log: NotificationLogEntry[] = loadPersisted("notifications", [...mockNotificationLog]);
const listeners = new Set<Listener>();
const preferenceListeners = new Set<Listener>();

function defaultPreferences(): NotificationPreferences {
  return Object.fromEntries(
    NOTIFICATION_EVENT_TYPES.map((event) => [event.id, { inApp: event.defaultInApp, email: event.defaultEmail }]),
  );
}

function mergePreferences(saved: Partial<NotificationPreferences>): NotificationPreferences {
  return Object.fromEntries(NOTIFICATION_EVENT_TYPES.map((event) => {
    const fallback = { inApp: event.defaultInApp, email: event.defaultEmail };
    const value = saved[event.id];
    return [event.id, {
      inApp: typeof value?.inApp === "boolean" ? value.inApp : fallback.inApp,
      email: typeof value?.email === "boolean" ? value.email : fallback.email,
    }];
  }));
}

// Preferences are deliberately separate from the activity log: a user can
// change delivery settings without rewriting the record of past events.
let preferences: NotificationPreferences = mergePreferences(
  loadPersisted<Partial<NotificationPreferences>>("notification-preferences", {}),
);

function notify() {
  savePersisted("notifications", log);
  listeners.forEach((l) => l());
}

function notifyPreferences() {
  savePersisted("notification-preferences", preferences);
  preferenceListeners.forEach((l) => l());
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

function normalizeSeedNotifications(entries: NotificationLogEntry[]): NotificationLogEntry[] {
  const correctedPaymentEvent = mockNotificationLog.find((entry) => entry.id === "NTF-001");
  const correctedQuotationEvent = mockNotificationLog.find((entry) => entry.id === "NTF-002");
  return entries.map((entry) => {
    // NTF-001 used to claim payment for an overdue invoice that had no
    // payment record. Preserve its read state while aligning the historical
    // event with the actual Payment Submitted invoice.
    if (correctedPaymentEvent && entry.id === correctedPaymentEvent.id && entry.bookingId === "BK-2026-0008") {
      return { ...correctedPaymentEvent, read: entry.read };
    }
    // NTF-002 used to claim acceptance of QT-2026-0001 while that
    // quotation remained Issued. Preserve its read state while pointing the
    // event at the accepted quotation it is describing.
    if (correctedQuotationEvent && entry.id === correctedQuotationEvent.id && entry.bookingId === "BK-2026-0002") {
      return { ...correctedQuotationEvent, read: entry.read };
    }
    return entry;
  });
}

log = normalizeSeedNotifications(log);
let seq = nextSeq(log);

// Cross-tab live sync — see persistence.ts. Fires when a *different* tab
// (e.g. the other portal, open side by side) sends a notification.
subscribePersisted<NotificationLogEntry[]>("notifications", (value) => {
  log = normalizeSeedNotifications(value);
  seq = Math.max(seq, nextSeq(log));
  notify();
});

subscribePersisted<NotificationPreferences>("notification-preferences", (value) => {
  preferences = mergePreferences(value);
  preferenceListeners.forEach((listener) => listener());
});

function nowStamp(): string {
  return demoNowStamp();
}

export function getNotifications(): NotificationLogEntry[] {
  return log;
}

export function getNotificationPreferences(): NotificationPreferences {
  return preferences;
}

export function updateNotificationPreference(
  eventTypeId: string,
  channel: "inApp" | "email",
  enabled: boolean,
): void {
  const event = NOTIFICATION_EVENT_TYPES.find((item) => item.id === eventTypeId);
  if (!event) return;
  preferences = {
    ...preferences,
    [eventTypeId]: {
      ...preferences[eventTypeId],
      [channel]: enabled,
    },
  };
  notifyPreferences();
}

/**
 * Fires one live notification. `channels` defaults to the event type's own
 * saved delivery preferences (or catalog defaults before a preference has
 * been saved). Pass channels explicitly only when one send must override
 * that event's normal delivery policy.
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
  const preference = preferences[entry.eventTypeId] ?? {
    inApp: eventType?.defaultInApp ?? false,
    email: eventType?.defaultEmail ?? false,
  };
  const channels: ("in_app" | "email")[] =
    entry.channels ?? [
      ...(preference.inApp ? (["in_app"] as const) : []),
      ...(preference.email ? (["email"] as const) : []),
    ];
  // No channels means the event has intentionally been turned off. There is
  // no in-app row to surface and, in this demo, no mail service to log.
  if (channels.length === 0) return;
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
      // Email-only events stay in the admin history but must not inflate the
      // in-app unread badge.
      read: !channels.includes("in_app"),
    },
    ...log,
  ];
  notify();
}

export function markAllRead(portal: "fleetco" | "client") {
  log = log.map((n) => (n.portal === portal && n.channels.includes("in_app") ? { ...n, read: true } : n));
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

/** Demo-only: restores notification delivery settings to catalog defaults. */
export function resetNotificationPreferences(): void {
  preferences = defaultPreferences();
  notifyPreferences();
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

/** Subscribes the calling component to saved delivery preferences. */
export function useNotificationPreferences(): NotificationPreferences {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    preferenceListeners.add(listener);
    return () => { preferenceListeners.delete(listener); };
  }, []);
  return preferences;
}
