/** @jsxImportSource react */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useElementWidth } from "@/app/hooks/useElementWidth";

// Real, print-accurate pagination for the three A4 document surfaces
// (DocumentEditor's live preview, QuotationDetail, InvoiceDetail).
//
// Earlier versions of this let the "paper" just grow taller as line items
// were added — no clipping, but also no sense of where page 1 actually
// ends and page 2 begins, on screen or when printed. This version renders
// genuine, separate page sheets, each sized to true A4 dimensions, and
// decides which line items land on which page from real measured heights.
//
// The key design choice making the screen preview and the print output
// match (they didn't before — the preview rendered at a small arbitrary
// pixel width like 560px while print rendered the same markup at the
// physical page's ~793px-equivalent width, so different amounts of content
// fit at each size): every page is always laid out at its true A4 size
// (210mm × 297mm, via `A4_WIDTH_MM`/`A4_HEIGHT_MM` below — mm is a CSS
// absolute unit, defined by spec to always resolve to the same px value
// regardless of context, so this is the one width used for layout,
// measurement, *and* print, never a screen-only approximation). On screen,
// that true-size page is visually shrunk to fit its column via CSS `zoom`
// (not `transform: scale`, which would keep reserving the page's full
// unscaled footprint in the surrounding layout and leave a gap under each
// shrunk page — `zoom` actually resizes the layout box). Print resets zoom
// back to 1 (see print.css) so what prints is the true size the pagination
// math was already computed against — not a second, independent reflow.

const MM_TO_PX = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_PADDING_MM = 14;
const A4_WIDTH_PX = A4_WIDTH_MM * MM_TO_PX;
const A4_HEIGHT_PX = A4_HEIGHT_MM * MM_TO_PX;
const PAGE_PADDING_PX = PAGE_PADDING_MM * MM_TO_PX;
const PAGE_CONTENT_HEIGHT_PX = A4_HEIGHT_PX - PAGE_PADDING_PX * 2;

interface Metrics {
  head: number;
  continuation: number;
  thead: number;
  row: number;
  tail: number;
}

interface PageChunk {
  start: number;
  end: number;
  isFirst: boolean;
  hasTail: boolean;
}

function computePages(rowCount: number, m: Metrics | null): PageChunk[] {
  if (rowCount === 0) return [{ start: 0, end: 0, isFirst: true, hasTail: true }];
  // Not measured yet (first tick of a mount) — show everything on one page
  // rather than nothing; corrects itself as soon as useLayoutEffect runs.
  if (!m) return [{ start: 0, end: rowCount, isFirst: true, hasTail: true }];

  const pages: PageChunk[] = [];
  let idx = 0;
  let isFirst = true;
  let guard = 0; // a measurement of 0 shouldn't be able to spin this forever
  while (idx < rowCount && guard < 1000) {
    guard++;
    const chrome = (isFirst ? m.head : m.continuation) + m.thead;
    const budget = Math.max(PAGE_CONTENT_HEIGHT_PX - chrome, m.row);
    const fit = Math.max(1, Math.floor(budget / m.row));
    const end = Math.min(rowCount, idx + fit);
    const usedByRows = (end - idx) * m.row;
    const remaining = PAGE_CONTENT_HEIGHT_PX - chrome - usedByRows;
    const hasTail = end === rowCount && remaining >= m.tail;
    pages.push({ start: idx, end, isFirst, hasTail });
    idx = end;
    isFirst = false;
  }
  if (pages.length === 0 || !pages[pages.length - 1].hasTail) {
    pages.push({ start: rowCount, end: rowCount, isFirst: false, hasTail: true });
  }
  return pages;
}

export interface A4DocumentProps {
  docNumber: string;
  docTypeLabel: string; // "QUOTATION" / "INVOICE" / "TAX INVOICE" — shown in the continuation header only
  draft?: boolean;
  head: React.ReactNode; // letterhead + bill-to — page 1 only
  columns?: React.ReactNode; // the <tr> of <th>s; omit along with rows to skip the table entirely
  rows?: React.ReactNode[]; // one <tr> per line item
  tail: React.ReactNode; // totals + terms + signature — after the last row, own page if it doesn't fit
}

