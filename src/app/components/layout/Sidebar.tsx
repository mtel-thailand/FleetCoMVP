import { useState, useRef, useCallback, useEffect } from "react";
import { NavLink, useLocation, useNavigate, useMatches } from "react-router";
import {
  LayoutDashboard,
  TrendingUp,
  Inbox,
  CalendarRange,
  CalendarCheck,
  Truck,
  IdCard,
  MapPin,
  Building2,
  FileText,
  FileCheck2,
  Receipt,
  Landmark,
  Calculator,
  Shield,
  Bell,
  ScrollText,
  ClipboardList,
  Wallet,
  ChevronDown,
  LogOut,
  User,
  RotateCcw,
} from "lucide-react";
import {
  setAuthenticated,
  getAdminRole,
  ROLE_LABELS,
  ROLE_PORTAL,
  ROLE_ALLOWED,
  type AdminRole,
} from "@/app/lib/auth";
import { resetAllDemoData } from "@/app/lib/resetDemoData";
import fleetcoLogo from "@/assets/fleetco-logo.svg";
import thailandPostLogo from "@/assets/thailand-post-logo.png";
import { clearAllListState } from "@/app/hooks/usePersistentListState";
import { clearAllDrafts } from "@/app/lib/documentDrafts";
import { bookingNavPath } from "@/app/data/bookings";
import type { RouteHandle } from "@/app/routes";
import { useBookings } from "@/app/lib/bookingsStore";
import { useQuotations } from "@/app/lib/quotationsStore";
import { useInvoices } from "@/app/lib/invoicesStore";
import { useTaxInvoices } from "@/app/lib/taxInvoicesStore";
import { useIssueReports } from "@/app/lib/issueReportsStore";
import { SHOW_ISSUE_REPORTS } from "@/app/data/issueReports";
import { CLIENT_ID } from "@/app/lib/currentClient";

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
  // Flags a nav entry that doesn't touch either of the brief's two §9 hero
  // flows (Request→Quotation→Acceptance→Assignment, Invoice→Paid→Tax
  // Invoice) — real, working pages, just not what those two flows need to
  // run. Renders disabled with a "Soon" pill instead of a live link; see
  // NavSectionView below. The route itself is untouched (still reachable
  // directly, still whatever ROLE_DEFAULT points a role at) — this only
  // ever changes what the sidebar itself offers as an entry point.
  soon?: boolean;
}

