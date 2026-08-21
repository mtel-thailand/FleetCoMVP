import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Wallet, Repeat, Gauge, Download, AlertCircle } from "lucide-react";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useBookings } from "@/app/lib/bookingsStore";
import { useVehicles } from "@/app/lib/vehiclesStore";
import { useClients } from "@/app/lib/clientsStore";
import type { Vehicle } from "@/app/data/vehicles";
import { formatCurrency } from "@/app/data/formatters";
import { formatDate } from "@/app/components/ui/utils";
import { exportCSV, exportXLSX, exportDateTag } from "@/app/components/ui/exportUtils";

// brief §4.7 — the other big gap the audit flagged. "Revenue by
// client/vehicle/type/rental-type; monthly trend; committed future revenue
// from long-term rentals. Utilization: % fleet on rental, idle vehicle
// report, per-vehicle revenue vs downtime. Receivables: outstanding
// invoices, aging buckets, expected payment dates. Exports: CSV/Excel for
// all reports; PDF for shareable summaries."
//
// "Revenue" here means invoiced amount (amountDue on every issued invoice,
// regardless of payment status) — an accrual view, not cash collected.
// Outstanding/aging below is the cash-collected side of the same numbers,
// kept as a separate section rather than conflated with "revenue" itself.
// "PDF" reuses the same window.print() convention already used for every
// other document in this app — no PDF library exists here, and print-to-PDF
// is what every browser already offers for a shareable summary.

const MONTHS_SHOWN = 6;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AGING_BUCKETS = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function agingBucket(dueDate: string, today: Date): (typeof AGING_BUCKETS)[number] {
  const days = Math.floor((today.getTime() - new Date(dueDate).getTime()) / 86400000);
  if (days <= 0) return "Current";
  if (days <= 30) return "1–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  return "90+ days";
}

// How long a currently-Available vehicle has been sitting idle, from its
// own status history — the closest thing to "idle duration" this data
// model supports without a dedicated telemetry feed.
function idleSinceDays(v: Vehicle, today: Date): number | null {
  if (v.status !== "Available") return null;
  const becameAvailable = [...v.statusHistory].reverse().find((h) => h.status === "Available");
  if (!becameAvailable) return null;
  return Math.floor((today.getTime() - new Date(becameAvailable.at).getTime()) / 86400000);
}

