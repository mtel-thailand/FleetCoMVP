import { Truck, Building2, CheckCircle2, Info } from "lucide-react";
import { OPS_NAV_SECTIONS, CLIENT_NAV_SECTIONS, type NavSection } from "@/app/components/layout/Sidebar";
import {
  ROLE_LABELS,
  ROLE_ALLOWED,
  type FleetCoRole,
  type ClientRole,
} from "@/app/lib/auth";

// brief §4.8: "Roles & permissions for FleetCo staff (admin, operations,
// account manager, finance, read-only)." Renders the actual access matrix
// from the same OPS_NAV_SECTIONS/CLIENT_NAV_SECTIONS the Sidebar uses and
// the same ROLE_ALLOWED the router enforces — a description of live policy,
// not a second copy of it that could quietly go stale.

const FLEETCO_ROLES: FleetCoRole[] = ["platform_admin", "ops_manager", "account_manager", "finance", "read_only"];
const CLIENT_ROLES: ClientRole[] = ["client_admin", "client_approver", "client_requester", "client_finance"];

function hasAccess(allowed: string[], path: string): boolean {
  return allowed.length === 0 || allowed.some((p) => path.startsWith(p) || p.startsWith(path));
}

function Matrix({ title, icon, sections, roles }: {
  title: string; icon: React.ReactNode; sections: NavSection[]; roles: (FleetCoRole | ClientRole)[];
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
        {icon}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">Section</th>
              {roles.map((r) => (
                <th key={r} className="text-center font-medium text-slate-400 px-3 py-2.5 whitespace-nowrap">{ROLE_LABELS[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.flatMap((section) =>
              section.items.map((item, i) => (
                <tr key={item.path} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                    {i === 0 && <span className="text-slate-400 mr-1">{section.section} ·</span>}
                    {item.label}
                  </td>
                  {roles.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      {hasAccess(ROLE_ALLOWED[r], item.path) ? (
                        <CheckCircle2 size={13} className="text-emerald-500 inline" />
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RolesPermissions() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-4 py-3">
        <Info size={14} className="text-[var(--portal-accent)] shrink-0 mt-0.5" />
        <span>
          This matrix reflects live navigation policy from <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">auth.ts</code>.
          <strong> Read-Only</strong> currently has full navigation access like Platform Admin — per-action write blocking
          (disabling every create/edit/delete button for this role specifically) isn't wired up yet.
        </span>
      </div>

      <Matrix title="FleetCo Operations Portal" icon={<Truck size={16} className="text-[var(--portal-accent)]" />} sections={OPS_NAV_SECTIONS} roles={FLEETCO_ROLES} />
      <Matrix title="Client Self-Service Portal" icon={<Building2 size={16} className="text-violet-600" />} sections={CLIENT_NAV_SECTIONS} roles={CLIENT_ROLES} />
    </div>
  );
}
