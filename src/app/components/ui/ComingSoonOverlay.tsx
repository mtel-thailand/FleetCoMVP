import { Construction } from "lucide-react";

export function ComingSoonOverlay({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="relative h-[calc(100vh-8rem)] overflow-hidden">
      <div className="opacity-75 pointer-events-none select-none blur-[3px]">
        {children}
      </div>
      <div className="absolute inset-0 pointer-events-none z-10 backdrop-blur-[2px] bg-white/30">
        <div className="h-full flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-5">
            <Construction size={28} className="text-slate-400" />
          </div>
          <h2 className="text-slate-800 text-xl font-semibold mb-2">{title}</h2>
          {description && (
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">{description}</p>
          )}
          <div className="mt-6 flex items-center gap-2 text-xs text-[var(--portal-accent)] bg-[var(--portal-accent-light)] border border-[var(--portal-accent-light-2)] px-4 py-2 rounded-full">
            <span className="w-1.5 h-1.5 bg-[var(--portal-accent)] rounded-full animate-pulse" />
            Phase 1 — Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
