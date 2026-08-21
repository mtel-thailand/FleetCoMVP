import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const [datePart, timePart] = value.trim().split(" ");
  const parts = datePart.split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  const label = `${parseInt(day)} ${MONTHS[parseInt(month) - 1]} ${year}`;
  return timePart ? `${label} · ${timePart}` : label;
}

export function formatDateTime(
  date: string | null | undefined,
  time: string | null | undefined
): string {
  if (!date || !time) return "—";
  return `${formatDate(date)} · ${time}`;
}

export function sortByStatus<T>(
  items: T[],
  key: keyof T,
  priority: string[],
  dir: "asc" | "desc"
): T[] {
  return [...items].sort((a, b) => {
    const ai = priority.indexOf(a[key] as string);
    const bi = priority.indexOf(b[key] as string);
    const aRank = ai === -1 ? priority.length : ai;
    const bRank = bi === -1 ? priority.length : bi;
    return dir === "asc" ? aRank - bRank : bRank - aRank;
  });
}

// statusKey accepts a plain field name (the common case — RequestInbox.tsx,
// MyRequests.tsx) or a function (MyRentals.tsx, where the thing being
// grouped on — Upcoming/Active/Completed — is a *derived* label collapsing
// several raw statuses together, not a stored field on the item itself).
export function sortByStatusWithDate<T>(
  items: T[],
  statusKey: keyof T | ((item: T) => string),
  priority: string[],
  dir: "asc" | "desc",
  dateKey: keyof T
): T[] {
  const getStatus = typeof statusKey === "function" ? statusKey : (item: T) => item[statusKey] as string;
  return [...items].sort((a, b) => {
    const ai = priority.indexOf(getStatus(a));
    const bi = priority.indexOf(getStatus(b));
    const aRank = ai === -1 ? priority.length : ai;
    const bRank = bi === -1 ? priority.length : bi;
    if (aRank !== bRank) return dir === "asc" ? aRank - bRank : bRank - aRank;
    const av = (a[dateKey] as string | null | undefined) ?? "";
    const bv = (b[dateKey] as string | null | undefined) ?? "";
    return av < bv ? 1 : av > bv ? -1 : 0;
  });
}

export function sortByDatetime<T>(
  items: T[],
  key: keyof T,
  dir: "asc" | "desc"
): T[] {
  return [...items].sort((a, b) => {
    const av = (a[key] as string | null | undefined) ?? "";
    const bv = (b[key] as string | null | undefined) ?? "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });
}

export function sortByDatetimePair<T>(
  items: T[],
  dateKey: keyof T,
  timeKey: keyof T,
  dir: "asc" | "desc"
): T[] {
  return [...items].sort((a, b) => {
    const av = `${a[dateKey] ?? ""} ${a[timeKey] ?? ""}`.trim();
    const bv = `${b[dateKey] ?? ""} ${b[timeKey] ?? ""}`.trim();
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });
}
