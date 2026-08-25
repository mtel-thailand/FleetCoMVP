import { useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  Navigation,
  ShieldCheck,
  Truck,
  UserCog,
  Wallet,
  Wrench,
} from "lucide-react";
import { bookingInvoices, fleetCoBookingStatusLabel, type Booking } from "@/app/data/bookings";
import { formatCurrency } from "@/app/data/formatters";
import type { Invoice } from "@/app/data/invoices";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { formatDate } from "@/app/components/ui/utils";
import { useBookings } from "@/app/lib/bookingsStore";
import { useClients } from "@/app/lib/clientsStore";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useVehicles } from "@/app/lib/vehiclesStore";
import { daysFromToday, fleetCoNextAction, relativeDateLabel } from "@/app/lib/fleetCoActions";

type WorkLane = "all" | "operations" | "commercial" | "finance";
type WorkPriority = "urgent" | "high" | "normal";

type WorkItem = {
  id: string;
  lane: Exclude<WorkLane, "all">;
  priority: WorkPriority;
  title: string;
  detail: string;
  timing: string;
  to: string;
  icon: React.ReactNode;
};

const PRIORITY_STYLES: Record<WorkPriority, string> = {
  urgent: "bg-rose-50 text-rose-700 ring-rose-600/10",
  high: "bg-amber-50 text-amber-700 ring-amber-600/10",
  normal: "bg-sky-50 text-sky-700 ring-sky-600/10",
};

const PRIORITY_ORDER: Record<WorkPriority, number> = { urgent: 0, high: 1, normal: 2 };
const RENTAL_ENDING_SOON_DAYS = 7;

function SummaryMetric({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-slate-300 hover:shadow-sm"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-none text-slate-900">{value}</span>
        <span className="mt-1 block text-[11px] text-slate-500">{label}</span>
      </span>
      <ArrowRight size={14} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
    </Link>
  );
}

