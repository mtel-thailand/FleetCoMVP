# FleetCo Design System — handoff notes

This file is the component inventory and the record of design decisions that
are **not** visible from a screenshot. It is written for the engineer who will
rebuild this against a real backend, and for the designer who will keep
extending the prototype.

The short version: the token layer and the domain components were already
strong. What was missing was the layer in between — the styled primitives —
so that work leaked into ~190 hand-written class strings. This document
records what has been consolidated, what has not, and which open questions
need a designer's answer rather than an engineer's guess.

---

## 1. The three layers

| Layer | What it is | Where it lives | Rule |
| --- | --- | --- | --- |
| **1 — Behavioural primitives** | Focus traps, keyboard nav, portals, ARIA wiring | Radix (`@radix-ui/react-dialog`, `react-select`) | **Never hand-roll.** Invisible in a screenshot, expensive to get right. |
| **2 — Styled primitives** | Button, Input, Textarea, Label | `components/ui/Button.tsx`, `Input.tsx`, `Label.tsx` | **We own these.** They *are* the spec — read the file, not a Figma frame. |
| **3 — Domain components** | StatusBadge, DocumentChain, RentalTimeline, InvoiceProgress, … | `components/ui/*.tsx` (PascalCase) | **Always custom.** No library has these; they encode FleetCo's product decisions. |

Layer 2 did not exist before this pass. That is why the same button was
written 17 different ways — there was no name to reuse, only a string to
copy.

---

## 2. Component inventory

`src/app/components/ui/` contains exactly the app's vocabulary and nothing
else. 48 unused vendored shadcn files were deleted; the directory went from
68 files to 23.

**Behavioural shell (layer 1)**
- `Modal.tsx` — Radix Dialog wiring behind every modal in the app; exports
  `Modal`, `ModalTitle`, `ModalDescription`, `ModalClose`

**Styled primitives (layer 2)**
- `Button.tsx` — variants: `primary` `outline` `danger` `warning` `ghost` `link` `close`; sizes: `sm` `md` `lg` `toolbar` `icon`
- `Input.tsx` — exports `Input` and `Textarea`, both with an `invalid` state
- `Label.tsx`

**Shared list-page state**
- `hooks/useTableState.ts` — filters + sort + page for all eight list pages

**Domain components (layer 3) — unchanged, deliberately**
`ActionModal` (built on `Modal`) `DocumentChain` `EmptyState` `FilterBar` `FilterDropdown`
`FilterTabs` `FormSelect` `InvoiceProgress` `MarkPaidForm` `ReasonForm`
`RentalTimeline` `SignaturePad` `SortIndicator` `StatTile` `StatusBadge`
`TablePagination`

**Vendored, kept (only 2 survived)**
- `select.tsx` — wraps `@radix-ui/react-select`
- `calendar.tsx` — wraps `react-day-picker`. It previously imported the
  vendored shadcn `button.tsx`; the two variants it needed are now inlined at
  the top of the file as `DP_*` constants so the date picker renders
  identically without keeping 44 dead files alive for it. This is vendored
  styling and is deliberately *not* routed through our `Button` — Button
  encodes FleetCo's decisions, react-day-picker's internals are not one.

---

## 3. Migration status — partial, and that is the honest number

The primitives exist and are wired to the tokens. Call sites are **partly**
migrated. Anything still hand-written is not broken, it just has not been
named yet.

| Element | Using the primitive | Still hand-written | Done |
| --- | --- | --- | --- |
| Button | 75 | 113 | 40% |
| Input | 33 | 18 | 65% |
| Label | 46 | 13 | 78% |
| Textarea | 6 | 3 | 67% |

What was migrated: every button, input and label whose class string exactly
matched a known pattern. What was not, and why:

1. **Conditional class strings** (~34 buttons) — `className={\`... ${isActive ? A : B}\`}`.
   Whether that conditional is a *variant* (belongs in `Button.tsx`) or a
   genuine one-off is a design decision, not a mechanical one. Examples:
   `FilterTabs`, `FormSelect`, `TablePagination` page numbers,
   `SignaturePad`'s draw/type/upload mode switch.
2. **Controls that are not buttons in the design sense** — the toggle switch
   in `ClientAccounts` (`w-9 h-5 rounded-full`), the signature-pad canvas
   controls, the login submit (`h-12 rounded-xl`, the only `rounded-xl`
   control in the app).
