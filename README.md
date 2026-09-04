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

Demo login: choose FleetCo or Thailand Post, use any username and password
`1234`. The demo signs into that portal's primary admin persona; role and
permission testing is intentionally outside the MVP scope.

## Status

The two MVP hero flows are demoable end to end: request → quotation →
acceptance → assignment, and invoice → payment evidence → verification → tax
invoice. Navigation prioritizes those flows; broader roadmap screens and
role-based access are not part of this MVP review.

Seed dates use a rolling demo timeline. The authored scenario is anchored to
25 August 2026 and shifted as a complete set so that date to the viewer is
always "today". Relationships such as upcoming, overdue, and expired therefore
remain stable without manually moving the data to another year. Saved demo
state lasts through reloads for the current calendar day and refreshes from the
rebased seed on the next day.