function WorkQueue({ items }: { items: WorkItem[] }) {
  const [lane, setLane] = useState<WorkLane>("all");
  const laneCounts: Record<WorkLane, number> = {
    all: items.length,
    operations: items.filter((item) => item.lane === "operations").length,
    commercial: items.filter((item) => item.lane === "commercial").length,
    finance: items.filter((item) => item.lane === "finance").length,
  };
  const visibleItems = items
    .filter((item) => lane === "all" || item.lane === lane)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <CheckCircle2 size={16} />
            </span>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">Prioritized work queue</h1>
              <p className="text-[11px] text-slate-500">The next actions across operations, commercial and finance.</p>
            </div>
          </div>
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700">
            {items.filter((item) => item.priority === "urgent").length} urgent
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Filter work queue">
          {(["all", "operations", "commercial", "finance"] as WorkLane[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLane(item)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium capitalize transition-colors ${
                lane === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item} <span className={lane === item ? "text-slate-300" : "text-slate-400"}>{laneCounts[item]}</span>
            </button>
          ))}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <CheckCircle2 size={28} className="text-emerald-500" />
          <p className="mt-2 text-sm font-medium text-slate-800">This queue is clear</p>
          <p className="mt-1 text-xs text-slate-400">No actions need attention in this lane.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleItems.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${PRIORITY_STYLES[item.priority]}`}>
                    {item.priority}
                  </span>
                </span>
                <span className="mt-1 block truncate text-[11px] text-slate-500">{item.detail}</span>
              </span>
              <span className="hidden text-right sm:block">
                <span className="block text-[11px] font-medium text-slate-700">{item.timing}</span>
                <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400 group-hover:text-slate-600">
                  Open action <ArrowRight size={11} />
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function OperationsDashboard() {
  const bookings = useBookings();
  const clients = useClients();
  const vehicles = useVehicles();
  const invoices = useInvoices();
  const today = new Date().toISOString().slice(0, 10);
  const clientById = new Map(clients.map((client) => [client.id, client]));

  const pendingRequests = bookings.filter((booking) => booking.status === "Requested");
  const awaitingAcceptance = bookings.filter((booking) => booking.status === "Quoted");
  const acceptedUnassigned = bookings.filter((booking) => booking.status === "Accepted");
  const activeToday = bookings.filter(
    (booking) => booking.status === "Active" && booking.startDate <= today && today <= booking.endDate,
  );
  const activeUnits = activeToday.reduce((total, booking) => total + booking.quantity, 0);
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === "Available").length;
  const paymentsToVerify = invoices.filter((invoice) => invoice.status === "Payment Submitted");
  const paidRevenue = invoices
    .filter((invoice) => invoice.status === "Paid")
    .reduce((total, invoice) => total + invoice.amountDue, 0);
  const outstandingRevenue = invoices
    .filter((invoice) => ["Unpaid", "Overdue", "Payment Issue", "Payment Submitted"].includes(invoice.status))
    .reduce((total, invoice) => total + invoice.amountDue, 0);

  const workItems: WorkItem[] = [];

  acceptedUnassigned.forEach((booking) => {
    const daysToStart = daysFromToday(booking.startDate, today);
    workItems.push({
      id: `assign-${booking.id}`,
      lane: "operations",
      priority: daysToStart <= 5 ? "urgent" : "high",
      title: "Assign vehicle and driver",
      detail: `${booking.id} · ${booking.quantity}× ${booking.vehicleClassRequested} · ${booking.pickupLocation}`,
      timing: relativeDateLabel(booking.startDate, today, "Starts"),
      to: `/ops/bookings/${booking.id}`,
      icon: <UserCog size={15} />,
    });
  });

  pendingRequests.forEach((booking) => {
    const daysToStart = daysFromToday(booking.startDate, today);
    workItems.push({
      id: `quote-${booking.id}`,
      lane: "commercial",
      priority: daysToStart <= 3 ? "urgent" : "high",
      title: "Prepare quotation",
      detail: `${booking.id} · ${booking.quantity}× ${booking.vehicleClassRequested} · requested by ${booking.requestedByName}`,
      timing: `Received ${formatDate(booking.created)}`,
      to: `/ops/bookings/${booking.id}`,
      icon: <FileText size={15} />,
    });
  });

  paymentsToVerify.forEach((invoice) => {
    workItems.push({
      id: `verify-${invoice.id}`,
      lane: "finance",
      priority: "urgent",
      title: "Verify submitted payment",
      detail: `${invoice.id} · ${formatCurrency(invoice.amountDue)} · ${clientById.get(invoice.clientId)?.name ?? invoice.clientId}`,
      timing: `Submitted ${formatDate(invoice.updated)}`,
      to: `/ops/bookings/${invoice.bookingId}`,
      icon: <ShieldCheck size={15} />,
    });
  });

  invoices.filter((invoice) => invoice.status === "Overdue").forEach((invoice) => {
    workItems.push({
      id: `overdue-${invoice.id}`,
      lane: "finance",
      priority: "urgent",
      title: "Follow up overdue invoice",
      detail: `${invoice.id} · ${formatCurrency(invoice.amountDue)} · ${clientById.get(invoice.clientId)?.name ?? invoice.clientId}`,
      timing: `Due ${formatDate(invoice.dueDate)}`,
      to: `/ops/documents/invoices/${invoice.id}`,
      icon: <AlertTriangle size={15} />,
    });
  });

  bookings
    .filter((booking) => booking.status === "Completed" && bookingInvoices(booking.id, invoices).length === 0)
    .forEach((booking) => {
      workItems.push({
        id: `invoice-${booking.id}`,
        lane: "finance",
        priority: "high",
        title: "Prepare final invoice",
        detail: `${booking.id} · ${booking.quantity}× ${booking.vehicleClassRequested} · rental completed`,
        timing: `Ended ${formatDate(booking.endDate)}`,
        to: `/ops/bookings/${booking.id}`,
        icon: <Wallet size={15} />,
      });
    });

  activeToday.forEach((booking) => {
    const daysToEnd = daysFromToday(booking.endDate, today);
    if (daysToEnd < 0 || daysToEnd > RENTAL_ENDING_SOON_DAYS) return;
    workItems.push({
      id: `closeout-${booking.id}`,
      lane: "operations",
      priority: daysToEnd <= 1 ? "urgent" : "normal",
      title: "Confirm return or extension",
      detail: `${booking.id} · ${booking.quantity} active unit${booking.quantity === 1 ? "" : "s"} · ${booking.pickupLocation}`,
      timing: relativeDateLabel(booking.endDate, today, "Ends"),
      to: `/ops/bookings/${booking.id}`,
      icon: <Clock3 size={15} />,
    });
  });

  const schedule = bookings
    .filter((booking) => {
      const terminal = ["Declined", "Cancelled"].includes(booking.status);
      return !terminal && booking.endDate >= today && (booking.status === "Active" || booking.startDate >= today);
    })
    .sort((a, b) => {
      if (a.status === "Active" && b.status !== "Active") return -1;
      if (a.status !== "Active" && b.status === "Active") return 1;
      return a.startDate.localeCompare(b.startDate);
    })
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <WorkQueue items={workItems} />

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Today at a glance</h2>
                <p className="text-[11px] text-slate-500">Live workload and rental activity.</p>
              </div>
              <CalendarDays size={17} className="text-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <SummaryMetric icon={<Inbox size={15} />} label="New requests" value={pendingRequests.length} to="/ops/requests" />
              <SummaryMetric icon={<Navigation size={15} />} label="Active rentals" value={activeToday.length} to="/ops/rentals" />
              <SummaryMetric icon={<Truck size={15} />} label="Units in service" value={activeUnits} to="/ops/calendar" />
              <SummaryMetric icon={<ShieldCheck size={15} />} label="Payments to verify" value={paymentsToVerify.length} to="/ops/documents/invoices" />
            </div>
          </section>

          <section className="rounded-2xl bg-slate-900 p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><Wallet size={15} /></span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Verified payments</span>
            </div>
            <p className="mt-5 text-[11px] text-slate-400">Revenue received</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(paidRevenue)}</p>
            <div className="mt-4 flex items-end justify-between gap-4 border-t border-white/10 pt-3">
              <div>
                <p className="text-[10px] text-slate-400">Open receivables</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{formatCurrency(outstandingRevenue)}</p>
              </div>
              <Link to="/ops/documents/invoices" className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white">
                View invoices <ArrowRight size={12} />
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Fleet readiness</h2>
                <p className="text-[11px] text-slate-500">Current vehicle availability.</p>
              </div>
              <Wrench size={17} className="text-slate-400" />
            </div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3 text-center">
              <div>
                <p className="text-lg font-bold text-emerald-600">{availableVehicles}</p>
                <p className="text-[10px] text-slate-500">Available</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-600">{vehicles.filter((vehicle) => vehicle.status === "On Rental").length}</p>
                <p className="text-[10px] text-slate-500">On rental</p>
              </div>
              <div>
                <p className="text-lg font-bold text-orange-600">{vehicles.filter((vehicle) => vehicle.status === "In Maintenance").length}</p>
                <p className="text-[10px] text-slate-500">Maintenance</p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Rental schedule</h2>
            <p className="text-[11px] text-slate-500">Active and upcoming work, ordered by the next start date.</p>
          </div>
          <Link to="/ops/rentals" className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900">
            View all rentals <ArrowRight size={12} />
          </Link>
        </div>

        {schedule.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-slate-400">No active or upcoming rentals.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 font-medium">Booking</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium">Rental</th>
                  <th className="px-4 py-2.5 font-medium">Schedule</th>
                  <th className="px-4 py-2.5 font-medium">Next action</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="w-10 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {schedule.map((booking) => {
                  const latestInvoice = bookingInvoices(booking.id, invoices)[0];
                  return (
                    <tr key={booking.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link to={`/ops/bookings/${booking.id}`} className="font-semibold text-slate-900 hover:text-[var(--portal-accent)]">
                          {booking.id}
                        </Link>
                        <p className="mt-0.5 text-[10px] text-slate-400">Requested {formatDate(booking.created)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{clientById.get(booking.clientId)?.name ?? booking.clientId}</td>
                      <td className="px-4 py-3 text-slate-600">{booking.quantity}× {booking.vehicleClassRequested}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(booking.startDate)} – {formatDate(booking.endDate)}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{fleetCoNextAction(booking, invoices, today)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={fleetCoBookingStatusLabel(booking)} />
                          {latestInvoice && <StatusBadge status={latestInvoice.status} />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link aria-label={`Open booking ${booking.id}`} to={`/ops/bookings/${booking.id}`} className="text-slate-300 hover:text-slate-700">
                          <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* top-0 left-0 added: Tailwind's sr-only sets position:absolute with
          no top/left of its own, so with no positioned ancestor anywhere
          above it, the browser fell back to this element's "hypothetical"
          in-flow position — i.e. wherever it would have landed after all
          the dashboard's own content, hundreds of pixels down the page.
          That pushed <html>'s own scrollable area past the viewport on top
          of Layout.tsx's already-intentional inner scrollbar, producing
          two visible scrollbars. Pinning it to 0,0 removes the fallback
          computation entirely — still a 1x1px clipped box either way, so
          nothing visible or accessible changes. */}
      <div className="sr-only top-0 left-0" aria-live="polite">
        {awaitingAcceptance.length} quotations await client acceptance. {workItems.length} actions are in the work queue.
      </div>
    </div>
  );
}