3. **Buttons inside domain components** (21) — `FilterBar`, `TablePagination`
   etc. have their own internal controls. Migrating them is safe but should
   follow a decision on whether their look is "a Button" or "part of that
   component's own identity".

To continue: match a hand-written class string against the variant table in
`Button.tsx`. If it maps cleanly, convert. If it does not, that is a new
variant — add it to `Button.tsx` with a comment saying where it is used, so
the next person inherits a decision instead of a mystery.

---

## 4. Intentional behaviour changes

Everything else in this pass renders pixel-identically. These are real,
deliberate normalisations of drift found in the audit:

1. **Outline button hover fill.** Was three different values —
   `hover:bg-slate-50` (10 uses), `hover:bg-white` (6), `hover:bg-slate-100` (2).
   Now uniformly `slate-50`. Six buttons hover slightly differently than before.
2. **Destructive button colour.** Was `rose-600/700` (2) and `rose-500/600` (1).
   Now uniformly `rose-600/700` — the darker pair, the one used inside modals
   where the confirm button carries the most weight.

Both are recorded in comments in `Button.tsx`. If either is wrong, change the
variant in one place.

3. **`Button` applies `transition-colors` uniformly**, which about half the
   original buttons did not have. Hover now fades rather than snaps. Reverse it
   in the `cva` base if that is not wanted.
4. **All eight list pages now remember their filters** across navigation, where
   five previously forgot them — see §4a for why, and for the empty-search-box
   bug that change surfaced.
5. **The pinned action column now follows row hover.** Seven tables have both a
   hoverable row and a `sticky right-0` action cell. The row went `slate-50` on
   hover while the pinned cell stayed `bg-white`, leaving a visible white notch
   at the right edge of the hovered row. Rows are now marked `group` and the
   pinned cell carries `group-hover:bg-slate-50`. Applied to all seven at once
   rather than to the one table that prompted it — fixing it in a single place
   would have created new drift instead of removing it.

---

## 4a. List pages: one hook, and the drift it exposed

Eight list pages (All Requests, All Rentals, Invoices, Quotations, Tax
Invoices, Vehicles, Driver Roster, Client Accounts) each spelled out their own
filter + sort + page state. Consolidating them into `useTableState` was worth
doing for the handoff more than for the line count: the copies had drifted in
ways nothing in the code explained, so a reader could not tell design decision
from accident.

**What the drift actually was:**

