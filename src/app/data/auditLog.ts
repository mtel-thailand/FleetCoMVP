// Audit log — brief §4.8/§8: "immutable trail on financial documents and
// payment status changes." Static historical sample, not live-wired to
// every store mutation in the app — a real build would append to this from
// inside each store's update function; that's a bigger cross-cutting change
// out of scope here (same honest boundary as notifications.ts).

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  entityType: "Booking" | "Quotation" | "Invoice" | "Tax Invoice" | "Vehicle" | "Driver" | "Client Account";
  entityId: string;
  detail: string;
};

export const mockAuditLog: AuditLogEntry[] = [
  { id: "AL-001", timestamp: "2026-08-14 10:15", actor: "Suphaporn Wongsa", actorRole: "Client Finance", action: "Marked as paid", entityType: "Invoice", entityId: "INV-2026-0001", detail: "Payment reference KBank20260814-0099, ฿2,354.00" },
  { id: "AL-002", timestamp: "2026-08-14 09:40", actor: "Naruemon Srisai", actorRole: "Client Approver / Manager", action: "Accepted", entityType: "Quotation", entityId: "QT-2026-0001", detail: "฿11,984.00 — booking BK-2026-0002 advanced to Accepted" },
  { id: "AL-003", timestamp: "2026-08-13 09:00", actor: "Pakawat Chuenjai", actorRole: "Client Requester", action: "Declined", entityType: "Quotation", entityId: "QT-2026-0010", detail: "Reason: rate above client's approved budget for this route" },
  { id: "AL-004", timestamp: "2026-08-13 16:00", actor: "System", actorRole: "—", action: "Status changed", entityType: "Vehicle", entityId: "VEH-008", detail: "Available → Out of Service (awaiting registration renewal)" },
  { id: "AL-005", timestamp: "2026-08-12 09:00", actor: "Somchai (Ops)", actorRole: "Operations Manager", action: "Assigned", entityType: "Booking", entityId: "BK-2026-0006", detail: "Vehicle 3กง 7788, driver Prasert Boonmee" },
  { id: "AL-006", timestamp: "2026-08-09 15:20", actor: "Account Team", actorRole: "Account / BD Manager", action: "Issued", entityType: "Quotation", entityId: "QT-2026-0002", detail: "฿64,400.00 subtotal, 2,000 discount applied — booking BK-2026-0003" },
  { id: "AL-007", timestamp: "2026-08-05 14:00", actor: "Finance Team", actorRole: "Finance Officer", action: "Verified payment", entityType: "Invoice", entityId: "INV-2026-0002", detail: "Reference KTB20260803-0091, ฿18,190.00 — status → Paid" },
  { id: "AL-008", timestamp: "2026-07-20 09:00", actor: "Account Team", actorRole: "Account / BD Manager", action: "Rate card updated", entityType: "Client Account", entityId: "CLI-001", detail: "Updated 4-Wheel Truck / Ad hoc / Daily to ฿2,800.00 per day" },
  { id: "AL-009", timestamp: "2026-07-11 09:30", actor: "Finance Team", actorRole: "Finance Officer", action: "Issued", entityType: "Tax Invoice", entityId: "TI-2026-0001", detail: "฿101,650.00 — released after payment verification on INV-2026-0003" },
  { id: "AL-010", timestamp: "2026-06-29 10:00", actor: "Finance Team", actorRole: "Finance Officer", action: "Issued", entityType: "Invoice", entityId: "INV-2026-0003", detail: "฿101,650.00 due 29 Jul 2026 — booking BK-2026-0010" },
  { id: "AL-011", timestamp: "2026-05-16 10:00", actor: "Account Team", actorRole: "Account / BD Manager", action: "Issued", entityType: "Quotation", entityId: "QT-2026-0009", detail: "฿98,000.00 subtotal, 3,000 volume discount — booking BK-2026-0010" },
  { id: "AL-012", timestamp: "2026-08-12 09:00", actor: "System", actorRole: "—", action: "Status changed", entityType: "Driver", entityId: "DRV-004", detail: "Active → On Leave (10 Aug – 20 Aug 2026)" },
];
