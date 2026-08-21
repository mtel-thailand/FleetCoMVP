// Thailand Post is the only client on the platform at launch (brief §1) — the
// client portal operates as this client's users. A real build would resolve
// this from the authenticated account, not a constant. Centralized here so
// the growing set of client-portal pages (My Rentals, Request a Vehicle,
// the document inboxes, Dashboard, Billing History) share one definition
// instead of each re-declaring it.
import { mockClients, mockClientUsers } from "@/app/data/clients";
import { getAdminRole } from "@/app/lib/auth";

export const CLIENT_ID = "CLI-001";

export function getCurrentClient() {
  return mockClients.find((c) => c.id === CLIENT_ID)!;
}

/** The signed-in client user, matched by role; falls back to the requester. */
export function getCurrentClientUser() {
  const role = getAdminRole();
  return (
    mockClientUsers.find((u) => u.clientId === CLIENT_ID && u.role === role) ??
    mockClientUsers.find((u) => u.clientId === CLIENT_ID && u.role === "client_requester")
  );
}
