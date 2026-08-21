import { Construction } from "lucide-react";

export function StubPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Construction size={28} className="text-slate-400" />
      </div>
      <h2 className="text-slate-800 text-lg font-semibold mb-2">{title}</h2>
      <p className="text-slate-400 text-sm max-w-sm">
        {description || "This screen hasn't been built yet."}
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-[var(--portal-accent)] bg-[var(--portal-accent-light)] px-4 py-2 rounded-full">
        <span className="w-1.5 h-1.5 bg-[var(--portal-accent)] rounded-full animate-pulse" />
        Not yet built
      </div>
    </div>
  );
}
