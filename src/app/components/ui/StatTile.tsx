import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// A single scannable fact — icon, label, value — for a detail page's
// "at a glance" summary row. Smaller and quieter than MiniDash's
// dashboard-style stat cards elsewhere in the app (no big number, no
// colored icon *well*): this restates a record's own fields, it isn't a
// computed metric worth the same visual weight as those. The icon glyph
// itself is accent-colored (var(--portal-accent), so it's FleetCo blue on
// ops and Thailand Post burgundy on the client portal automatically, same
// as every other accent-colored element in the app) — tried plain grey
// first, tried it against a reference that used blue; this is a middle
// ground, a touch of color without the full colored-well treatment that'd
// actually put it in competition with MiniDash.
//
// value takes ReactNode, not just string, so a caller can fold a second,
// lower-priority fact into one tile with its own muted styling (e.g.
// Rental Period appending the rental type after it, quieter than the
// dates) instead of giving both facts equal visual weight. The hover
// tooltip only fires for the plain-string case — every existing call site
// still gets it unchanged; the richer case just skips it rather than
// stringifying JSX into something unreadable.
export function StatTile({ icon: Icon, label, value, className = "" }: { icon: LucideIcon; label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-50 rounded-lg p-3 ${className}`}>
      <Icon size={13} className="text-[var(--portal-accent)] mb-2" />
      <p className="text-[10px] font-normal uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className="text-xs font-medium text-slate-800 truncate" title={typeof value === "string" ? value : undefined}>{value}</p>
    </div>
  );
}
