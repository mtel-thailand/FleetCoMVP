import { useState } from "react";
import { usePersistentListState } from "@/app/hooks/usePersistentListState";

export type SortDir = "asc" | "desc";

/**
 * The state every list page in this app was re-implementing by hand: a set of
 * filters, a sort column and direction, and a page number.
 *
 * It exists for a handoff reason more than a DRY one. Eight list pages each
 * spelled this out separately, and they had drifted in ways nothing in the
 * code explained — an engineer reading them could not tell which differences
 * were design decisions and which were accidents:
 *
 *  - Three pages (All Requests, All Rentals, Invoices) persisted their filters
 *    via usePersistentListState, so a filter survived clicking into a row and
 *    coming back. Five (Quotations, Tax Invoices, Vehicles, Driver Roster,
 *    Client Accounts) used plain useState and silently forgot everything on
 *    navigation. Same interaction, two different behaviours, no stated reason.
 *    usePersistentListState's own header comment argues the persisted one is
 *    correct — "the user didn't do anything to clear their filter, the page
 *    just forgot it existed" — so this hook persists for every page.
 *  - `setPage(1)` was hand-written at roughly thirty individual filter-change
 *    call sites. Every one of them is a chance to forget, and forgetting
 *    strands the user on an empty page 3 of a now-2-row result. setFilter
 *    resets the page itself, so it cannot be forgotten.
 *
 * Page number is deliberately NOT persisted, unlike the filters — carried over
 * verbatim from AllRequests.tsx's own note: it is a scroll-position-like
 * detail rather than a chosen view, and re-deriving it against a row count
 * that can shrink (Reset Demo Data, a status change moving a row to another
 * list) is more likely to strand it out of range than to help.
 */
type Config<F extends Record<string, string>, K extends string> = {
  /** Prefix for this page's sessionStorage keys, e.g. "opsRequests". */
  storageKey: string;
  /** Initial value per filter. Keys become the names passed to setFilter. */
  filters: F;
  sort?: { key: K | null; dir?: SortDir };
  defaultDirFor?: (key: K) => SortDir;
};

type Result<F extends Record<string, string>, K extends string, S extends K | null> = {
  filters: F;
  setFilter: <N extends keyof F>(name: N, value: F[N]) => void;
  sortKey: S;
  sortDir: SortDir;
  toggleSort: (key: K) => void;
  page: number;
  setPage: (p: number) => void;
};

// Two overloads so callers get the honest type for their case. A page that
// seeds a default sort column (All Requests sorts by `created` on arrival) can
// never observe a null sortKey, and shouldn't have to null-check one. A page
// that starts unsorted until the user clicks a header (Vehicles, Driver
// Roster, Client Accounts) genuinely can, and should.
export function useTableState<F extends Record<string, string>, K extends string>(
  config: Config<F, K> & { sort: { key: K; dir?: SortDir } },
): Result<F, K, K>;
export function useTableState<F extends Record<string, string>, K extends string>(
  config: Config<F, K>,
): Result<F, K, K | null>;
export function useTableState<F extends Record<string, string>, K extends string>(config: {
  /** Prefix for this page's sessionStorage keys, e.g. "opsRequests". */
  storageKey: string;
  /** Initial value per filter. Keys become the names passed to setFilter. */
  filters: F;
  /** Initial sort. `null` means "unsorted until the user picks a column". */
  sort?: { key: K | null; dir?: SortDir };
  /**
   * Direction to use when the user switches to a *different* column. Pages
   * differ here on purpose — a status column reads best ascending (most
   * urgent first), a date column descending (newest first) — so the rule
   * stays per-page rather than being averaged into one global default.
   */
  defaultDirFor?: (key: K) => SortDir;
}): Result<F, K, K | null> {
  const { storageKey, filters: initialFilters, sort, defaultDirFor } = config;

  // One stored object rather than one key per filter: fewer sessionStorage
  // entries, and it keeps a page's filters atomic so a partial write can't
  // leave half of them applied.
  const [filters, setFilters] = usePersistentListState<F>(`${storageKey}.filters`, initialFilters);
  const [sortKey, setSortKey] = usePersistentListState<K | null>(`${storageKey}.sortKey`, sort?.key ?? null);
  const [sortDir, setSortDir] = usePersistentListState<SortDir>(`${storageKey}.sortDir`, sort?.dir ?? "desc");
  const [page, setPage] = useState(1);

  function setFilter<N extends keyof F>(name: N, value: F[N]) {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  }

  function toggleSort(key: K) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDirFor ? defaultDirFor(key) : "desc");
    }
    setPage(1);
  }

  return { filters, setFilter, sortKey, sortDir, toggleSort, page, setPage };
}
