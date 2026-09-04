import { useState } from "react";
import { DollarSign } from "lucide-react";
import { mockAuditLog, type AuditLogEntry } from "@/app/data/auditLog";
import { FilterBar } from "@/app/components/ui/FilterBar";
import { FilterDropdown } from "@/app/components/ui/FilterDropdown";
import { formatDate } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, parseExcelDate, exportDateTag } from "@/app/components/ui/exportUtils";

// brief §4.8/§8: "Audit log: who did what, when — especially on pricing and
// payment status changes." Financial entity types (Quotation/Invoice/Tax
// Invoice) get a small $ marker so those rows scan out from the rest, per
// that emphasis.

const ENTITY_TYPES: AuditLogEntry["entityType"][] = ["Booking", "Quotation", "Invoice", "Tax Invoice", "Vehicle", "Driver", "Client Account"];
const FINANCIAL_TYPES = new Set(["Quotation", "Invoice", "Tax Invoice"]);

const HEADERS = ["Timestamp", "Actor", "Role", "Action", "Entity Type", "Entity ID", "Detail"];

function csvRow(e: AuditLogEntry): string[] {
  return [e.timestamp, e.actor, e.actorRole, e.action, e.entityType, e.entityId, e.detail];
}
function xlsxRow(e: AuditLogEntry): (string | Date)[] {
  return [parseExcelDate(e.timestamp) as Date, e.actor, e.actorRole, e.action, e.entityType, e.entityId, e.detail];
}

export function AuditLog() {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const filtered = mockAuditLog.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !search || e.actor.toLowerCase().includes(q) || e.entityId.toLowerCase().includes(q) || e.detail.toLowerCase().includes(q);
    const matchEntity = !entityFilter || e.entityType === entityFilter;
    return matchSearch && matchEntity;
  });

  const sorted = filtered.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return (
    <div>
      <FilterBar
        showSearch
        searchableFields={["Actor", "Entity ID", "Detail"]}
        showExport
        exportDisabled={sorted.length === 0}
        onExportCSV={() => exportCSV(HEADERS, sorted.map(csvRow), `audit-log-${exportDateTag()}.csv`)}
        onExportXLSX={() => exportXLSX(HEADERS, sorted.map(xlsxRow), `audit-log-${exportDateTag()}.xlsx`)}
        onSearch={setSearch}
        extraFilters={
          <FilterDropdown
            value={entityFilter}
            onChange={setEntityFilter}
            placeholder="All Entity Types"
            options={[{ label: "All Entity Types", value: "" }, ...ENTITY_TYPES.map((t) => ({ label: t, value: t }))]}
          />
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "900px" }}>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Timestamp", "Actor", "Action", "Entity", "Detail"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(e.timestamp)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <p className="text-slate-800 font-medium">{e.actor}</p>
                    <p className="text-slate-400">{e.actorRole}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{e.action}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                      {FINANCIAL_TYPES.has(e.entityType) && <DollarSign size={11} className="text-emerald-600" />}
                      {e.entityId}
                    </span>
                    <p className="text-slate-400">{e.entityType}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No matching audit entries</div>}
      </div>
    </div>
  );
}
