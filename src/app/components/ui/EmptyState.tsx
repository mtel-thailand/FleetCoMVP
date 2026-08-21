import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

// Shared empty-state block — brief §9 lists "empty states" as an explicit
// design-system deliverable, not an afterthought. Icon + short title +
// optional subtext + optional CTA, used anywhere a list/inbox can be
// legitimately empty (no rentals yet, no quotations yet, ...).
export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <Icon size={20} className="text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{subtitle}</p>}
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
