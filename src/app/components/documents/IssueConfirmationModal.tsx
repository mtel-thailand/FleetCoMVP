import type { ReactNode } from "react";
import { Button } from "@/app/components/ui/Button";
import { Check } from "lucide-react";
import { ActionModal } from "@/app/components/ui/ActionModal";

// The last step of both issuance flows (DocumentEditor.tsx and
// InvoiceIssuanceReview.tsx), which had a near-identical copy each.
// Issuing is the one irreversible act on these screens — everything up to
// it is a draft that saves and restores itself — so it gets a confirmation
// that names the amount and who it goes to, in one wording rather than two.
export function IssueConfirmationModal({
  documentLabel, docNumber, amount, clientName, detail, onConfirm, onClose,
}: {
  documentLabel: string;
  docNumber: string;
  amount: string;
  clientName: string;
  /** Overrides the second line, for a flow with its own thing to say (an
   *  invoice is locked to the quotation it came from, not just to itself). */
  detail?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ActionModal title={`Issue ${documentLabel}`} subtitle={docNumber} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
          <p className="font-medium text-slate-900">Issue {documentLabel.toLowerCase()} for {amount}?</p>
          <p className="mt-1 leading-relaxed">
            {detail ?? (
              <>This locks {docNumber} and notifies {clientName}. Corrections require a revised document rather than editing this record.</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onClose}>
            Cancel
          </Button>
          <button
            onClick={onConfirm}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--portal-accent)] py-2 text-xs font-medium text-white hover:bg-[var(--portal-accent-hover)]"
          >
            <Check size={13} /> Confirm and Issue
          </button>
        </div>
      </div>
    </ActionModal>
  );
}
