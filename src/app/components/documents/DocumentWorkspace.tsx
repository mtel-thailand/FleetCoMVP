import { useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { translate } from "@/app/i18n";
import { downloadA4Document } from "@/app/lib/downloadPdf";

// The shared shell for the two document-composing screens: a page header, a
// large live A4 preview, and a single editing column beside it.
//
// brief §6.2: "All three documents share one editor pattern: a single
// screen, form on the left, live A4 preview on the right. What you type is
// what you get." That's the literal wording; the layout below deliberately
// flips the sides — the document itself, the thing "what you type is what
// you get" is actually about, gets the dominant column, and the form takes
// the sidebar. "What you type is what you get" holds either way round.
//
// This file exists because DocumentEditor.tsx and InvoiceIssuanceReview.tsx
// had independently converged on that same layout and then re-typed it:
// same grid, same slate tray, same sticky column, same card — with
// different radii, paddings and column widths, so the two halves of one
// flow (compose a quotation → issue the invoice from it) looked subtly
// unrelated. Now there is one shell and each screen supplies only its own
// sidebar contents.
//
// Layout compared against FLCCMS's own DocumentEditorPage (a sibling
// project's take on the same brief) and adopted what was genuinely better
// there: a naturally-flowing page with a column pinned via `sticky`, rather
// than a fixed-height dual-independent-scroll container computed from a
// magic number. Kept, deliberately, rather than copying over: FLCCMS's
// preview is single-page-only with no overflow handling, and uses
// `transform: scale` (which leaves a layout gap where the unscaled
// footprint used to be — see A4Document.tsx on why this uses `zoom`).

interface DocumentWorkspaceProps {
  title: string;
  subtitle: ReactNode;
  preview: ReactNode;
  children: ReactNode;
  /** Sidebar column width at `xl` and up. The panel with a line-item grid
   *  in it needs more room than the one with pricing locked. */
  sidebarWidth?: number;
  /** Which column stays near the top on wide screens while the page scrolls.
   *  Narrow layouts always use normal document flow. */
  stick?: "preview" | "sidebar";
  /** Keep the editable controls above the document on narrow screens. */
  mobileSidebarFirst?: boolean;
  /** Hide the small preview label when the document header already carries that context. */
  showLivePreviewLabel?: boolean;
  /** Let a surrounding detail page own the document header while reusing the split workspace. */
  showHeader?: boolean;
  /** Filename used by the one-click PDF download. */
  downloadFilename: string;
  /** Draft/review screens are preview-only until the document is issued. */
  allowDownload?: boolean;
}

// The app's scroll container is the main region in Layout.tsx, under a
// sticky 56px header — so sticky offsets here are measured from below that
// header, not from the top of the screen: 56px + a 16px gap = 4.5rem.
//
// Keep the page itself as the only vertical scroll surface. Capping either
// column would create a nested scroll area and make long previews or editor
// actions harder to reach. At `xl`, sticky positioning provides orientation
// without changing that scroll model; stacked layouts below `xl` stay in
// normal document flow.
const STICKY_TOP = "xl:sticky xl:top-[4.5rem]";

// One preview-tray treatment across the composing screens and the
// read-only document pages used by both FleetCo and Thailand Post. Keeping
// the spacing here avoids the A4 sheet and its Download PDF control drifting
// apart between portals as each page evolves.
export const DOCUMENT_PREVIEW_FRAME_CLASS = "rounded-lg p-3 sm:px-6 sm:pb-6 sm:pt-4 print:rounded-none print:p-0";

export function DocumentWorkspace({
  title,
  subtitle,
  preview,
  children,
  sidebarWidth = 400,
  stick = "preview",
  mobileSidebarFirst = false,
  showLivePreviewLabel = true,
  showHeader = true,
  downloadFilename,
  allowDownload = true,
}: DocumentWorkspaceProps) {
  return (
    <div className="pb-4">
      {/* print:hidden throughout: Download PDF exports the document,
          not the screen it was composed on. Same convention as
          QuotationDetail.tsx. */}
      {showHeader && <div className="mb-5 print:hidden">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>}

      <div
        className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_var(--doc-sidebar-w)]"
        style={{ "--doc-sidebar-w": `${sidebarWidth}px` } as CSSProperties}
      >
        <div className={`min-w-0 ${mobileSidebarFirst ? "order-2 xl:order-1" : ""} ${stick === "preview" ? STICKY_TOP : ""}`}>
          {showLivePreviewLabel && (
            <div className="mb-2 flex items-center px-1 print:hidden">
              <p className="text-xs font-medium text-slate-500">Live preview</p>
            </div>
          )}
          <DocumentPreviewFrame allowDownload={allowDownload} downloadFilename={downloadFilename} className={DOCUMENT_PREVIEW_FRAME_CLASS}>
            {preview}
          </DocumentPreviewFrame>
        </div>

        {/* One unified card, divided into sections — not a stack of
            floating cards, which read as unrelated pieces rather than the
            one document-editing flow they are. No `overflow-hidden` on it:
            that would make an ancestor scroll container of the card and
            quietly break the sticky footer inside it, so the footer rounds
            its own bottom corners instead. */}
        <aside
          className={`${mobileSidebarFirst ? "order-1 xl:order-2" : ""} divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white print:hidden ${
            stick === "sidebar" ? STICKY_TOP : ""
          }`}
        >
          {children}
        </aside>
      </div>
    </div>
  );
}