1. **Three pages persisted their filters, five did not.** All Requests, All
   Rentals and Invoices used `usePersistentListState`, so filtering a list,
   clicking into a row and pressing Back returned you to your filter. The other
   five used plain `useState` and silently forgot everything. Same interaction,
   two behaviours, no stated reason — and `usePersistentListState`'s own header
   comment argues the persisted one is correct ("the user didn't do anything to
   *clear* their filter, the page just forgot it existed"). **All eight now
   persist.** This is the third intentional behaviour change in this pass.
2. **`setPage(1)` was hand-written at ~30 filter-change call sites.** Every one
   is a chance to forget, and forgetting strands the user on an empty page 3 of
   a now-2-row result. `setFilter` resets the page itself; all 30 manual calls
   are gone.

**A bug this surfaced.** `FilterBar`'s search box is uncontrolled — it seeds
from a `defaultSearch` prop on mount. Only the three already-persisting pages
passed it. The moment the other five started persisting, they came back from a
row click showing an *empty search box over a filtered table* — rows silently
missing with no visible cause. All eight now pass `defaultSearch`. Worth
remembering if another list page is added: persisting the value and restoring
the input are two separate steps.

**Deliberately kept per-page:** the default sort direction when switching
columns (`defaultDirFor`). A status column reads best ascending, a due date
ascending, a created date descending. That is a real design difference, so it
stays a per-page argument instead of being averaged into one global default.

**Deliberately not persisted:** the page number, carried over verbatim from
All Requests' original reasoning — it is a scroll-position-like detail rather
than a chosen view, and re-deriving it against a row count that can shrink is
more likely to strand it out of range than to help.

## 4b. `ReadyToIssueTable` — how one table differed, and what was done

`OpsInvoices`'s "Ready to Issue" sub-table was audited against the app's other
thirteen list tables. Four differences, handled differently:

| Difference | Verdict |
| --- | --- |
| Row was not clickable — only the ID text opened the booking, with no row hover | **Fixed.** Every other list opens the record from anywhere in the row. |
| Pinned action cell did not follow row hover | **Fixed app-wide** (§4, item 5) — all seven affected tables. |
| No sortable columns at all | **Left as-is.** Defensible for a work queue, but undeclared — see below. |
| Class-order drift (`overflow-hidden rounded-xl … bg-white` vs the other 18's `bg-white rounded-xl … overflow-hidden`) | **Left as-is.** Renders identically. |

**On the row click**, the ID stays a real `<button>` instead of becoming plain
styled text like the other tables. A clickable `<tr>` is not reachable by
keyboard, so those thirteen tables are effectively mouse-only for opening a
record. Keeping the button gives this one both — click anywhere with a mouse,
and a proper tab stop for keyboard and screen-reader users. **That is the
pattern the other thirteen should adopt, not the reverse.** The button
stops propagation so the row handler does not also fire.

**Still open — a rule worth stating:** is "work queues are not sortable" a
deliberate convention? If so it should apply to the other queue-shaped tables
too, and be written down. Right now it is a single table with no sort headers
and no stated reason, which reads as an omission rather than a decision.

**A correction to an earlier draft of these notes:** it was previously recorded
here that six sticky action columns were missing an `aria-label`. That was
wrong — those six columns contain a visible "Status" heading and need no label.
`ReadyToIssueTable`'s is the app's only genuinely blank action header, and it
already carries `aria-label="Invoice action"`. No work was needed.

## 5. Accessibility: every modal now sits on Radix

All 18 hand-rolled `fixed inset-0` overlays have been migrated. Measured in the
browser, every one of them previously had:

| | Before | After |
| --- | --- | --- |
| `role="dialog"` | ✗ | ✓ |
| Accessible name (`aria-labelledby`) | ✗ | ✓ |
| Focus moved into dialog on open | ✗ (stayed on the trigger behind the overlay) | ✓ |
| Focus trapped while open | ✗ (all background controls tabbable) | ✓ |
| `Escape` closes | ✗ (no key handling existed anywhere) | ✓ |
| Focus returned to trigger on close | ✗ | ✓ |
| Background hidden from screen readers | ✗ | ✓ |
| Scroll lock compensates for scrollbar width | ✗ (page nudged sideways on open) | ✓ |

### The split: Modal vs ActionModal

`Modal.tsx` owns **only behaviour** — layer 1. It exists because the 18
overlays do not share a look: widths run `sm:max-w-sm` to `sm:max-w-4xl`, radii
are `rounded-xl` / `rounded-2xl` / a `rounded-t-2xl` bottom sheet, some own
their header and footer while others are bare wrappers around `ReasonForm` /
`MarkPaidForm`, and `LoginPage`'s carries a `data-portal` attribute that drives
its own accent theming. Forcing them through one presentational shell would
have meant redesigning them. So `Modal` takes `overlayClassName` and
`contentClassName` and each call site keeps its exact original classes —
every migrated overlay renders identically.

`ActionModal` is now a thin presentational layer on top of `Modal` (titled
header bar + dismiss X + scrollable body) and keeps its original API.

`@radix-ui/react-dialog` was **already in `package.json`** — installed, unused.

### Three things worth knowing before you touch this

1. **Focus return is implemented by hand** in `Modal.tsx`, because every call
   site mounts conditionally (`{showX && <Modal/>}`) rather than keeping the
   modal mounted and toggling `open`. That tears down `Dialog.Root` in the same
   tick Radix would restore focus. The trigger is captured in a `useRef`
   *initialiser* — during render, before Radix moves focus. Moving that into an
   effect will silently break it.
2. **`dismissOnOutsideClick={false}`** on the Vehicles and Driver add/edit
   forms. Those two deliberately had no backdrop `onClick`, so a stray click
   could not discard a half-filled form; Radix would have added that. Escape
   still closes both — that is explicit intent, and neither had it before.
3. **Name the dialog once.** If the content shows a heading, wrap it in
   `<ModalTitle asChild>` and do *not* pass `title`. Passing both makes a
   screen reader announce the same words twice — which is exactly what happened
   on the first pass here and was caught by inspecting the rendered a11y tree.
   Only the two headless wrappers (`ReasonForm`, `MarkPaidForm`) pass `title`.

`useBodyScrollLock` has been deleted — Radix supersedes it, and better.

**One overlay is deliberately not migrated:** the mobile nav scrim in
`Sidebar.tsx`. It is a backdrop for a slide-in `<aside>` navigation, not a
dialog. If it ever needs focus management it should become a Radix drawer, not
an ActionModal.

## 6. Open design decisions

> **Status: mixed.** The **bilingual UI** item is **decided** — a platform-wide
> language toggle, English default, Thai second. Everything else in this
> section is the author's recommended default, recorded so this handoff states
> a position rather than leaving it implied by absence, and is **not** yet
> signed off. Confirm the rest before build starts.

**Responsive — proposed: ops desktop-only, client portal responsive.**
25 of 39 page files contain zero breakpoints today, and the ones that do have
them are mostly on the client side. Ops staff work at desks against dense
tables; Thailand Post users may well raise a request from a phone. Adopting
this means the ops tables need no responsive work, and the client portal's
request/rental/invoice screens do. If ops ever needs tablet support, that is a
new decision, not an oversight.

**Dark mode — proposed: out of scope for v1.**
`theme.css` already defines the dark token set; only 21 `dark:` usages exist in
components, so it currently reads as abandoned rather than deferred. Keep the
tokens (they cost nothing and preserve the option) but treat dark mode as
explicitly not shipping in v1, so nobody builds against a half-present feature.
Completing it properly needs a real design pass on the dark palette, not a
mechanical sweep.

**Bilingual UI — DECIDED.** A language toggle across the whole platform,
English as default, Thai as the second language. This is a product decision
made by the design owner, not a proposal — it is the one item in this section
that is settled. Everything below follows from it.

*Do not confuse this with the bilingual document layer, which already exists
and is correct.* Tax documents render both languages **simultaneously**
(`Tax ID / เลขผู้เสียภาษี`, `Subtotal / ยอดรวม`) because Thai tax law requires
it, and `legalNameTh`/`legalNameEn` are paired display fields serving that.
None of that is i18n. The toggle is a separate problem: **one** language at a
time, chosen by the user.

What already survives any approach — genuinely valuable, keep it:
`thaiBahtText.ts`, the paired legal-name/address fields, and the
simultaneous-language document templates.

What has to change, in cost order:

1. **Three formatters are locale-hardcoded.** `formatDate` in
   `components/ui/utils.ts` carries `const MONTHS = ["Jan","Feb",…]`, so every
   date in the app is English-only whatever the toggle says; `formatCurrency`
   and `formatNumber` in `data/formatters.ts` both hardcode `"en-US"`. Cheapest
   fix in the list, no visual impact today, and it is a prerequisite for
   everything else. Do this first regardless of when the rest happens.
2. **No string catalogue.** Roughly 101 visible text nodes in the pages alone,
   all inline JSX. **This cost grows with every screen built.** Scaffolding
   `t("key")` with only the English values filled in costs nothing at runtime
   and freezes extraction at today's screen count — strongly preferred over
   waiting until translation actually starts.
3. **English grammar is baked into JSX.** `{quantity === 1 ? "" : "s"}` appears
   in four files; Thai has no plural inflection, so those become dead branches.
   `{start}–{end} of {total}` in `TablePagination` assumes English word order.
4. **No Thai webfont is loaded.** The only `@fontsource` import is Dancing
   Script, for signature rendering. Thai currently falls back to whatever the
   OS provides — inconsistent across platforms and unmatched to the design.
   Needs Sarabun / Noto Sans Thai / IBM Plex Sans Thai at weights matching
   400/500.
5. **Thai typography collides with the type scale (§ below).** Thai stacks
   vowels above and below the baseline with tone marks above those, so it needs
   more line-height than Latin. The app's real scale is `text-[11px]` (114 uses)
   and `text-[10px]` (53); at those sizes Thai tone marks begin to collide or
   clip. **This couples the type-scale decision to the language decision** —
   see below.
6. **Layout is rigid.** 82 hardcoded px column widths, 12 `table-fixed` tables,
   47 `truncate`, 160 `whitespace-nowrap`. Thai UI strings generally run longer
   than English and break differently — no word spaces, so line breaking is
   dictionary-based. Fixed-width truncating columns will clip Thai labels.

**Architecture that fits the idioms already here.** Locale is two mechanisms,
not one:

- *Text* — a small subscribe/notify store plus a `t()` helper. The app already
  has this exact shape eleven times over (`bookingsStore`, `pageHeaderStore`);
  a locale store is the same pattern, and `usePersistentListState`'s
  sessionStorage approach is the right precedent for remembering the choice.
- *Typography* — a `data-locale="th"` attribute on the root wrapper, with the
  Thai font stack and looser line-height defined under `[data-locale="th"]` in
  `theme.css`. This mirrors `data-portal` exactly.

**And it inherits `data-portal`'s known gotcha.** Content rendered through a
React portal is no longer a DOM descendant of the wrapper carrying the
attribute, so it loses it. That has already bitten this codebase twice with
`data-portal` (see `RequestVehicle.tsx`'s note, and `LoginPage`'s modal, which
re-stamps it through `Modal`'s `overlayProps`). Every Radix modal will need
`data-locale` re-stamped the same way. `Modal.tsx` already has the mechanism —
use it rather than rediscovering the bug.

**Type scale — now coupled to the language decision above.**
182 arbitrary pixel values sit below `text-xs`: `text-[11px]` (114),
`text-[10px]` (53), `text-[12px]` (11), `text-[9px]` (3), `text-[8px]` (1). For
a dense B2B tool those sizes are a reasonable choice; the problem is that they
are undeclared, so a reader cannot tell density from drift. Note `text-[12px]`
is identical to `text-xs` — those 11 are pure drift. Declaring `--text-2xs` /
`--text-3xs` in a Tailwind v4 `@theme` block would turn the rest into system,
but check computed `line-height` when doing it: Tailwind's `text-*` utilities
set a line-height and the arbitrary `text-[11px]` form does not, so a naive
swap shifts vertical rhythm.

**Border radius — needs a rule.**
11 values in use, with `rounded-lg` (199) and `rounded-xl` (127) both heavy. A
plausible rule is `lg` for controls and `xl` for containers, which is roughly
what the code already does — but "roughly" is the problem. State it.

**Accessibility beyond modals.**
Modals are now correct (§5). The rest is thin: 85 `aria-` attributes across
~19k lines. Keyboard and screen-reader behaviour is design territory, and code
handoff is the one format where it can be *specified* rather than annotated on
a frame.

## 7. Repo hygiene fixed in this pass

- **TypeScript was never installed.** `strict: true` was set, 180 `.tsx` files
  existed, and nothing had ever typechecked them. Added `typescript` and
  `@types/react`/`@types/react-dom`/`@types/leaflet`, plus a `typecheck`
  script; `build` now runs `tsc --noEmit` first. The first run surfaced 37
  errors, including 8 real `number | null` unsoundnesses in
  `OpsBookingDetailPanel` and two unsafe casts in `Vehicles.tsx`. All fixed;
  the tree is clean.
- **React was declared as an optional peer dependency** — a library manifest,
  not an application one. npm does not install optional peers, so a fresh
  clone was not guaranteed to produce a runnable app. Moved to `dependencies`.
- **Four dependencies with zero imports removed**: `jspdf`, `qrcode`,
  `react-dnd`, `react-dnd-html5-backend`.
- **`.claude/launch.json` pointed at port 5173** while `vite.config.ts` sets
  5175.
- **Case-sensitivity hazard.** macOS is case-insensitive, so a new
  `Button.tsx` silently overwrote the vendored `button.tsx` while git kept
  tracking the lowercase name — which would have broken the Linux build on
  Vercel. Resolved by deleting the vendored file and adding `Button.tsx` as a
  genuinely new path. Worth knowing about before adding any other
  PascalCase file whose lowercase twin exists.

- **`hooks/useBodyScrollLock.ts` deleted** — every caller now gets scroll
  locking from Radix, which also compensates for scrollbar width so opening a
  modal no longer nudges the page sideways.

Deleting the dead shadcn files cut the CSS bundle from **142 kB to 88 kB**
(gzip 27.4 → 20.1). JS was unchanged — tree-shaking already excluded those
components, but Tailwind was still scanning their class names.

---

## 8. Still outstanding

- Migrate the remaining hand-written button/input/label call sites (§3). Modals
  are done (§5) — the only overlay left is the mobile nav scrim, deliberately.
  List pages are done (§4a).
- Answer the open design decisions (§6).
- No linter, no formatter, no tests, no CI. For a handoff artifact these
  matter less than they would in production — but there is now a `typecheck`
  script, which is the one that protects the data contract engineering will
  build its API schema from.
