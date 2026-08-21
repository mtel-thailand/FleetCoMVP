// Shared client-account store — same reasoning as vehiclesStore.ts. Client
// Accounts (rate cards, contract status, users) can now be edited by
// FleetCo staff, and needs to be live everywhere a client org is read from
// (RequestInbox's client lookup, the client portal's own rate card, etc.)
import { useEffect, useState } from "react";
import { mockClients, mockClientUsers, type ClientAccount, type ClientUser } from "@/app/data/clients";
import { loadPersisted, savePersisted, subscribePersisted } from "@/app/lib/persistence";

type Listener = () => void;

let clients: ClientAccount[] = loadPersisted("clients", [...mockClients]);
let clientUsers: ClientUser[] = loadPersisted("clientUsers", [...mockClientUsers]);
const listeners = new Set<Listener>();

function notify() {
  savePersisted("clients", clients);
  savePersisted("clientUsers", clientUsers);
  listeners.forEach((l) => l());
}

// Cross-tab live sync — see persistence.ts. Two independent keys, since
// clients and clientUsers are two independent arrays here.
subscribePersisted<ClientAccount[]>("clients", (value) => {
  clients = value;
  notify();
});
subscribePersisted<ClientUser[]>("clientUsers", (value) => {
  clientUsers = value;
  notify();
});

export function getClients(): ClientAccount[] {
  return clients;
}

export function addClient(client: ClientAccount) {
  clients = [client, ...clients];
  notify();
}

export function updateClient(id: string, patch: Partial<ClientAccount>) {
  clients = clients.map((c) => (c.id === id ? { ...c, ...patch } : c));
  notify();
}

export function getClientUsers(): ClientUser[] {
  return clientUsers;
}

export function addClientUser(user: ClientUser) {
  clientUsers = [user, ...clientUsers];
  notify();
}

export function updateClientUser(id: string, patch: Partial<ClientUser>) {
  clientUsers = clientUsers.map((u) => (u.id === id ? { ...u, ...patch } : u));
  notify();
}

/** Demo-only: restores this store to its seeded state. See resetDemoData.ts. */
export function resetClients(): void {
  clients = [...mockClients];
  clientUsers = [...mockClientUsers];
  notify();
}

export function useClients(): ClientAccount[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return clients;
}

export function useClientUsers(): ClientUser[] {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return clientUsers;
}
