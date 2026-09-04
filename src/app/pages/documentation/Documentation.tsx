/** @jsxImportSource react */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Map,
  Milestone,
  PlayCircle,
} from "lucide-react";
import { BOOKING_STATUS_FLOW, type BookingStatus } from "@/app/data/bookingStatus";
import { StatusBadge } from "@/app/components/ui/StatusBadge";

// This is the reader-facing product guide. Keep it focused on three questions:
// what FleetCo is, how to use the demo, and what each status means. Detailed
// implementation notes belong in DESIGN-SYSTEM.md or a future developer guide.

const NAV = [
  { id: "overview", label: "What FleetCo is" },
  { id: "how-to-use", label: "How to use it" },
  { id: "workflows", label: "Main workflows" },
  { id: "statuses", label: "Statuses" },
];

function TocSidebar() {
  const [active, setActive] = useState(NAV[0].id);

  useEffect(() => {
    const sections = NAV.map((item) => document.getElementById(item.id)).filter(
      (element): element is HTMLElement => Boolean(element),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="On this page" className="hidden lg:block w-48 shrink-0">
      <div className="sticky top-8 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">On this page</p>
        {NAV.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`block px-3 py-2 text-xs rounded-lg transition-colors ${
              active === item.id
                ? "text-indigo-700 bg-indigo-50 font-semibold"
                : "text-slate-500 font-medium hover:text-indigo-700 hover:bg-indigo-50"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function SectionHeading({ icon, kicker, title }: { icon: ReactNode; kicker: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">{kicker}</p>
        <h2 className="text-xl font-bold text-slate-900 -mt-0.5">{title}</h2>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm shadow-slate-200/60 ${className}`}>{children}</div>;
}

function HeroSnapshot() {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-slate-100/80 p-4 shadow-lg shadow-slate-300/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Live demo preview</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">A booking at a glance</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> In progress
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {[
          { number: "01", label: "Request received", detail: "Thailand Post · 2 vehicles", done: true },
          { number: "02", label: "Quotation accepted", detail: "Ready for assignment", done: true },
          { number: "03", label: "Vehicle + driver", detail: "FleetCo’s next action", done: false },
        ].map((item) => (
          <div key={item.number} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${item.done ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-500"}`}>
              {item.number}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800">{item.label}</p>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">{item.detail}</p>
            </div>
            {item.done && <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-[10px] font-medium text-slate-600">Every step has a clear next action.</span>
        <ArrowRight size={14} className="text-indigo-600 shrink-0" />
      </div>
    </div>
  );
}

function DemoStep({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{number}</div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-sm text-slate-600 leading-relaxed mt-0.5">{children}</p>
      </div>
    </div>
  );
}

function WorkflowCard({
  title,
  subtitle,
  steps,
  tone,
}: {
  title: string;
  subtitle: string;
  steps: { actor: string; action: string }[];
  tone: "rose" | "blue";
}) {
  const tones = {
    rose: { border: "border-rose-100", actor: "bg-rose-50 text-rose-800", number: "bg-rose-700", bar: "bg-rose-200" },
    blue: { border: "border-blue-100", actor: "bg-blue-50 text-blue-700", number: "bg-blue-600", bar: "bg-blue-200" },
  } as const;
  const colors = tones[tone];

  return (
    <Card className={colors.border}>
      <div className={`h-1.5 -mx-5 -mt-5 mb-5 rounded-t-xl ${colors.bar}`} />
      <p className="text-base font-bold text-slate-900">{title}</p>
      <p className="text-sm text-slate-500 mt-1 mb-5">{subtitle}</p>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={`${step.actor}-${step.action}`} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span className={`w-6 h-6 rounded-full ${colors.number} text-white text-[11px] font-bold flex items-center justify-center`}>{index + 1}</span>
              {index < steps.length - 1 && <span className="w-px flex-1 bg-slate-200 mt-1" />}
            </div>
            <div className={index < steps.length - 1 ? "pb-1" : ""}>
              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors.actor}`}>{step.actor}</span>
              <p className="text-sm text-slate-700 leading-relaxed mt-1">{step.action}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const RENTAL_STATUS_EXPLANATIONS: Record<BookingStatus, string> = {
  Requested: "The client has sent a request.",
  Quoted: "FleetCo has sent a price.",
  Accepted: "The client approved the quotation.",
  Assigned: "A vehicle and driver are selected.",
  Active: "The rental is in progress.",
  Completed: "The rental has finished.",
  Declined: "The quotation was not accepted.",
  Cancelled: "The rental will not continue.",
};

const RENTAL_STATUS_STEPS = BOOKING_STATUS_FLOW.map((status) => ({
  label: status,
  explanation: RENTAL_STATUS_EXPLANATIONS[status],
  badges: [status],
}));

function StatusTrack({
  title,
  description,
  steps,
  tone,
}: {
  title: string;
  description: string;
  steps: { label: string; explanation: string; badges?: string[] }[];
  tone: "blue" | "indigo";
}) {
  const tones = {
    blue: { border: "border-blue-100", number: "bg-blue-600", bar: "bg-blue-200" },
    indigo: { border: "border-indigo-100", number: "bg-indigo-600", bar: "bg-indigo-200" },
  } as const;
  const colors = tones[tone];

  return (
    <Card className={colors.border}>
      <div className={`h-1.5 -mx-5 -mt-5 mb-5 rounded-t-xl ${colors.bar}`} />
      <p className="text-base font-bold text-slate-900">{title}</p>
      <p className="text-sm text-slate-600 leading-relaxed mt-1 mb-4">{description}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100">
            <span className={`w-5 h-5 rounded-full ${colors.number} text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5`}>{index + 1}</span>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(step.badges ?? [step.label]).map((badge) => <StatusBadge key={badge} status={badge} />)}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{step.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Documentation() {
  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");

    // Old deep links such as #data-model should not restore a stale scroll
    // position now that the guide has a shorter, reader-focused structure.
    const currentHash = window.location.hash.slice(1);
    if (currentHash && !NAV.some((item) => item.id === currentHash)) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    return () => document.documentElement.classList.remove("scroll-smooth");
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <BookOpen size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">FleetCo Platform</p>
              <p className="text-[11px] text-slate-400 leading-tight">Product guide</p>
            </div>
          </div>
          <Link to="/login" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
            Try the demo <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 flex gap-10 items-start">
        <TocSidebar />

        <main className="flex-1 min-w-0 space-y-16 pb-20">
          <section id="overview" className="scroll-mt-8">
            <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-slate-50 to-indigo-50 p-6 sm:p-8 text-slate-900 shadow-lg shadow-slate-200/70">
              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-100/70 blur-3xl" />
              <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-slate-200/60 blur-3xl" />
              <div className="relative grid md:grid-cols-[1.08fr_0.92fr] gap-7 items-center">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                    <Map size={12} /> Fleet management · product guide
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.03] mt-5 text-slate-950">From request<br /><span className="text-indigo-600">to road-ready.</span></h1>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md mt-5">
                    FleetCo helps businesses request vehicles with dedicated drivers, follow the rental, and manage the billing in one place.
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5 mt-6">
                    <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
                      Try the demo <ArrowRight size={15} />
                    </Link>
                    <a href="#workflows" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/60 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white transition-colors">
                      See how it works <ArrowRight size={15} />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-6 text-[10px] font-medium text-slate-500">
                    <span>Two portals</span><span>One shared booking</span><span>Clear next steps</span>
                  </div>
                </div>
                <HeroSnapshot />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { value: "2", label: "portals", detail: "Client and FleetCo" },
                { value: "2", label: "main journeys", detail: "Rental and billing" },
                { value: "1", label: "shared booking", detail: "One view of the work" },
              ].map((item) => (
                <Card key={item.label} className="text-center py-4 hover:-translate-y-0.5 transition-transform">
                  <p className="text-2xl font-bold text-indigo-600">{item.value}</p>
                  <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>
                </Card>
              ))}
            </div>

            <Card className="mt-4 bg-white/80 border-indigo-100">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Map size={15} /></div>
                <div>
                  <p className="text-sm font-bold text-slate-900">The simple idea</p>
                  <p className="text-sm text-slate-700 leading-relaxed mt-1">
                    The client asks for a rental. FleetCo turns that request into a confirmed trip, assigns the people and vehicle, and handles the billing afterward.
                  </p>
                </div>
              </div>
            </Card>
          </section>

          <section id="how-to-use" className="scroll-mt-8">
            <SectionHeading icon={<PlayCircle size={17} />} kicker="Get started" title="How to use it" />
            <p className="text-base text-slate-700 leading-relaxed max-w-3xl mb-6">
              This is a guided demo. You can enter either side of the experience and follow the sample booking already on screen.
            </p>

            <Card className="max-w-3xl">
              <div className="space-y-5">
                <DemoStep number={1} title="Open the demo">Select <strong>Try the demo</strong> above, or return to the login page.</DemoStep>
                <DemoStep number={2} title="Choose who you want to be">Choose <strong>FleetCo</strong> to manage rentals, or <strong>Thailand Post</strong> to request and follow them.</DemoStep>
                <DemoStep number={3} title="Sign in">Use any username. The demo password is <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">1234</code>.</DemoStep>
                <DemoStep number={4} title="Follow a journey">Start with a request, quotation, or invoice and follow the next action shown on screen.</DemoStep>
              </div>
              <Link to="/login" className="inline-flex items-center gap-2 mt-7 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
                Open the demo <ArrowRight size={15} />
              </Link>
            </Card>
          </section>

          <section id="workflows" className="scroll-mt-8">
            <SectionHeading icon={<Milestone size={17} />} kicker="What happens next" title="Main workflows" />
            <p className="text-base text-slate-700 leading-relaxed max-w-3xl mb-6">
              There are two journeys worth trying. They use the same booking, so a change made in one portal can be seen from the other.
            </p>

            <div className="grid lg:grid-cols-2 gap-5 max-w-5xl">
              <WorkflowCard
                title="Request → quotation → assignment"
                subtitle="The rental journey"
                tone="rose"
                steps={[
                  { actor: "Client", action: "Requests a vehicle, quantity, dates, and delivery location." },
                  { actor: "FleetCo", action: "Reviews the request, sets a price, and sends a quotation." },
                  { actor: "Client", action: "Accepts the quotation." },
                  { actor: "FleetCo", action: "Assigns a vehicle and driver." },
                ]}
              />
              <WorkflowCard
                title="Invoice → payment → tax invoice"
                subtitle="The billing journey"
                tone="blue"
                steps={[
                  { actor: "FleetCo", action: "Issues an invoice when the rental is ready to be billed." },
                  { actor: "Client", action: "Pays by bank transfer and submits the payment details." },
                  { actor: "FleetCo", action: "Checks the payment information." },
                  { actor: "FleetCo", action: "Marks the invoice paid and issues the tax invoice." },
                ]}
              />
            </div>

            <Card className="mt-5 max-w-5xl bg-slate-100/80 border-slate-200">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 leading-relaxed">
                  For a recurring rental, the rental stays active while billing repeats each month. The same booking can therefore have several invoices over time.
                </p>
              </div>
            </Card>
          </section>

          <section id="statuses" className="scroll-mt-8">
            <SectionHeading icon={<Clock3 size={17} />} kicker="Know what it means" title="Statuses" />
            <p className="text-base text-slate-700 leading-relaxed max-w-3xl mb-6">
              A status tells you where the work is and who needs to act next. Rental progress and billing progress are separate.
            </p>

            <div className="space-y-5 max-w-5xl">
              <StatusTrack
                title="Rental progress"
                description="This follows the vehicle request itself, from the first request to the end of the rental."
                tone="blue"
                steps={RENTAL_STATUS_STEPS}
              />

              <StatusTrack
                title="Billing progress"
                description="This follows the latest invoice. It can move forward while the rental is still active."
                tone="indigo"
                steps={[
                  { label: "Unpaid / Overdue", badges: ["Unpaid", "Overdue"], explanation: "The invoice is waiting for payment." },
                  { label: "Payment Submitted", badges: ["Payment Submitted"], explanation: "The client has sent payment details." },
                  { label: "Payment Issue", badges: ["Payment Issue"], explanation: "Something needs to be corrected or checked again." },
                  { label: "Paid", badges: ["Paid"], explanation: "FleetCo has verified the payment." },
                  { label: "Tax Invoice Issued", badges: ["Tax Invoice Issued"], explanation: "The final tax document is ready." },
                ]}
              />
            </div>

            <Card className="mt-5 max-w-5xl bg-amber-50/60 border-amber-100">
              <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> A few outcomes are different</p>
              <div className="grid sm:grid-cols-3 gap-4 mt-3">
                <div>
                  <p className="text-sm font-semibold text-rose-700">Declined</p>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">The quotation was not accepted.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Cancelled</p>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">The rental will not continue.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-700">Payment issue</p>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">The client needs to correct and submit the payment details again.</p>
                </div>
              </div>
            </Card>

            <Card className="mt-5 max-w-5xl border-slate-200">
              <div className="flex items-start gap-2.5">
                <BookOpen size={17} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900">The one thing to remember</p>
                  <p className="text-sm text-slate-600 leading-relaxed mt-1">
                    An <strong>Active</strong> rental may still have an <strong>Unpaid</strong>, <strong>Paid</strong>, or <strong>Tax Invoice Issued</strong> billing status. That is expected, especially for monthly rentals.
                  </p>
                </div>
              </div>
            </Card>
          </section>

          <Card className="max-w-5xl bg-slate-100/80 border-slate-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={17} className="text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900">About this demo</p>
                <p className="text-sm text-slate-600 leading-relaxed mt-1">
                  This is a guided product demo, not a live rental service. It uses sample data saved in your browser. Payment transfers, file uploads, and real notifications are represented for demonstration purposes.
                </p>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
