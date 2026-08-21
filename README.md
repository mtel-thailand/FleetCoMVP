# FleetCo Platform

B2B fleet management platform (vehicle rental with dedicated drivers) — two
portals sharing one data model:

- **FleetCo Operations Portal** (`/ops/*`) — internal staff: bookings, fleet,
  drivers, clients, the document chain, vehicle financing.
- **Client Self-Service Portal** (`/portal/*`) — Thailand Post (launch client):
  request vehicles, track rentals, handle quotations/invoices.

Seeded from the [FleetCMS](../FleetCMS) (ThaiPass CMS) codebase — the ui kit,
layout shell, auth/role pattern, THB formatters, and data-file convention
were carried over; everything domain-specific (booking state machine,
vehicles/drivers/clients/quotations/invoices/tax invoices/financing) is new.
See `src/app/data/` for the shared mock domain layer both portals read from.

## Running the code

```bash
npm i
npm run dev
```

Demo login: any username, password `1234`, then pick a role from either the
"FleetCo Team" or "Thailand Post — Client Portal" group to see that side.

## Status

Scaffold + shared domain layer are in place; every nav item routes to a real
page, but most are still `StubPage` placeholders (see the two-portal route
list in `src/app/routes.tsx`) — screens get built out next, starting with
vehicle + driver assignment on a booking.
