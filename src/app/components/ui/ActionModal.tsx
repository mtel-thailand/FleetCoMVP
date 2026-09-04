import { X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Modal, ModalTitle, ModalDescription, ModalClose } from "@/app/components/ui/Modal";

// Shared modal shell for an action that needs more than a click (picking a
// vehicle+driver per unit, typing a rejection reason, confirming a tax
// invoice) — used from OpsBookingDetailPanel.tsx (Assign/Reassign, Reject
// Request) and InvoiceDetail.tsx (Reject Payment, Issue Tax Invoice), so
// every "act on this record" modal in the ops portal shares one shell
// instead of each screen growing its own near-duplicate.
//
// This is the *presentation* half — a titled header bar with a dismiss X and a
// scrollable body. All of the dialog behaviour lives in Modal.tsx; see that
// file for what the hand-rolled version was missing. The markup and classes
// below are unchanged from that version, so it renders identically.
//
// Not every modal in the app fits this shape (widths, radii, bottom-sheet vs
// centered, headless wrappers around ReasonForm/MarkPaidForm), which is why
// Modal is the shared piece and this is not.
export function ActionModal({
  title, subtitle, onClose, children,
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal
      onClose={onClose}
      overlayClassName="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      contentClassName="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] flex flex-col focus:outline-none"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
        <div>
          <ModalTitle className="text-sm font-semibold text-slate-900">{title}</ModalTitle>
          {subtitle
            ? <ModalDescription className="text-xs text-slate-500">{subtitle}</ModalDescription>
            // Radix requires a description for screen readers; with no subtitle
            // to show, name the dialog instead of rendering an empty <p> that
            // would add spacing.
            : <ModalDescription className="sr-only">{title}</ModalDescription>}
        </div>
        <ModalClose asChild>
          <Button variant="close" size="icon" aria-label={`Close ${title}`}><X size={18} /></Button>
        </ModalClose>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </Modal>
  );
}
