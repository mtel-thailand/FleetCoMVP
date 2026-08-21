import type { QuotationLineItem } from "@/app/data/quotations";
import type { DocMode } from "@/app/components/documents/DocumentEditor";

// Automatic draft persistence for the Quotation/Invoice editor —
// modeled on FLCCMS's own DocumentEditorPage (save/restore a document
// in-progress), adapted to this app's own established convention:
// sessionStorage, not localStorage — same "survives normal navigation
// within this session, cleared on the two moments that actually should
// reset it" lifecycle usePersistentListState.ts already established for
// list filters, not a separate, longer-lived mechanism. Directly resolves
// the one tradeoff OpsDocumentEditorPage.tsx's own header comment flagged
// and accepted when the editor moved from a modal to a routed page: a
// reload or an accidental Back used to just lose whatever was typed.
// Every edit is now saved silently and restored the next time this booking's
// editor is opened in the same mode; issuing the document clears the draft.
const PREFIX = "fleetco_draft_";

export interface DocumentDraftData {
  lineItems: QuotationLineItem[];
  discount: number;
  paymentTerms: string;
  remarks: string;
  validUntilOrDue: string;
}

function draftKey(bookingId: string, mode: DocMode): string {
  return `${PREFIX}${bookingId}:${mode}`;
}

export function getDraft(bookingId: string, mode: DocMode): DocumentDraftData | null {
  try {
    const raw = sessionStorage.getItem(draftKey(bookingId, mode));
    return raw ? (JSON.parse(raw) as DocumentDraftData) : null;
  } catch {
    return null;
  }
}

export function saveDraft(bookingId: string, mode: DocMode, data: DocumentDraftData): void {
  try {
    sessionStorage.setItem(draftKey(bookingId, mode), JSON.stringify(data));
  } catch {
    // Private-mode/quota failures just mean this draft won't survive
    // navigation — not worth surfacing to the user over, same reasoning
    // usePersistentListState's own save path already uses.
  }
}

export function clearDraft(bookingId: string, mode: DocMode): void {
  sessionStorage.removeItem(draftKey(bookingId, mode));
}

// Scans by prefix rather than tracking keys as they're created — same
// approach as clearAllListState, and wired into the exact same two reset
// points (Sidebar's logout handler, resetAllDemoData) for the same reason:
// neither actually reloads the page in this app, so without this a stale
// draft for a booking that Reset Demo Data just wiped back to seed would
// otherwise sit there waiting to reappear.
export function clearAllDrafts(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(PREFIX)) toRemove.push(key);
  }
  toRemove.forEach((k) => sessionStorage.removeItem(k));
}
