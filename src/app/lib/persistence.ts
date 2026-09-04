// Cross-tab persistence for the demo stores — localStorage specifically,
// not sessionStorage, because it's shared across every tab/window on the
// same origin. That covers both things this demo needs: state survives a
// reload during the same demo day (so a dev-server WebSocket hiccup or an
// accidental F5 doesn't silently wipe a walkthrough). Saved state is dated:
// the next calendar day's first load falls back to freshly rebased seeds,
// while "Reset Demo Data" remains the explicit same-day reset. Two
// tabs opened side by side — FleetCo ops in one window, Thailand Post
// client portal in another — see the same live data.
//
// The browser's native `storage` event is the sync mechanism: it fires in
// *other* tabs the instant one tab's localStorage changes (never in the tab
// that made the write — the browser guarantees that, which is what keeps
// this from looping), so every store just re-reads and re-notifies its own
// React subscribers when it fires. No polling, no backend.
//
// Deliberately NOT used for auth (sessionStorage, untouched) — the whole
// point of two tabs is being signed in as *different* roles in each at
// once; syncing who's logged in across tabs would break that immediately.

import { demoToday } from "@/app/data/demoDates";

const PREFIX = "fleetco_demo:";
const DEMO_STORAGE_DATE = demoToday();

type PersistedEnvelope<T> = {
  demoDate: string;
  value: T;
};

function currentEnvelopeValue<T>(parsed: unknown): T | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const envelope = parsed as Partial<PersistedEnvelope<T>>;
  return envelope.demoDate === DEMO_STORAGE_DATE && "value" in envelope ? envelope.value : undefined;
}

export function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return currentEnvelopeValue<T>(JSON.parse(raw)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function savePersisted<T>(key: string, value: T): void {
  try {
    const envelope: PersistedEnvelope<T> = { demoDate: DEMO_STORAGE_DATE, value };
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Private-browsing storage caps, quota exceeded, etc. — the demo just
    // degrades to in-memory-only behavior for this tab rather than crashing.
  }
}

export function mergeSeedRecords<T extends { id: string }>(persisted: T[], seeds: T[]): T[] {
  const existingIds = new Set(persisted.map((item) => item.id));
  const missingSeeds = seeds.filter((item) => !existingIds.has(item.id));
  return missingSeeds.length ? [...missingSeeds, ...persisted] : persisted;
}

// The current demo is intentionally scoped to Thailand Post. Normalize old
// persisted records from the former second-client examples so a browser that
// already ran the demo does not keep showing a stale mixed-client dataset.
export function scopeToThailandPost<T extends { clientId: string }>(records: T[]): T[] {
  return records.map((record) => record.clientId === "CLI-001" ? record : { ...record, clientId: "CLI-001" });
}

/** Calls onChange whenever a *different* tab/window updates this key. */
export function subscribePersisted<T>(key: string, onChange: (value: T) => void): () => void {
  function handler(e: StorageEvent) {
    if (e.key !== PREFIX + key || e.newValue == null) return;
    try {
      const value = currentEnvelopeValue<T>(JSON.parse(e.newValue));
      if (value !== undefined) onChange(value);
    } catch {
      // Ignore a malformed write from a stale/incompatible tab.
    }
  }
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
