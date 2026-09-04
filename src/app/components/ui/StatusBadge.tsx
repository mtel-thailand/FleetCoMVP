export function StatusBadge({ status, variant }: { status: string; variant?: "esim" }) {
  const baseMap: Record<string, string> = {
    // generic
    Active: "bg-emerald-100 text-emerald-700",
    Inactive: "bg-slate-100 text-slate-500",
    Display: "bg-emerald-100 text-emerald-700",
    Hide: "bg-slate-100 text-slate-500",
    Organic: "bg-sky-100 text-sky-700",
    Affiliate: "bg-violet-100 text-violet-700",
    Verified: "bg-emerald-100 text-emerald-700",
    Pending: "bg-amber-100 text-amber-700",
    Payout: "bg-red-100 text-red-700",
    Return: "bg-emerald-100 text-emerald-700",
    // FastPass
    "Not verified": "bg-amber-100 text-amber-700",
    "Ready to use": "bg-green-100 text-green-700",
    Confirmed: "bg-emerald-100 text-emerald-700",
    Redeemed: "bg-blue-100 text-blue-700",
    Expired: "bg-red-100 text-red-800 border border-red-200",
    // Transportation
    Assigned: "bg-blue-100 text-blue-700",
    Cancelled: "bg-slate-100 text-slate-500",
    Complete: "bg-emerald-100 text-emerald-700",
    // eSIM statuses
    "Not Installed": "bg-slate-100 text-slate-500",
    "Out of Data": "bg-orange-100 text-orange-700",
    // Insurance
    "Not submitted": "bg-slate-100 text-slate-500",
    Rejected: "bg-orange-100 text-orange-700",
    Purchased: "bg-sky-100 text-sky-700",
    Approved: "bg-emerald-100 text-emerald-700",

    // ── FleetCo booking chain (data/bookingStatus.ts) — §3/§6.1 ──────────
    Requested: "bg-amber-100 text-amber-700",
    Quoted: "bg-sky-100 text-sky-700",
    Accepted: "bg-violet-100 text-violet-700",
    "Awaiting Assignment": "bg-violet-100 text-violet-700",
    Scheduled: "bg-blue-100 text-blue-700",
    // Active / Assigned / Cancelled reuse the generic entries above.
    Completed: "bg-teal-100 text-teal-700",
    Declined: "bg-rose-100 text-rose-700",
    // My Rentals' simplified label (bookings.ts's clientRentalStatusLabel) —
    // Accepted+Assigned collapse into this on the client portal; reuses
    // Assigned's own blue since it's absorbing that status. Completed's
    // own entry above already covers that half of the collapse for free.
    Upcoming: "bg-blue-100 text-blue-700",

    // ── Quotation status (data/quotations.ts) — §6 ───────────────────────
    Draft: "bg-slate-100 text-slate-500",
    Issued: "bg-sky-100 text-sky-700",
    Superseded: "bg-slate-100 text-slate-400",

    // ── Invoice status (data/invoices.ts) — §6.1 ─────────────────────────
    Unpaid: "bg-amber-100 text-amber-700",
    "Payment Submitted": "bg-indigo-100 text-indigo-700",
    Paid: "bg-green-100 text-green-700",
    Overdue: "bg-red-100 text-red-700",
    "Tax Invoice Issued": "bg-violet-100 text-violet-700",
    // Orange, not red — a rejected claim isn't the same problem as a missed
    // deadline (Overdue), it's "you tried and it didn't go through," same
    // "attempted, went wrong" semantics as Rejected/In Maintenance/Out of
    // Data above.
    "Payment Issue": "bg-orange-100 text-orange-700",

    // ── Vehicle status (data/vehicles.ts) — §4.2 ─────────────────────────
    Available: "bg-emerald-100 text-emerald-700",
    Unavailable: "bg-slate-100 text-slate-500",
    Reserved: "bg-amber-100 text-amber-700",
    "On Rental": "bg-blue-100 text-blue-700",
    "In Maintenance": "bg-orange-100 text-orange-700",
    "Out of Service": "bg-red-100 text-red-700",

    // ── Driver employment status (data/drivers.ts) — §4.3 ────────────────
    "On Leave": "bg-amber-100 text-amber-700",

    // ── Financing coverage (data/financing.ts) — §7.2 ────────────────────
    Covered: "bg-emerald-100 text-emerald-700",
    "At Risk": "bg-amber-100 text-amber-700",
    "Not Covered": "bg-red-100 text-red-700",

    // ── Issue Report status (data/issueReports.ts) ───────────────────────
    Open: "bg-amber-100 text-amber-700",
    Resolved: "bg-emerald-100 text-emerald-700",

    // ── Tax branch registry status (data/clients.ts OrgBranch) ───────────
    Deactivated: "bg-slate-100 text-slate-500",
  };

  // eSIM variant: Inactive is blue instead of grey
  const esimOverrides: Record<string, string> = {
    Inactive: "bg-blue-100 text-blue-700",
  };

  const colorMap = variant === "esim" ? { ...baseMap, ...esimOverrides } : baseMap;
  const cls = colorMap[status] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
