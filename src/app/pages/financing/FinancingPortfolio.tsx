import { useState } from "react";
import { X, Landmark, TrendingUp, AlertTriangle, DollarSign, CheckCircle2 } from "lucide-react";
import type { FinancingRecord } from "@/app/data/financing";
import { useFinancingRecords, updateFinancingRecord } from "@/app/lib/financingStore";
import { useVehicles } from "@/app/lib/vehiclesStore";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { SortIndicator } from "@/app/components/ui/SortIndicator";
import { formatDate, sortByStatus } from "@/app/components/ui/utils";
import { formatCurrency } from "@/app/data/formatters";
import { useBodyScrollLock } from "@/app/hooks/useBodyScrollLock";

// brief §7.4: "Two key surfaces: (a) the portfolio table with dense
// financial columns and status colors, (b) the per-vehicle financing detail
// page combining payment progress, margin trend chart, and ROI countdown in
// one narrative."

const COVERAGE_PRIORITY = ["Not Covered", "At Risk", "Covered"];

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function monthsFromNow(n: number | null): string {
  if (n === null) return "Not on track";
  if (n <= 0) return "Paid off";
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return `${n} month${n === 1 ? "" : "s"} (~${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })})`;
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h4>
      <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <span className="text-xs text-slate-500 shrink-0">{label}</span>
            <span className="text-xs font-medium text-slate-800 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ pct, tone }: { pct: number; tone: "blue" | "emerald" | "amber" | "rose" }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const bar = { blue: "bg-[var(--portal-accent)]", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" }[tone];
  return (
    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
      <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

// ── Financing detail panel ──────────────────────────────────────────────────

function FinancingDetailPanel({ record, onClose }: { record: FinancingRecord; onClose: () => void }) {
  useBodyScrollLock();
  const vehicles = useVehicles();
  const vehicle = vehicles.find((v) => v.id === record.vehicleId);
  const [confirmSettle, setConfirmSettle] = useState(false);

  const paidPct = (record.installmentsPaid / record.termMonths) * 100;
  const roiPct = (record.cumulativeMarginRecovered / record.allInCost) * 100;
  const monthsRemaining = record.termMonths - record.installmentsPaid;
  const monthlyCarryingCost = record.monthlyInstallment + record.insuranceAnnual / 12;
  const monthlyMargin = record.monthlyRevenueAvg - monthlyCarryingCost;
  const idleBurn = vehicle?.status === "Available" && record.coverage !== "Covered";

  function handleSettle() {
    updateFinancingRecord(record.id, {
      outstandingPrincipal: 0,
      installmentsPaid: record.termMonths,
      updated: nowStamp(),
    });
    setConfirmSettle(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{vehicle ? `${vehicle.plateNumber} · ${vehicle.brand} ${vehicle.model}` : record.vehicleId}</h3>
            <p className="text-xs text-slate-500">{record.lender} · {record.contractNumber}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Coverage</span>
            <StatusBadge status={record.coverage} />
            {idleBurn && (
              <span className="flex items-center gap-1 text-[11px] text-rose-600">
                <AlertTriangle size={11} /> idle — still costing the installment
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Progress</h4>
              <span className="text-xs text-slate-500">{record.installmentsPaid} of {record.termMonths} months</span>
            </div>
            <ProgressBar pct={paidPct} tone="blue" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Outstanding Principal</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatCurrency(record.outstandingPrincipal)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Months Remaining</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{Math.max(0, monthsRemaining)}</p>
              </div>
            </div>
          </div>

          <Section
            title="Total Cost of Ownership"
            rows={[
              ["Base Cost", formatCurrency(record.baseCost)],
              ["Total Interest", formatCurrency(record.totalInterest)],
              ["Insurance (annual)", formatCurrency(record.insuranceAnnual)],
              ["Registration & Fees", formatCurrency(record.registrationFees)],
              ["All-In Cost", formatCurrency(record.allInCost)],
              ["Next Payment", `${formatDate(record.nextPaymentDate)}, ${formatCurrency(record.monthlyInstallment)}`],
            ]}
          />

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Rental Coverage &amp; Margin</h4>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs text-slate-500">Monthly Carrying Cost</span>
                <span className="text-xs font-medium text-slate-800">{formatCurrency(monthlyCarryingCost)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs text-slate-500">Monthly Revenue (avg)</span>
                <span className="text-xs font-medium text-slate-800">{formatCurrency(record.monthlyRevenueAvg)}</span>
              </div>
              <div className="flex items-start justify-between gap-4 pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-500">Monthly Margin</span>
                <span className={`text-xs font-semibold ${monthlyMargin < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {monthlyMargin < 0 ? "−" : ""}{formatCurrency(Math.abs(monthlyMargin))}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs text-slate-500">Coverage Ratio</span>
                <span className="text-xs font-medium text-slate-800">{(record.monthlyRevenueAvg / monthlyCarryingCost).toFixed(2)}×</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ROI &amp; Break-Even</h4>
              <span className="text-xs text-slate-500">{roiPct.toFixed(0)}% recovered</span>
            </div>
            <ProgressBar pct={roiPct} tone={record.roiMonthsEstimate === null ? "rose" : "emerald"} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Cumulative Margin Recovered</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatCurrency(record.cumulativeMarginRecovered)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Break-Even ETA</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{monthsFromNow(record.roiMonthsEstimate)}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Payment Schedule (recent)</h4>
            <div className="bg-slate-50 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="text-left font-medium px-3 py-2">Due Date</th>
                    <th className="text-right font-medium px-3 py-2">Installment</th>
                    <th className="text-right font-medium px-3 py-2">Principal</th>
                    <th className="text-right font-medium px-3 py-2">Interest</th>
                    <th className="text-right font-medium px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {record.paymentSchedule.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-700">{formatDate(p.dueDate)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(p.installment)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(p.principal)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(p.interest)}</td>
                      <td className="px-3 py-2 text-right"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {record.outstandingPrincipal > 0 && (
            <div>
              {confirmSettle ? (
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-slate-600">
                    Record early settlement of {formatCurrency(record.outstandingPrincipal)}? This marks the loan fully paid off.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmSettle(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer">Cancel</button>
                    <button onClick={handleSettle} className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs hover:bg-[var(--portal-accent-hover)] cursor-pointer">Confirm Settlement</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmSettle(true)} className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={13} /> Record Early Settlement
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Portfolio list ───────────────────────────────────────────────────────────

function HeadlineCards({ records }: { records: FinancingRecord[] }) {
  const totalObligation = records.reduce((sum, r) => sum + r.monthlyInstallment + r.insuranceAnnual / 12, 0);
  const totalRevenue = records.reduce((sum, r) => sum + r.monthlyRevenueAvg, 0);
  const atRisk = records.filter((r) => r.coverage !== "Covered").length;
  const portfolioRatio = totalObligation > 0 ? totalRevenue / totalObligation : 0;

  const cards = [
    { label: "Total Monthly Obligation", value: formatCurrency(totalObligation), icon: <Landmark size={16} className="text-[var(--portal-accent)]" />, bg: "bg-[var(--portal-accent-light)]" },
    { label: "Total Contracted Revenue", value: formatCurrency(totalRevenue), icon: <DollarSign size={16} className="text-emerald-600" />, bg: "bg-emerald-50" },
    { label: "Portfolio Coverage Ratio", value: `${portfolioRatio.toFixed(2)}×`, icon: <TrendingUp size={16} className="text-violet-600" />, bg: "bg-violet-50" },
    { label: "Vehicles At Risk", value: String(atRisk), icon: <AlertTriangle size={16} className="text-rose-600" />, bg: "bg-rose-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>{c.icon}</div>
          <div>
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-xl font-semibold text-slate-900 mt-0.5">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FinancingPortfolio() {
  const records = useFinancingRecords();
  const vehicles = useVehicles();
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"coverage" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const selected = selectedId ? (records.find((r) => r.id === selectedId) ?? null) : null;

  function handleSort() {
    setSortKey("coverage");
    setSortDir((d) => (sortKey === "coverage" && d === "asc" ? "desc" : "asc"));
  }

  const sorted = sortKey ? sortByStatus(records, "coverage", COVERAGE_PRIORITY, sortDir) : records;

  return (
    <div>
      {selected && <FinancingDetailPanel record={selected} onClose={() => setSelectedId(null)} />}

      <HeadlineCards records={records} />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm" style={{ minWidth: "1100px" }}>
            <colgroup>
              <col style={{ width: "190px" }} />
              <col style={{ width: "170px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Vehicle", "Lender", "Outstanding", "Months Left", "Monthly Installment", "Break-Even ETA"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap">{h}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-600" onClick={handleSort}>
                  <span className="inline-flex items-center gap-1">Coverage<SortIndicator active={sortKey === "coverage"} direction={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const v = vehicleById.get(r.vehicleId);
                return (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(r.id)}>
                    <td className="px-4 py-3 text-xs text-[var(--portal-accent)] font-medium truncate">{v ? `${v.plateNumber} · ${v.brand} ${v.model}` : r.vehicleId}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 truncate">{r.lender}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-medium whitespace-nowrap">{formatCurrency(r.outstandingPrincipal)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{Math.max(0, r.termMonths - r.installmentsPaid)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatCurrency(r.monthlyInstallment)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{monthsFromNow(r.roiMonthsEstimate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={r.coverage} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {records.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No financed vehicles yet.</div>}
      </div>
    </div>
  );
}
