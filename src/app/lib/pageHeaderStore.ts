import { useEffect, useSyncExternalStore } from "react";

// Same shape as every domain store in this app (module-level value +
// subscribe/notify list) — see Documentation.tsx's "Shared external store"
// pattern card — just holding the current page's dynamic header instead of
// a domain record. One real difference from those: this one reads via
// useSyncExternalStore rather than the useState+useEffect subscribe pattern
// bookingsStore.ts etc. use, and that's not a style preference — plain
// useState+useEffect has a real race here that those don't hit in practice.
// A domain store's writes happen from a click handler, long after every
// subscriber has already mounted and registered. This store's write
// (usePageHeader, called from a detail page) and its one reader (Layout.tsx)
// can both be mounting for the first time in the *same* commit — and React
// runs child effects before parent effects, so the child's notify() call
// fires before the parent's subscribe-effect has registered a listener to
// receive it. The notification is silently missed, and Layout never
// re-renders with the fresh header. useSyncExternalStore doesn't have that
// gap; it's built specifically for reading external state safely regardless
// of where in the tree the write and the read happen to sit.
//
// Layout.tsx's own pageTitles is a static table keyed by exact pathname,
// which works fine for fixed routes but can't say "BK-2026-0002" or
// "Quotation" for a :id route — it doesn't have the resolved record, and
// title/subtitle need actual data (a booking's own id, its current status).
// Rather than teach Layout.tsx about booking/quotation specifics itself
// (which would mean every new dynamic-title route needs a new pathname
// regex added there, growing forever), a detail page registers its own
// header via usePageHeader() once it has resolved its own data; Layout.tsx
// just displays whatever's registered, falling back to the static table
// when nothing is.

type PageHeader = { title: string; subtitle: string } | null;

let header: PageHeader = null;
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): PageHeader {
  return header;
}

// Read by Layout.tsx to render the current dynamic header, if any.
export function usePageHeaderValue(): PageHeader {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// Called by a detail page once it has resolved the record its header needs
// (a booking, a quotation, ...). Registers on mount and whenever title or
// subtitle change (e.g. the booking's status flips from Requested to
// Accepted while the page is open — Case Timeline already reacts live to
// store changes, the header should too); clears on unmount so navigating
// away falls back to the static pageTitles lookup for wherever's next,
// rather than leaving a stale title behind. title undefined means "not
// resolved yet" (record not found, or still loading) — skip registering
// rather than show a half-built header.
export function usePageHeader(title: string | undefined, subtitle: string) {
  useEffect(() => {
    if (!title) return;
    header = { title, subtitle };
    notify();
    return () => {
      header = null;
      notify();
    };
  }, [title, subtitle]);
}
