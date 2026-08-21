import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { Toaster } from "sonner";
import { Menu } from "lucide-react";
import { getAdminRole, ROLE_PORTAL } from "@/app/lib/auth";
import { usePageHeaderValue } from "@/app/lib/pageHeaderStore";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  // FleetCo Operations Portal
  "/ops/dashboard":               { title: "Overview",              subtitle: "Dashboard" },
  "/ops/revenue":                 { title: "Revenue & Reports",      subtitle: "Dashboard" },
  "/ops/requests":                { title: "All Requests",           subtitle: "Bookings & Schedule" },
  "/ops/rentals":                 { title: "All Rentals",            subtitle: "Bookings & Schedule" },
  "/ops/calendar":                { title: "Fleet Calendar",         subtitle: "Bookings & Schedule" },
  "/ops/documents/quotations":    { title: "Quotations",             subtitle: "Bookings & Schedule" },
  "/ops/fleet":                   { title: "Vehicles",               subtitle: "Fleet" },
  "/ops/drivers":                 { title: "Driver Roster",          subtitle: "Fleet" },
  "/ops/tracking":                { title: "Live Map",               subtitle: "Fleet" },
  "/ops/clients":                 { title: "Client Accounts",        subtitle: "Clients" },
  "/ops/documents/invoices":      { title: "Invoices",               subtitle: "Billing" },
  "/ops/documents/tax-invoices":  { title: "Tax Invoices",           subtitle: "Billing" },
  "/ops/financing":               { title: "Portfolio",              subtitle: "Vehicle Financing" },
  "/ops/financing/simulator":     { title: "Acquisition Simulator",  subtitle: "Vehicle Financing" },
  "/ops/admin/roles":             { title: "Roles & Permissions",    subtitle: "Admin" },
  "/ops/admin/notifications":     { title: "Notifications",          subtitle: "Admin" },
  "/ops/admin/audit-log":         { title: "Audit Log",              subtitle: "Admin" },

  // Client Self-Service Portal
  "/portal/dashboard":              { title: "Overview",             subtitle: "Dashboard" },
  "/portal/requests":               { title: "My Requests",          subtitle: "Rentals" },
  "/portal/rentals":                { title: "My Rentals",           subtitle: "Rentals" },
  "/portal/tracking":               { title: "Live Map",             subtitle: "Rentals" },
  "/portal/documents/invoices":     { title: "Invoices & Payments",  subtitle: "Billing" },
  "/portal/billing-history":        { title: "Billing History",      subtitle: "Reports" },
};

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  // A detail page (booking, quotation, ...) registers its own title/
  // subtitle via usePageHeader once it's resolved its own data — takes
  // priority over the static table below, which only knows fixed routes.
  const dynamicHeader = usePageHeaderValue();
  const pageInfo = dynamicHeader ?? pageTitles[location.pathname] ?? { title: "FleetCo Platform", subtitle: "" };
  const role = getAdminRole();
  const portal = role ? ROLE_PORTAL[role] : "fleetco";

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden" data-portal={portal}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — scroll container lives here, not on html/body.
          This means Radix measures zero scrollbar gap and never injects
          margin compensation, so modals open without any background shift. */}
      <div
        className={`flex-1 min-w-0 flex flex-col h-screen overflow-y-scroll transition-all duration-300 ease-in-out ${
          sidebarOpen ? "lg:ml-60" : "lg:ml-0"
        }`}
      >
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 h-14 flex items-center gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1">
            <div className="text-slate-900 text-sm font-semibold">{pageInfo.title}</div>
            {pageInfo.subtitle && (
              <div className="text-slate-500 text-xs">{pageInfo.subtitle}</div>
            )}
          </div>

          <NotificationBell portal={portal} />
        </header>

        {/* Page content */}
        <main className="flex-1 min-h-0 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" duration={2000} />
    </div>
  );
}
