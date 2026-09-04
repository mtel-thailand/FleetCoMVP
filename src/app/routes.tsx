import { createBrowserRouter, Navigate, useLocation } from "react-router";
import { Layout } from "./components/layout/Layout";
import { isAuthenticated, getAdminRole, ROLE_ALLOWED, ROLE_DEFAULT, ROLE_PORTAL } from "./lib/auth";
import { bookingNavPath, type Booking } from "./data/bookings";
import type { Quotation } from "./data/quotations";
import type { Invoice } from "./data/invoices";
import type { TaxInvoice } from "./data/taxInvoices";
import { LoginPage } from "./pages/auth/LoginPage";
import { OperationsDashboard } from "./pages/operations/OperationsDashboard";
import { AllRequests } from "./pages/operations/AllRequests";
import { AllRentals } from "./pages/operations/AllRentals";
import { OpsBookingDetail } from "./pages/operations/OpsBookingDetail";
import { FleetCalendar } from "./pages/operations/FleetCalendar";
import { OpsQuotations } from "./pages/operations/OpsQuotations";
import { OpsQuotationDetail } from "./pages/operations/OpsQuotationDetail";
import { OpsInvoices } from "./pages/operations/OpsInvoices";
import { OpsInvoiceDetail } from "./pages/operations/OpsInvoiceDetail";
import { OpsPaymentVerification } from "./pages/operations/OpsPaymentVerification";
import { OpsTaxInvoices } from "./pages/operations/OpsTaxInvoices";
import { OpsTaxInvoiceDetail } from "./pages/operations/OpsTaxInvoiceDetail";
import { OpsDocumentEditorPage } from "./pages/operations/OpsDocumentEditorPage";
import { RevenueReporting } from "./pages/operations/RevenueReporting";
import { Vehicles } from "./pages/fleet/Vehicles";
import { VehicleDetail } from "./pages/fleet/VehicleDetail";
import { DriverRoster } from "./pages/fleet/DriverRoster";
import { ClientAccountDetail, ClientAccounts } from "./pages/external/ClientAccounts";
import { FinancingPortfolio } from "./pages/financing/FinancingPortfolio";
import { AcquisitionSimulator } from "./pages/financing/AcquisitionSimulator";
import { RolesPermissions } from "./pages/system/RolesPermissions";
import { NotificationCenter } from "./pages/system/NotificationCenter";
import { AuditLog } from "./pages/system/AuditLog";
import { AccountSettings } from "./pages/system/AccountSettings";
import { LiveMap } from "./pages/fleet/LiveMap";
import { MyRequests } from "./pages/portal/MyRequests";
import { MyRentals } from "./pages/portal/MyRentals";
import { BookingDetail } from "./pages/portal/BookingDetail";
import { ClientLiveMap } from "./pages/portal/ClientLiveMap";
import { QuotationDetailPage } from "./pages/portal/QuotationDetailPage";
import { InvoiceInbox } from "./pages/portal/InvoiceInbox";
import { InvoiceDetailPage } from "./pages/portal/InvoiceDetailPage";
import { TaxInvoiceDetailPage } from "./pages/portal/TaxInvoiceDetailPage";
import { PortalDashboard } from "./pages/portal/PortalDashboard";
import { BillingHistory } from "./pages/portal/BillingHistory";
import { CompanyProfile } from "./pages/portal/CompanyProfile";
import { Documentation } from "./pages/documentation/Documentation";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RoleGuard({ children }: { children: React.ReactNode }) {
  const role = getAdminRole();
  const location = useLocation();
  if (!role) return <>{children}</>;

  // A role's own portal boundary comes first, unconditionally — a client
  // role has no business reaching /ops/* (or vice versa) no matter what
  // ROLE_ALLOWED says. This used to be missing entirely: ROLE_ALLOWED's own
  // comment says an empty array means "unrestricted within their portal,"
  // but the old check below (`allowed.length > 0 && ...`) skips itself
  // completely when the array is empty, which actually granted unrestricted
  // access *everywhere* — so client_admin (empty array, same as
  // platform_admin) could load an /ops/* URL directly and see every
  // client's bookings, not a display bug but a real cross-tenant leak.
  const portalPrefix = ROLE_PORTAL[role] === "client" ? "/portal" : "/ops";
  const isWithinPath = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (!isWithinPath(location.pathname, portalPrefix)) {
    return <Navigate to={ROLE_DEFAULT[role]} replace />;
  }

  const allowed = ROLE_ALLOWED[role];
  if (allowed.length > 0 && !allowed.some((p) => isWithinPath(location.pathname, p))) {
    return <Navigate to={ROLE_DEFAULT[role]} replace />;
  }
  return <>{children}</>;
}

