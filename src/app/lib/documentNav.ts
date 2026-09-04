import { useNavigate, useLocation } from "react-router";
import { bookingNavPath } from "@/app/data/bookings";
import { useBookings } from "@/app/lib/bookingsStore";

export type DocumentOriginState = {
  fromBookingId?: string;
  navPath?: string;
  returnTo?: string;
  returnLabel?: string;
  returnState?: unknown;
};

export type DocumentKind = "quotations" | "invoices" | "tax-invoices";

export type BookingOriginOptions = {
  navPath?: string;
  preserveOrigin?: boolean;
  returnLabel?: string;
  returnTo?: string;
};

export function documentListPath(portal: "ops" | "portal", kind: DocumentKind): string {
  return `/${portal}/documents/${kind}`;
}

export function documentDetailPath(portal: "ops" | "portal", kind: DocumentKind, id: string): string {
  return `${documentListPath(portal, kind)}/${id}`;
}

// Cross-page navigation to a specific document or booking. Quotations,
// invoices, and bookings all have a real routed :id page now, on both
// portals, so "open this one" is just a navigate — no sessionStorage
// handoff, no mount-effect on the destination page to consume it. A
// document always knows its own bookingId, and a booking's DocumentChain
// always knows each document's id, so the destination itself is a plain
// graph edge looked up fresh each time. Route state only preserves UX
// context: which workspace owns the drill-down and where the in-page Back
// action should return, including one nested level at a time.

function isOpsPortal(pathname: string) {
  return pathname === "/ops" || pathname.startsWith("/ops/");
}

function documentOriginState(location: ReturnType<typeof useLocation>, portal: "ops" | "portal", fromBookingId?: string): DocumentOriginState {
  const prefix = portal === "ops" ? "/ops" : "/portal";
  const currentState = location.state as DocumentOriginState | null;
  if (fromBookingId) {
    return {
      fromBookingId,
      ...(currentState?.navPath?.startsWith(`${prefix}/`) ? { navPath: currentState.navPath } : {}),
      ...(currentState ? { returnState: currentState } : {}),
    };
  }

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const isInvoicePage = location.pathname === `${prefix}/documents/invoices` || location.pathname.startsWith(`${prefix}/documents/invoices/`);
  const isTaxInvoicePage = location.pathname === `${prefix}/documents/tax-invoices` || location.pathname.startsWith(`${prefix}/documents/tax-invoices/`);

  // Tax-invoice registers are secondary archive routes in both portals, so
  // their detail pages keep Invoices & Payments selected in primary nav.
  const isBookingPage = location.pathname.startsWith(`${prefix}/bookings/`);
  const defaultNavPath = isTaxInvoicePage
    ? documentListPath(portal, "invoices")
    : isInvoicePage
      ? documentListPath(portal, "invoices")
      : isBookingPage ? undefined : location.pathname;
  const returnLabel = isInvoicePage
    ? location.pathname === `${prefix}/documents/invoices` ? "Invoices & Payments" : "Invoice"
    : isTaxInvoicePage
      ? location.pathname === `${prefix}/documents/tax-invoices` ? "Tax invoice register" : "Tax Invoice"
      : isBookingPage ? "Booking" : undefined;

  const inheritedNavPath = currentState?.navPath?.startsWith(`${prefix}/`) ? currentState.navPath : undefined;
  return {
    ...(currentState?.fromBookingId ? { fromBookingId: currentState.fromBookingId } : {}),
    ...((inheritedNavPath ?? defaultNavPath) ? { navPath: inheritedNavPath ?? defaultNavPath } : {}),
    returnTo,
    ...(returnLabel ? { returnLabel } : {}),
    ...(currentState ? { returnState: currentState } : {}),
  };
}

// fromBookingId used to only exist on useOpenInvoice — useOpenQuotation had
// no way to carry it at all, which meant a quotation opened from inside a
// booking's Documents card could never override the sidebar the way an
// invoice opened the same way already could. Client-side this never showed
// up as a bug (quotations have no standalone list to wrongly default to —
// see CLIENT_NAV_SECTIONS's own comment in Sidebar.tsx), but ops's
// Quotations list means ops needs the same override invoices already get.
export function useOpenQuotation() {
  const navigate = useNavigate();
  const location = useLocation();
  return (quotationId: string, fromBookingId?: string) => {
    const portal = isOpsPortal(location.pathname) ? "ops" : "portal";
    const path = documentDetailPath(portal, "quotations", quotationId);
    navigate(path, { state: documentOriginState(location, portal, fromBookingId) });
  };
}

