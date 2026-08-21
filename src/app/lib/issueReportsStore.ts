// Shared store for issue reports — same subscribe/notify shape as
// bookingsStore.ts, so a report a client submits shows up immediately in
// ops's own All Rentals (issue reports are only ever raised on active
// rentals) in the same running session. See bookingsStore.ts for the full
// rationale (no backend exists yet).
import { useEffect, useState } from "react";
import { mockIssueReports, type IssueReport } from "@/app/data/issueReports";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

let issueReports: IssueReport[] = loadPersisted("issueReports", [...mockIssueReports]);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("issueReports", issueReports);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<IssueReport[]>("issueReports", (value) => {
  issueReports = value;
  notify();
});

export function getIssueReports(): IssueReport[] {
  return issueReports;
}

export function addIssueReport(report: IssueReport) {
  issueReports = [report, ...issueReports];
  notify();
}

export function updateIssueReport(id: string, patch: Partial<IssueReport>) {
  issueReports = issueReports.map((r) => (r.id === id ? { ...r, ...patch } : r));
  notify();
}

export function nextIssueReportId(): string {
  const nums = issueReports
    .map((r) => parseInt(r.id.split("-").pop() ?? "", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `ISS-2026-${String(next).padStart(4, "0")}`;
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetIssueReports(): void {
  issueReports = [...mockIssueReports];
  notify();
}

/** Subscribes the calling component to the shared issue reports array. */
export function useIssueReports(): IssueReport[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return issueReports;
}
