import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE = 10;

interface TablePaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ total, page, pageSize, onPageChange }: TablePaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const getPages = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      <span className="text-xs text-slate-500">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        {getPages().map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                p === page ? "bg-[var(--portal-accent)] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
