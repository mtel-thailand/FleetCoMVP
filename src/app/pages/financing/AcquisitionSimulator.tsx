import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Calculator, CheckCircle2 } from "lucide-react";
import { computeFinancingProjection } from "@/app/lib/financingCalc";
import { addFinancingRecord } from "@/app/lib/financingStore";
import { useVehicles, updateVehicle } from "@/app/lib/vehiclesStore";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { formatCurrency } from "@/app/data/formatters";
import type { FinancingRecord } from "@/app/data/financing";
import { toast } from "sonner";
import { translate } from "@/app/i18n";
import { demoNowStamp, demoToday } from "@/app/data/demoDates";

// brief §7.4: "Acquisition simulator (pre-purchase): before committing to
// the bank, model a candidate vehicle — enter base cost, financing terms,
// insurance, and expected B2B rental rate/duration — and see projected
// monthly margin, coverage, and ROI timeline. Turns fleet expansion into a
// data-backed decision."

function nowStamp() {
  return demoNowStamp();
}

function Field({ label, value, onChange, suffix, step }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Input className="pr-12"
          type="number"
          value={value}
          step={step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

export function AcquisitionSimulator() {
  const vehicles = useVehicles();
  const candidateVehicles = vehicles.filter((v) => !v.financed);

  const [baseCost, setBaseCost] = useState(850000);
  const [downPayment, setDownPayment] = useState(170000);
  const [interestRatePct, setInterestRatePct] = useState(4.5);
  const [termMonths, setTermMonths] = useState(60);
  const [insuranceAnnual, setInsuranceAnnual] = useState(26000);
  const [registrationFees, setRegistrationFees] = useState(3000);
  const [rentalRatePerDay, setRentalRatePerDay] = useState(2500);
  const [utilizationPct, setUtilizationPct] = useState(65);
  const [targetVehicleId, setTargetVehicleId] = useState(candidateVehicles[0]?.id ?? "");
  const [committed, setCommitted] = useState(false);

  const expectedMonthlyRevenue = Math.round(rentalRatePerDay * 30 * (utilizationPct / 100));

  const projection = computeFinancingProjection({
    baseCost, downPayment, interestRatePct, termMonths, insuranceAnnual, registrationFees, expectedMonthlyRevenue,
  });

  function handleCommit() {
    if (!targetVehicleId) return;
    const id = `FIN-${String(Date.now()).slice(-6)}`;
    const record: FinancingRecord = {
      id, vehicleId: targetVehicleId, lender: "TBD — pending bank approval", contractNumber: "Pending",
      baseCost, downPayment, financedAmount: projection.financedAmount, interestRatePct, totalInterest: projection.totalInterest,
      insuranceAnnual, registrationFees, termMonths, monthlyInstallment: projection.monthlyInstallment,
      startDate: demoToday(), installmentsPaid: 0, outstandingPrincipal: projection.financedAmount,
      nextPaymentDate: demoToday(), monthlyRevenueAvg: expectedMonthlyRevenue,
      coverage: projection.coverage, cumulativeMarginRecovered: 0, allInCost: projection.allInCost,
      roiMonthsEstimate: projection.roiMonths, paymentSchedule: [], created: nowStamp(), updated: nowStamp(),
    };
    addFinancingRecord(record);
    updateVehicle(targetVehicleId, { financed: true, updated: nowStamp() });
    setCommitted(true);
    toast.success(translate("Financing record {id} created — see it in Portfolio.", { id }));
  }

  const coverageTone: Record<string, string> = {
    Covered: "text-emerald-600", "At Risk": "text-amber-600", "Not Covered": "text-rose-600",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Inputs */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Candidate Vehicle</h3>
          <p className="text-xs text-slate-400 mb-3">Model a purchase before committing to the bank.</p>
          <Select
            value={targetVehicleId || undefined}
            onValueChange={(value) => { setTargetVehicleId(value); setCommitted(false); }}
            disabled={candidateVehicles.length === 0}
          >
            <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]">
              <SelectValue placeholder="No unfinanced vehicles in fleet" />
            </SelectTrigger>
            <SelectContent>
              {candidateVehicles.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">{v.plateNumber} · {v.brand} {v.model} ({v.vehicleClass})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Acquisition &amp; Financing</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base Cost" value={baseCost} onChange={setBaseCost} suffix="THB" step={10000} />
            <Field label="Down Payment" value={downPayment} onChange={setDownPayment} suffix="THB" step={10000} />
            <Field label="Interest Rate" value={interestRatePct} onChange={setInterestRatePct} suffix="% / yr" step={0.1} />
            <Field label="Term" value={termMonths} onChange={setTermMonths} suffix="months" step={12} />
            <Field label="Insurance" value={insuranceAnnual} onChange={setInsuranceAnnual} suffix="THB / yr" step={1000} />
            <Field label="Registration &amp; Fees" value={registrationFees} onChange={setRegistrationFees} suffix="THB" step={500} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Expected B2B Demand (the "what if")</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600">Rental Rate</label>
                <span className="text-xs text-slate-500">{formatCurrency(rentalRatePerDay)} / day</span>
              </div>
              <input type="range" min={500} max={6000} step={100} value={rentalRatePerDay}
                onChange={(e) => setRentalRatePerDay(Number(e.target.value))} className="w-full accent-[var(--portal-accent)]" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600">Expected Utilization</label>
                <span className="text-xs text-slate-500">{utilizationPct}% of days rented</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={utilizationPct}
                onChange={(e) => setUtilizationPct(Number(e.target.value))} className="w-full accent-[var(--portal-accent)]" />
            </div>
            <p className="text-[11px] text-slate-400">→ projected revenue {formatCurrency(expectedMonthlyRevenue)} / month</p>
          </div>
        </div>
      </div>

      {/* Projection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-[var(--portal-accent)]" />
          <h3 className="text-sm font-semibold text-slate-900">Projection</h3>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500">Coverage</p>
          <p className={`text-2xl font-semibold mt-1 ${coverageTone[projection.coverage]}`}>{projection.coverageRatio.toFixed(2)}×</p>
          <div className="mt-2"><StatusBadge status={projection.coverage} /></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Monthly Installment</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatCurrency(projection.monthlyInstallment)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Monthly Carrying Cost</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatCurrency(projection.monthlyCarryingCost)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Monthly Margin</p>
            <p className={`text-sm font-semibold mt-0.5 ${projection.monthlyMargin < 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {projection.monthlyMargin < 0 ? "−" : ""}{formatCurrency(Math.abs(projection.monthlyMargin))}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">All-In Cost</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatCurrency(projection.allInCost)}</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500">Break-Even Timeline</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {projection.roiMonths === null ? "Not on track at this rate" : translate("~{count} months", { count: projection.roiMonths })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {projection.roiMonths === null
              ? "Raise the rental rate or utilization assumption above to see a break-even date."
              : "at the current rate and utilization assumptions"}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-100">
          {committed ? (
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 py-2">
              <CheckCircle2 size={14} /> Committed — see Financing Portfolio
            </div>
          ) : (
            <Button variant="primary" size="lg"
              disabled={!targetVehicleId}
              onClick={handleCommit}
            >
              Commit to Financing
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
