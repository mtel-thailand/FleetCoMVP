import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Textarea } from "@/app/components/ui/Input";

// Generic reason-collecting confirm step — shared by every "explain why,
// then confirm" action across both portals (Decline a quotation, Cancel a
// booking): a textarea plus back/confirm, with different copy and a
// different mutation behind each call site. Extracted out of
// ClientBookingDetail so QuotationDetail/InvoiceDetail can use the exact
// same form without importing from a component that itself imports (via
// DocumentChain) back into them — that path would be a circular import.
export function ReasonForm({
  title, placeholder, confirmLabel, required = true, onCancel, onConfirm,
}: {
  title: string; placeholder: string; confirmLabel: string; required?: boolean;
  onCancel: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
      <label className="text-xs font-medium text-slate-600 block">{title}</label>
      <Textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder}
      />
      <div className="flex gap-2">
        <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onCancel}>
          Back
        </Button>
        <button
          disabled={required && !reason.trim()}
          onClick={() => onConfirm(reason.trim())}
          className="flex-1 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
