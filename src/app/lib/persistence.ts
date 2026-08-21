// Cross-tab persistence for the demo stores — localStorage specifically,
// not sessionStorage, because it's shared across every tab/window on the
// same origin. That covers both things this demo needs: state survives a
// reload (so a dev-server WebSocket hiccup or an accidental F5 doesn't
// silently wipe a walkthrough back to seed data — "Reset Demo Data" in the
// Sidebar is now the only intentional way back to a clean slate), and two
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

const PREFIX = "fleetco_demo:";

export function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function savePersisted<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
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

/** Calls onChange whenever a *different* tab/window updates this key. */
export function subscribePersisted<T>(key: string, onChange: (value: T) => void): () => void {
  function handler(e: StorageEvent) {
    if (e.key !== PREFIX + key || e.newValue == null) return;
    try {
      onChange(JSON.parse(e.newValue) as T);
    } catch {
      // Ignore a malformed write from a stale/incompatible tab.
    }
  }
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
