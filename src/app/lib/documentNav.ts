import { useNavigate, useLocation } from "react-router";

// Cross-page navigation to a specific document or booking. Quotations,
// invoices, and bookings all have a real routed :id page now, on both
// portals, so "open this one" is just a navigate — no sessionStorage
// handoff, no mount-effect on the destination page to consume it. A
// document always knows its own bookingId, and a booking's DocumentChain
// always knows each document's id, so neither direction needs to track
// "where did I come from" to find its way there — it's a plain graph edge,
// looked up fresh each time. All three "open a document" hooks below
// optionally carry an origin booking id, not to navigate (the destination
// is the same either way) but purely so Sidebar.tsx can tell a document
// opened from its own booking's page apart from one opened from that
// document type's own standalone list — see each route's resolveNavPath
// handle in routes.tsx for the default it overrides.

function isOpsPortal(pathname: string) {
  return pathname.startsWith("/ops");
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
    const path = isOpsPortal(location.pathname) ? `/ops/documents/quotations/${quotationId}` : `/portal/documents/quotations/${quotationId}`;
    navigate(path, fromBookingId ? { state: { fromBookingId } } : undefined);
  };
}

export function useOpenInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  return (invoiceId: string, fromBookingId?: string) => {
    const path = isOpsPortal(location.pathname) ? `/ops/documents/invoices/${invoiceId}` : `/portal/documents/invoices/${invoiceId}`;
    navigate(path, fromBookingId ? { state: { fromBookingId } } : undefined);
  };
}

// Used to be client-only (a tax invoice had no ops-side detail page) — now
// portal-aware like its two siblings above, now that OpsTaxInvoiceDetail.tsx
// exists.
export function useOpenTaxInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  return (taxInvoiceId: string, fromBookingId?: string) => {
    const path = isOpsPortal(location.pathname) ? `/ops/documents/tax-invoices/${taxInvoiceId}` : `/portal/documents/tax-invoices/${taxInvoiceId}`;
    navigate(path, fromBookingId ? { state: { fromBookingId } } : undefined);
  };
}

export function useOpenBookingFromDocument() {
  const navigate = useNavigate();
  const location = useLocation();
  return (bookingId: string) => {
    navigate(isOpsPortal(location.pathname) ? `/ops/bookings/${bookingId}` : `/portal/bookings/${bookingId}`);
  };
}
