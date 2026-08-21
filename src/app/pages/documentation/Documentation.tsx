import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, BookOpen, Map, Database, GitBranch, Layers, Terminal,
  ArrowRight, FileText, Receipt, Wallet, Truck,
  AlertTriangle, GitCommitHorizontal, Milestone,
} from "lucide-react";

// Public reference doc for the FleetCo Platform demo — reachable from the
// login screen (no auth required, see routes.tsx), so it lives outside
// RequireAuth/Layout entirely and builds its own page chrome rather than
// borrowing the authenticated Sidebar shell. Deliberately its own third
// color (indigo) rather than either portal's accent — this describes both
// portals equally and isn't scoped under either one's data-portal.
//
// Content here is a snapshot of decisions actually made while building this
// demo, not aspirational spec — where something is a known gap (single
// hardcoded client, no real backend), it says so rather than glossing over
// it. Cross-check against the source before trusting a specific field name;
// this describes the shape of the system, the code is still the ground
// truth.

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "mvp-flow", label: "MVP Flow" },
  { id: "ia", label: "Information Architecture" },
  { id: "data-model", label: "Data Model" },
  { id: "status", label: "Status Lifecycles" },
  { id: "patterns", label: "Key Patterns" },
  { id: "stack", label: "Tech Stack & Constraints" },
];

