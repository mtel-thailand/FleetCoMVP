// Vehicle financing & fleet expansion — brief §7. FleetCo-internal only; no
// cost/margin/financing data is ever exposed on the client side (§7 intro).
//
// paymentSchedule below only carries a few rows around "now" for each record —
// a real build would generate the full amortization schedule from the loan
// terms (baseCost, financedAmount, interestRatePct, termMonths) with a pure
// function rather than storing 60+ hand-authored rows per vehicle.

export type FinancingCoverage = "Covered" | "At Risk" | "Not Covered";

export type PaymentScheduleEntry = {
  dueDate: string;
  installment: number;
  principal: number;
  interest: number;
  status: "Paid" | "Upcoming" | "Overdue";
};

export type FinancingRecord = {
  id: string;
  vehicleId: string;
  lender: string;
  contractNumber: string;
  baseCost: number;
  downPayment: number;
  financedAmount: number;
  interestRatePct: number;
  totalInterest: number;
  insuranceAnnual: number;
  registrationFees: number;
  termMonths: number;
  monthlyInstallment: number;
  startDate: string;
  installmentsPaid: number;
  outstandingPrincipal: number;
  nextPaymentDate: string;
  // Rolling average — the denominator for the coverage ratio (§7.2).
  monthlyRevenueAvg: number;
  coverage: FinancingCoverage;
  // All-time recovered margin toward allInCost — the numerator for ROI (§7.3).
  cumulativeMarginRecovered: number;
  allInCost: number;
  // Months to break-even at the *current* run-rate. null = not on track at
  // the current monthly margin (e.g. vehicle is idle/in maintenance) — the
  // brief's own "idle burn alert" and "scenario sensitivity" cases (§7.2/7.3).
  roiMonthsEstimate: number | null;
  paymentSchedule: PaymentScheduleEntry[];
  created: string;
  updated: string;
};

