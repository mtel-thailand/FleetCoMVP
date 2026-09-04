import { FileQuestion, FileText, MapPin, ReceiptText, ShieldCheck, type LucideIcon } from "lucide-react";
import { getClientPaymentTerms } from "@/app/data/clients";
import { useClients } from "@/app/lib/clientsStore";
import { CLIENT_ID } from "@/app/lib/currentClient";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";

// Read-only mirror of what FleetCo's own Client Accounts page manages for
// this org — see ClientAccounts.tsx's ClientDetailPanel, which this
// deliberately doesn't import from or share components with, same
// "parallel, not shared" split this app already keeps between every other
// ops/client pair (OpsBookingDetailPanel vs ClientBookingDetail, and so
// on): the ops page is a full CRUD surface with modals and store-mutating
// handlers; this page has none of that, on purpose — no edit button, no Add
// Branch, no deactivate control, nothing that calls updateClient/
// updateClientTaxFields/addOrgBranch/updateOrgBranch/deactivateOrgBranch
// anywhere in this file. If any of that shows up here later, that's the
// read-only guarantee breaking, not a refactor.
//
// Scoped by CLIENT_ID (see currentClient.ts), the same isolation pattern
// every other client-portal page already uses (BookingDetail.tsx,
// RequestVehicle.tsx, ...) — this client only ever sees its own record,
// never another organisation's, because the lookup is filtered by id up
// front rather than trusted to just happen to be the only one in the data.
//
// Tax field / branch edit history (taxFieldHistory, OrgBranch.fieldHistory)
// is deliberately NOT shown here — that's FleetCo's own accountability
// trail (who internally changed what), not something a client account needs
// surfaced. What the client needs is the current state of their own record,
// which is exactly what this page shows.
function ProfileTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3">
      <Icon size={14} className="mb-2 text-[var(--portal-accent)]" />
      <p className="text-[10px] font-normal uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-medium leading-relaxed text-slate-800">{value}</p>
    </div>
  );
}

export function CompanyProfile() {
  const client = useClients().find((c) => c.id === CLIENT_ID);

  usePageHeader(client?.name, "System");

  if (!client) {
    return (
      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white">
        <EmptyState icon={FileQuestion} title="Organisation record not found" subtitle="Contact FleetCo if this looks wrong." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{client.name}</h1>
          <StatusBadge status={client.status} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{client.id}</p>
      </div>

      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Company Profile</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ProfileTile icon={FileText} label="Tax ID" value={client.taxId} />
            <ProfileTile icon={ReceiptText} label="Payment Terms" value={getClientPaymentTerms(client)} />
            <ProfileTile icon={MapPin} label="Registered Address" value={client.registeredAddress} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tax Registration Branches</h4>
            <p className="mt-0.5 text-[11px] text-slate-400">Your registered tax branches (ภ.พ.20) on file with FleetCo — what appears on your tax invoices.</p>
          </div>
          {client.orgBranches.length === 0 ? (
            <p className="text-xs text-slate-400">No tax branches on file yet.</p>
          ) : (
            <div className="space-y-2">
              {client.orgBranches.map((branch) => {
                const isDeactivated = branch.status === "Deactivated";
                return (
                  <div key={branch.id} className={`rounded-lg p-3 ${isDeactivated ? "bg-slate-50/70 opacity-60" : "bg-slate-50"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500">{branch.code}</span>
                      {branch.isHeadOffice && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700">Head Office</span>
                      )}
                      <StatusBadge status={branch.status} />
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-800">{branch.legalNameEn}</p>
                    <p className="text-[11px] text-slate-500">{branch.legalNameTh}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{branch.addressEn}</p>
                    <p className="text-[11px] leading-relaxed text-slate-400">{branch.addressTh}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          <span>Read-only. To correct anything here — a wrong address, a new branch, a closed one — contact your FleetCo account manager; FleetCo staff apply the change on their side.</span>
        </div>
      </div>
    </div>
  );
}