function TocSidebar() {
  const [active, setActive] = useState(NAV[0].id);

  // Scroll-spy: highlight whichever section is passing through a narrow
  // band near the top of the viewport, rather than requiring a click to
  // know where you are on a page this long.
  useEffect(() => {
    const sections = NAV.map((n) => document.getElementById(n.id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="hidden lg:block w-52 shrink-0">
      <div className="sticky top-8 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">On this page</p>
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className={`block px-3 py-1.5 text-xs rounded-lg transition-colors ${
              active === n.id ? "text-indigo-700 bg-indigo-50 font-semibold" : "text-slate-500 font-medium hover:text-indigo-700 hover:bg-indigo-50"
            }`}
          >
            {n.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

// ── MVP flow steps ────────────────────────────────────────────────────────

function FlowStep({
  n, isLast, actor, actorTone, action, result,
}: {
  n: number; isLast?: boolean; actor: string; actorTone: string; action: string; result?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{n}</div>
        {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-4"}`}>
        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mb-1 ${actorTone}`}>{actor}</span>
        <p className="text-xs text-slate-700 leading-relaxed">{action}</p>
        {result && (
          <p className="text-[11px] text-indigo-600 font-medium mt-1 flex items-center gap-1">
            <ArrowRight size={11} className="shrink-0" /> {result}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ icon, kicker, title }: { icon: React.ReactNode; kicker: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">{kicker}</p>
        <h2 className="text-lg font-bold text-slate-900 -mt-0.5">{title}</h2>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-slate-200 rounded-xl p-4 ${className}`}>{children}</div>;
}

// ── Entity reference ─────────────────────────────────────────────────────

function DocEntityCard({
  name, idFormat, tone, description, fields, relations,
}: {
  name: string; idFormat: string; tone: string; description: string; fields: string[]; relations: string[];
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-900">{name}</h4>
        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${tone}`}>{idFormat}</span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Key fields</p>
        <div className="flex flex-wrap gap-1">
          {fields.map((f) => (
            <code key={f} className="text-[10.5px] font-mono bg-slate-50 border border-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{f}</code>
          ))}
        </div>
      </div>
      {relations.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1">
          {relations.map((r) => (
            <p key={r} className="text-[11px] text-slate-500 flex items-start gap-1.5">
              <GitCommitHorizontal size={12} className="text-slate-300 shrink-0 mt-0.5" />
              {r}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Status steppers ──────────────────────────────────────────────────────

function StatusFlow({ steps, activeTone }: { steps: string[]; activeTone: string }) {
  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${activeTone}`}>{s}</span>
          {i < steps.length - 1 && <ArrowRight size={12} className="text-slate-300 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// ── Nav tree (mirrors Sidebar.tsx's real NAV_SECTIONS) ──────────────────

function NavTree({ tone, sections }: { tone: string; sections: { section: string; items: string[] }[] }) {
  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <div key={s.section}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${tone}`}>{s.section}</p>
          <ul className="space-y-0.5">
            {s.items.map((item) => (
              <li key={item} className="text-xs text-slate-600 pl-2.5 border-l-2 border-slate-100 py-0.5">{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const OPS_TREE = [
  { section: "Dashboard", items: ["Overview", "Revenue & Reports"] },
  { section: "Bookings & Schedule", items: ["All Requests", "All Rentals", "Fleet Calendar", "Quotations"] },
  { section: "Fleet", items: ["Vehicles", "Driver Roster", "Live Map"] },
  { section: "Clients", items: ["Client Accounts"] },
  { section: "Billing", items: ["Invoices", "Tax Invoices"] },
  { section: "Vehicle Financing", items: ["Portfolio", "Acquisition Simulator"] },
  { section: "Admin", items: ["Roles & Permissions", "Notifications", "Audit Log"] },
];

const CLIENT_TREE = [
  { section: "Dashboard", items: ["Overview"] },
  { section: "Rentals", items: ["My Requests", "My Rentals", "Live Map"] },
  { section: "Billing", items: ["Invoices & Payments"] },
  { section: "Reports", items: ["Billing History"] },
];

const ROLE_ROWS: [string, string, string, string][] = [
  ["Platform Admin", "FleetCo", "/ops/dashboard", "Full access, every /ops/* screen"],
  ["Operations Manager", "FleetCo", "/ops/requests", "Dashboard, Requests, Rentals, Calendar, Fleet"],
  ["Account / BD Manager", "FleetCo", "/ops/clients", "Dashboard, Clients, Requests, Rentals, Quotations, Revenue"],
  ["Finance Officer", "FleetCo", "/ops/documents/invoices", "Dashboard, Invoices, Tax Invoices, Revenue, Financing"],
  ["Read-Only", "FleetCo", "/ops/dashboard", "Full navigation, not yet write-blocked per action"],
  ["Client Admin", "Thailand Post", "/portal/dashboard", "Full access, every /portal/* screen"],
  ["Client Approver / Manager", "Thailand Post", "/portal/dashboard", "Dashboard, Requests, Rentals, Live Map"],
  ["Client Requester", "Thailand Post", "/portal/requests", "Requests, Rentals, Live Map — no billing"],
  ["Client Finance", "Thailand Post", "/portal/documents/invoices", "Invoices & Payments, Reports, Rentals"],
];

export function Documentation() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <BookOpen size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">FleetCo Platform</p>
              <p className="text-[11px] text-slate-400 leading-tight">Documentation</p>
            </div>
          </div>
          <Link to="/login" className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={13} /> Back to login
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-10 items-start">
        <TocSidebar />

        <div className="flex-1 min-w-0 space-y-14 pb-20">
          {/* ── Overview ─────────────────────────────────────────────── */}
          <section id="overview" className="scroll-mt-8">
            <SectionHeading icon={<Map size={17} />} kicker="Start here" title="Overview" />
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              FleetCo Platform is a B2B fleet management demo: on-demand vehicle rental with dedicated drivers, built for FleetCo
              Operations and its launch client, Thailand Post. One codebase, <strong>two portals</strong> sharing a single mock
              domain layer — no backend, no real persistence beyond the browser's own <code className="text-[11px] font-mono bg-slate-100 px-1 rounded">localStorage</code>.
              This page exists so the shape of that system — the data, the two portals' navigation, the status rules — is
              written down somewhere other than the source itself.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 max-w-3xl">
              {[
                { label: "Portals", value: "2", sub: "Operations · Client" },
                { label: "Roles", value: "9", sub: "5 FleetCo · 4 client" },
                { label: "Core entities", value: "10", sub: "Booking-centered" },
                { label: "Document types", value: "3", sub: "Quotation → Invoice → Tax Invoice" },
              ].map((s) => (
                <Card key={s.label} className="text-center">
                  <p className="text-xl font-bold text-indigo-600">{s.value}</p>
                  <p className="text-[11px] font-medium text-slate-600 mt-0.5">{s.label}</p>
                  <p className="text-[10px] text-slate-400">{s.sub}</p>
                </Card>
              ))}
            </div>
            <Card className="mt-5 max-w-3xl bg-indigo-50/40 border-indigo-100">
              <p className="text-xs font-bold text-slate-800 mb-1">Try it</p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                On the login screen: pick <strong>FleetCo</strong> or <strong>Thailand Post</strong>, any username, password{" "}
                <code className="font-mono bg-white px-1 rounded">1234</code>, then a role from the picker. There's no real
                account behind any of it — the role you pick <em>is</em> the account for that session.
              </p>
            </Card>
          </section>

          {/* ── MVP Flow ─────────────────────────────────────────────── */}
          <section id="mvp-flow" className="scroll-mt-8">
            <SectionHeading icon={<Milestone size={17} />} kicker="What to actually click through" title="MVP Flow" />
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-6">
              Brief §9 names two "hero flows" as the priority deliverable — everything else in this build supports one of
              these two. Both are demoable end-to-end today, crossing both portals for real: an action taken as one role is
              immediately visible to the other, through the shared store described in Key Patterns below.
            </p>

            <div className="grid lg:grid-cols-2 gap-5 mb-5">
              <Card>
                <p className="text-xs font-bold text-slate-800 mb-0.5">Flow A — Request → Quotation → Acceptance</p>
                <p className="text-[11px] text-slate-400 mb-4">Brief §9, hero flow 1</p>
                <FlowStep n={1} actor="Client Requester" actorTone="bg-rose-50 text-rose-800"
                  action="Submits a vehicle request — type, quantity, dates, branch location — from My Requests."
                  result="Booking created → Requested" />
                <FlowStep n={2} actor="Operations Manager" actorTone="bg-blue-50 text-blue-700"
                  action="Opens it in All Requests, prices it in the split-screen editor, signs, issues the Quotation."
                  result="Booking → Quoted" />
                <FlowStep n={3} actor="Client Approver" actorTone="bg-rose-50 text-rose-800"
                  action="Opens the actual A4 quotation (not a summary) from My Requests, and Accepts it."
                  result="Quotation → Accepted · Booking → Accepted" />
                <FlowStep n={4} isLast actor="Operations Manager" actorTone="bg-blue-50 text-blue-700"
                  action="Assigns a vehicle + driver — checked live against double-booking, license class, and leave conflicts."
                  result="Booking → Assigned" />
              </Card>

              <Card>
                <p className="text-xs font-bold text-slate-800 mb-0.5">Flow B — Invoice → Mark Paid → Tax Invoice</p>
                <p className="text-[11px] text-slate-400 mb-4">Brief §9, hero flow 2</p>
                <FlowStep n={1} actor="Operations / Finance" actorTone="bg-blue-50 text-blue-700"
                  action="Once the booking is Assigned, Active, or Completed, issues an Invoice the same way — signature required."
                  result="Invoice created → Unpaid" />
                <FlowStep n={2} actor="Client Finance" actorTone="bg-rose-50 text-rose-800"
                  action="Opens the invoice, submits a payment date and reference. A claim, not a settlement."
                  result="Invoice → Payment Submitted (booking untouched)" />
                <FlowStep n={3} isLast actor="Finance Officer" actorTone="bg-blue-50 text-blue-700"
                  action="Checks the claim against the bank statement — Verifies and issues the Tax Invoice together in one step, or Rejects with a reason if it doesn't match. Immutable from this point — corrections happen via a credit note, never an edit."
                  result="Invoice → Paid · Tax Invoice created" />
              </Card>
            </div>

            <Card className="bg-indigo-50/40 border-indigo-100">
              <p className="text-xs font-bold text-slate-800 mb-1.5">The recurring variant</p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                For an <code className="font-mono bg-white/70 px-1 rounded">isRecurringBilling</code> booking (long-term rentals,
                billed monthly), Flow B repeats every cycle on the <em>same</em> booking — which just sits at{" "}
                <code className="font-mono bg-white/70 px-1 rounded">Active</code> the whole time. Nothing about Flow A changes;
                it's Flow B that loops, which is exactly why the rental/billing status split in the next section had to exist —
                a single shared status couldn't represent "still renting, on invoice 4 of a 6-month contract" at all.
              </p>
            </Card>
          </section>

          {/* ── Information Architecture ────────────────────────────── */}
          <section id="ia" className="scroll-mt-8">
            <SectionHeading icon={<Layers size={17} />} kicker="Structure" title="Information Architecture" />
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-5">
              Every route lives under one of two top-level prefixes. Which portal a signed-in user lands in — and which of its
              screens they can reach — is entirely a function of their role (<code className="text-[11px] font-mono bg-slate-100 px-1 rounded">auth.ts</code>'s{" "}
              <code className="text-[11px] font-mono bg-slate-100 px-1 rounded">ROLE_ALLOWED</code>/<code className="text-[11px] font-mono bg-slate-100 px-1 rounded">ROLE_DEFAULT</code>),
              not a manual switch — the login screen's FleetCo/Thailand Post toggle only exists because this demo has one shared
              login for every role, which a real deployment wouldn't need.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <Card className="border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <p className="text-xs font-bold text-slate-800">FleetCo Operations Portal</p>
                  <code className="text-[10px] font-mono text-slate-400 ml-auto">/ops/*</code>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">Internal staff. Brief §2: "power users — optimize for density and speed." Desktop-optimized.</p>
                <NavTree tone="text-blue-600" sections={OPS_TREE} />
              </Card>
              <Card className="border-rose-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-800" />
                  <p className="text-xs font-bold text-slate-800">Client Self-Service Portal</p>
                  <code className="text-[10px] font-mono text-slate-400 ml-auto">/portal/*</code>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">Thailand Post's own users. Brief §2: "occasional users — optimize for clarity." Must work on tablet/mobile.</p>
                <NavTree tone="text-rose-800" sections={CLIENT_TREE} />
              </Card>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Role → access</p>
            <Card className="overflow-hidden !p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
                      <th className="text-left font-medium px-4 py-2.5">Role</th>
                      <th className="text-left font-medium px-4 py-2.5">Side</th>
                      <th className="text-left font-medium px-4 py-2.5">Default landing</th>
                      <th className="text-left font-medium px-4 py-2.5">Can reach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_ROWS.map(([role, side, landing, access]) => (
                      <tr key={role} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{role}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${side === "FleetCo" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-800"}`}>{side}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{landing}</td>
                        <td className="px-4 py-2.5 text-slate-500">{access}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="text-[11px] text-slate-400 mt-2">Platform Admin and Client Admin have an empty <code className="font-mono">ROLE_ALLOWED</code> array — that's the codebase's convention for "no restriction," not "no access."</p>
          </section>

          {/* ── Data Model ───────────────────────────────────────────── */}
          <section id="data-model" className="scroll-mt-8">
            <SectionHeading icon={<Database size={17} />} kicker="Data mapping" title="Data Model" />
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-5">
              <strong>Booking is the hub.</strong> Every other entity either belongs to a client, gets assigned to a booking, or
              documents one. The three billing documents form a strict chain — a Tax Invoice always traces back to one Invoice,
              which traces back to one Booking (and, indirectly, the Quotation that priced it).
            </p>

            <Card className="mb-6 bg-indigo-50/40 border-indigo-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-3">The document chain</p>
              <div className="flex items-center flex-wrap gap-2">
                {[
                  { label: "Booking", icon: <Truck size={13} />, sub: "BK-" },
                  { label: "Quotation", icon: <FileText size={13} />, sub: "QT-" },
                  { label: "Invoice", icon: <Wallet size={13} />, sub: "INV-" },
                  { label: "Tax Invoice", icon: <Receipt size={13} />, sub: "TI-" },
                ].map((n, i, arr) => (
                  <div key={n.label} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white border border-indigo-200 rounded-lg px-3 py-2 shadow-sm">
                      <span className="text-indigo-500">{n.icon}</span>
                      <span className="text-xs font-semibold text-slate-800">{n.label}</span>
                      <span className="text-[10px] font-mono text-slate-400">{n.sub}</span>
                    </div>
                    {i < arr.length - 1 && <ArrowRight size={14} className="text-indigo-300 shrink-0" />}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                One catch: a <code className="font-mono bg-white/70 px-1 rounded">isRecurringBilling</code> booking (brief §3, long-term
                rentals invoiced monthly) generates a <em>new</em> Invoice every cycle — so this chain isn't strictly 1:1:1:1 past
                the Quotation. See the reverse-lookup pattern below.
              </p>
            </Card>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Document chain entities</p>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              <DocEntityCard
                name="Booking" idFormat="BK-2026-####" tone="bg-slate-100 text-slate-600"
                description="The central record. Created by a client's request; everything else in the system attaches to one of these."
                fields={["clientId", "rentalType", "vehicleClassRequested", "quantity", "startDate/endDate", "pickupLocation", "status", "assignments?: {vehicleId,driverId}[]", "isRecurringBilling"]}
                relations={["clientId → ClientAccount", "assignments → one {vehicleId,driverId} pair per unit, filled in once Accepted→Assigned"]}
              />
              <DocEntityCard
                name="Quotation" idFormat="QT-2026-####" tone="bg-sky-50 text-sky-700"
                description="FleetCo's priced offer against a Requested booking. Client Accept/Decline is what actually advances the booking."
                fields={["bookingId", "lineItems[]", "discount", "vatRate", "validUntil", "status", "version", "fleetcoSignature?"]}
                relations={["bookingId → Booking (reverse lookup: bookingQuotations)"]}
              />
              <DocEntityCard
                name="Invoice" idFormat="INV-2026-####" tone="bg-indigo-50 text-indigo-700"
                description="Issued once a booking is eligible (Assigned/Active/Completed). A recurring booking gets one of these per billing cycle."
                fields={["bookingId", "quotationId", "amountDue", "dueDate", "status", "paymentDate?", "paymentReference?", "paymentRejectionReason?", "fleetcoSignature?"]}
                relations={["bookingId → Booking (reverse lookup: bookingInvoices, newest-first)", "\"Marked paid\" by a client is a claim — FleetCo finance verifies before it becomes Paid"]}
              />
              <DocEntityCard
                name="Tax Invoice" idFormat="TI-2026-####" tone="bg-violet-50 text-violet-700"
                description="Issued once FleetCo verifies payment. Immutable — corrections happen via a credit note, never an edit."
                fields={["invoiceId", "bookingId", "seller* / buyer*", "subtotal/vatAmount/totalAmount", "amountInWordsThai"]}
                relations={["invoiceId → the specific Invoice it closes out", "bookingId → Booking (reverse lookup: bookingTaxInvoices)"]}
              />
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Supporting entities</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              <DocEntityCard
                name="Client Account" idFormat="CLI-###" tone="bg-rose-50 text-rose-800"
                description="One per customer org. Only CLI-001 (Thailand Post) is populated — the client portal hardcodes CLIENT_ID."
                fields={["name", "taxId", "rateCard[]", "locations?", "billingTerms", "status"]}
                relations={["has many ClientUser, many Booking"]}
              />
              <DocEntityCard
                name="Vehicle" idFormat="VEH-###" tone="bg-emerald-50 text-emerald-700"
                description="Fleet inventory. Compliance dates drive the ops Dashboard's expiry alerts."
                fields={["plateNumber", "vehicleClass", "status", "4× expiry dates", "statusHistory[]", "maintenanceLog[]"]}
                relations={["assigned to Booking via an entry in booking.assignments[]", "financed via FinancingRecord.vehicleId"]}
              />
              <DocEntityCard
                name="Driver" idFormat="DRV-###" tone="bg-amber-50 text-amber-700"
                description="Roster. licenseClass gates which vehicleClass a driver can be assigned to."
                fields={["name", "licenseClass", "licenseExpiry", "employmentStatus", "leaveFrom?/leaveTo?"]}
                relations={["assigned to Booking via an entry in booking.assignments[]"]}
              />
              <DocEntityCard
                name="Financing Record" idFormat="—" tone="bg-teal-50 text-teal-700"
                description="Loan terms behind a financed vehicle. FleetCo-internal only — never exposed client-side (brief §7)."
                fields={["vehicleId", "lender", "financedAmount", "monthlyInstallment", "paymentSchedule[]"]}
                relations={["belongs to one Vehicle"]}
              />
              <DocEntityCard
                name="Vehicle Position" idFormat="—" tone="bg-cyan-50 text-cyan-700"
                description="Live-ish GPS ping for on-rental vehicles. Only exists for vehicles that have ever been out."
                fields={["vehicleId", "bookingId", "lat/lng", "speedKmh", "timestamp", "stale"]}
                relations={["tied to Vehicle + its active Booking"]}
              />
              <DocEntityCard
                name="Issue Report" idFormat="—" tone="bg-orange-50 text-orange-700"
                description="A client-raised flag on an in-progress rental (driver, vehicle, schedule, billing)."
                fields={["bookingId", "category", "description", "status", "resolutionNotes?"]}
                relations={["belongs to one Booking"]}
              />
            </div>

            <Card className="bg-amber-50/60 border-amber-100">
              <p className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5"><AlertTriangle size={13} className="text-amber-600" /> Reverse lookups, not forward pointers</p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Booking used to carry <code className="font-mono bg-white/70 px-1 rounded">quotationId</code>/<code className="font-mono bg-white/70 px-1 rounded">invoiceId</code>/
                <code className="font-mono bg-white/70 px-1 rounded">taxInvoiceId</code> as its only way to find its documents — a "most recent" convenience pointer, overwritten
                every time a new one was issued. That silently dropped every earlier cycle's invoice on a recurring-billing booking the moment a
                second one was issued. Fixed with <code className="font-mono bg-white/70 px-1 rounded">bookingQuotations(id, all)</code> /{" "}
                <code className="font-mono bg-white/70 px-1 rounded">bookingInvoices(id, all)</code> / <code className="font-mono bg-white/70 px-1 rounded">bookingTaxInvoices(id, all)</code> in{" "}
                <code className="font-mono bg-white/70 px-1 rounded">data/bookings.ts</code> — plain filters on each document's own <code className="font-mono bg-white/70 px-1 rounded">bookingId</code>, sorted newest-first. Every screen that needs "the current one" just takes index <code className="font-mono bg-white/70 px-1 rounded">[0]</code>; the ones that need full history (Billing History, DocumentChain) use the whole array.
              </p>
            </Card>
          </section>

          {/* ── Status lifecycles ────────────────────────────────────── */}
          <section id="status" className="scroll-mt-8">
            <SectionHeading icon={<GitBranch size={17} />} kicker="State" title="Status Lifecycles" />
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-5">
              The single most-revised decision in this build: a booking's <em>rental</em> progress and its <em>billing</em> progress
              used to be one linear status chain. They're tracked separately now — a booking can be sitting at <code className="text-[11px] font-mono bg-slate-100 px-1 rounded">Active</code> for
              months while its billing cycles through Unpaid → Paid → Tax Invoice several times over (recurring billing), or an invoice
              can be issued the moment a vehicle is <code className="text-[11px] font-mono bg-slate-100 px-1 rounded">Assigned</code>, well before the rental itself has finished.
            </p>

            <Card className="mb-4">
              <p className="text-xs font-bold text-slate-800 mb-3">Rental track — <code className="font-mono font-normal text-slate-400">BOOKING_STATUS_FLOW</code></p>
              <StatusFlow steps={["Requested", "Quoted", "Accepted", "Assigned", "Active", "Completed"]} activeTone="bg-blue-50 text-blue-700" />
              <p className="text-[11px] text-slate-400 mt-3">Plus two terminal branches reachable from most early states: <span className="font-medium text-rose-600">Declined</span> and <span className="font-medium text-slate-500">Cancelled</span>. Completed is terminal here too — a booking's own status never advances past it; everything past this point is the billing track below.</p>
            </Card>

            <Card className="mb-4">
              <p className="text-xs font-bold text-slate-800 mb-3">Billing track — driven by the latest Invoice, independent of rental status</p>
              <StatusFlow steps={["Unpaid / Overdue", "Payment Submitted", "Paid", "Tax Invoice issued"]} activeTone="bg-indigo-50 text-indigo-700" />
              <p className="text-[11px] text-slate-400 mt-3">
                Plus a rejection loop: FleetCo can reject a submitted claim (<code className="font-mono">handleRejectPayment</code>), which bounces
                the invoice to <span className="font-medium text-orange-600">Payment Issue</span> — same "your move" position as Unpaid/Overdue, not
                a step forward. The client resubmits from there like any other unpaid invoice.
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Computed per booking by <code className="font-mono">needsFleetCoAction()</code> / each screen's own <code className="font-mono">billingActionArea</code> —
                reads the booking's actual invoice state, not a field on the booking itself.
              </p>
            </Card>
          </section>

          {/* ── Key patterns ─────────────────────────────────────────── */}
          <section id="patterns" className="scroll-mt-8">
            <SectionHeading icon={<Layers size={17} />} kicker="Conventions" title="Key Patterns" />
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <p className="text-xs font-bold text-slate-800 mb-1.5">Shared external store</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Every domain object (<code className="font-mono">bookingsStore.ts</code>, <code className="font-mono">quotationsStore.ts</code>, …) is a module-level
                  array + a subscribe/notify list + a <code className="font-mono">useX()</code> hook, so state is shared live across
                  both portals without a real backend. Layered with <code className="font-mono">persistence.ts</code>, which mirrors every
                  store to <code className="font-mono">localStorage</code> under a <code className="font-mono">"fleetco_demo:"</code> prefix and
                  syncs across browser tabs via the <code className="font-mono">storage</code> event.
                </p>
              </Card>
              <Card>
                <p className="text-xs font-bold text-slate-800 mb-1.5">Portal-accent theming</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <code className="font-mono">--portal-accent*</code> CSS variables default to FleetCo blue on bare <code className="font-mono">:root</code>,
                  overridden to Thailand Post burgundy under <code className="font-mono">[data-portal="client"]</code>. The catch: this only
                  works if the element carrying that attribute is an actual DOM ancestor. Anything rendered via <code className="font-mono">createPortal</code> to{" "}
                  <code className="font-mono">document.body</code> (popovers, the login role modal) becomes a DOM <em>sibling</em> instead — bitten by
                  this twice this build, fixed both times by stamping <code className="font-mono">data-portal</code> directly on the portaled content's own root.
                </p>
              </Card>
              <Card>
                <p className="text-xs font-bold text-slate-800 mb-1.5">Cross-page document navigation</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Bookings, quotations, and invoices each have a real routed <code className="font-mono">:id</code> page on both
                  portals; tax invoices only on the client side (no ops equivalent exists yet — see the card below). Jumping from a
                  document to its booking (or back) is just <code className="font-mono">navigate()</code>{" "}
                  (<code className="font-mono">useOpenQuotation</code>/<code className="font-mono">useOpenInvoice</code>/
                  <code className="font-mono">useOpenBookingFromDocument</code>/<code className="font-mono">useOpenTaxInvoice</code> in{" "}
                  <code className="font-mono">documentNav.ts</code>), no <code className="font-mono">sessionStorage</code> handoff or
                  mount-effect to consume one. Started that way for bookings only (modeled on how the original FleetCMS repo links an
                  Order to its underlying Product) and later replaced entirely once every document type had somewhere of its own to
                  navigate to.
                </p>
              </Card>
              <Card>
                <p className="text-xs font-bold text-slate-800 mb-1.5">One decision, two entry points</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Accept/Decline a quotation and Mark-as-Paid an invoice are each a single function in{" "}
                  <code className="font-mono">documentActions.ts</code>, called both from the Booking Detail page's quick action and from the
                  full document view (<code className="font-mono">QuotationDetail</code>/<code className="font-mono">InvoiceDetail</code>) — two places
                  to trigger it, one place the mutation actually lives.
                </p>
              </Card>
              <Card>
                <p className="text-xs font-bold text-slate-800 mb-1.5">Signature capture</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <code className="font-mono">SignaturePad</code> is a plain <code className="font-mono">&lt;canvas&gt;</code> — draw with a
                  pointer, captured as a PNG data URL on pointer-up. Required in <code className="font-mono">DocumentEditor</code> before a
                  Quotation or Invoice can be issued, stored as <code className="font-mono">fleetcoSignature</code> on the document, and printed
                  in place of the blank "Authorized Signature — FleetCo" line everywhere that document is viewed. Stands in for a real
                  e-signature — an image, not a cryptographic one.
                </p>
              </Card>
              <Card>
                <p className="text-xs font-bold text-slate-800 mb-1.5">Quotations & Tax Invoices skip the inbox</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Unlike Invoices, neither gets its own client-portal nav item — both still have a real routed{" "}
                  <code className="font-mono">:id</code> page, just no standalone list. The test: a screen earns a nav slot only if
                  it has identity independent of a single parent record, or urgent state worth monitoring in aggregate across many.
                  A quotation is inert once decided (My Requests already surfaces the ones still awaiting a decision); a tax invoice
                  is a receipt for one specific invoice (linked straight from <code className="font-mono">InvoiceDetail</code> and from
                  the booking's own Documents card). Invoice keeps its worklist because "what's outstanding, across everything" is
                  the one genuinely portfolio-wide, time-sensitive concern of the three. Ops keeps separate Quotations/Invoices/Tax
                  Invoices lists regardless — there, all three <em>are</em> cross-client triage queues, which is exactly the case
                  this same test says deserves a standing list.
                </p>
              </Card>
            </div>
          </section>

          {/* ── Tech stack ────────────────────────────────────────────── */}
          <section id="stack" className="scroll-mt-8">
            <SectionHeading icon={<Terminal size={17} />} kicker="Under the hood" title="Tech Stack & Constraints" />
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <p className="text-xs font-bold text-slate-800 mb-2">Stack</p>
                <ul className="text-[11px] text-slate-500 space-y-1">
                  <li>React 18 + Vite 6 + TypeScript</li>
                  <li>Tailwind v4, Radix UI primitives</li>
                  <li>react-router v7 (see <code className="font-mono">routes.tsx</code>)</li>
                  <li>recharts for the dashboard charts</li>
                  <li>lucide-react for every icon</li>
                  <li>No server. No database. No build-time type-check — esbuild strips types without verifying them.</li>
                </ul>
              </Card>
              <Card className="bg-amber-50/50 border-amber-100">
                <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber-600" /> Known limitations</p>
                <ul className="text-[11px] text-slate-600 space-y-1">
                  <li>Client portal hardcodes <code className="font-mono bg-white/70 px-1 rounded">CLIENT_ID = "CLI-001"</code> — one client, by design, per the brief's launch scope</li>
                  <li>State lives in <code className="font-mono bg-white/70 px-1 rounded">localStorage</code>; "Reset Demo Data" (sidebar) restores the original seed</li>
                  <li>No file storage — payment slips, contracts, etc. are checkboxes/labels, not real uploads</li>
                  <li>Extend/modify-a-rental and an internal client-side approval workflow are both unbuilt — no product decision made yet on their shape</li>
                </ul>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