export function A4Document({ docNumber, docTypeLabel, draft, head, columns, rows = [], tail }: A4DocumentProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const outerWidth = useElementWidth(outerRef);
  const scale = outerWidth ? Math.min(1, outerWidth / A4_WIDTH_PX) : 1;

  const headRef = useRef<HTMLDivElement>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const rowProbeRef = useRef<HTMLTableSectionElement>(null); // a <tbody> wrapping exactly one row
  const tailRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const continuationHeader = (
    <div className="mb-2 flex items-baseline justify-between border-b border-slate-200 pb-2 text-[10px] text-slate-400 print:break-inside-avoid">
      <span>{docTypeLabel} {docNumber} — continued</span>
    </div>
  );

  const hasTable = !!columns && rows.length > 0;

  // Re-measures on every render deliberately (no dependency array) — these
  // blocks' real heights depend on their content (a longer bill-to address,
  // remarks appearing, a discount line toggling on), and re-measuring is
  // cheap enough at this app's scale that tracking every input precisely
  // isn't worth the risk of missing one and pagination going stale.
  //
  // The functional setMetrics form + bail-out below is load-bearing, not
  // just tidy: without it, every call creates a new object, which triggers
  // a re-render, which re-runs this same effect, forever — an infinite
  // update loop that only stops once the measured numbers actually stop
  // changing. Returning the previous state object when nothing changed
  // makes React skip the re-render (its documented bail-out for a setter
  // returning the current value), so the loop terminates as soon as
  // measurements settle instead of never.
  useLayoutEffect(() => {
    const next: Metrics = {
      head: headRef.current?.offsetHeight ?? 0,
      continuation: contRef.current?.offsetHeight ?? 0,
      thead: hasTable ? (theadRef.current?.offsetHeight ?? 0) : 0,
      row: rowProbeRef.current?.offsetHeight || 22,
      tail: tailRef.current?.offsetHeight ?? 0,
    };
    setMetrics((prev) =>
      prev && prev.head === next.head && prev.continuation === next.continuation && prev.thead === next.thead && prev.row === next.row && prev.tail === next.tail
        ? prev
        : next
    );
  });

  const pages = useMemo(() => computePages(rows.length, metrics), [rows.length, metrics]);

  return (
    <div ref={outerRef}>
      <div className="space-y-6 print:space-y-0">
        {pages.map((p, i) => (
          <PageSheet key={i} scale={scale} draft={draft} isLast={i === pages.length - 1} pageNum={i + 1} totalPages={pages.length}>
            {p.isFirst ? head : continuationHeader}
            {hasTable && p.end > p.start && (
              <table className="mt-4 w-full table-fixed border-collapse text-[11px]">
                <thead className="print:table-header-group">{columns}</thead>
                <tbody>{rows.slice(p.start, p.end)}</tbody>
              </table>
            )}
            {p.hasTail && tail}
          </PageSheet>
        ))}
      </div>

      {/* Hidden measurement rig: mirrors the real head/continuation-header/
          table-header/one-row/tail content at true page width, off-screen.
          Pagination is decided from these actual rendered heights (real
          text, real wrapping) rather than guessed row-height constants. */}
      <div
        aria-hidden
        style={{ position: "absolute", top: 0, left: -99999, width: `${A4_WIDTH_MM}mm`, padding: `${PAGE_PADDING_MM}mm`, boxSizing: "border-box", visibility: "hidden", pointerEvents: "none" }}
      >
        <div ref={headRef}>{head}</div>
        <div ref={contRef}>{continuationHeader}</div>
        {hasTable && (
          <table className="mt-4 w-full table-fixed border-collapse text-[11px]">
            <thead ref={theadRef}>{columns}</thead>
            <tbody ref={rowProbeRef}>{rows[0]}</tbody>
          </table>
        )}
        <div ref={tailRef}>{tail}</div>
      </div>
    </div>
  );
}

function PageSheet({
  children, scale, draft, isLast, pageNum, totalPages,
}: {
  children: React.ReactNode; scale: number; draft?: boolean; isLast: boolean; pageNum: number; totalPages: number;
}) {
  return (
    <div
      className={`a4-page-sheet bg-white shadow-lg print:shadow-none relative mx-auto ${!isLast ? "print:break-after-page" : ""}`}
      style={{
        width: `${A4_WIDTH_MM}mm`,
        height: `${A4_HEIGHT_MM}mm`,
        padding: `${PAGE_PADDING_MM}mm`,
        boxSizing: "border-box",
        // `zoom`, not `transform: scale` — zoom actually resizes the layout
        // box, so the page takes up the *visually* correct amount of space
        // among its siblings instead of leaving a transform-shrunk gap
        // where its unscaled footprint used to be. Reset to 1 for print by
        // print.css (`!important`, the one case a stylesheet rule is
        // allowed to beat an inline style).
        zoom: scale,
      }}
    >
      <div className="flex h-full flex-col overflow-hidden text-[12px] text-slate-800">
        {children}
      </div>
      {totalPages > 1 && (
        <div className="absolute bottom-3 right-0 left-0 text-center text-[8px] text-slate-300 print:text-slate-400">
          Page {pageNum} of {totalPages}
        </div>
      )}
    </div>
  );
}
