import { X } from "lucide-react";
import { useBodyScrollLock } from "@/app/hooks/useBodyScrollLock";

// Shared modal shell for an action that needs more than a click (picking a
// vehicle+driver per unit, typing a rejection reason, confirming a tax
// invoice) — used from OpsBookingDetailPanel.tsx (Assign/Reassign, Reject
// Request) and InvoiceDetail.tsx (Reject Payment, Issue Tax Invoice), so
// every "act on this record" modal in the ops portal shares one shell
// instead of each screen growing its own near-duplicate.
export function ActionModal({
  title, subtitle, onClose, children,
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  useBodyScrollLock();
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
