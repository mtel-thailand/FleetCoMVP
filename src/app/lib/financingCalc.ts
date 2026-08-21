// Shared financing math — brief §7. Used by both the Acquisition Simulator
// (a pure what-if calculator, nothing stored) and the "add financing record"
// form (which is really just committing to a simulated projection), so the
// two screens can never quietly disagree on how a number is derived.
//
// Note: this is a flat-rate approximation (principal × rate × years), not a
// bank-grade amortization schedule — proportionate for a planning/what-if
// tool, not for generating an actual loan contract.
import type { FinancingCoverage } from "@/app/data/financing";

export type FinancingInputs = {
  baseCost: number;
  downPayment: number;
  interestRatePct: number;
  termMonths: number;
  insuranceAnnual: number;
  registrationFees: number;
  expectedMonthlyRevenue: number;
};

export type FinancingProjection = {
  financedAmount: number;
  totalInterest: number;
  monthlyInstallment: number;
  allInCost: number;
  monthlyCarryingCost: number;
  monthlyMargin: number;
  coverageRatio: number;
  coverage: FinancingCoverage;
  roiMonths: number | null;
};

const COVERED_RATIO = 1.2;
const AT_RISK_RATIO = 0.9;

export function computeFinancingProjection(inputs: FinancingInputs): FinancingProjection {
  const financedAmount = Math.max(0, inputs.baseCost - inputs.downPayment);
  const totalInterest = Math.round(financedAmount * (inputs.interestRatePct / 100) * (inputs.termMonths / 12));
  const monthlyInstallment = inputs.termMonths > 0 ? Math.round((financedAmount + totalInterest) / inputs.termMonths) : 0;
  const allInCost = inputs.baseCost + totalInterest + inputs.insuranceAnnual * (inputs.termMonths / 12) + inputs.registrationFees;
  const monthlyCarryingCost = monthlyInstallment + inputs.insuranceAnnual / 12;
  const monthlyMargin = inputs.expectedMonthlyRevenue - monthlyCarryingCost;
  const coverageRatio = monthlyCarryingCost > 0 ? inputs.expectedMonthlyRevenue / monthlyCarryingCost : 0;
  const coverage: FinancingCoverage =
    coverageRatio >= COVERED_RATIO ? "Covered" : coverageRatio >= AT_RISK_RATIO ? "At Risk" : "Not Covered";
  const roiMonths = monthlyMargin > 0 ? Math.ceil(allInCost / monthlyMargin) : null;

  return { financedAmount, totalInterest, monthlyInstallment, allInCost, monthlyCarryingCost, monthlyMargin, coverageRatio, coverage, roiMonths };
}
