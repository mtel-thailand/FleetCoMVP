import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Car, CalendarClock, FileText, AlertCircle, ArrowUpRight } from "lucide-react";
import { useBookings } from "@/app/lib/bookingsStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { useInvoices } from "@/app/lib/invoicesStore";
import { isQuotationExpired } from "@/app/data/quotations";
import { invoiceDisplayStatus } from "@/app/data/invoices";
import type { VehicleClass } from "@/app/data/vehicles";
import { formatCurrency } from "@/app/data/formatters";
import { formatDate } from "@/app/components/ui/utils";
import { CLIENT_ID } from "@/app/lib/currentClient";
import { localeFor, useI18n } from "@/app/i18n";

// brief §5.4: "Overview: active rentals count, upcoming starts/ends, pending
// quotations, unpaid invoices, monthly spend to date. Usage reports: rentals
// and spend by month, by vehicle type." (Skipping "by requesting branch" —
// this portal doesn't model client sub-branches yet, a real gap not a typo.)

const UPCOMING_WINDOW_DAYS = 14;
const MONTHS_SHOWN = 6;

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

function daysFromToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

export function PortalDashboard() {
  const { language } = useI18n();
  const bookings = useBookings().filter((b) => b.clientId === CLIENT_ID);
  const quotations = useQuotations().filter((q) => q.clientId === CLIENT_ID);
  const invoices = useInvoices().filter((i) => i.clientId === CLIENT_ID);
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  const activeRentals = bookings.filter((b) => b.status === "Active");
  const pendingQuotations = quotations.filter((q) => q.status === "Issued" && !isQuotationExpired(q));
  const outstandingInvoices = invoices.filter((i) => ["Unpaid", "Overdue", "Payment Issue"].includes(invoiceDisplayStatus(i)));
  const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + i.amountDue, 0);

  const upcoming = bookings
    .flatMap((b) => {
      const events: { booking: typeof b; label: string; date: string; days: number }[] = [];
      if (b.status === "Assigned") {
        const days = daysFromToday(b.startDate);
        if (days >= 0 && days <= UPCOMING_WINDOW_DAYS) events.push({ booking: b, label: "Starts", date: b.startDate, days });
      }
      if (b.status === "Active") {
        const days = daysFromToday(b.endDate);
        if (days >= 0 && days <= UPCOMING_WINDOW_DAYS) events.push({ booking: b, label: "Ends", date: b.endDate, days });
      }
      return events;
    })
    .sort((a, b) => a.days - b.days);

  // Trailing N months of spend, oldest → newest, zero-filled.
  const now = new Date();
  const monthBuckets = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat(localeFor(language), { month: "short" }).format(d),
    };
  });
  const spendByMonth = monthBuckets.map((m) => ({
    month: m.label,
    spend: invoices.filter((i) => monthKey(i.issuedAt) === m.key).reduce((sum, i) => sum + i.amountDue, 0),
  }));

  const spendByClass = new Map<VehicleClass, number>();
  for (const inv of invoices) {
    const booking = bookingById.get(inv.bookingId);
    if (!booking) continue;
    spendByClass.set(booking.vehicleClassRequested, (spendByClass.get(booking.vehicleClassRequested) ?? 0) + inv.amountDue);
  }
  const spendByClassRows = [...spendByClass.entries()].sort((a, b) => b[1] - a[1]);
  const spendByClassTotal = spendByClassRows.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Rentals"
          value={String(activeRentals.length)}
          subtitle="Vehicles on the road now"
          icon={<Car size={18} className="text-[var(--portal-accent)]" />}
          color="bg-[var(--portal-accent-light)]"
        />
        <MetricCard
          title={`Upcoming (${UPCOMING_WINDOW_DAYS}d)`}
          value={String(upcoming.length)}
          subtitle="Starts & ends this window"
          icon={<CalendarClock size={18} className="text-violet-600" />}
          color="bg-violet-50"
        />
        <MetricCard
          title="Pending Quotations"
          value={String(pendingQuotations.length)}
          subtitle="Awaiting your decision"
          icon={<FileText size={18} className="text-amber-600" />}
          color="bg-amber-50"
        />
        <MetricCard
          title="Outstanding"
          value={formatCurrency(outstandingTotal)}
          subtitle={`${outstandingInvoices.length} unpaid invoice${outstandingInvoices.length === 1 ? "" : "s"}`}
          icon={<AlertCircle size={18} className="text-rose-600" />}
          color="bg-rose-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly Spend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={spendByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              {/* CSS var, not a Tailwind class — recharts fill is a plain SVG
                  attribute, but browsers resolve var() in it same as CSS, so
                  this still follows the portal accent set on the ancestor. */}
              <Bar dataKey="spend" fill="var(--portal-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Spend by Vehicle Type</h3>
          {spendByClassRows.length === 0 ? (
            <p className="text-xs text-slate-400">No invoiced spend yet.</p>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-slate-400 pb-1 border-b border-slate-100">
                <span>Vehicle Type</span>
                <span className="text-right">Spend</span>
                <span className="text-right">Share</span>
              </div>
              {spendByClassRows.map(([cls, amount]) => (
                <div key={cls} className="grid grid-cols-3 gap-2 text-xs">
                  <span className="text-slate-700 font-medium truncate">{cls}</span>
                  <span className="text-right text-slate-600">{formatCurrency(amount)}</span>
                  <span className="text-right text-slate-500">{spendByClassTotal > 0 ? Math.round((amount / spendByClassTotal) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Upcoming Starts &amp; Ends</h3>
        {upcoming.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing starting or ending in the next {UPCOMING_WINDOW_DAYS} days.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((u) => (
              <div key={`${u.booking.id}-${u.label}`} className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <ArrowUpRight size={13} className={u.label === "Starts" ? "text-emerald-600" : "text-slate-400"} />
                  <div>
                    <p className="text-xs font-medium text-slate-800">{u.booking.id} — {u.label.toLowerCase()} {formatDate(u.date)}</p>
                    <p className="text-xs text-slate-500">{u.booking.rentalType} · {u.booking.vehicleClassRequested} · {u.booking.pickupLocation}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{u.days === 0 ? "Today" : u.days === 1 ? "Tomorrow" : `In ${u.days} days`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