function MetricCard({ title, value, subtitle, icon, color }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-xs mb-1">{title}</p>
          <p className="text-slate-900 text-2xl font-semibold">{value}</p>
          {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function CardHeader({ title, onExport }: { title: string; onExport?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {onExport && (
        <button onClick={onExport} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer">
          <Download size={12} /> Export
        </button>
      )}
    </div>
  );
}

export function RevenueReporting() {
  const invoices = useInvoices();
  const bookings = useBookings();
  const vehicles = useVehicles();
  const clients = useClients();
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const today = new Date();

  const totalRevenue = invoices.reduce((sum, i) => sum + i.amountDue, 0);
  const outstanding = invoices.filter((i) => i.status === "Unpaid" || i.status === "Overdue" || i.status === "Payment Issue");
  const outstandingTotal = outstanding.reduce((sum, i) => sum + i.amountDue, 0);

  // Committed future revenue — the most recent invoice amount for each
  // long-term rental still running, read as "what we can expect again next
  // billing cycle" rather than a promise of a fixed future total.
  const recurringActive = bookings.filter((b) => b.isRecurringBilling && (b.status === "Active" || b.status === "Assigned"));
  const committedMonthly = recurringActive.reduce((sum, b) => {
    const latest = invoices.filter((i) => i.bookingId === b.id).sort((a, c) => (a.issuedAt < c.issuedAt ? 1 : -1))[0];
    return sum + (latest?.amountDue ?? 0);
  }, 0);

  const onRentalCount = vehicles.filter((v) => v.status === "On Rental").length;
  const utilizationPct = vehicles.length ? Math.round((onRentalCount / vehicles.length) * 100) : 0;
  const idleVehicles = vehicles
    .map((v) => ({ v, idleDays: idleSinceDays(v, today) }))
    .filter((x): x is { v: Vehicle; idleDays: number } => x.idleDays !== null)
    .sort((a, b) => b.idleDays - a.idleDays);

  const monthBuckets = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (MONTHS_SHOWN - 1 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTH_NAMES[d.getMonth()] };
  });
  const revenueByMonth = monthBuckets.map((m) => ({
    month: m.label,
    revenue: invoices.filter((i) => monthKey(i.issuedAt) === m.key).reduce((sum, i) => sum + i.amountDue, 0),
  }));

  const byClient = new Map<string, number>();
  for (const inv of invoices) byClient.set(inv.clientId, (byClient.get(inv.clientId) ?? 0) + inv.amountDue);
  const byClientRows = [...byClient.entries()]
    .map(([id, total]) => ({ name: clientById.get(id)?.name ?? id, total }))
    .sort((a, b) => b.total - a.total);
  const byClientMax = Math.max(1, ...byClientRows.map((r) => r.total));

  const byVehicleType = new Map<string, number>();
  const byRentalType = new Map<string, number>();
  for (const inv of invoices) {
    const booking = bookingById.get(inv.bookingId);
    if (!booking) continue;
    byVehicleType.set(booking.vehicleClassRequested, (byVehicleType.get(booking.vehicleClassRequested) ?? 0) + inv.amountDue);
    byRentalType.set(booking.rentalType, (byRentalType.get(booking.rentalType) ?? 0) + inv.amountDue);
  }
  const byVehicleTypeRows = [...byVehicleType.entries()].map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total);
  const byRentalTypeRows = [...byRentalType.entries()].map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total);

  const agingSummary = AGING_BUCKETS.map((bucket) => {
    const inBucket = outstanding.filter((i) => agingBucket(i.dueDate, today) === bucket);
    return { bucket, total: inBucket.reduce((sum, i) => sum + i.amountDue, 0), count: inBucket.length };
  });
  const agingMax = Math.max(1, ...agingSummary.map((a) => a.total));

  const REV_HEADERS = ["Client", "Total Revenue"];
  const AGING_HEADERS = ["Invoice ID", "Client", "Booking", "Amount Due", "Due Date", "Aging Bucket"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Revenue" value={formatCurrency(totalRevenue)} subtitle="All issued invoices, all time" icon={<TrendingUp size={18} />} color="bg-emerald-50 text-emerald-600" />
        <MetricCard title="Outstanding Receivables" value={formatCurrency(outstandingTotal)} subtitle={`${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"}`} icon={<Wallet size={18} />} color="bg-amber-50 text-amber-600" />
        <MetricCard title="Committed Monthly Revenue" value={formatCurrency(committedMonthly)} subtitle={`${recurringActive.length} long-term rental${recurringActive.length === 1 ? "" : "s"} running`} icon={<Repeat size={18} />} color="bg-indigo-50 text-indigo-600" />
        <MetricCard title="Fleet Utilization" value={`${utilizationPct}%`} subtitle={`${onRentalCount} of ${vehicles.length} vehicles on rental`} icon={<Gauge size={18} />} color="bg-sky-50 text-sky-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <CardHeader
            title="Monthly Revenue"
            onExport={() => exportCSV(["Month", "Revenue"], revenueByMonth.map((m) => [m.month, String(m.revenue)]), `revenue-by-month-${exportDateTag()}.csv`)}
          />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="revenue" fill="var(--portal-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <CardHeader
            title="Revenue by Client"
            onExport={() => exportCSV(REV_HEADERS, byClientRows.map((r) => [r.name, String(r.total)]), `revenue-by-client-${exportDateTag()}.csv`)}
          />
          <div className="space-y-3">
            {byClientRows.map((r) => (
              <div key={r.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 truncate">{r.name}</span>
                  <span className="font-medium text-slate-800 shrink-0 ml-2">{formatCurrency(r.total)}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--portal-accent)] rounded-full" style={{ width: `${(r.total / byClientMax) * 100}%` }} />
                </div>
              </div>
            ))}
            {byClientRows.length === 0 && <p className="text-xs text-slate-400">No revenue yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <CardHeader title="Revenue by Vehicle Type" />
          <table className="w-full text-xs">
            <tbody>
              {byVehicleTypeRows.map((r) => (
                <tr key={r.type} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-600">{r.type}</td>
                  <td className="py-2 text-right font-medium text-slate-800">{formatCurrency(r.total)}</td>
                </tr>
              ))}
              {byVehicleTypeRows.length === 0 && <tr><td className="py-2 text-slate-400">No data yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <CardHeader title="Revenue by Rental Type" />
          <table className="w-full text-xs">
            <tbody>
              {byRentalTypeRows.map((r) => (
                <tr key={r.type} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-600">{r.type}</td>
                  <td className="py-2 text-right font-medium text-slate-800">{formatCurrency(r.total)}</td>
                </tr>
              ))}
              {byRentalTypeRows.length === 0 && <tr><td className="py-2 text-slate-400">No data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <CardHeader
          title={`Idle Vehicle Report (${idleVehicles.length})`}
          onExport={idleVehicles.length > 0 ? () => exportCSV(
            ["Plate Number", "Class", "Idle Since", "Days Idle"],
            idleVehicles.map(({ v, idleDays }) => [v.plateNumber, v.vehicleClass, formatDate(today.toISOString()), String(idleDays)]),
            `idle-vehicles-${exportDateTag()}.csv`,
          ) : undefined}
        />
        {idleVehicles.length === 0 ? (
          <p className="text-xs text-slate-400">Every vehicle is either on rental, reserved, or unavailable — nothing idle right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {idleVehicles.map(({ v, idleDays }) => (
              <div key={v.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{v.plateNumber}</p>
                  <p className="text-[11px] text-slate-400 truncate">{v.brand} {v.model} · {v.vehicleClass}</p>
                </div>
                <span className={`text-xs font-semibold shrink-0 ml-2 ${idleDays >= 7 ? "text-amber-600" : "text-slate-500"}`}>{idleDays}d idle</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <CardHeader
          title="Receivables Aging"
          onExport={outstanding.length > 0 ? () => exportXLSX(
            AGING_HEADERS,
            outstanding.map((i) => [i.id, clientById.get(i.clientId)?.name ?? i.clientId, i.bookingId, i.amountDue, formatDate(i.dueDate), agingBucket(i.dueDate, today)]),
            `receivables-aging-${exportDateTag()}.xlsx`,
          ) : undefined}
        />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {agingSummary.map((a) => (
            <div key={a.bucket} className={`rounded-lg p-3 ${a.bucket === "Current" ? "bg-slate-50" : a.total > 0 ? "bg-red-50" : "bg-slate-50"}`}>
              <p className="text-[11px] text-slate-500">{a.bucket}</p>
              <p className={`text-sm font-semibold mt-0.5 ${a.bucket !== "Current" && a.total > 0 ? "text-red-700" : "text-slate-800"}`}>{formatCurrency(a.total)}</p>
              <div className="h-1 bg-white rounded-full mt-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${a.bucket === "Current" ? "bg-slate-400" : "bg-red-400"}`} style={{ width: `${(a.total / agingMax) * 100}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{a.count} invoice{a.count === 1 ? "" : "s"}</p>
            </div>
          ))}
        </div>

        {outstanding.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing outstanding — every issued invoice is paid or submitted for verification.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: "640px" }}>
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-medium text-slate-400 px-2 py-2">Invoice</th>
                  <th className="text-left font-medium text-slate-400 px-2 py-2">Client</th>
                  <th className="text-left font-medium text-slate-400 px-2 py-2">Amount Due</th>
                  <th className="text-left font-medium text-slate-400 px-2 py-2">Expected Payment Date</th>
                  <th className="text-left font-medium text-slate-400 px-2 py-2">Aging</th>
                </tr>
              </thead>
              <tbody>
                {outstanding
                  .slice()
                  .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
                  .map((i) => {
                    const bucket = agingBucket(i.dueDate, today);
                    return (
                      <tr key={i.id} className="border-b border-slate-50">
                        <td className="px-2 py-2.5 text-[var(--portal-accent)] font-medium whitespace-nowrap">{i.id}</td>
                        <td className="px-2 py-2.5 text-slate-600 truncate">{clientById.get(i.clientId)?.name ?? i.clientId}</td>
                        <td className="px-2 py-2.5 text-slate-800 font-medium whitespace-nowrap">{formatCurrency(i.amountDue)}</td>
                        <td className="px-2 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(i.dueDate)}</td>
                        <td className="px-2 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 ${bucket === "Current" ? "text-slate-500" : "text-red-600"}`}>
                            {bucket !== "Current" && <AlertCircle size={11} />} {bucket}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        onClick={() => window.print()}
        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer print:hidden"
      >
        <Download size={12} /> Print / Export Full Summary as PDF
      </button>
    </div>
  );
}