export const mockFinancingRecords: FinancingRecord[] = [
  {
    id: "FIN-001", vehicleId: "VEH-001", lender: "Kasikornbank Hire-Purchase", contractNumber: "KBHP-2023-00841",
    baseCost: 850000, downPayment: 170000, financedAmount: 680000, interestRatePct: 4.5, totalInterest: 76500,
    insuranceAnnual: 28000, registrationFees: 3200, termMonths: 60, monthlyInstallment: 12610,
    startDate: "2023-02-10", installmentsPaid: 42, outstandingPrincipal: 204000, nextPaymentDate: "2026-09-10",
    monthlyRevenueAvg: 46000, coverage: "Covered", cumulativeMarginRecovered: 620000, allInCost: 1069700,
    roiMonthsEstimate: 15,
    paymentSchedule: [
      { dueDate: "2026-07-10", installment: 12610, principal: 9840, interest: 2770, status: "Paid" },
      { dueDate: "2026-08-10", installment: 12610, principal: 9910, interest: 2700, status: "Paid" },
      { dueDate: "2026-09-10", installment: 12610, principal: 9980, interest: 2630, status: "Upcoming" },
    ],
    created: "2023-02-10 10:00", updated: "2026-08-10 09:00",
  },
  {
    id: "FIN-002", vehicleId: "VEH-002", lender: "Kasikornbank Hire-Purchase", contractNumber: "KBHP-2022-00512",
    baseCost: 1050000, downPayment: 210000, financedAmount: 840000, interestRatePct: 4.2, totalInterest: 88000,
    insuranceAnnual: 24000, registrationFees: 3000, termMonths: 60, monthlyInstallment: 15470,
    startDate: "2022-11-05", installmentsPaid: 45, outstandingPrincipal: 210000, nextPaymentDate: "2026-09-05",
    monthlyRevenueAvg: 16000, coverage: "At Risk", cumulativeMarginRecovered: 390000, allInCost: 1261000,
    roiMonthsEstimate: 210,
    paymentSchedule: [
      { dueDate: "2026-07-05", installment: 15470, principal: 12930, interest: 2540, status: "Paid" },
      { dueDate: "2026-08-05", installment: 15470, principal: 12990, interest: 2480, status: "Paid" },
      { dueDate: "2026-09-05", installment: 15470, principal: 13050, interest: 2420, status: "Upcoming" },
    ],
    created: "2022-11-05 10:00", updated: "2026-08-05 09:00",
  },
  {
    id: "FIN-003", vehicleId: "VEH-003", lender: "Siam Commercial Leasing", contractNumber: "SCL-2024-00193",
    baseCost: 720000, downPayment: 144000, financedAmount: 576000, interestRatePct: 4.0, totalInterest: 57600,
    insuranceAnnual: 20000, registrationFees: 2800, termMonths: 60, monthlyInstallment: 10560,
    startDate: "2024-01-20", installmentsPaid: 31, outstandingPrincipal: 278000, nextPaymentDate: "2026-09-20",
    monthlyRevenueAvg: 28000, coverage: "Covered", cumulativeMarginRecovered: 340000, allInCost: 880400,
    roiMonthsEstimate: 34,
    paymentSchedule: [
      { dueDate: "2026-07-20", installment: 10560, principal: 8460, interest: 2100, status: "Paid" },
      { dueDate: "2026-08-20", installment: 10560, principal: 8500, interest: 2060, status: "Paid" },
      { dueDate: "2026-09-20", installment: 10560, principal: 8540, interest: 2020, status: "Upcoming" },
    ],
    created: "2024-01-20 10:00", updated: "2026-08-20 09:00",
  },
  {
    id: "FIN-004", vehicleId: "VEH-004", lender: "Siam Commercial Leasing", contractNumber: "SCL-2021-00087",
    baseCost: 1800000, downPayment: 360000, financedAmount: 1440000, interestRatePct: 4.8, totalInterest: 207000,
    insuranceAnnual: 42000, registrationFees: 4500, termMonths: 72, monthlyInstallment: 22880,
    startDate: "2021-05-14", installmentsPaid: 63, outstandingPrincipal: 180000, nextPaymentDate: "2026-09-14",
    monthlyRevenueAvg: 9000, coverage: "Not Covered", cumulativeMarginRecovered: 1450000, allInCost: 2263500,
    roiMonthsEstimate: null,
    paymentSchedule: [
      { dueDate: "2026-07-14", installment: 22880, principal: 21100, interest: 1780, status: "Paid" },
      { dueDate: "2026-08-14", installment: 22880, principal: 21170, interest: 1710, status: "Paid" },
      { dueDate: "2026-09-14", installment: 22880, principal: 21240, interest: 1640, status: "Upcoming" },
    ],
    created: "2021-05-14 10:00", updated: "2026-08-14 09:00",
  },
  {
    id: "FIN-005", vehicleId: "VEH-005", lender: "Kasikornbank Hire-Purchase", contractNumber: "KBHP-2023-00902",
    baseCost: 1050000, downPayment: 210000, financedAmount: 840000, interestRatePct: 4.3, totalInterest: 86000,
    insuranceAnnual: 24000, registrationFees: 3000, termMonths: 60, monthlyInstallment: 15430,
    startDate: "2023-03-18", installmentsPaid: 41, outstandingPrincipal: 266000, nextPaymentDate: "2026-09-18",
    monthlyRevenueAvg: 49500, coverage: "Covered", cumulativeMarginRecovered: 610000, allInCost: 1259000,
    roiMonthsEstimate: 20,
    paymentSchedule: [
      { dueDate: "2026-07-18", installment: 15430, principal: 12680, interest: 2750, status: "Paid" },
      { dueDate: "2026-08-18", installment: 15430, principal: 12730, interest: 2700, status: "Paid" },
      { dueDate: "2026-09-18", installment: 15430, principal: 12780, interest: 2650, status: "Upcoming" },
    ],
    created: "2023-03-18 10:00", updated: "2026-08-18 09:00",
  },
  {
    id: "FIN-006", vehicleId: "VEH-007", lender: "Siam Commercial Leasing", contractNumber: "SCL-2024-00266",
    baseCost: 730000, downPayment: 146000, financedAmount: 584000, interestRatePct: 4.0, totalInterest: 58400,
    insuranceAnnual: 20000, registrationFees: 2800, termMonths: 60, monthlyInstallment: 10710,
    startDate: "2024-06-01", installmentsPaid: 26, outstandingPrincipal: 331000, nextPaymentDate: "2026-09-01",
    monthlyRevenueAvg: 24000, coverage: "Covered", cumulativeMarginRecovered: 180000, allInCost: 891200,
    roiMonthsEstimate: 61,
    paymentSchedule: [
      { dueDate: "2026-07-01", installment: 10710, principal: 8340, interest: 2370, status: "Paid" },
      { dueDate: "2026-08-01", installment: 10710, principal: 8380, interest: 2330, status: "Paid" },
      { dueDate: "2026-09-01", installment: 10710, principal: 8420, interest: 2290, status: "Upcoming" },
    ],
    created: "2024-06-01 10:00", updated: "2026-08-01 09:00",
  },
];