export function useOpenInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  return (invoiceId: string, fromBookingId?: string) => {
    const portal = isOpsPortal(location.pathname) ? "ops" : "portal";
    const path = documentDetailPath(portal, "invoices", invoiceId);
    navigate(path, { state: documentOriginState(location, portal, fromBookingId) });
  };
}

// Used to be client-only (a tax invoice had no ops-side detail page) — now
// portal-aware like its two siblings above, now that OpsTaxInvoiceDetail.tsx
// exists. It also records the current invoice/list URL for a context-aware
// Back action.
export function useOpenTaxInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  return (taxInvoiceId: string, fromBookingId?: string) => {
    const ops = isOpsPortal(location.pathname);
    const path = documentDetailPath(ops ? "ops" : "portal", "tax-invoices", taxInvoiceId);
    const state = documentOriginState(location, ops ? "ops" : "portal", fromBookingId);
    navigate(path, { state });
  };
}

// Opens a related booking without losing the workspace that led to it.
// Callers outside the document graph supply their own stable sidebar owner
// (Vehicles, Driver Roster, Calendar, etc.); direct booking list rows should
// continue using their normal route because that list already is the
// booking's canonical home.
export function useOpenBookingFromContext() {
  const navigate = useNavigate();
  const location = useLocation();

  return (bookingId: string, options: BookingOriginOptions = {}) => {
    const portal = isOpsPortal(location.pathname) ? "ops" : "portal";
    const path = `/${portal}/bookings/${bookingId}`;
    if (options.preserveOrigin === false) {
      navigate(path);
      return;
    }

    const prefix = portal === "ops" ? "/ops/" : "/portal/";
    const returnTo = options.returnTo ?? `${location.pathname}${location.search}${location.hash}`;
    const navPath = options.navPath?.startsWith(prefix) ? options.navPath : undefined;
    navigate(path, {
      state: {
        ...(returnTo.startsWith(prefix) ? { returnTo } : {}),
        ...(options.returnLabel ? { returnLabel: options.returnLabel } : {}),
        ...(navPath ? { navPath } : {}),
        ...(location.state ? { returnState: location.state } : {}),
      },
    });
  };
}

export function useOpenBookingFromDocument() {
  const location = useLocation();
  const bookings = useBookings();
  const openBooking = useOpenBookingFromContext();

  return (bookingId: string, options: Pick<BookingOriginOptions, "preserveOrigin"> = {}) => {
    if (options.preserveOrigin === false) {
      openBooking(bookingId, options);
      return;
    }

    const portal = isOpsPortal(location.pathname) ? "ops" : "portal";
    const prefix = portal === "ops" ? "/ops" : "/portal";
    const state = location.state as DocumentOriginState | null;
    const inheritedNavPath = state?.navPath?.startsWith(`${prefix}/`) ? state.navPath : undefined;
    const fromBookingNavPath = state?.fromBookingId
      ? bookingNavPath(state.fromBookingId, bookings, portal === "ops" ? "ops" : "client")
      : undefined;
    const targetBookingNavPath = bookingNavPath(bookingId, bookings, portal === "ops" ? "ops" : "client");

    const isInvoice = location.pathname.startsWith(`${prefix}/documents/invoices/`);
    const isQuotation = location.pathname.startsWith(`${prefix}/documents/quotations/`);
    const isTaxInvoice = location.pathname.startsWith(`${prefix}/documents/tax-invoices/`);
    const returnLabel = isInvoice ? "Invoice" : isQuotation ? "Quotation" : isTaxInvoice ? "Tax Invoice" : "Document";
    const canonicalDocumentNavPath = isInvoice || isTaxInvoice
      ? `${prefix}/documents/invoices`
      : isQuotation && portal === "ops"
        ? "/ops/requests"
        : targetBookingNavPath;

    openBooking(bookingId, {
      returnLabel,
      navPath: inheritedNavPath ?? fromBookingNavPath ?? canonicalDocumentNavPath,
    });
  };
}
