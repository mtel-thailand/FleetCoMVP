// The hand-authored demo dataset was balanced around this day: some work is
// upcoming, some is due, and some is deliberately overdue/expired. Rebase
// every seeded date by the same offset so that balance survives as the real
// calendar moves forward.
export const DEMO_REFERENCE_DATE = "2026-08-25";

const MONTH_INDEX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sept: 8, Oct: 9, Nov: 10, Dec: 11,
};
const MONTH_LABELS = Object.keys(MONTH_INDEX);

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function demoToday(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function demoNowStamp(date = new Date()): string {
  return `${demoToday(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addCalendarDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dayOffset(targetDate: string): number {
  return Math.round((parseDateOnly(targetDate).getTime() - parseDateOnly(DEMO_REFERENCE_DATE).getTime()) / 86400000);
}

function shiftedDate(year: number, monthIndex: number, day: number, offset: number): Date {
  const date = new Date(year, monthIndex, day, 12);
  date.setDate(date.getDate() + offset);
  return date;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function englishDate(date: Date, includeYear: boolean) {
  const label = `${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
  return includeYear ? `${label} ${date.getFullYear()}` : label;
}

function rebaseString(value: string, targetDate: string): string {
  const offset = dayOffset(targetDate);
  const targetYear = parseDateOnly(targetDate).getFullYear();

  let result = value.replace(/^(\d{4})-(\d{2})-(\d{2})(.*)$/, (_match, year, month, day, suffix) => {
    const shifted = shiftedDate(Number(year), Number(month) - 1, Number(day), offset);
    return `${isoDate(shifted)}${suffix}`;
  });

  // Keep human-readable dates embedded in notification/audit copy aligned
  // with the underlying records as well.
  result = result.replace(
    /\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec) – (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec) (\d{4})\b/g,
    (_match, firstDay, firstMonth, secondDay, secondMonth, year) => {
      const first = shiftedDate(Number(year), MONTH_INDEX[firstMonth], Number(firstDay), offset);
      const second = shiftedDate(Number(year), MONTH_INDEX[secondMonth], Number(secondDay), offset);
      return `${englishDate(first, false)} – ${englishDate(second, true)}`;
    },
  );
  result = result.replace(
    /\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec) (\d{4})\b/g,
    (_match, day, month, year) => englishDate(shiftedDate(Number(year), MONTH_INDEX[month], Number(day), offset), true),
  );

  // IDs and bank references encode the original seed year/date. Shift them
  // with their records so a 2027 demo never displays an INV-2026 identifier
  // beside a 2027 issue date.
  result = result.replace(/\b(BK|QT|INV|TI|ISS)-2026-/g, `$1-${targetYear}-`);
  result = result.replace(/\b([A-Z]{2,6})(2026)(\d{2})(\d{2})(-\d+)\b/g, (_match, prefix, year, month, day, suffix) => {
    const shifted = shiftedDate(Number(year), Number(month) - 1, Number(day), offset);
    return `${prefix}${isoDate(shifted).replaceAll("-", "")}${suffix}`;
  });

  return result;
}

/** Deep-clones seed data while rebasing every recognized demo date/string. */
export function rebaseDemoDates<T>(value: T, targetDate = demoToday()): T {
  if (typeof value === "string") return rebaseString(value, targetDate) as T;
  if (Array.isArray(value)) return value.map((item) => rebaseDemoDates(item, targetDate)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, rebaseDemoDates(item, targetDate)]),
    ) as T;
  }
  return value;
}