interface DocumentPreviewFrameProps {
  children: ReactNode;
  downloadFilename: string;
  className?: string;
  contentClassName?: string;
  allowDownload?: boolean;
}

/**
 * Shared document tray used by editors and read-only document pages. The
 * download control belongs to the preview it exports, so it stays visible
 * at the tray's top-right without becoming a separate page-level toolbar.
 */
export function DocumentPreviewFrame({
  children,
  downloadFilename,
  className = "",
  contentClassName = "",
  allowDownload = true,
}: DocumentPreviewFrameProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  async function downloadPdf() {
    if (!previewRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadA4Document(previewRef.current, downloadFilename);
      toast.success(translate("PDF downloaded."));
    } catch {
      toast.error(translate("Could not create the PDF. Please try again."));
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div
      ref={previewRef}
      className={`bg-slate-200 overflow-hidden print:bg-white print:p-0 ${className}`}
    >
      <div className={`mb-3 flex print:hidden ${allowDownload ? "justify-end" : "justify-start"}`}>
        {allowDownload ? (
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={isDownloading}
            aria-busy={isDownloading}
            className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-500 hover:text-slate-800 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
          >
            <Download size={13} /> {isDownloading ? "Preparing PDF..." : "Download PDF"}
          </button>
        ) : (
          <p className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Preview only — not issued
          </p>
        )}
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}

export function EditorSection({
  title, action, children, collapsible = false, defaultOpen = true, required = false,
}: { title?: string; action?: ReactNode; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; required?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="p-4">
      {(title || action) && !collapsible && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          {action}
        </div>
      )}
      {collapsible && title ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              aria-controls={contentId}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
              <span>{title}</span>
              {required && <span className="normal-case tracking-normal text-[11px] font-medium text-amber-600">Required</span>}
            </button>
            {action}
          </div>
          <div id={contentId} hidden={!open}>
            {children}
          </div>
        </>
      ) : children}
    </section>
  );
}

// The running total and the one button everything above is building toward,
// pinned to the bottom of the panel. Both are visible the whole way down a
// long form, without the summary having to sit *above* the line items that
// produce it — where it reads as stale ("Amount ฿0.00") for as long as the
// form is still being filled in.
export function IssueFooter({
  amountLabel, amount, missing = [], buttonLabel, buttonIcon, onIssue,
}: {
  amountLabel: string;
  amount: string;
  missing?: string[];
  buttonLabel: string;
  buttonIcon: ReactNode;
  onIssue: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 rounded-b-lg bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="text-xs text-slate-500">{amountLabel}</span>
        <span className="text-base font-semibold text-slate-900">{amount}</span>
      </div>
      {missing.length > 0 && (
        <p className="mb-3 text-[11px] leading-relaxed text-slate-400">Still needed: {missing.join(", ")}.</p>
      )}
      <button
        disabled={missing.length > 0}
        onClick={onIssue}
        className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--portal-accent)] px-3 text-xs font-medium text-white hover:bg-[var(--portal-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {buttonIcon} {buttonLabel}
      </button>
    </div>
  );
}
