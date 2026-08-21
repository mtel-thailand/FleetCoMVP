import { useState } from "react";

// A list page's own tab/search/sort selections currently live in plain
// useState — which means every one resets to default the instant the page
// unmounts, which is every single time you navigate away and back (click a
// row, then Back; click a sidebar link and return). That's surprising: the
// user didn't do anything to "clear" their filter, the page just forgot it
// existed. sessionStorage fixes that the same way auth.ts already persists
// the login session itself — survives normal navigation within the tab,
// cleared explicitly on the two moments that actually should reset it: See
// clearAllListState below, wired into Sidebar's logout handler and
// resetAllDemoData — not a full page reload, since neither of those
// actually triggers one in this app (resetDemoData.ts's own comment: every
// store is in-memory, only an actual reload wipes it, and neither logout
// nor Reset Demo Data does that here).
const PREFIX = "fleetco_list_";

export function usePersistentListState<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = PREFIX + key;
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  function update(value: T | ((prev: T) => T)) {
    setState((prev) => {
      const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Private-mode/quota failures just mean this particular selection
        // won't survive navigation — not worth surfacing to the user over.
      }
      return next;
    });
  }

  return [state, update];
}

// Scans sessionStorage directly for this prefix rather than tracking keys
// as components register them — correctly clears state left over from
// *any* prior page visit this session, not just pages that happened to
// mount before this runs.
export function clearAllListState(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(PREFIX)) toRemove.push(key);
  }
  toRemove.forEach((k) => sessionStorage.removeItem(k));
}