// Redirects "/" to the right portal's default landing page for whoever is
// signed in, instead of a single hardcoded path — there are two portals now.
function IndexRedirect() {
  const role = getAdminRole();
  return <Navigate to={role ? ROLE_DEFAULT[role] : "/ops/dashboard"} replace />;
}

// A route that's "about" a booking — directly, or one level deeper via a
// Quotation/Invoice/Tax Invoice it belongs to — declares how to get that
// booking's id from its own params, right here next to its own definition.
// Sidebar.tsx reads this through useMatches() instead of keeping its own
// parallel copy of these same route shapes as regexes: rename a path here
// and the resolver moves with it automatically, rather than the sidebar
// silently going dark for that page because its own copy fell out of sync.
export type BookingLookupContext = { bookings: Booking[]; quotations: Quotation[]; invoices: Invoice[]; taxInvoices: TaxInvoice[] };
// What the sidebar should treat as "active" while this route is open — not
// always the route's own literal path. A booking detail page's real URL is
// /portal/bookings/:id, which belongs to My Requests or My Rentals depending
// on that booking's current status, not to either path literally; a
// quotation or tax invoice one level deeper resolves the same way, since
// neither has a standalone list of its own to point to instead (see the
// CLIENT_NAV_SECTIONS comment in Sidebar.tsx). An invoice is different — it
// does have its own list ("Invoices & Payments"), so its handle resolves
// there directly rather than following its booking, regardless of what
// status that booking happens to be in. Declared once per route here, not
// re-derived from the raw pathname in Sidebar.tsx.
export type RouteHandle = { resolveNavPath?: (params: Record<string, string | undefined>, ctx: BookingLookupContext) => string | undefined };

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/documentation", element: <Documentation /> },
  {
    path: "/",
    element: <RequireAuth><RoleGuard><Layout /></RoleGuard></RequireAuth>,
    children: [
      { index: true, element: <IndexRedirect /> },

      // ── FleetCo Operations Portal — brief §4 ───────────────────────────
      { path: "ops/dashboard", element: <OperationsDashboard /> },
      { path: "ops/revenue", element: <RevenueReporting /> },
      { path: "ops/requests", element: <AllRequests /> },
      { path: "ops/rentals", element: <AllRentals /> },
      {
        path: "ops/bookings/:id",
        element: <OpsBookingDetail />,
        handle: { resolveNavPath: (params, ctx) => bookingNavPath(params.id, ctx.bookings, "ops") } satisfies RouteHandle,
      },
      { path: "ops/calendar", element: <FleetCalendar /> },
      { path: "ops/fleet", element: <Vehicles /> },
      {
        path: "ops/fleet/:id",
        element: <VehicleDetail />,
        handle: { resolveNavPath: () => "/ops/fleet" } satisfies RouteHandle,
      },
      { path: "ops/drivers", element: <DriverRoster /> },
      { path: "ops/tracking", element: <LiveMap /> },
      { path: "ops/clients", element: <ClientAccounts /> },
      {
        path: "ops/clients/:id",
        element: <ClientAccountDetail />,
        handle: { resolveNavPath: () => "/ops/clients" } satisfies RouteHandle,
      },
      { path: "ops/documents/quotations", element: <OpsQuotations />, handle: { resolveNavPath: () => "/ops/requests" } satisfies RouteHandle },
      // Document detail routes default to their own ops workspace when
      // loaded directly. Cross-page opens carry origin state so the detail
      // page can return to the exact parent record when needed.
      {
        path: "ops/documents/quotations/:id",
        element: <OpsQuotationDetail />,
        handle: { resolveNavPath: () => "/ops/requests" } satisfies RouteHandle,
      },
      { path: "ops/documents/invoices", element: <OpsInvoices /> },
      {
        path: "ops/documents/invoices/:id/verify",
        element: <OpsPaymentVerification />,
        handle: { resolveNavPath: () => "/ops/documents/invoices" } satisfies RouteHandle,
      },
      {
        path: "ops/documents/invoices/:id",
        element: <OpsInvoiceDetail />,
        handle: { resolveNavPath: () => "/ops/documents/invoices" } satisfies RouteHandle,
      },
      // Tax invoices retain an immutable secondary register for search and
      // audit, while Invoices & Payments stays selected as the primary task.
      { path: "ops/documents/tax-invoices", element: <OpsTaxInvoices />, handle: { resolveNavPath: () => "/ops/documents/invoices" } satisfies RouteHandle },
      {
        path: "ops/documents/tax-invoices/:id",
        element: <OpsTaxInvoiceDetail />,
        handle: { resolveNavPath: () => "/ops/documents/invoices" } satisfies RouteHandle,
      },
      // Was a fixed-overlay modal (DocumentEditor.tsx) rendered inline on
      // OpsBookingDetail — converted to a routed page since it's already
      // effectively full-screen in practice (max-w-7xl, 94vh) and brief
      // §6.2 calls this split-screen editor out by name as needing real
      // design space, unlike RequestVehicle.tsx's compact form (which stays
      // a modal — see that file's own "explicitly not converting" note).
      // docNumber is reserved when the page itself mounts (nextQuotationId/
      // nextInvoiceId), same "reserved once, stable for the page's life"
      // behavior the old modal's local state gave it.
      {
        path: "ops/bookings/:id/quotation/new",
        element: <OpsDocumentEditorPage mode="quotation" />,
        handle: { resolveNavPath: (params, ctx) => bookingNavPath(params.id, ctx.bookings, "ops") } satisfies RouteHandle,
      },
      {
        path: "ops/bookings/:id/invoice/new",
        element: <OpsDocumentEditorPage mode="invoice" />,
        handle: { resolveNavPath: (params, ctx) => bookingNavPath(params.id, ctx.bookings, "ops") } satisfies RouteHandle,
      },
      { path: "ops/financing", element: <FinancingPortfolio /> },
      { path: "ops/financing/simulator", element: <AcquisitionSimulator /> },
      { path: "ops/admin/roles", element: <RolesPermissions /> },
      { path: "ops/admin/notifications", element: <NotificationCenter /> },
      { path: "ops/admin/audit-log", element: <AuditLog /> },
      // Reachable by every role, not gated behind the "Admin" section's own
      // items (which are all platform_admin/read_only-only in practice) —
      // see the matching addition to every restricted FleetCo role's own
      // ROLE_ALLOWED entry in auth.ts. Opened from Sidebar.tsx's own footer
      // identity block, not a nav section item.
      { path: "ops/account", element: <AccountSettings /> },

      // ── Client Self-Service Portal (Thailand Post) — brief §5 ──────────
      { path: "portal/dashboard", element: <PortalDashboard /> },
      { path: "portal/requests", element: <MyRequests /> },
      { path: "portal/rentals", element: <MyRentals /> },
      {
        path: "portal/bookings/:id",
        element: <BookingDetail />,
        handle: { resolveNavPath: (params, ctx) => bookingNavPath(params.id, ctx.bookings) } satisfies RouteHandle,
      },
      { path: "portal/tracking", element: <ClientLiveMap /> },
      // The client portal keeps quotation and tax-invoice detail contextual
      // to the booking/invoice flow; it does not expose duplicate standalone
      // registers alongside Billing History and Invoices & Payments.
      {
        path: "portal/documents/quotations/:id",
        element: <QuotationDetailPage />,
        handle: { resolveNavPath: (params, ctx) => bookingNavPath(ctx.quotations.find((q) => q.id === params.id)?.bookingId, ctx.bookings) } satisfies RouteHandle,
      },
      { path: "portal/documents/invoices", element: <InvoiceInbox /> },
      {
        path: "portal/documents/invoices/:id",
        element: <InvoiceDetailPage />,
        // Unlike quotations/tax invoices, invoices keep their own standing
        // list ("Invoices & Payments") — an invoice detail page belongs
        // there, not to whatever nav section its booking currently sits
        // under, so this resolves to a fixed path rather than following the
        // booking like the other two documents do.
        handle: { resolveNavPath: () => "/portal/documents/invoices" } satisfies RouteHandle,
      },
      {
        path: "portal/documents/tax-invoices/:id",
        element: <TaxInvoiceDetailPage />,
        handle: { resolveNavPath: () => "/portal/documents/invoices" } satisfies RouteHandle,
      },
      { path: "portal/billing-history", element: <BillingHistory /> },
      // Read-only mirror of what ops manages on Client Accounts (org
      // profile + tax branch registry) — see CompanyProfile.tsx's own
      // header comment for why it's a separate component, not a shared one.
      { path: "portal/company", element: <CompanyProfile /> },
      // Client-side mirror of ops/account above — same shared AccountSettings
      // component, reachable by every client role via Sidebar.tsx's footer.
      { path: "portal/account", element: <AccountSettings /> },

      // Catch all
      { path: "*", element: <IndexRedirect /> },
    ],
  },
]);