export interface NavSection {
  section: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const DEFAULT_COLLAPSED_SECTIONS = new Set<string>();

// Exported so Roles & Permissions can render its access matrix from the same
// nav structure everyone actually sees, instead of a second hand-maintained
// list that could quietly drift out of sync.
// ── FleetCo Operations Portal navigation (brief §4) ─────────────────────────
export const OPS_NAV_SECTIONS: NavSection[] = [
  {
    section: "Dashboard",
    icon: <LayoutDashboard size={16} />,
    items: [
      { label: "Overview",          path: "/ops/dashboard", icon: <LayoutDashboard size={16} />, soon: true },
      { label: "Revenue & Reports", path: "/ops/revenue",   icon: <TrendingUp size={16} />, soon: true },
    ],
  },
  {
    section: "Bookings & Schedule",
    icon: <Inbox size={16} />,
    items: [
      // Split from one "Request Inbox" covering the whole booking
      // lifecycle into the same REQUEST_STATUSES/RENTAL_STATUSES partition
      // the client portal already uses (My Requests/My Rentals) — see
      // bookings.ts. All Requests = nothing decided yet (Requested/Quoted/
      // Declined/Cancelled); All Rentals = the client has nothing left to
      // decide (Accepted onward) — same line, ops's own side of it.
      { label: "All Requests", path: "/ops/requests", icon: <Inbox size={16} /> },
      { label: "All Rentals", path: "/ops/rentals", icon: <CalendarCheck size={16} /> },
      { label: "Fleet Calendar", path: "/ops/calendar", icon: <CalendarRange size={16} />, soon: true },
      // Moved from the old "Documents" section — a quotation belongs to
      // Flow A (Request → Quotation → Acceptance), not Flow B (Invoice →
      // Paid → Tax Invoice), so grouping it with Invoices/Tax Invoices was
      // mixing two different flows under one label. It lives with the rest
      // of the request/booking lifecycle instead, same section as the
      // request it prices.
      { label: "Quotations", path: "/ops/documents/quotations", icon: <FileText size={16} /> },
    ],
  },
  {
    section: "Fleet",
    icon: <Truck size={16} />,
    items: [
      { label: "Vehicles", path: "/ops/fleet", icon: <Truck size={16} /> },
      { label: "Driver Roster", path: "/ops/drivers", icon: <IdCard size={16} /> },
      { label: "Live Map", path: "/ops/tracking", icon: <MapPin size={16} />, soon: true },
    ],
  },
  {
    section: "Clients",
    icon: <Building2 size={16} />,
    items: [
      { label: "Client Accounts", path: "/ops/clients", icon: <Building2 size={16} />, soon: true },
    ],
  },
  {
    // Renamed from "Documents" — now just Flow B's two billing documents,
    // not a catch-all for every document type (Quotations moved out, see
    // above). Same section name and icon (Wallet) as the client portal's
    // own Billing section, since it's the same underlying concern from
    // each side.
    section: "Billing",
    icon: <Wallet size={16} />,
    items: [
      { label: "Invoices",     path: "/ops/documents/invoices",     icon: <FileCheck2 size={16} /> },
      { label: "Tax Invoices", path: "/ops/documents/tax-invoices", icon: <Receipt size={16} /> },
    ],
  },
  {
    section: "Vehicle Financing",
    icon: <Landmark size={16} />,
    items: [
      { label: "Portfolio",              path: "/ops/financing",           icon: <Landmark size={16} />, soon: true },
      { label: "Acquisition Simulator",  path: "/ops/financing/simulator", icon: <Calculator size={16} />, soon: true },
    ],
  },
  {
    section: "Admin",
    icon: <Shield size={16} />,
    items: [
      { label: "Roles & Permissions", path: "/ops/admin/roles",         icon: <Shield size={16} />, soon: true },
      { label: "Notifications",       path: "/ops/admin/notifications", icon: <Bell size={16} />, soon: true },
      { label: "Audit Log",           path: "/ops/admin/audit-log",     icon: <ScrollText size={16} />, soon: true },
    ],
  },
];

// ── Client Self-Service Portal navigation (brief §5) ────────────────────────
//
// Quotations and Tax Invoices deliberately have no nav item of their own
// here (they still have real routed :id pages — see routes.tsx — just no
// standalone inbox to browse them from). Neither has identity or urgency
// independent of a single parent record: a quotation only matters while its
// booking is Quoted (My Requests already surfaces that, badge and all), and
// a tax invoice is a receipt for one specific invoice (InvoiceDetail links
// straight to it). Invoices stays, because "what do I currently owe" is a
// genuinely portfolio-wide, time-sensitive concern — the one document type
// worth monitoring in aggregate rather than one rental at a time. Billing
// History (brief §5.3 / §2 Client Finance) would live in its own Reports
// section for the same reason in reverse — an archival reconciliation
// trail, not something actioned day to day — but that section is hidden
// entirely for now rather than shown as a "Soon" placeholder; see the
// comment just above the closing bracket below.
export const CLIENT_NAV_SECTIONS: NavSection[] = [
  {
    section: "Dashboard",
    icon: <LayoutDashboard size={16} />,
    items: [
      { label: "Overview", path: "/portal/dashboard", icon: <LayoutDashboard size={16} />, soon: true },
    ],
  },
  {
    section: "Rentals",
    icon: <ClipboardList size={16} />,
    items: [
      { label: "My Requests",       path: "/portal/requests", icon: <ClipboardList size={16} /> },
      { label: "My Rentals",        path: "/portal/rentals",  icon: <Truck size={16} /> },
      { label: "Live Map",          path: "/portal/tracking", icon: <MapPin size={16} />, soon: true },
    ],
  },
  {
    section: "Billing",
    icon: <Wallet size={16} />,
    items: [
      { label: "Invoices & Payments", path: "/portal/documents/invoices", icon: <Wallet size={16} /> },
    ],
  },
  // Reports/Billing History hidden for now, not deleted — brief §5.3 and
  // the Client Finance row in §2 both name it as real scope, it's just not
  // built yet and the client asked not to show a "Soon" placeholder for
  // this one specifically (unlike the other 10 items, which still show
  // dimmed+pill). Route itself untouched at /portal/billing-history; only
  // its nav entry point is gone. Re-add the section here once it's built.
];

function getFilteredSections(role: AdminRole | null): { sections: NavSection[]; portal: "fleetco" | "client" } {
  const portal = role ? ROLE_PORTAL[role] : "fleetco";
  const base = portal === "client" ? CLIENT_NAV_SECTIONS : OPS_NAV_SECTIONS;
  const allowed = role ? ROLE_ALLOWED[role] : [];

  // Hide every "Soon" item for now — the roadmap-signal treatment (dimmed
  // text + outlined pill, see NavSectionView below) still assumes the page
  // itself is real and worth linking to; right now several of these are
  // just placeholders. Same drop-empty-sections cleanup as the role filter
  // right below, since a section can end up all-"Soon" (e.g. Fleet
  // Calendar) and there's no reason to render an empty section header.
  const withoutSoon = base
    .map((s) => ({ ...s, items: s.items.filter((item) => !item.soon) }))
    .filter((s) => s.items.length > 0);

  if (allowed.length === 0) return { sections: withoutSoon, portal };

  const sections = withoutSoon
    .map((s) => ({ ...s, items: s.items.filter((item) => allowed.some((p) => item.path.startsWith(p))) }))
    .filter((s) => s.items.length > 0);
  return { sections, portal };
}

// Action badges live only on the views where that action is taken. The nav
// section constants hold JSX icons, so their dynamic counts are merged in at
// render time instead.
function applyBadges(sections: NavSection[], badgeByPath: Record<string, number>): NavSection[] {
  return sections.map((s) => ({
    ...s,
    items: s.items.map((item) => (badgeByPath[item.path] ? { ...item, badge: badgeByPath[item.path] } : item)),
  }));
}

function NavSectionView({ section, effectiveNavPath }: { section: NavSection; effectiveNavPath: string }) {
  const hasActive = section.items.some((item) => item.path === effectiveNavPath);
  const [open, setOpen] = useState(
    hasActive || !DEFAULT_COLLAPSED_SECTIONS.has(section.section),
  );

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 mt-4 first:mt-0 group cursor-pointer"
      >
        <span className="text-xs text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
          {section.section}
        </span>
        <ChevronDown
          size={12}
          className={`text-slate-600 group-hover:text-slate-400 transition-all duration-200 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {section.items.map((item) => {
            // Own isActive instead of NavLink's built-in one (which only
            // exact-matches item.path against the real URL) — a booking
            // detail page's real URL is /portal/bookings/:id, which
            // legitimately belongs to My Requests or My Rentals depending
            // on that booking's own status (see effectiveNavPath below,
            // computed once in Sidebar() and passed down), not to either
            // path literally. Without this override, opening a specific
            // booking would go dark in the nav with nothing highlighted.
            // Not-yet-MVP items (brief §9's two hero flows don't touch them
            // — see Documentation.tsx's "MVP Flow" section) still navigate —
            // the pages themselves are real and working, and at least one
            // role (account_manager) actually lands on one of these by
            // default (ROLE_DEFAULT → /ops/clients), so an inert link would
            // strand it. This is a roadmap signal, not an access gate: dimmed
            // text/icon + an outlined "Soon" pill instead of a disabled
            // control, still a full NavLink underneath.
            const isActive = item.path === effectiveNavPath;
            if (item.soon) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "text-white bg-[var(--portal-accent)]"
                        : "text-slate-600 hover:text-slate-300 hover:bg-white/5"
                    }`
                  }
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate flex-1">{item.label}</span>
                  <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-semibold uppercase tracking-wider ${
                    isActive ? "border-white/40 text-white/80" : "border-slate-700 text-slate-500"
                  }`}>
                    Soon
                  </span>
                </NavLink>
              );
            }
            return (
            <NavLink
              key={item.path}
              to={item.path}
              className={
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "text-white bg-[var(--portal-accent)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate flex-1">{item.label}</span>
              {!!item.badge && (
                <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-semibold">
                  {item.badge}
                </span>
              )}
            </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LogoutModal({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center mb-4">
            <LogOut size={18} className="text-rose-500" />
          </div>
          <h2 className="text-slate-900 text-lg font-semibold">Log out of your account?</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            You're about to log out. You'll need to sign in again to continue.
          </p>
          <div className="flex items-center justify-end gap-2.5 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
            >
              <LogOut size={14} strokeWidth={2.5} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// There's no backend behind this demo — every store is an in-memory array
// that a full page reload silently wipes back to seed data anyway (the dev
// server's own WebSocket reconnecting triggers this). This just makes that
// reset an explicit, intentional action instead of a confusing surprise.
function ResetDataModal({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <RotateCcw size={18} className="text-amber-500" />
          </div>
          <h2 className="text-slate-900 text-lg font-semibold">Reset demo data?</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            This restores every booking, quotation, invoice, and tax invoice to its starting state —
            for both portals, since it's the same shared data. Anything you've submitted or changed
            this session will be gone.
          </p>
          <div className="flex items-center justify-end gap-2.5 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
            >
              <RotateCcw size={14} strokeWidth={2.5} />
              Reset Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [showLogout, setShowLogout] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const matches = useMatches();
  const navRef = useRef<HTMLElement>(null);
  const role = getAdminRole();
  const { sections: baseSections, portal } = getFilteredSections(role);
  const bookings = useBookings();
  const quotations = useQuotations();
  const invoices = useInvoices();
  const taxInvoices = useTaxInvoices();
  const issueReports = useIssueReports();
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A booking detail page's real URL (/portal/bookings/:id) doesn't match
  // My Requests or My Rentals literally, but it does legitimately belong to
  // one of them — same status-derived question BookingDetail.tsx answers
  // for its own page header. Documents one level deeper (Quotation/Invoice/
  // Tax Invoice) resolve the same way, or to their own list, depending on
  // the document type — which nav path each route effectively belongs
  // under is declared once per route in routes.tsx (handle.resolveNavPath),
  // not re-derived here from the raw pathname — this file doesn't need its
  // own copy of those route shapes or document-type distinctions, just
  // whatever the current route says about itself.
  const currentHandle = matches[matches.length - 1]?.handle as RouteHandle | undefined;
  const currentParams = matches[matches.length - 1]?.params ?? {};
  const resolvedNavPath = currentHandle?.resolveNavPath?.(currentParams, { bookings, quotations, invoices, taxInvoices });
  // An invoice opened from inside its own booking's page (that page's
  // header action, or its DocumentChain row) carries that booking's id as
  // router state — see useOpenInvoice. When present, it overrides the
  // route's own default (Invoices & Payments) with that booking's section
  // instead, so the click that opened it doesn't jump the sidebar out from
  // under a context that never actually changed. Absent on a fresh load —
  // typed URL, reload, bookmark — where following the invoice's own default
  // home is the only sensible answer. useOpenInvoice sends this on both
  // portals, and now both portals have a requests/rentals split to resolve
  // it into (ops's AllRequests/AllRentals mirrors the client's own), so
  // this no longer gates on portal the way it used to when only the client
  // side had a split for it to resolve into.
  const fromBookingId = (location.state as { fromBookingId?: string } | null)?.fromBookingId;
  const effectiveNavPath = (fromBookingId && bookingNavPath(fromBookingId, bookings, portal === "client" ? "client" : "ops")) || resolvedNavPath || location.pathname;

  const badgeByPath: Record<string, number> = {};
  if (portal === "client") {
    if (role === "client_approver" || role === "client_admin") {
      const awaiting = bookings.filter((b) => b.clientId === CLIENT_ID && b.status === "Quoted").length;
      if (awaiting > 0) badgeByPath["/portal/requests"] = awaiting;
    }
    // Same client-action definition as InvoiceInbox.tsx's Needs Action tab:
    // Due/Overdue/Payment Issue all mean the client can pay or resubmit.
    // Gated to the roles who can actually mark an invoice paid
    // (InvoiceDetail.tsx's canMarkPaid), same as above.
    if (role === "client_approver" || role === "client_finance" || role === "client_admin") {
      const needsPayment = invoices.filter(
        (i) => i.clientId === CLIENT_ID && (i.status === "Unpaid" || i.status === "Overdue" || i.status === "Payment Issue"),
      ).length;
      if (needsPayment > 0) badgeByPath["/portal/documents/invoices"] = needsPayment;
    }
  } else if (SHOW_ISSUE_REPORTS) {
    // Unscoped by client — ops manages every account, unlike the client
    // portal's own single-client badges above.
    const openIssues = issueReports.filter((r) => r.status === "Open").length;
    // Issue reports are only ever raised on active rentals (ClientBookingDetail's
    // Report an Issue action isn't offered pre-Accepted) — All Rentals, not
    // All Requests.
    if (openIssues > 0) badgeByPath["/ops/rentals"] = openIssues;
  }
  const filteredSections = applyBadges(baseSections, badgeByPath);

  const handleScroll = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    el.classList.add("is-scrolling");
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      el.classList.remove("is-scrolling");
    }, 800);
  }, []);

  return (
    <>
      {/* Overlay (mobile + desktop when sidebar is open over content) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-slate-900 flex flex-col z-50
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Logo / Header */}
        <div className="flex items-center justify-between px-4 border-b border-slate-700/50 h-14 shrink-0">
          <div className="flex items-center gap-2">
            {/* Same real-mark-per-portal pattern as the login card
                (LoginPage.tsx) so the identity carries through from login
                into the app itself. Both marks sit on a white backdrop,
                since each is a colored mark rather than a flat glyph that
                works reversed-out on the accent square the way
                Truck/Building2 did. Unlike the login card, the name/subtitle
                text next to each mark stays — at this h-6 size the mark's
                own wordmark is too small to read, so the text is still
                doing real identifying work here, not just repeating it. */}
            <div className="h-9 px-1.5 rounded-lg bg-white flex items-center justify-center shrink-0">
              <img src={portal === "client" ? thailandPostLogo : fleetcoLogo} alt={portal === "client" ? "Thailand Post" : "FleetCo"} className="h-6 w-auto" />
            </div>
            <div>
              <div className="text-white text-sm font-semibold">{portal === "client" ? "ThaiPost" : "FleetCo"}</div>
              <div className="text-slate-400 text-xs">
                {portal === "client" ? "Client Portal" : "Operations Portal"}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav ref={navRef} onScroll={handleScroll} className="sidebar-nav flex-1 overflow-y-auto py-3">
          <div className="px-2">
            {filteredSections.map((section) => (
              <NavSectionView key={section.section} section={section} effectiveNavPath={effectiveNavPath} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700/50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[var(--portal-accent)] flex items-center justify-center text-white shrink-0">
              <User size={14} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-300 text-xs font-medium truncate">
                {role ? ROLE_LABELS[role] : "Signed in"}
              </div>
              <div className="text-slate-500 text-xs truncate">
                {portal === "client" ? "Client Portal" : "FleetCo Team"}
              </div>
            </div>
            <button
              onClick={() => setShowReset(true)}
              className="text-slate-500 hover:text-amber-400 transition-colors shrink-0 cursor-pointer"
              title="Reset Demo Data"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setShowLogout(true)}
              className="text-slate-500 hover:text-rose-400 transition-colors shrink-0 cursor-pointer"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {showLogout && (
        <LogoutModal
          onClose={() => setShowLogout(false)}
          onLogout={() => { setShowLogout(false); setAuthenticated(false); clearAllListState(); clearAllDrafts(); navigate("/login", { replace: true }); }}
        />
      )}
      {showReset && (
        <ResetDataModal
          onClose={() => setShowReset(false)}
          onReset={() => { resetAllDemoData(); setShowReset(false); }}
        />
      )}
    </>
  );
}
