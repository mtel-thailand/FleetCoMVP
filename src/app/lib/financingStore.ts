// Shared financing-record store — same reasoning as vehiclesStore.ts.
import { useEffect, useState } from "react";
import { mockFinancingRecords, type FinancingRecord } from "@/app/data/financing";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

let records: FinancingRecord[] = loadPersisted("financingRecords", [...mockFinancingRecords]);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("financingRecords", records);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts.
subscribePersisted<FinancingRecord[]>("financingRecords", (value) => {
  records = value;
  notify();
});

export function getFinancingRecords(): FinancingRecord[] {
  return records;
}

export function addFinancingRecord(record: FinancingRecord) {
  records = [record, ...records];
  notify();
}

export function updateFinancingRecord(id: string, patch: Partial<FinancingRecord>) {
  records = records.map((r) => (r.id === id ? { ...r, ...patch } : r));
  notify();
}

export function useFinancingRecords(): FinancingRecord[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return records;
}
