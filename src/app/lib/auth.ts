let currentPassword = "1234";

export function getStoredPassword(): string {
  return currentPassword;
}

export function setStoredPassword(password: string): void {
  currentPassword = password;
}

const AUTH_KEY = "fleetco_authed";
const ROLE_KEY = "fleetco_role";

// FleetCo-side roles (Operations Portal) — brief §2, plus "read-only" from
// the §4.8 role list. Note: read_only currently has full *navigation* access
// like platform_admin — it is NOT yet write-blocked on individual actions
// (every create/edit/delete button across the app), which would be a much
// larger cross-cutting change. Flagged honestly in the Roles & Permissions
// screen rather than silently pretended-away.
export type FleetCoRole = "platform_admin" | "ops_manager" | "account_manager" | "finance" | "read_only";
// Thailand Post-side roles (Client Portal) — brief §2, plus "client_admin":
// unlike the FleetCo side, none of the brief's three client roles is a
// superset of the others (Approver and Finance are genuinely disjoint
// concerns) — this is the client-side equivalent of platform_admin, full
// access across the whole client portal.
export type ClientRole = "client_admin" | "client_approver" | "client_requester" | "client_finance";

export type AdminRole = FleetCoRole | ClientRole;

const FLEETCO_ROLES: FleetCoRole[] = ["platform_admin", "ops_manager", "account_manager", "finance", "read_only"];

export function isFleetCoRole(role: AdminRole): role is FleetCoRole {
  return (FLEETCO_ROLES as AdminRole[]).includes(role);
}

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

export function setAuthenticated(value: boolean): void {
  if (value) {
    sessionStorage.setItem(AUTH_KEY, "1");
  } else {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(ROLE_KEY);
  }
}

export function getAdminRole(): AdminRole | null {
  return sessionStorage.getItem(ROLE_KEY) as AdminRole | null;
}

export function setAdminRole(role: AdminRole): void {
  sessionStorage.setItem(ROLE_KEY, role);
}

// ── Role metadata (single source of truth — shared by Sidebar + routes) ────

export const ROLE_LABELS: Record<AdminRole, string> = {
  platform_admin: "Platform Admin",
  ops_manager: "Operations Manager",
  account_manager: "Account / BD Manager",
  finance: "Finance Officer",
  read_only: "Read-Only",
  client_admin: "Client Admin",
  client_approver: "Client Approver / Manager",
  client_requester: "Client Requester",
  client_finance: "Client Finance",
};

export const ROLE_PORTAL: Record<AdminRole, "fleetco" | "client"> = {
  platform_admin: "fleetco",
  ops_manager: "fleetco",
  account_manager: "fleetco",
  finance: "fleetco",
  read_only: "fleetco",
  client_admin: "client",
  client_approver: "client",
  client_requester: "client",
  client_finance: "client",
};

// Path prefixes each role may access. Empty array = unrestricted within their portal.
export const ROLE_ALLOWED: Record<AdminRole, string[]> = {
  platform_admin: [],
  // /ops/bookings kept in both even though the list pages moved to
  // /ops/requests + /ops/rentals — /ops/bookings/:id (the detail route)
  // still lives under that prefix, and both roles need it.
  ops_manager: ["/ops/dashboard", "/ops/requests", "/ops/rentals", "/ops/bookings", "/ops/calendar", "/ops/fleet", "/ops/drivers", "/ops/tracking"],
  account_manager: ["/ops/dashboard", "/ops/clients", "/ops/requests", "/ops/rentals", "/ops/bookings", "/ops/documents/quotations", "/ops/revenue"],
  finance: ["/ops/dashboard", "/ops/documents/invoices", "/ops/documents/tax-invoices", "/ops/revenue", "/ops/financing"],
  read_only: [],
  client_admin: [],
  // /portal/bookings/:id (a single booking's detail — see BookingDetail.tsx)
  // added to all three: it used to be a modal rendered *inside* My
  // Requests/My Rentals/Billing History, so RoleGuard never had a separate
  // path to check. Now that it's a real route, each role that can already
  // reach at least one booking list needs it allowlisted too, or clicking a
  // row would bounce them straight back to their own default page.
  client_approver: ["/portal/dashboard", "/portal/requests", "/portal/rentals", "/portal/tracking", "/portal/documents/quotations", "/portal/bookings"],
  client_requester: ["/portal/requests", "/portal/rentals", "/portal/tracking", "/portal/bookings"],
  client_finance: ["/portal/documents/invoices", "/portal/documents/tax-invoices", "/portal/billing-history", "/portal/rentals", "/portal/bookings"],
};

// /ops/dashboard and /portal/dashboard used to be the default landing page
// for platform_admin/read_only and client_admin/client_approver — now that
// Overview is hidden from both sidebars (Sidebar.tsx's "Soon" filter), those
// routes still exist but nothing links to them anymore, so landing there
// would show a page with no matching sidebar item highlighted. Pointed at
// the first real destination each role can already reach instead.
export const ROLE_DEFAULT: Record<AdminRole, string> = {
  platform_admin: "/ops/requests",
  ops_manager: "/ops/requests",
  account_manager: "/ops/clients",
  finance: "/ops/documents/invoices",
  read_only: "/ops/requests",
  client_admin: "/portal/requests",
  client_approver: "/portal/requests",
  client_requester: "/portal/requests",
  client_finance: "/portal/documents/invoices",
};
